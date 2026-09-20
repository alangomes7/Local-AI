from __future__ import annotations

import os
from typing import Any

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from transformers.cli.serving.chat_completion import ChatCompletionHandler
from transformers.cli.serving.completion import CompletionHandler
from transformers.cli.serving.response import ResponseHandler
from transformers.cli.serving.server import build_server
from transformers.cli.serving.transcription import TranscriptionHandler
from transformers.cli.serving.utils import GenerationState
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from openai.types.audio import Transcription

from . import state
from .memory import cleanup_memory, get_system_memory_status
from .models import (
    LocalModelManager,
    get_loaded_models,
    is_transcription_or_tts_only_model,
    load_model,
    unload_all_models,
    unload_model,
)
from .routes import add_custom_routes, log_registered_routes


class LocalChatCompletionHandler(ChatCompletionHandler):
    async def handle_request(self, request: Any, request_id: Any = None, *args: Any, **kwargs: Any) -> Any:
        model = getattr(request, "model", None)
        if isinstance(model, str) and is_transcription_or_tts_only_model(model):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Model '{model}' is an audio transcription/TTS model "
                    "and cannot be used for /v1/chat/completions. "
                    "Please select an LLM chat model (e.g., Qwen, Llama)."
                ),
            )
        if request_id is not None:
            kwargs["request_id"] = request_id
        return await super().handle_request(request, *args, **kwargs)


class LocalTranscriptionHandler(TranscriptionHandler):
    async def _non_streaming(
        self,
        gen_manager: Any,
        audio_model: Any,
        audio_processor: Any,
        audio_inputs: dict[str, Any],
    ) -> JSONResponse:
        generated = await gen_manager.async_submit(audio_model.generate, **audio_inputs)
        
        if hasattr(generated, "text"):
            text = generated.text
            if isinstance(text, (list, tuple)) and text:
                text = text[0]
        elif isinstance(generated, dict) and "text" in generated:
            text = generated["text"]
            if isinstance(text, (list, tuple)) and text:
                text = text[0]
        else:
            if hasattr(generated, "sequences"):
                generated = generated.sequences
            elif isinstance(generated, dict) and "sequences" in generated:
                generated = generated["sequences"]

            if isinstance(generated, str):
                text = generated
            elif (
                isinstance(generated, (list, tuple))
                and generated
                and isinstance(generated[0], str)
            ):
                text = generated[0]
            else:
                text = audio_processor.batch_decode(
                    generated,
                    skip_special_tokens=True,
                )[0]
        return JSONResponse(
            Transcription(text=text).model_dump(exclude_none=True),
        )


def create_server() -> FastAPI:
    state.logger.info('Creating standalone Transformers 5.16.1 server...')
    state.logger.info('Python executable: %s', os.sys.executable)
    state.logger.info('Python version: %s', os.sys.version.split()[0])
    state.logger.info('Server file: %s', os.path.abspath(__file__))

    state.model_manager = LocalModelManager(
        device=state.DEVICE,
        dtype=state.DTYPE,
        trust_remote_code=state.TRUST_REMOTE_CODE,
        model_timeout=state.MODEL_TIMEOUT,
    )
    state.generation_state = GenerationState(continuous_batching=state.CONTINUOUS_BATCHING)
    state.chat_handler = LocalChatCompletionHandler(
        model_manager=state.model_manager,
        generation_state=state.generation_state,
        chat_template_kwargs={},
    )
    state.completion_handler = CompletionHandler(
        model_manager=state.model_manager,
        generation_state=state.generation_state,
    )
    state.response_handler = ResponseHandler(
        model_manager=state.model_manager,
        generation_state=state.generation_state,
        chat_template_kwargs={},
    )
    state.transcription_handler = LocalTranscriptionHandler(
        state.model_manager,
        state.generation_state,
    )

    application = build_server(
        state.model_manager,
        state.chat_handler,
        state.completion_handler,
        state.response_handler,
        state.transcription_handler,
        generation_state=state.generation_state,
        enable_cors=False,
    )
    if state.ENABLE_CORS:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=['*'],
            allow_credentials=True,
            allow_methods=['*'],
            allow_headers=['*'],
        )
        state.logger.warning("CORS allow_origins=['*'] enabled.")

    add_custom_routes(
        application,
        get_loaded_models,
        get_system_memory_status,
        unload_model,
        unload_all_models,
        state.transcription_handler,
        state.logger,
    )
    log_registered_routes(application, state.logger)

    required_routes = {
        '/health', '/v1/models', '/v1/chat/completions', '/v1/completions',
        '/v1/responses', '/v1/audio/transcriptions', '/load_model',
        '/v1/models/loaded', '/v1/models/unload', '/v1/models/unload-all', '/unload-all',
    }
    registered_paths = {getattr(route, 'path', '') for route in application.routes}
    missing = required_routes - registered_paths
    if missing:
        raise RuntimeError('Required routes missing: ' + ', '.join(sorted(missing)))
    state.logger.info('All required API routes registered.')
    state.app = application
    return application


def shutdown_server() -> None:
    state.logger.info('Beginning server shutdown...')
    with state._lifecycle_lock:
        if state.generation_state is not None:
            try:
                state.generation_state.shutdown()
                state.logger.info('Generation state shut down.')
            except Exception:
                state.logger.exception('Failed to shut down generation state.')
        if state.model_manager is not None:
            try:
                state.model_manager.shutdown()
                state.logger.info('Model manager shut down.')
            except Exception:
                state.logger.exception('Failed to shut down model manager.')
    cleanup_memory()
    state.logger.info('Server stopped.')


def main() -> None:
    state.logger.info('')
    state.logger.info('=' * 72)
    state.logger.info('LOCAL TRANSFORMERS AI SERVER')
    state.logger.info('=' * 72)
    state.logger.info('Transformers: 5.16.1')
    state.logger.info('Python:       %s', os.sys.version.split()[0])
    state.logger.info('Executable:   %s', os.sys.executable)
    state.logger.info('Server file:  %s', os.path.abspath(__file__))
    state.logger.info('Host:         %s', state.HOST)
    state.logger.info('Port:         %d', state.PORT)
    state.logger.info('Device:       %s', state.DEVICE)
    state.logger.info('Dtype:        %s', state.DTYPE)
    state.logger.info('Model timeout: %d seconds', state.MODEL_TIMEOUT)
    state.logger.info('Continuous batching: %s', state.CONTINUOUS_BATCHING)
    state.logger.info('=' * 72)
    try:
        application = create_server()
        # Keep uvicorn quiet and route runtime output through the app's
        # custom logging script instead of its default noisy access/error logs.
        state.uvicorn_server = uvicorn.Server(uvicorn.Config(
            application,
            host=state.HOST,
            port=state.PORT,
            log_level=state.LOG_LEVEL,
            access_log=False,
            log_config=None,
            loop='auto',
        ))
        state.logger.info('Starting Uvicorn with custom logging...')
        state.logger.info('API: http://localhost:%d', state.PORT)
        state.logger.info('Loaded models: http://localhost:%d/v1/models/loaded', state.PORT)
        state.logger.info('Server ready.')
        state.uvicorn_server.run()
    except KeyboardInterrupt:
        state.logger.info('Keyboard interrupt received.')
    except Exception:
        state.logger.exception('Server terminated with an error.')
        raise
    finally:
        shutdown_server()
