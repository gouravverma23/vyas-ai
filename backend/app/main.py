import base64
import json
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from app.database import init_db, insert_message, get_recent_history, get_context_turns, clear_all_history
from app.ollama_client import stream_ollama_chat, check_ollama_health, get_available_models, DEFAULT_MODEL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local_ai_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure SQLite database schema & WAL mode are configured
    logger.info("Initializing SQLite database with WAL mode...")
    await init_db()
    yield
    # Teardown logic if needed
    logger.info("Shutting down backend...")

app = FastAPI(
    title="Local AI Interface API",
    description="Offline-capable, local-first multimodal chat backend powered by SQLite & Ollama",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware for local React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    """Health check endpoint checking both backend and Ollama connectivity."""
    ollama_status = await check_ollama_health()
    return {
        "status": "healthy",
        "database": "sqlite_wal_active",
        "ollama": ollama_status
    }

@app.get("/models")
async def list_models():
    """List available local Ollama models."""
    models = await get_available_models()
    return {
        "models": models,
        "default": DEFAULT_MODEL
    }

@app.get("/history")
async def get_history(limit: int = 50):
    """
    Retrieve the last ordered messages to hydrate chat UI on reload.
    Returns up to `limit` messages (default 50) in chronological order.
    """
    try:
        messages = await get_recent_history(limit=limit)
        return {"messages": messages}
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch message history: {str(e)}"
        )

@app.delete("/history")
async def clear_history():
    """Clear all chat history from SQLite."""
    try:
        deleted_count = await clear_all_history()
        return {"status": "success", "deleted_messages": deleted_count}
    except Exception as e:
        logger.error(f"Error clearing history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear history: {str(e)}"
        )

@app.post("/chat")
async def chat(
    prompt: str = Form(...),
    image: Optional[UploadFile] = File(None),
    model: Optional[str] = Form(None)
):
    """
    Accepts multipart form data (prompt: string, optional image: file).
    1. Records user message into SQLite.
    2. Queries previous 8-10 conversation turns from SQLite for context.
    3. Encodes image as base64 if provided and appends to Ollama payload.
    4. Streams assistant tokens back via SSE.
    5. Persists the assistant completion into SQLite upon stream finish.
    """
    clean_prompt = prompt.strip()
    if not clean_prompt and not image:
        raise HTTPException(status_code=400, detail="Either prompt or image must be provided.")

    has_image = image is not None
    image_b64 = None
    image_data_uri = None

    if has_image:
        try:
            image_bytes = await image.read()
            if len(image_bytes) == 0:
                has_image = False
            else:
                image_b64 = base64.b64encode(image_bytes).decode("utf-8")
                mime_type = image.content_type or "image/png"
                image_data_uri = f"data:{mime_type};base64,{image_b64}"
        except Exception as e:
            logger.error(f"Failed to process attached image: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    # 1. Fetch the last 8-10 turns of conversation context BEFORE inserting current user prompt
    context_messages = await get_context_turns(turn_count=10)

    # 2. Persist user message to SQLite
    user_msg_id = await insert_message(
        role="user",
        content=clean_prompt,
        has_image=has_image,
        image_data=image_data_uri
    )

    # 3. Construct current message with optional multimodal payload
    current_message = {
        "role": "user",
        "content": clean_prompt
    }
    if has_image and image_b64:
        current_message["images"] = [image_b64]

    full_chat_payload = context_messages + [current_message]

    # 4. Stream response generator
    async def sse_event_stream():
        # First send an acknowledgment event with user_msg_id
        init_event = {
            "type": "init",
            "user_id": user_msg_id,
            "has_image": has_image
        }
        yield f"data: {json.dumps(init_event)}\n\n"

        assistant_full_text = ""

        try:
            async for chunk in stream_ollama_chat(
                messages=full_chat_payload,
                model=model,
                has_image=has_image
            ):
                token = chunk.get("token", "")
                is_done = chunk.get("done", False)

                if token:
                    assistant_full_text += token
                    event_data = {
                        "type": "chunk",
                        "token": token
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"

                if is_done:
                    # Capture full content if provided or use accumulated
                    if chunk.get("full_content"):
                        assistant_full_text = chunk["full_content"]
                    break

        except Exception as e:
            logger.error(f"Exception during stream: {e}")
            err_event = {
                "type": "error",
                "error": str(e)
            }
            yield f"data: {json.dumps(err_event)}\n\n"
            if not assistant_full_text:
                assistant_full_text = f"An error occurred: {str(e)}"

        # 5. Asynchronously persist completed assistant response into SQLite
        assistant_id = None
        try:
            if assistant_full_text.strip():
                assistant_id = await insert_message(
                    role="assistant",
                    content=assistant_full_text,
                    has_image=False,
                    image_data=None
                )
        except Exception as e:
            logger.error(f"Failed to persist assistant message to SQLite: {e}")

        # Send final completion event
        final_event = {
            "type": "done",
            "assistant_id": assistant_id,
            "full_content": assistant_full_text
        }
        yield f"data: {json.dumps(final_event)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
