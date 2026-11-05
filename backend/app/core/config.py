import os

# Server settings
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))

# Database settings
DB_PATH = os.getenv(
    "DB_PATH",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "chat.db"))
)

# Ollama AI integration settings
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "qwen3.5:4b")
FALLBACK_VISION_MODEL = os.getenv("FALLBACK_VISION_MODEL", "qwen2.5-vl:3b")

# Limits & Validation
MAX_IMAGE_COUNT = 10
MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
ALLOWED_IMAGE_MIMES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
}

# CORS settings: localhost and 127.0.0.1 on any port
CORS_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

