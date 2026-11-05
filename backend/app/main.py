import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGIN_REGEX
from app.core.database import init_db
from app.api import api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local_ai_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SQLite database with WAL mode and schema...")
    await init_db()
    yield
    logger.info("Shutting down backend...")

app = FastAPI(
    title="Local AI Interface API",
    description="Offline-capable, local-first multimodal chat backend with conversation & group management",
    version="1.2.0",
    lifespan=lifespan
)

# CORS Middleware: allow local development ports on localhost / 127.0.0.1
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all modular domain routers
app.include_router(api_router)
