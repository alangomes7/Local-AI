"""Executable compatibility entry point for the local AI server."""

from __future__ import annotations

import sys
from pathlib import Path


# ============================================================================
# Direct execution compatibility
# ============================================================================

if __package__ in {None, ""}:
    sys.path.insert(
        0,
        str(
            Path(__file__).resolve().parent.parent
        ),
    )


# ============================================================================
# Application
# ============================================================================

from server.application import (
    create_server,
    main,
    shutdown_server,
)


# ============================================================================
# Memory
# ============================================================================

from server.memory import (
    cleanup_memory,
    estimate_model_memory_bytes,
    format_memory_size,
    get_system_memory_status,
)


# ============================================================================
# Models
# ============================================================================

from server.models import (
    get_loaded_models,
    load_model,
    unload_all_models,
    unload_model,
)


# ============================================================================
# Routes
# ============================================================================

from server.routes import (
    add_custom_routes,
    log_registered_routes,
)


# ============================================================================
# State
# ============================================================================

from server.state import (
    HOST,
    PORT,
    MODEL_TIMEOUT,
    ENABLE_CORS,
    LOG_LEVEL,
    DEVICE,
    DTYPE,
    TRUST_REMOTE_CODE,
    CONTINUOUS_BATCHING,
    canonical_model_name,
    get_generation_state,
    get_model_manager,
    logger,
)


# ============================================================================
# Metrics
# ============================================================================

try:
    from server.metrics import (
        MetricsStore,
        RequestMetrics,
    )
except ImportError:
    # Keep backwards compatibility while metrics.py is being introduced.
    MetricsStore = None
    RequestMetrics = None


# ============================================================================
# Public API
# ============================================================================

__all__ = [
    # Application
    "create_server",
    "main",
    "shutdown_server",

    # Memory
    "cleanup_memory",
    "estimate_model_memory_bytes",
    "format_memory_size",
    "get_system_memory_status",

    # Models
    "get_loaded_models",
    "load_model",
    "unload_model",
    "unload_all_models",

    # Routes
    "add_custom_routes",
    "log_registered_routes",

    # State
    "canonical_model_name",
    "get_generation_state",
    "get_model_manager",

    # Configuration
    "HOST",
    "PORT",
    "MODEL_TIMEOUT",
    "ENABLE_CORS",
    "LOG_LEVEL",
    "DEVICE",
    "DTYPE",
    "TRUST_REMOTE_CODE",
    "CONTINUOUS_BATCHING",

    # Logging
    "logger",

    # Metrics
    "MetricsStore",
    "RequestMetrics",
]


# ============================================================================
# Executable entry point
# ============================================================================

if __name__ == "__main__":
    main()