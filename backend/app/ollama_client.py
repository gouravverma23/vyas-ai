"""
Compatibility module: re-exports from app.services.ollama_service and app.core.config.
Prefer importing directly from app.services or app.core in new code.
"""
from app.core.config import OLLAMA_BASE_URL, DEFAULT_MODEL, FALLBACK_VISION_MODEL
from app.services.ollama_service import (
    get_available_models,
    check_ollama_health,
    stream_ollama_chat,
)

__all__ = [
    "OLLAMA_BASE_URL",
    "DEFAULT_MODEL",
    "FALLBACK_VISION_MODEL",
    "get_available_models",
    "check_ollama_health",
    "stream_ollama_chat",
]
