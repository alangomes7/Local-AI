"""
Clean structured console logging for the Local AI Transformers server.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any


LOGGER_NAME = "local-ai"

LOG_LEVEL = os.getenv("AI_LOG_LEVEL", "INFO").upper()


class CleanFormatter(logging.Formatter):
    """Compact human-readable formatter."""

    LEVEL_SYMBOLS = {
        logging.DEBUG: "·",
        logging.INFO: "│",
        logging.WARNING: "⚠",
        logging.ERROR: "✖",
        logging.CRITICAL: "‼",
    }

    def format(self, record: logging.LogRecord) -> str:
        timestamp = self.formatTime(record, "%H:%M:%S")
        symbol = self.LEVEL_SYMBOLS.get(record.levelno, "│")

        return (
            f"[{timestamp}] "
            f"{symbol} "
            f"{record.getMessage()}"
        )


def configure_logging() -> logging.Logger:
    """
    Configure application logging and reduce noisy third-party logs.
    """

    logger = logging.getLogger(LOGGER_NAME)

    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    logger.propagate = False

    # Avoid duplicate handlers when the server is reloaded.
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    handler.setFormatter(CleanFormatter())

    logger.addHandler(handler)

    # ---------------------------------------------------------
    # Reduce noisy dependency logging.
    # ---------------------------------------------------------

    noisy_loggers = {
        "httpx": logging.WARNING,
        "httpcore": logging.WARNING,
        "transformers": logging.WARNING,
        "transformers.cli": logging.WARNING,
        "transformers.cli.serve": logging.WARNING,
        "huggingface_hub": logging.WARNING,
        "uvicorn.access": logging.WARNING,
        "uvicorn.error": logging.WARNING,
    }

    for name, level in noisy_loggers.items():
        logging.getLogger(name).setLevel(level)

    return logger


logger = configure_logging()


# ============================================================
# Formatting helpers
# ============================================================

def _model_name(model: str | None) -> str:
    if not model:
        return "unknown"

    # Keep logs readable.
    if "@" in model:
        model = model.split("@", 1)[0]

    return model


def request(
    request_id: str,
    method: str,
    path: str,
    model: str | None = None,
    stream: bool | None = None,
) -> None:
    logger.info(
        "🟢 REQUEST  %-12s %s %s%s",
        request_id,
        method,
        path,
        (
            f" | model={_model_name(model)}"
            if model
            else ""
        )
        + (
            f" | stream={stream}"
            if stream is not None
            else ""
        ),
    )


def context(
    request_id: str,
    input_tokens: int | None,
    context_window: int | None,
) -> None:
    if input_tokens is None:
        logger.info(
            "🧠 CONTEXT  %-12s input_tokens=unknown",
            request_id,
        )
        return

    if context_window:
        percentage = (
            input_tokens / context_window * 100
            if context_window > 0
            else 0
        )

        logger.info(
            "🧠 CONTEXT  %-12s %s / %s tokens (%.1f%%)",
            request_id,
            f"{input_tokens:,}",
            f"{context_window:,}",
            percentage,
        )
    else:
        logger.info(
            "🧠 CONTEXT  %-12s %s input tokens",
            request_id,
            f"{input_tokens:,}",
        )


def processing(
    request_id: str,
    message: str,
) -> None:
    logger.info(
        "⚙ PROCESS   %-12s %s",
        request_id,
        message,
    )


def first_token(
    request_id: str,
    milliseconds: float,
) -> None:
    logger.info(
        "⚡ TTFT     %-12s %.0f ms",
        request_id,
        milliseconds,
    )


def complete(
    request_id: str,
    model: str | None,
    duration_ms: float,
    output_tokens: int | None = None,
    tokens_per_second: float | None = None,
) -> None:

    parts: list[str] = [
        f"model={_model_name(model)}",
        f"total={duration_ms / 1000:.2f}s",
    ]

    if output_tokens is not None:
        parts.append(f"output={output_tokens:,} tokens")

    if tokens_per_second is not None:
        parts.append(f"speed={tokens_per_second:.2f} tok/s")

    logger.info(
        "✅ COMPLETE  %-12s %s",
        request_id,
        " | ".join(parts),
    )


def error(
    request_id: str,
    message: str,
) -> None:
    logger.error(
        "❌ ERROR     %-12s %s",
        request_id,
        message,
    )


def model_loading(
    model: str,
) -> None:
    logger.info(
        "📦 LOAD      %-12s loading...",
        _model_name(model),
    )


def model_loaded(
    model: str,
    duration_ms: float | None = None,
    memory: str | None = None,
) -> None:

    details: list[str] = []

    if duration_ms is not None:
        details.append(f"load={duration_ms / 1000:.2f}s")

    if memory:
        details.append(f"memory={memory}")

    suffix = f" | {' | '.join(details)}" if details else ""

    logger.info(
        "✅ READY     %-12s%s",
        _model_name(model),
        suffix,
    )


def model_unloading(
    model: str,
) -> None:
    logger.info(
        "🗑️ UNLOAD    %-12s releasing...",
        _model_name(model),
    )


def model_unloaded(
    model: str,
    memory_freed: str | None = None,
) -> None:

    suffix = (
        f" | freed={memory_freed}"
        if memory_freed
        else ""
    )

    logger.info(
        "✅ RELEASED  %-12s%s",
        _model_name(model),
        suffix,
    )


def memory(
    used: int | None,
    total: int | None,
) -> None:

    if used is None or total is None:
        return

    logger.info(
        "💾 MEMORY    %s / %s",
        format_bytes(used),
        format_bytes(total),
    )


def format_bytes(value: int | float | None) -> str:
    if value is None:
        return "unknown"

    value = float(value)

    units = ["B", "KB", "MB", "GB", "TB"]

    for unit in units:
        if value < 1024:
            return f"{value:.1f} {unit}"

        value /= 1024

    return f"{value:.1f} PB"