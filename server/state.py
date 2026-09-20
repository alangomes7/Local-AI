from __future__ import annotations

import logging
import os
import threading
from typing import Any

import uvicorn
from fastapi import FastAPI
from transformers.cli.serving.chat_completion import ChatCompletionHandler
from transformers.cli.serving.completion import CompletionHandler
from transformers.cli.serving.model_manager import ModelManager
from transformers.cli.serving.response import ResponseHandler
from transformers.cli.serving.transcription import TranscriptionHandler
from transformers.cli.serving.utils import GenerationState

from .logging_utils import logger

HOST = os.getenv('AI_SERVER_HOST', '0.0.0.0')
PORT = int(os.getenv('AI_SERVER_PORT', '8000'))
MODEL_TIMEOUT = int(os.getenv('AI_MODEL_TIMEOUT', '300'))
ENABLE_CORS = os.getenv('AI_ENABLE_CORS', 'true').lower() in {'1', 'true', 'yes', 'on'}
LOG_LEVEL = os.getenv('AI_LOG_LEVEL', 'info').lower()
DEVICE = os.getenv('AI_DEVICE', 'auto')
DTYPE = os.getenv('AI_DTYPE', 'auto')
TRUST_REMOTE_CODE = os.getenv('AI_TRUST_REMOTE_CODE', 'false').lower() in {'1', 'true', 'yes', 'on'}
CONTINUOUS_BATCHING = os.getenv('AI_CONTINUOUS_BATCHING', 'false').lower() in {'1', 'true', 'yes', 'on'}

model_manager: ModelManager | None = None
generation_state: GenerationState | None = None
chat_handler: ChatCompletionHandler | None = None
completion_handler: CompletionHandler | None = None
response_handler: ResponseHandler | None = None
transcription_handler: TranscriptionHandler | None = None
app: FastAPI | None = None
uvicorn_server: uvicorn.Server | None = None
_lifecycle_lock = threading.RLock()


def get_model_manager() -> ModelManager:
    if model_manager is None:
        raise RuntimeError('ModelManager has not been initialized.')
    return model_manager


def get_generation_state() -> GenerationState:
    if generation_state is None:
        raise RuntimeError('GenerationState has not been initialized.')
    return generation_state


def canonical_model_name(model: str) -> str:
    return ModelManager.process_model_name(model)
