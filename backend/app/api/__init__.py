from fastapi import APIRouter
from app.api.system import router as system_router
from app.api.groups import router as groups_router
from app.api.conversations import router as conversations_router
from app.api.chat import router as chat_router

api_router = APIRouter()
api_router.include_router(system_router)
api_router.include_router(groups_router)
api_router.include_router(conversations_router)
api_router.include_router(chat_router)

__all__ = ["api_router"]

