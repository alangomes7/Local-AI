"""
Inference metrics and request instrumentation.
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RequestMetrics:
    request_id: str

    method: str = ""
    path: str = ""

    model: str | None = None

    stream: bool = False

    started_at: float = field(
        default_factory=time.perf_counter
    )

    completed_at: float | None = None

    input_tokens: int | None = None
    output_tokens: int | None = None

    context_window: int | None = None

    first_token_at: float | None = None

    status_code: int | None = None

    error: str | None = None

    @property
    def duration_ms(self) -> float | None:
        end = self.completed_at

        if end is None:
            return None

        return (end - self.started_at) * 1000

    @property
    def ttft_ms(self) -> float | None:
        if self.first_token_at is None:
            return None

        return (
            self.first_token_at - self.started_at
        ) * 1000

    @property
    def generation_ms(self) -> float | None:
        if (
            self.first_token_at is None
            or self.completed_at is None
        ):
            return None

        return (
            self.completed_at - self.first_token_at
        ) * 1000

    @property
    def tokens_per_second(self) -> float | None:
        if (
            self.output_tokens is None
            or self.generation_ms is None
            or self.generation_ms <= 0
        ):
            return None

        return (
            self.output_tokens
            / (self.generation_ms / 1000)
        )

    @property
    def context_utilization(self) -> float | None:
        if (
            self.input_tokens is None
            or not self.context_window
            or self.context_window <= 0
        ):
            return None

        return self.input_tokens / self.context_window

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_id": self.request_id,
            "method": self.method,
            "path": self.path,
            "model": self.model,
            "stream": self.stream,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "context_window": self.context_window,
            "context_utilization": self.context_utilization,
            "ttft_ms": self.ttft_ms,
            "generation_ms": self.generation_ms,
            "duration_ms": self.duration_ms,
            "tokens_per_second": self.tokens_per_second,
            "status_code": self.status_code,
            "error": self.error,
        }


class MetricsStore:
    """
    Thread-safe in-memory metrics store.

    Keeps only the most recent requests.
    """

    def __init__(self, max_items: int = 100):
        self.max_items = max_items

        self._items: list[RequestMetrics] = []

        self._lock = threading.RLock()

    def create(
        self,
        method: str,
        path: str,
    ) -> RequestMetrics:

        metrics = RequestMetrics(
            request_id=f"REQ-{uuid.uuid4().hex[:8].upper()}",
            method=method,
            path=path,
        )

        with self._lock:
            self._items.append(metrics)

            if len(self._items) > self.max_items:
                self._items.pop(0)

        return metrics

    def latest(self) -> RequestMetrics | None:
        with self._lock:
            if not self._items:
                return None

            return self._items[-1]

    def all(self) -> list[RequestMetrics]:
        with self._lock:
            return list(self._items)

    def summary(self) -> dict[str, Any]:
        with self._lock:
            completed = [
                item
                for item in self._items
                if item.completed_at is not None
            ]

        if not completed:
            return {
                "requests": 0,
                "completed": 0,
            }

        durations = [
            item.duration_ms
            for item in completed
            if item.duration_ms is not None
        ]

        speeds = [
            item.tokens_per_second
            for item in completed
            if item.tokens_per_second is not None
        ]

        return {
            "requests": len(self._items),
            "completed": len(completed),
            "average_duration_ms": (
                sum(durations) / len(durations)
                if durations
                else None
            ),
            "average_tokens_per_second": (
                sum(speeds) / len(speeds)
                if speeds
                else None
            ),
        }


metrics_store = MetricsStore()