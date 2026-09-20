from __future__ import annotations

import asyncio
import contextlib
import shutil
import subprocess
import tempfile
from collections.abc import Callable
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.datastructures import FormData, UploadFile

from .memory import format_memory_size

def add_custom_routes(
    application: FastAPI,
    get_loaded_models: Callable[[], list[dict[str, Any]]],
    get_system_memory_status: Callable[[], dict[str, Any]],
    unload_model: Callable[[str], dict[str, Any]],
    unload_all_models: Callable[[], dict[str, Any]],
    transcription_handler: Any,
    logger: Any,
) -> None:

    async def normalized_transcription_endpoint(request: Request) -> Any:
        """
        Receives browser audio, normalizes it through FFmpeg to:

            WAV
            16 kHz
            mono
            PCM signed 16-bit

        and forwards the normalized audio to the Transformers
        transcription handler.

        This keeps browser-specific WebM/Opus decoding outside
        the Parakeet/Transformers pipeline.
        """

        ffmpeg = shutil.which("ffmpeg")

        if not ffmpeg:
            raise HTTPException(
                status_code=503,
                detail=(
                    "FFmpeg is required for audio transcription "
                    "but was not found on PATH."
                ),
            )

        logger.info("Using FFmpeg: %s", ffmpeg)

        async with request.form() as form:
            file_field = form.get("file")

            if not isinstance(file_field, UploadFile):
                raise HTTPException(
                    status_code=422,
                    detail="Expected file upload.",
                )

            model = form.get("model")

            if not isinstance(model, str) or not model.strip():
                raise HTTPException(
                    status_code=422,
                    detail="Valid `model` string required.",
                )

            model = model.strip()

            logger.info(
                "Audio transcription request: model=%s filename=%s "
                "content_type=%s",
                model,
                file_field.filename,
                file_field.content_type,
            )


            source_bytes = await file_field.read()

            if not source_bytes:
                raise HTTPException(
                    status_code=422,
                    detail="Uploaded audio file is empty.",
                )

            logger.info(
                "Received audio: %d bytes",
                len(source_bytes),
            )

            normalized_bytes = await _normalize_audio_with_ffmpeg(
                ffmpeg=ffmpeg,
                source_bytes=source_bytes,
                logger=logger,
            )

            if not normalized_bytes:
                raise HTTPException(
                    status_code=422,
                    detail="FFmpeg returned empty audio.",
                )

            logger.info(
                "Normalized audio: %d bytes "
                "(WAV, 16 kHz, mono, PCM S16LE)",
                len(normalized_bytes),
            )

            normalized_file = _upload_file_from_bytes(
                normalized_bytes,
                filename="normalized.wav",
                content_type="audio/wav",
            )

            forwarded_fields: list[tuple[str, Any]] = []

            for key, value in form.multi_items():
                if key == "file":
                    forwarded_fields.append(
                        ("file", normalized_file)
                    )
                elif key == "language":

                    if isinstance(value, str) and value.strip().lower() == "auto":
                        continue

                    forwarded_fields.append((key, value))
                else:
                    forwarded_fields.append((key, value))

            # Ensure model is present.
            if not any(
                key == "model" and value == model
                for key, value in forwarded_fields
            ):
                forwarded_fields.append(("model", model))

        proxy_request = _FormRequest(
            FormData(forwarded_fields)
        )

        try:
            result = await transcription_handler.handle_request(
                proxy_request
            )

            logger.info(
                "Transcription completed successfully: model=%s",
                model,
            )

            return result

        except Exception:
            logger.exception(
                "Parakeet/Transformers transcription failed: model=%s",
                model,
            )
            raise

        finally:
            # Close our temporary normalized audio file.
            with contextlib.suppress(Exception):
                normalized_file.file.close()

    application.add_api_route(
        "/v1/audio/transcriptions",
        normalized_transcription_endpoint,
        methods=["POST"],
        include_in_schema=False,
    )

    normalized_route = application.router.routes.pop()
    application.router.routes.insert(0, normalized_route)

    @application.post("/v1/audio/speech")
    async def audio_speech_endpoint(request: Request) -> Any:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")
            
        text = body.get("input")
        if not text:
            raise HTTPException(status_code=400, detail="Missing input text")

        voice_param = body.get("voice") or "af_heart"
        try:
            speed_param = float(body.get("speed", 1.0))
        except (ValueError, TypeError):
            speed_param = 1.0
        # Clamp speed between 0.5 and 2.0 as supported by Kokoro
        speed_param = max(0.5, min(2.0, speed_param))
            
        import io
        from fastapi.responses import Response

        def generate_tts():
            from huggingface_hub import hf_hub_download
            import soundfile as sf
            
            model_path = hf_hub_download(repo_id="leonelhs/kokoro-thewh1teagle", filename="kokoro-v1.0.onnx")
            voices_path = hf_hub_download(repo_id="leonelhs/kokoro-thewh1teagle", filename="voices-v1.0.bin")
            
            if not hasattr(application.state, "kokoro_model"):
                from kokoro_onnx import Kokoro
                application.state.kokoro_model = Kokoro(model_path, voices_path)
                
            kokoro = application.state.kokoro_model
            chosen_voice = voice_param if voice_param in kokoro.get_voices() else "af_heart"
            audio_array, sample_rate = kokoro.create(text, voice=chosen_voice, speed=speed_param)
            
            wav_io = io.BytesIO()
            sf.write(wav_io, audio_array, sample_rate, format="WAV")
            wav_io.seek(0)
            return wav_io.read()

        try:
            wav_data = await asyncio.to_thread(generate_tts)
            return Response(content=wav_data, media_type="audio/wav")
        except Exception as exc:
            logger.exception("Kokoro TTS generation failed")
            raise HTTPException(status_code=500, detail=str(exc))

    @application.get("/v1/audio/voices")
    async def audio_voices_endpoint() -> Any:
        def get_all_voices():
            from huggingface_hub import hf_hub_download
            model_path = hf_hub_download(repo_id="leonelhs/kokoro-thewh1teagle", filename="kokoro-v1.0.onnx")
            voices_path = hf_hub_download(repo_id="leonelhs/kokoro-thewh1teagle", filename="voices-v1.0.bin")
            if not hasattr(application.state, "kokoro_model"):
                from kokoro_onnx import Kokoro
                application.state.kokoro_model = Kokoro(model_path, voices_path)
            return application.state.kokoro_model.get_voices()

        try:
            voices = await asyncio.to_thread(get_all_voices)
            return {"voices": voices}
        except Exception as exc:
            logger.exception("Failed to get Kokoro voices")
            raise HTTPException(status_code=500, detail=str(exc))

    @application.get("/v1/models/loaded")
    async def loaded_models_endpoint() -> dict[str, Any]:
        try:
            raw_models = await asyncio.to_thread(
                get_loaded_models
            )

            models = raw_models

            total_memory_bytes = sum(
                item.get("memory_bytes", 0)
                for item in models
            )

            memory_status = await asyncio.to_thread(
                get_system_memory_status
            )

            return {
                "object": "list",
                "data": models,
                "count": len(models),
                "total_memory_bytes": total_memory_bytes,
                "total_memory_human": format_memory_size(
                    total_memory_bytes
                ),
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

    @application.get("/v1/system/memory")
    async def system_memory_endpoint() -> dict[str, Any]:
        try:
            status = await asyncio.to_thread(
                get_system_memory_status
            )

            models = await asyncio.to_thread(
                get_loaded_models
            )

            total_model_bytes = sum(
                item.get("memory_bytes", 0)
                for item in models
            )

            status["models_memory_bytes"] = total_model_bytes
            status["models_memory_human"] = format_memory_size(
                total_model_bytes
            )

            return status

        except Exception as exc:
            logger.exception(
                "Failed to retrieve system memory status."
            )

            raise HTTPException(
                status_code=500,
                detail=str(exc),
            ) from exc

    @application.post("/v1/models/unload")
    async def unload_endpoint(
        body: dict[str, Any],
    ) -> JSONResponse:

        model = body.get("model")

        if not isinstance(model, str) or not model.strip():
            raise HTTPException(
                status_code=422,
                detail="Valid `model` string required.",
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

    @application.post("/v1/models/unload-all")
    async def unload_all_endpoint() -> JSONResponse:
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

    @application.post("/unload-all")
    async def unload_all_alias() -> JSONResponse:
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


async def _normalize_audio_with_ffmpeg(
    ffmpeg: str,
    source_bytes: bytes,
    logger: Any,
) -> bytes:
    """
    Convert browser audio such as:

        WebM / Opus
        OGG / Opus
        MP4 / AAC
        WAV
        etc.

    into:

        WAV
        16,000 Hz
        mono
        PCM signed 16-bit

    suitable for Parakeet.
    """

    try:
        process = await asyncio.create_subprocess_exec(
            ffmpeg,

            "-hide_banner",
            "-loglevel",
            "error",

            "-i",
            "pipe:0",

            # Output format
            "-f",
            "wav",

            # Parakeet-compatible sampling rate
            "-ar",
            "16000",

            # Mono
            "-ac",
            "1",

            # PCM signed 16-bit
            "-c:a",
            "pcm_s16le",

            # Output to stdout
            "pipe:1",

            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "FFmpeg is required for audio transcription "
                "but could not be started."
            ),
        ) from exc

    stdout, stderr = await process.communicate(
        source_bytes
    )

    if process.returncode != 0:
        detail = stderr.decode(
            "utf-8",
            errors="replace",
        ).strip()

        logger.error(
            "FFmpeg audio normalization failed: %s",
            detail,
        )

        raise HTTPException(
            status_code=422,
            detail=(
                detail
                or "FFmpeg could not decode the uploaded audio."
            ),
        )

    return stdout


def _upload_file_from_bytes(
    content: bytes,
    filename: str,
    content_type: str,
) -> UploadFile:
    """
    Create a Starlette UploadFile backed by a temporary
    spooled file.
    """

    file_object = tempfile.SpooledTemporaryFile(
        max_size=1024 * 1024
    )

    file_object.write(content)
    file_object.seek(0)

    return UploadFile(
        file=file_object,
        filename=filename,
        headers={
            "content-type": content_type
        },
    )


class _FormRequest:
    """
    Minimal request-like object compatible with the
    Transformers transcription handler.
    """

    def __init__(
        self,
        form: FormData,
    ) -> None:
        self._form = form

    @contextlib.asynccontextmanager
    async def form(self):
        yield self._form


def log_registered_routes(
    application: FastAPI,
    logger: Any,
) -> None:
    logger.info("")
    logger.info("=" * 72)
    logger.info("REGISTERED API ROUTES")
    logger.info("=" * 72)

    for route in application.routes:
        methods = getattr(
            route,
            "methods",
            set(),
        )

        method_text = (
            ",".join(sorted(methods))
            if methods
            else ""
        )

        logger.info(
            "%-12s %s",
            method_text,
            getattr(route, "path", ""),
        )

    logger.info("=" * 72)