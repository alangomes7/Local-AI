from __future__ import annotations

import asyncio
import gc
import json
import logging
import os
import threading
from typing import Any

import torch
import uvicorn

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from transformers.cli.serving.chat_completion import ChatCompletionHandler
from transformers.cli.serving.completion import CompletionHandler
from transformers.cli.serving.model_manager import ModelManager
from transformers.cli.serving.response import ResponseHandler
from transformers.cli.serving.server import build_server
from transformers.cli.serving.transcription import TranscriptionHandler
from transformers.cli.serving.utils import GenerationState


# ============================================================
# Configuration
# ============================================================

HOST = os.getenv("AI_SERVER_HOST", "0.0.0.0")
PORT = int(os.getenv("AI_SERVER_PORT", "8000"))

MODEL_TIMEOUT = int(
    os.getenv("AI_MODEL_TIMEOUT", "300")
)

ENABLE_CORS = (
    os.getenv("AI_ENABLE_CORS", "true").lower()
    in {"1", "true", "yes", "on"}
)

LOG_LEVEL = os.getenv(
    "AI_LOG_LEVEL",
    "info",
).lower()

DEVICE = os.getenv(
    "AI_DEVICE",
    "auto",
)

DTYPE = os.getenv(
    "AI_DTYPE",
    "auto",
)

TRUST_REMOTE_CODE = (
    os.getenv(
        "AI_TRUST_REMOTE_CODE",
        "false",
    ).lower()
    in {"1", "true", "yes", "on"}
)

CONTINUOUS_BATCHING = (
    os.getenv(
        "AI_CONTINUOUS_BATCHING",
        "false",
    ).lower()
    in {"1", "true", "yes", "on"}
)


# ============================================================
# Logging
# ============================================================

logging.basicConfig(
    level=getattr(
        logging,
        LOG_LEVEL.upper(),
        logging.INFO,
    ),
    format=(
        "%(asctime)s | "
        "%(levelname)s | "
        "%(name)s | "
        "%(message)s"
    ),
)

logger = logging.getLogger(
    "local-ai-server"
)


# ============================================================
# Global state
# ============================================================

model_manager: ModelManager | None = None

generation_state: GenerationState | None = None

chat_handler: ChatCompletionHandler | None = None

completion_handler: CompletionHandler | None = None

response_handler: ResponseHandler | None = None

transcription_handler: TranscriptionHandler | None = None

app: FastAPI | None = None

uvicorn_server: uvicorn.Server | None = None


# ============================================================
# Lifecycle synchronization
# ============================================================

_lifecycle_lock = threading.RLock()


# ============================================================
# Memory cleanup
# ============================================================

def cleanup_memory() -> None:
    logger.info("Running memory cleanup...")

    try:
        collected = gc.collect()

        logger.info(
            "Python garbage collection complete | collected=%d",
            collected,
        )

    except Exception:
        logger.exception(
            "Python garbage collection failed."
        )

    # --------------------------------------------------------
    # CUDA
    # --------------------------------------------------------

    try:
        if torch.cuda.is_available():

            try:
                torch.cuda.empty_cache()
            except Exception:
                logger.exception(
                    "torch.cuda.empty_cache() failed."
                )

            try:
                torch.cuda.ipc_collect()
            except Exception:
                logger.debug(
                    "torch.cuda.ipc_collect() unavailable.",
                    exc_info=True,
                )

            try:
                allocated_mb = (
                    torch.cuda.memory_allocated()
                    // 1024
                    // 1024
                )

                reserved_mb = (
                    torch.cuda.memory_reserved()
                    // 1024
                    // 1024
                )

                logger.info(
                    "CUDA memory | allocated=%d MB | reserved=%d MB",
                    allocated_mb,
                    reserved_mb,
                )

            except Exception:
                logger.debug(
                    "Unable to read CUDA memory statistics.",
                    exc_info=True,
                )

    except Exception:
        logger.exception(
            "CUDA memory cleanup failed."
        )

    # --------------------------------------------------------
    # Apple MPS
    # --------------------------------------------------------

    try:
        if (
            hasattr(torch, "mps")
            and torch.backends.mps.is_available()
        ):
            torch.mps.empty_cache()

            logger.info(
                "MPS cache cleared."
            )

    except Exception:
        logger.exception(
            "MPS memory cleanup failed."
        )


# ============================================================
# Manager helpers
# ============================================================

def get_model_manager() -> ModelManager:
    if model_manager is None:
        raise RuntimeError(
            "ModelManager has not been initialized."
        )

    return model_manager


def get_generation_state() -> GenerationState:
    if generation_state is None:
        raise RuntimeError(
            "GenerationState has not been initialized."
        )

    return generation_state


def canonical_model_name(
    model: str,
) -> str:
    return ModelManager.process_model_name(
        model
    )


# ============================================================
# Loaded models & Memory estimation
# ============================================================

def estimate_model_memory_bytes(model_obj: Any) -> int:
    """Calculates the memory footprint of a loaded model in bytes."""
    if model_obj is None:
        return 0

    target = getattr(model_obj, "model", model_obj)

    # 1. Hugging Face PreTrainedModel footprint
    try:
        if hasattr(target, "get_memory_footprint"):
            footprint = target.get_memory_footprint()
            if isinstance(footprint, (int, float)) and footprint > 0:
                return int(footprint)
    except Exception:
        pass

    # 2. PyTorch parameters and buffers summation
    try:
        total_bytes = 0
        if hasattr(target, "parameters"):
            for p in target.parameters():
                total_bytes += p.nelement() * p.element_size()
        if hasattr(target, "buffers"):
            for b in target.buffers():
                total_bytes += b.nelement() * b.element_size()
        if total_bytes > 0:
            return int(total_bytes)
    except Exception:
        pass

    # 3. Model memory property if available
    try:
        if hasattr(target, "model_memory"):
            val = getattr(target, "model_memory")
            if isinstance(val, (int, float)):
                return int(val)
    except Exception:
        pass

    return 0


def format_memory_size(num_bytes: int) -> str:
    """Formats bytes into a readable string (e.g. 4.2 GB or 850 MB)."""
    if num_bytes <= 0:
        return "0 MB"
    gb = num_bytes / (1024 ** 3)
    if gb >= 1.0:
        return f"{gb:.2f} GB"
    mb = num_bytes / (1024 ** 2)
    return f"{mb:.1f} MB"


def get_system_memory_status() -> dict[str, Any]:
    """
    Returns system and GPU memory status including total, used, available,
    and percentage statistics.
    """
    result: dict[str, Any] = {
        "primary_device": "ram",
        "total_bytes": 0,
        "used_bytes": 0,
        "available_bytes": 0,
        "percentage": 0.0,
        "total_human": "0 MB",
        "used_human": "0 MB",
        "available_human": "0 MB",
        "system_ram": None,
        "gpu": None,
    }

    # 1. System RAM via psutil
    try:
        import psutil
        vm = psutil.virtual_memory()
        total_ram = int(vm.total)
        used_ram = int(vm.used)
        available_ram = int(vm.available)
        free_ram = int(vm.free)
        pct_ram = round(float(vm.percent), 1)

        result["system_ram"] = {
            "total_bytes": total_ram,
            "used_bytes": used_ram,
            "available_bytes": available_ram,
            "free_bytes": free_ram,
            "percentage": pct_ram,
            "total_human": format_memory_size(total_ram),
            "used_human": format_memory_size(used_ram),
            "available_human": format_memory_size(available_ram),
        }
        result["total_bytes"] = total_ram
        result["used_bytes"] = used_ram
        result["available_bytes"] = available_ram
        result["percentage"] = pct_ram
        result["total_human"] = format_memory_size(total_ram)
        result["used_human"] = format_memory_size(used_ram)
        result["available_human"] = format_memory_size(available_ram)
    except Exception:
        logger.exception("Failed to collect system RAM metrics.")

    # 2. GPU / VRAM via PyTorch CUDA
    try:
        if torch.cuda.is_available():
            dev_idx = torch.cuda.current_device() if torch.cuda.device_count() > 0 else 0
            free_b, total_b = torch.cuda.mem_get_info(dev_idx)
            used_b = total_b - free_b
            allocated_b = torch.cuda.memory_allocated(dev_idx)
            reserved_b = torch.cuda.memory_reserved(dev_idx)
            pct_gpu = round(((total_b - free_b) / total_b) * 100, 1) if total_b > 0 else 0.0

            gpu_stats = {
                "device_name": torch.cuda.get_device_name(dev_idx),
                "device_index": dev_idx,
                "total_bytes": total_b,
                "used_bytes": used_b,
                "available_bytes": free_b,
                "allocated_bytes": allocated_b,
                "reserved_bytes": reserved_b,
                "percentage": pct_gpu,
                "total_human": format_memory_size(total_b),
                "used_human": format_memory_size(used_b),
                "available_human": format_memory_size(free_b),
                "allocated_human": format_memory_size(allocated_b),
            }
            result["gpu"] = gpu_stats
            result["primary_device"] = "gpu"
            result["total_bytes"] = total_b
            result["used_bytes"] = used_b
            result["available_bytes"] = free_b
            result["percentage"] = pct_gpu
            result["total_human"] = format_memory_size(total_b)
            result["used_human"] = format_memory_size(used_b)
            result["available_human"] = format_memory_size(free_b)
    except Exception:
        logger.exception("Failed to collect GPU VRAM metrics.")

    return result


def get_loaded_models() -> list[dict[str, Any]]:
    manager = get_model_manager()

    result: list[dict[str, Any]] = []

    with _lifecycle_lock:

        for model_id, timed_model in list(
            manager.loaded_models.items()
        ):

            model_object = getattr(
                timed_model,
                "model",
                None,
            )

            processor_object = getattr(
                timed_model,
                "processor",
                None,
            )

            memory_bytes = estimate_model_memory_bytes(model_object)
            memory_mb = round(memory_bytes / (1024 * 1024), 2)
            memory_human = format_memory_size(memory_bytes)

            result.append(
                {
                    "id": model_id,
                    "loaded": (
                        model_object is not None
                    ),
                    "processor_loaded": (
                        processor_object is not None
                    ),
                    "memory_bytes": memory_bytes,
                    "memory_mb": memory_mb,
                    "memory_human": memory_human,
                    "timeout": getattr(
                        timed_model,
                        "timeout_seconds",
                        None,
                    ),
                }
            )

    return result


# ============================================================
# Explicit model loading
# ============================================================

def load_model(
    model: str,
) -> dict[str, Any]:

    manager = get_model_manager()

    model_id = canonical_model_name(
        model
    )

    logger.info(
        "Explicit model load requested: %s",
        model_id,
    )

    # ModelManager provides per-model synchronization.
    manager.load_model_and_processor(
        model_id
    )

    logger.info(
        "Model loaded successfully: %s",
        model_id,
    )

    return {
        "success": True,
        "model": model_id,
        "loaded": True,
        "message": (
            "Model loaded successfully."
        ),
    }


# ============================================================
# Explicit model unloading
# ============================================================

def unload_model(
    model: str,
) -> dict[str, Any]:

    manager = get_model_manager()

    model_id = canonical_model_name(
        model
    )

    with _lifecycle_lock:

        timed_model = (
            manager.loaded_models.get(
                model_id
            )
        )

        if timed_model is None:

            logger.info(
                "Unload requested for model "
                "not loaded: %s",
                model_id,
            )

            return {
                "success": True,
                "model": model_id,
                "loaded": False,
                "unloaded": False,
                "message": (
                    "Model was not loaded."
                ),
            }

        logger.info(
            "Explicit unload requested: %s",
            model_id,
        )

        try:

            timed_model.delete_model()

            # delete_model() normally triggers
            # the ModelManager callback that removes
            # the entry. We also remove it defensively.

            manager.loaded_models.pop(
                model_id,
                None,
            )

        except Exception as exc:

            logger.exception(
                "Failed to unload model: %s",
                model_id,
            )

            raise RuntimeError(
                f"Failed to unload model "
                f"'{model_id}': {exc}"
            ) from exc

        cleanup_memory()

        logger.info(
            "Model unloaded successfully: %s",
            model_id,
        )

        return {
            "success": True,
            "model": model_id,
            "loaded": False,
            "unloaded": True,
            "message": (
                "Model unloaded successfully."
            ),
        }


# ============================================================
# Unload all
# ============================================================

def unload_all_models() -> dict[str, Any]:

    manager = get_model_manager()

    with _lifecycle_lock:

        model_ids = list(
            manager.loaded_models.keys()
        )

        logger.info(
            "Unload-all requested | models=%d",
            len(model_ids),
        )

        unloaded: list[str] = []

        failed: list[dict[str, str]] = []

        for model_id in model_ids:

            timed_model = (
                manager.loaded_models.get(
                    model_id
                )
            )

            if timed_model is None:
                continue

            try:

                logger.info(
                    "Unloading model: %s",
                    model_id,
                )

                timed_model.delete_model()

                manager.loaded_models.pop(
                    model_id,
                    None,
                )

                unloaded.append(
                    model_id
                )

            except Exception as exc:

                logger.exception(
                    "Failed to unload model: %s",
                    model_id,
                )

                failed.append(
                    {
                        "model": model_id,
                        "error": str(exc),
                    }
                )

        cleanup_memory()

        success = not failed

        logger.info(
            "Unload-all complete | "
            "unloaded=%d | failed=%d",
            len(unloaded),
            len(failed),
        )

        return {
            "success": success,
            "unloaded": unloaded,
            "failed": failed,
            "count": len(unloaded),
            "message": (
                "All models unloaded successfully."
                if success
                else "Some models could not be unloaded."
            ),
        }


# ============================================================
# Custom routes
# ============================================================

def add_custom_routes(
    application: FastAPI,
) -> None:

    # --------------------------------------------------------
    # Loaded models
    # --------------------------------------------------------

    @application.get(
        "/v1/models/loaded"
    )
    async def loaded_models_endpoint():

        try:

            models = await asyncio.to_thread(
                get_loaded_models
            )

            total_memory_bytes = sum(m.get("memory_bytes", 0) for m in models)
            memory_status = await asyncio.to_thread(
                get_system_memory_status
            )

            return {
                "object": "list",
                "data": models,
                "count": len(models),
                "total_memory_bytes": total_memory_bytes,
                "total_memory_human": format_memory_size(total_memory_bytes),
                "memory_status": memory_status,
            }

        except Exception as exc:

            logger.exception(
                "Failed to inspect loaded models."
            )

            raise HTTPException(
                status_code=500,
                detail=str(exc),
            ) from exc

    # --------------------------------------------------------
    # System and GPU Memory
    # --------------------------------------------------------

    @application.get(
        "/v1/system/memory"
    )
    async def system_memory_endpoint():

        try:

            status = await asyncio.to_thread(
                get_system_memory_status
            )

            models = await asyncio.to_thread(
                get_loaded_models
            )

            total_model_bytes = sum(m.get("memory_bytes", 0) for m in models)
            status["models_memory_bytes"] = total_model_bytes
            status["models_memory_human"] = format_memory_size(total_model_bytes)

            return status

        except Exception as exc:

            logger.exception(
                "Failed to retrieve system memory status."
            )

            raise HTTPException(
                status_code=500,
                detail=str(exc),
            ) from exc

    # --------------------------------------------------------
    # Explicit load
    # --------------------------------------------------------

    @application.post(
        "/load_model"
    )
    async def load_model_endpoint(
        body: dict[str, Any],
    ):

        model = body.get("model")

        if (
            not isinstance(model, str)
            or not model.strip()
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Valid `model` string required."
                ),
            )

        try:

            result = await asyncio.to_thread(
                load_model,
                model.strip(),
            )

            return JSONResponse(
                content=result
            )

        except Exception as exc:

            logger.exception(
                "Failed to load model: %s",
                model,
            )

            raise HTTPException(
                status_code=500,
                detail=str(exc),
            ) from exc

    # --------------------------------------------------------
    # Unload one
    # --------------------------------------------------------

    @application.post(
        "/v1/models/unload"
    )
    async def unload_endpoint(
        body: dict[str, Any],
    ):

        model = body.get("model")

        if (
            not isinstance(model, str)
            or not model.strip()
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Valid `model` string required."
                ),
            )

        try:

            result = await asyncio.to_thread(
                unload_model,
                model.strip(),
            )

            return JSONResponse(
                content=result
            )

        except Exception as exc:

            logger.exception(
                "Failed to unload model."
            )

            raise HTTPException(
                status_code=500,
                detail=str(exc),
            ) from exc

    # --------------------------------------------------------
    # Unload all
    # --------------------------------------------------------

    @application.post(
        "/v1/models/unload-all"
    )
    async def unload_all_endpoint():

        try:

            result = await asyncio.to_thread(
                unload_all_models
            )

            return JSONResponse(
                content=result,
                status_code=(
                    200
                    if result["success"]
                    else 207
                ),
            )

        except Exception as exc:

            logger.exception(
                "Unload-all failed."
            )

            raise HTTPException(
                status_code=500,
                detail=str(exc),
            ) from exc

    # --------------------------------------------------------
    # Alias
    # --------------------------------------------------------

    @application.post(
        "/unload-all"
    )
    async def unload_all_alias():

        result = await asyncio.to_thread(
            unload_all_models
        )

        return JSONResponse(
            content=result,
            status_code=(
                200
                if result["success"]
                else 207
            ),
        )


# ============================================================
# Route diagnostics
# ============================================================

def log_registered_routes(
    application: FastAPI,
) -> None:

    logger.info("")
    logger.info(
        "=" * 72
    )
    logger.info(
        "REGISTERED API ROUTES"
    )
    logger.info(
        "=" * 72
    )

    for route in application.routes:

        path = getattr(
            route,
            "path",
            "",
        )

        methods = getattr(
            route,
            "methods",
            set(),
        )

        method_text = (
            ",".join(
                sorted(methods)
            )
            if methods
            else ""
        )

        logger.info(
            "%-12s %s",
            method_text,
            path,
        )

    logger.info(
        "=" * 72
    )


# ============================================================
# Application construction
# ============================================================

def create_server() -> FastAPI:

    global model_manager
    global generation_state
    global chat_handler
    global completion_handler
    global response_handler
    global transcription_handler

    logger.info(
        "Creating standalone "
        "Transformers 5.16.1 server..."
    )

    logger.info(
        "Python executable: %s",
        os.sys.executable,
    )

    logger.info(
        "Python version: %s",
        os.sys.version.split()[0],
    )

    logger.info(
        "Server file: %s",
        os.path.abspath(__file__),
    )

    # --------------------------------------------------------
    # Model manager
    #
    # This is the same component used internally by
    # Transformers Serve, but we construct it directly so
    # Transformers does NOT start its own Uvicorn server.
    # --------------------------------------------------------

    model_manager = ModelManager(
        device=DEVICE,
        dtype=DTYPE,
        trust_remote_code=TRUST_REMOTE_CODE,
        model_timeout=MODEL_TIMEOUT,
    )

    # --------------------------------------------------------
    # Generation state
    # --------------------------------------------------------

    generation_state = GenerationState(
        continuous_batching=CONTINUOUS_BATCHING,
    )

    # --------------------------------------------------------
    # Request handlers
    # --------------------------------------------------------

    chat_handler = ChatCompletionHandler(
        model_manager=model_manager,
        generation_state=generation_state,
        chat_template_kwargs={},
    )

    completion_handler = CompletionHandler(
        model_manager=model_manager,
        generation_state=generation_state,
    )

    response_handler = ResponseHandler(
        model_manager=model_manager,
        generation_state=generation_state,
        chat_template_kwargs={},
    )

    transcription_handler = (
        TranscriptionHandler(
            model_manager,
            generation_state,
        )
    )

    # --------------------------------------------------------
    # Official Transformers FastAPI app
    # --------------------------------------------------------

    application = build_server(
        model_manager,
        chat_handler,
        completion_handler,
        response_handler,
        transcription_handler,
        generation_state=generation_state,
        enable_cors=False,
    )

    # --------------------------------------------------------
    # CORS
    # --------------------------------------------------------

    if ENABLE_CORS:

        application.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        logger.warning(
            "CORS allow_origins=['*'] enabled."
        )

    # --------------------------------------------------------
    # Custom lifecycle routes
    # --------------------------------------------------------

    add_custom_routes(
        application
    )

    # --------------------------------------------------------
    # Diagnostics
    # --------------------------------------------------------

    log_registered_routes(
        application
    )

    # --------------------------------------------------------
    # Required route verification
    # --------------------------------------------------------

    required_routes = {
        "/health",
        "/v1/models",
        "/v1/chat/completions",
        "/v1/completions",
        "/v1/responses",
        "/v1/audio/transcriptions",
        "/load_model",
        "/v1/models/loaded",
        "/v1/models/unload",
        "/v1/models/unload-all",
        "/unload-all",
    }

    registered_paths = {
        getattr(
            route,
            "path",
            "",
        )
        for route in application.routes
    }

    missing = (
        required_routes
        - registered_paths
    )

    if missing:

        raise RuntimeError(
            "Required routes missing: "
            + ", ".join(
                sorted(missing)
            )
        )

    logger.info(
        "All required API routes registered."
    )

    return application


# ============================================================
# Shutdown
# ============================================================

def shutdown_server() -> None:

    global model_manager
    global generation_state

    logger.info(
        "Beginning server shutdown..."
    )

    with _lifecycle_lock:

        # ----------------------------------------------------
        # Generation state
        # ----------------------------------------------------

        if generation_state is not None:

            try:

                generation_state.shutdown()

                logger.info(
                    "Generation state shut down."
                )

            except Exception:

                logger.exception(
                    "Failed to shut down generation state."
                )

        # ----------------------------------------------------
        # Models
        # ----------------------------------------------------

        if model_manager is not None:

            try:

                model_manager.shutdown()

                logger.info(
                    "Model manager shut down."
                )

            except Exception:

                logger.exception(
                    "Failed to shut down model manager."
                )

    cleanup_memory()

    logger.info(
        "Server stopped."
    )


# ============================================================
# Main
# ============================================================

def main() -> None:

    global app
    global uvicorn_server

    logger.info("")
    logger.info(
        "=" * 72
    )
    logger.info(
        "LOCAL TRANSFORMERS AI SERVER"
    )
    logger.info(
        "=" * 72
    )

    logger.info(
        "Transformers: 5.16.1"
    )

    logger.info(
        "Python:       %s",
        os.sys.version.split()[0],
    )

    logger.info(
        "Executable:   %s",
        os.sys.executable,
    )

    logger.info(
        "Server file:  %s",
        os.path.abspath(__file__),
    )

    logger.info(
        "Host:         %s",
        HOST,
    )

    logger.info(
        "Port:         %d",
        PORT,
    )

    logger.info(
        "Device:       %s",
        DEVICE,
    )

    logger.info(
        "Dtype:        %s",
        DTYPE,
    )

    logger.info(
        "Model timeout: %d seconds",
        MODEL_TIMEOUT,
    )

    logger.info(
        "Continuous batching: %s",
        CONTINUOUS_BATCHING,
    )

    logger.info(
        "=" * 72
    )

    try:

        app = create_server()

        config = uvicorn.Config(
            app,
            host=HOST,
            port=PORT,
            log_level=LOG_LEVEL,
            access_log=True,
            loop="auto",
        )

        uvicorn_server = uvicorn.Server(
            config
        )

        logger.info(
            "Starting Uvicorn..."
        )

        logger.info(
            "API: http://localhost:%d",
            PORT,
        )

        logger.info(
            "Loaded models: "
            "http://localhost:%d/v1/models/loaded",
            PORT,
        )

        logger.info(
            "Server ready."
        )

        uvicorn_server.run()

    except KeyboardInterrupt:

        logger.info(
            "Keyboard interrupt received."
        )

    except Exception:

        logger.exception(
            "Server terminated with an error."
        )

        raise

    finally:

        shutdown_server()


# ============================================================
# Direct execution
# ============================================================

if __name__ == "__main__":
    main()