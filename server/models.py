from __future__ import annotations

import functools
import json
import os
import pathlib
import threading
import time
from typing import Any

from transformers import AutoTokenizer
from transformers.cli.serving.model_manager import ModelManager, TimedModel

from . import state
from .memory import (
    cleanup_memory,
    estimate_model_memory_bytes,
    format_memory_size,
)

from .logging_utils import model_loaded

# ============================================================================
# Transformers model discovery compatibility
# ============================================================================

# Transformers 5.16.x may use the platform's default text encoding while
# reading some model metadata. On Windows this can result in UnicodeDecodeError
# when the file contains UTF-8 characters.
#
# Keep the workaround local to get_gen_models() instead of globally replacing
# pathlib.Path.open for the lifetime of the server.
_original_get_gen_models = ModelManager.get_gen_models


def _resolve_cache_dir(cache_dir: str | os.PathLike[str] | Any | None = None):
    """Resolve the canonical Hugging Face cache directory."""

    if cache_dir is None:
        hf_home = os.environ.get("HF_HOME")
        if hf_home:
            cache_dir = pathlib.Path(hf_home) / "hub"
        else:
            transformers_cache = os.environ.get("TRANSFORMERS_CACHE")
            if transformers_cache:
                cache_dir = transformers_cache
            else:
                cache_dir = pathlib.Path.home() / ".cache" / "huggingface" / "hub"
    elif hasattr(cache_dir, "cache_dir") and not isinstance(cache_dir, (str, os.PathLike)):
        cache_dir = cache_dir.cache_dir

    return pathlib.Path(cache_dir)


@functools.wraps(_original_get_gen_models)
def _patched_get_gen_models(cache_dir: str | os.PathLike[str] | Any | None = None):
    """
    UTF-8-safe replacement for Transformers' ModelManager.get_gen_models().

    Matches the upstream staticmethod contract: it accepts no explicit cache
    directory, a direct cache path, or a manager-like object exposing
    ``cache_dir``.
    """

    models = []
    cache_path = _resolve_cache_dir(cache_dir)

    if not cache_path.exists():
        return models

    for config_path in cache_path.rglob("config.json"):
        try:
            with config_path.open("r", encoding="utf-8") as f:
                config = json.load(f)

        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            # Ignore invalid/incomplete cache entries.
            continue

        # Match the structure expected by Transformers serving.
        model_id = config.get("_name_or_path")

        if not model_id:
            # Try to derive the model ID from the cache path.
            model_id = _model_id_from_cache_path(config_path)

        if not model_id:
            continue

        models.append(
            {
                "id": model_id,
                "object": "model",
                "created": config_path.stat().st_mtime,
                "owned_by": model_id.split("/")[0]
                if "/" in model_id
                else "local",
                "capabilities": get_model_capabilities(model_id),
            }
        )

    # Avoid duplicates.
    unique = {}

    for model in models:
        unique[model["id"]] = model

    return list(unique.values())

def _model_id_from_cache_path(config_path: pathlib.Path) -> str | None:
    """
    Try to recover a Hugging Face model ID from a cache path.

    Example:
        models--Qwen--Qwen3-VL-2B-Instruct
        ->
        Qwen/Qwen3-VL-2B-Instruct
    """

    for part in config_path.parts:
        if part.startswith("models--"):
            name = part[len("models--") :]
            pieces = name.split("--")

            if len(pieces) >= 2:
                return "/".join(pieces)

    return None


# Preserve the upstream staticmethod behavior exactly: Transformers invokes
# `ModelManager.get_gen_models()` without a bound self argument, and the method
# resolves the default cache directory itself when no argument is supplied.
ModelManager.get_gen_models = staticmethod(_patched_get_gen_models)


# ============================================================================
# Helpers
# ============================================================================


def _split_model_id(model_id: str) -> tuple[str, str]:
    """
    Split:

        org/model@revision

    into:

        org/model
        revision

    If no revision is supplied, use "main".
    """

    if "@" in model_id:
        model_name, revision = model_id.split("@", 1)

        if not revision:
            revision = "main"

        return model_name, revision

    return model_id, "main"


def _is_dedicated_tts_model(model_id: str) -> bool:
    """
    Return True for models that are handled by a dedicated TTS runtime
    rather than the normal Transformers model/processor pipeline.
    """

    model_lower = model_id.lower()

    return (
        "kokoro" in model_lower
        or "xtts" in model_lower
    )


def is_transcription_or_tts_only_model(model_id: str) -> bool:
    """
    Return True if the model is exclusively a transcription (STT) or TTS model
    and cannot be used for text chat completions.
    """
    model_lower = model_id.lower()
    return (
        "seamless-m4t" in model_lower
        or "parakeet" in model_lower
        or "whisper" in model_lower
        or "silero" in model_lower
        or "kokoro" in model_lower
        or "xtts" in model_lower
    )


def get_model_capabilities(model_id: str) -> dict[str, bool]:
    """
    Return capabilities map for a given model ID.
    """
    model_lower = model_id.lower()
    if "seamless-m4t" in model_lower:
        return {
            "chat": False,
            "completion": False,
            "transcription": True,
            "translation": True,
            "tts": True,
        }
    if any(k in model_lower for k in ("parakeet", "whisper")):
        return {
            "chat": False,
            "completion": False,
            "transcription": True,
            "translation": False,
            "tts": False,
        }
    if any(k in model_lower for k in ("kokoro", "xtts")):
        return {
            "chat": False,
            "completion": False,
            "transcription": False,
            "translation": False,
            "tts": True,
        }
    return {
        "chat": True,
        "completion": True,
        "transcription": False,
        "translation": False,
        "tts": False,
    }


# ============================================================================
# Local model manager
# ============================================================================


class LocalModelManager(ModelManager):
    """
    Local model manager used by the custom Local-AI server.

    Responsibilities:

    - normal Transformers model loading
    - text-only checkpoints without AutoProcessor
    - AutoTokenizer fallback
    - dedicated TTS compatibility entries
    - model lifecycle logging
    - model memory reporting

    Dedicated TTS implementations such as Kokoro ONNX and Coqui XTTS-v2
    should ideally have their own runtime. The compatibility path below only
    keeps them visible to the Local-AI model lifecycle API.
    """

    # ------------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------------

    def load_model_and_processor(
        self,
        model_id_and_revision: str,
        *args: Any,
        **kwargs: Any,
    ):
        with self._model_locks_guard:
            lock = self._model_locks.setdefault(
                model_id_and_revision,
                threading.RLock(),
            )

        with lock:
            loaded_model = self.loaded_models.get(model_id_and_revision)
            if loaded_model is not None:
                state.logger.info(
                    "[MODEL] Already loaded: %s",
                    model_id_and_revision,
                )
                return loaded_model.model, loaded_model.processor

            return self._load_model_and_processor_unlocked(
                model_id_and_revision,
                *args,
                **kwargs,
            )

    def _load_model_and_processor_unlocked(
        self,
        model_id_and_revision: str,
        *args: Any,
        **kwargs: Any,
    ):
        """
        Load a model and its processor/tokenizer.

        Normal flow:

            Transformers ModelManager
                ↓
            AutoProcessor / model loading

        Fallback flow for text-only models:

            AutoTokenizer
                +
            manager._load_model()

        Dedicated TTS models use the compatibility path.
        """

        model_id = model_id_and_revision

        # --------------------------------------------------------------------
        # Dedicated TTS compatibility
        # --------------------------------------------------------------------

        if _is_dedicated_tts_model(model_id):
            return self._load_dedicated_tts_model(model_id)

        # --------------------------------------------------------------------
        # Normal Transformers loading
        # --------------------------------------------------------------------

        state.logger.info(
            "[MODEL] Loading Transformers model: %s",
            model_id,
        )

        started = time.perf_counter()

        try:
            result = super().load_model_and_processor(
                model_id_and_revision,
                *args,
                **kwargs,
            )

            elapsed = time.perf_counter() - started

            state.logger.info(
                "[MODEL] Loaded successfully: %s (%.2fs)",
                model_id,
                elapsed,
            )

            return result

        except (ImportError, ModuleNotFoundError, OSError, ValueError) as exc:
            # Some checkpoints advertise a multimodal processor but do not
            # actually include one, or they are text-only models whose processor
            # dependencies are missing. In those cases, the tokenizer fallback is
            # the correct compatibility path.
            state.logger.warning(
                "[MODEL] Processor unavailable for %s: %s",
                model_id,
                exc,
            )
            state.logger.warning(
                "[MODEL] Model compatibility check:\n"
                "Text pipeline: ✅ available\n"
                "Multimodal processor: ❌ unavailable\n"
                "Vision/image features: ❌ unavailable\n"
                "Fallback mode: ✅ active\n"
                "The server loaded the model with tokenizer fallback, so text generation still works, but image and multimodal capabilities remain disabled until a compatible processor/preprocessor is available."
            )

            try:
                return self._load_text_model_with_tokenizer(
                    model_id,
                )
            except Exception:
                # Preserve the original Transformers error when the tokenizer
                # fallback also fails.
                state.logger.exception(
                    "[MODEL] Tokenizer fallback failed for %s",
                    model_id,
                )
                raise

    # ------------------------------------------------------------------------
    # Dedicated TTS compatibility
    # ------------------------------------------------------------------------

    def _load_dedicated_tts_model(
        self,
        model_id_and_revision: str,
    ):
        """
        Register a lightweight lifecycle entry for a dedicated TTS runtime.

        This does NOT actually initialize Kokoro/XTTS.

        The real TTS runtime should be initialized by its dedicated service.
        """

        state.logger.info(
            "[MODEL] Dedicated TTS model requested: %s",
            model_id_and_revision,
        )

        class DummyTTSModel:
            def __init__(self, name_or_path: str):
                self.name_or_path = name_or_path

                # Approximate Kokoro ONNX runtime footprint currently used
                # by the Local-AI compatibility layer.
                self.model_memory = 353_746_785

        class DummyTTSProcessor:
            pass

        with self._model_locks_guard:
            lock = self._model_locks.setdefault(
                model_id_and_revision,
                threading.RLock(),
            )

        with lock:
            existing = self.loaded_models.get(
                model_id_and_revision,
            )

            if existing is not None:
                state.logger.info(
                    "[MODEL] Already loaded: %s",
                    model_id_and_revision,
                )

                return (
                    existing.model,
                    existing.processor,
                )

            dummy_model = DummyTTSModel(
                model_id_and_revision,
            )

            dummy_processor = DummyTTSProcessor()

            self.loaded_models[model_id_and_revision] = TimedModel(
                dummy_model,
                timeout_seconds=self.model_timeout,
                processor=dummy_processor,
                on_unload=lambda key=model_id_and_revision: (
                    self.loaded_models.pop(key, None)
                ),
            )

        state.logger.info(
            "[MODEL] Dedicated TTS model registered: %s (%s)",
            model_id_and_revision,
            format_memory_size(
                dummy_model.model_memory,
            ),
        )

        return (
            dummy_model,
            dummy_processor,
        )

    # ------------------------------------------------------------------------
    # Text-only model fallback
    # ------------------------------------------------------------------------

    def _load_text_model_with_tokenizer(
        self,
        model_id_and_revision: str,
    ):
        """
        Load a text-only Transformers model using AutoTokenizer.

        This path is intentionally separate from the normal Transformers
        processor path.
        """

        state.logger.info(
            "[MODEL] Using AutoTokenizer fallback: %s",
            model_id_and_revision,
        )

        started = time.perf_counter()

        _load_with_tokenizer(
            self,
            model_id_and_revision,
        )

        elapsed = time.perf_counter() - started

        timed_model = self.loaded_models.get(
            model_id_and_revision,
        )

        if timed_model is None:
            raise RuntimeError(
                "Model was not registered after tokenizer fallback: "
                f"{model_id_and_revision}"
            )

        state.logger.info(
            "[MODEL] Tokenizer fallback loaded: %s (%.2fs)",
            model_id_and_revision,
            elapsed,
        )

        return (
            timed_model.model,
            timed_model.processor,
        )


# ============================================================================
# Loaded model inspection
# ============================================================================


def get_loaded_models() -> list[dict[str, Any]]:
    """
    Return information about currently loaded Transformers models.
    """

    manager = state.get_model_manager()

    result: list[dict[str, Any]] = []

    with state._lifecycle_lock:
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

            memory_bytes = estimate_model_memory_bytes(
                model_object,
            )

            # Some dedicated runtimes expose an explicit memory estimate.
            explicit_memory = getattr(
                model_object,
                "model_memory",
                None,
            )

            if (
                explicit_memory is not None
                and isinstance(explicit_memory, (int, float))
                and explicit_memory > memory_bytes
            ):
                memory_bytes = int(explicit_memory)

            result.append(
                {
                    "id": model_id,
                    "loaded": model_object is not None,
                    "processor_loaded": processor_object is not None,
                    "memory_bytes": memory_bytes,
                    "memory_mb": round(
                        memory_bytes / (1024 * 1024),
                        2,
                    ),
                    "memory_human": format_memory_size(
                        memory_bytes,
                    ),
                    "timeout": getattr(
                        timed_model,
                        "timeout_seconds",
                        None,
                    ),
                    "capabilities": get_model_capabilities(model_id),
                }
            )

    return result


# ============================================================================
# Tokenizer fallback implementation
# ============================================================================


def _load_with_tokenizer(
    manager: Any,
    model_id: str,
) -> None:
    """
    Load a Transformers text model using AutoTokenizer.

    Intended for checkpoints where AutoProcessor is unavailable but a normal
    tokenizer exists.

    The model itself is still loaded through Transformers ModelManager.
    """

    model_name, revision = _split_model_id(
        model_id,
    )

    # ------------------------------------------------------------------------
    # Per-model lock
    # ------------------------------------------------------------------------

    with manager._model_locks_guard:
        lock = manager._model_locks.setdefault(
            model_id,
            threading.RLock(),
        )

    # ------------------------------------------------------------------------
    # Serialize loading of the same model
    # ------------------------------------------------------------------------

    with lock:
        if model_id in manager.loaded_models:
            state.logger.info(
                "[MODEL] Already loaded: %s",
                model_id,
            )
            return

        started = time.perf_counter()

        state.logger.info(
            "[MODEL] Loading tokenizer: %s",
            model_id,
        )

        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            revision=revision,
            trust_remote_code=manager.trust_remote_code,
        )

        state.logger.info(
            "[MODEL] Loading model weights: %s",
            model_id,
        )

        model_object = manager._load_model(
            model_id,
        )

        elapsed = time.perf_counter() - started

        manager.loaded_models[model_id] = TimedModel(
            model_object,
            timeout_seconds=manager.model_timeout,
            processor=tokenizer,
            on_unload=lambda key=model_id: (
                manager.loaded_models.pop(
                    key,
                    None,
                )
            ),
        )

        memory_bytes = estimate_model_memory_bytes(
            model_object,
        )

        model_loaded(
            model=model_id,
            duration_ms=elapsed * 1000,
            memory=format_memory_size(memory_bytes)
        )


# ============================================================================
# Explicit model lifecycle API
# ============================================================================


def load_model(
    model: str,
) -> dict[str, Any]:
    """
    Explicitly load a Transformers model.
    """

    manager = state.get_model_manager()

    model_id = state.canonical_model_name(
        model,
    )

    state.logger.info(
        "[MODEL] Explicit load requested: %s",
        model_id,
    )

    started = time.perf_counter()

    manager.load_model_and_processor(
        model_id,
    )

    elapsed = time.perf_counter() - started

    # Get the actual loaded model information.
    loaded_info = next(
        (
            item
            for item in get_loaded_models()
            if item["id"] == model_id
        ),
        None,
    )

    memory_human = (
        loaded_info["memory_human"]
        if loaded_info is not None
        else "unknown"
    )

    state.logger.info(
        "[MODEL] LOAD COMPLETE | %s | %.2fs | memory=%s",
        model_id,
        elapsed,
        memory_human,
    )

    return {
        "success": True,
        "model": model_id,
        "loaded": True,
        "load_time_seconds": round(
            elapsed,
            3,
        ),
        "memory_bytes": (
            loaded_info["memory_bytes"]
            if loaded_info is not None
            else None
        ),
        "memory_human": memory_human,
        "message": "Model loaded successfully.",
    }


def unload_model(
    model: str,
) -> dict[str, Any]:
    """
    Explicitly unload one Transformers model.
    """

    manager = state.get_model_manager()

    model_id = state.canonical_model_name(
        model,
    )

    with state._lifecycle_lock:
        timed_model = manager.loaded_models.get(
            model_id,
        )

        if timed_model is None:
            state.logger.info(
                "[MODEL] Unload requested but model is not loaded: %s",
                model_id,
            )

            return {
                "success": True,
                "model": model_id,
                "loaded": False,
                "unloaded": False,
                "message": "Model was not loaded.",
            }

        state.logger.info(
            "[MODEL] UNLOAD START | %s",
            model_id,
        )

        started = time.perf_counter()

        try:
            timed_model.delete_model()

            manager.loaded_models.pop(
                model_id,
                None,
            )

        except Exception as exc:
            state.logger.exception(
                "[MODEL] UNLOAD FAILED | %s",
                model_id,
            )

            raise RuntimeError(
                f"Failed to unload model '{model_id}': {exc}"
            ) from exc

        cleanup_memory()

        elapsed = time.perf_counter() - started

        state.logger.info(
            "[MODEL] UNLOAD COMPLETE | %s | %.2fs",
            model_id,
            elapsed,
        )

        return {
            "success": True,
            "model": model_id,
            "loaded": False,
            "unloaded": True,
            "unload_time_seconds": round(
                elapsed,
                3,
            ),
            "message": "Model unloaded successfully.",
        }


def unload_all_models() -> dict[str, Any]:
    """
    Unload every currently loaded Transformers model.
    """

    manager = state.get_model_manager()

    with state._lifecycle_lock:
        unloaded: list[str] = []
        failed: list[dict[str, str]] = []

        model_ids = list(
            manager.loaded_models.keys()
        )

        state.logger.info(
            "[MODEL] UNLOAD ALL | count=%d",
            len(model_ids),
        )

        started = time.perf_counter()

        for model_id in model_ids:
            timed_model = manager.loaded_models.get(
                model_id,
            )

            if timed_model is None:
                continue

            try:
                state.logger.info(
                    "[MODEL] Unloading: %s",
                    model_id,
                )

                timed_model.delete_model()

                manager.loaded_models.pop(
                    model_id,
                    None,
                )

                unloaded.append(
                    model_id,
                )

                state.logger.info(
                    "[MODEL] Unloaded: %s",
                    model_id,
                )

            except Exception as exc:
                state.logger.exception(
                    "[MODEL] Failed to unload: %s",
                    model_id,
                )

                failed.append(
                    {
                        "model": model_id,
                        "error": str(exc),
                    }
                )

        cleanup_memory()

        elapsed = time.perf_counter() - started

        success = not failed

        state.logger.info(
            "[MODEL] UNLOAD ALL COMPLETE | unloaded=%d | failed=%d | %.2fs",
            len(unloaded),
            len(failed),
            elapsed,
        )

        return {
            "success": success,
            "unloaded": unloaded,
            "failed": failed,
            "count": len(unloaded),
            "elapsed_seconds": round(
                elapsed,
                3,
            ),
            "message": (
                "All models unloaded successfully."
                if success
                else "Some models could not be unloaded."
            ),
        }