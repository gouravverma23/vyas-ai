from fastapi import APIRouter
from app.services.ollama_service import check_ollama_health, get_available_models
from app.core.config import DEFAULT_MODEL

router = APIRouter(tags=["System"])

@router.get("/health")
async def health():
    """Health check endpoint checking both backend and Ollama connectivity."""
    ollama_status = await check_ollama_health()
    return {
        "status": "healthy",
        "database": "sqlite_wal_active",
        "ollama": ollama_status
    }

@router.get("/models")
async def list_models():
    """List available local Ollama models."""
    models = await get_available_models()
    return {
        "models": models,
        "default": DEFAULT_MODEL
    }

