import base64
import json
import logging
import asyncio
import uuid
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

from app.database import (
    init_db,
    insert_message,
    get_recent_history,
    get_context_turns,
    clear_all_history,
    clear_conversation_history,
    list_conversations,
    create_conversation,
    get_conversation,
    update_conversation,
    delete_conversation,
    touch_conversation,
    list_groups,
    create_group,
    update_group,
    delete_group,
)
from app.ollama_client import stream_ollama_chat, check_ollama_health, get_available_models, DEFAULT_MODEL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local_ai_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure SQLite database schema & WAL mode are configured
    logger.info("Initializing SQLite database with WAL mode and schema...")
    await init_db()
    yield
    # Teardown logic if needed
    logger.info("Shutting down backend...")

app = FastAPI(
    title="Local AI Interface API",
    description="Offline-capable, local-first multimodal chat backend with conversation & group management",
    version="1.1.0",
    lifespan=lifespan
)

# CORS Middleware: allow all local development ports on localhost/127.0.0.1 (Vite, Next, React)
# while strictly blocking external/public web domains from making drive-by requests.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Request Schemas ---

class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Chat"
    group_id: Optional[str] = None

class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    group_id: Optional[str] = None
    clear_group: Optional[bool] = False

class CreateGroupRequest(BaseModel):
    name: str

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    is_expanded: Optional[bool] = None

# --- Status Endpoints ---

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

# --- Conversation & Group Endpoints ---

@app.get("/conversations")
async def get_all_conversations():
    """Retrieve all conversations and groups for the sidebar."""
    try:
        conversations = await list_conversations()
        groups = await list_groups()
        return {
            "conversations": conversations,
            "groups": groups
        }
    except Exception as e:
        logger.error(f"Error fetching conversations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch conversations: {str(e)}"
        )

@app.post("/conversations")
async def create_new_conversation(req: CreateConversationRequest = Body(default_factory=CreateConversationRequest)):
    """Create a new conversation optionally inside a group."""
    try:
        conv = await create_conversation(title=req.title or "New Chat", group_id=req.group_id)
        return conv
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create conversation: {str(e)}"
        )

@app.get("/conversations/{conversation_id}")
async def get_single_conversation(conversation_id: str):
    """Get metadata and messages for a specific conversation."""
    try:
        conv = await get_conversation(conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        messages = await get_recent_history(conversation_id=conversation_id, limit=100)
        return {
            "conversation": conv,
            "messages": messages
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve conversation: {str(e)}"
        )

@app.patch("/conversations/{conversation_id}")
async def update_single_conversation(conversation_id: str, req: UpdateConversationRequest):
    """Rename conversation or change its group assignment."""
    try:
        updated = await update_conversation(
            conv_id=conversation_id,
            title=req.title,
            group_id=req.group_id,
            clear_group=bool(req.clear_group)
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update conversation: {str(e)}"
        )

@app.delete("/conversations/{conversation_id}")
async def delete_single_conversation(conversation_id: str):
    """Delete a conversation and its messages."""
    try:
        success = await delete_conversation(conversation_id)
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"status": "success", "deleted_id": conversation_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete conversation: {str(e)}"
        )

# --- Group Endpoints ---

@app.post("/groups")
async def create_new_group(req: CreateGroupRequest):
    """Create a new group for organizing conversations."""
    try:
        group = await create_group(name=req.name)
        return group
    except Exception as e:
        logger.error(f"Error creating group: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create group: {str(e)}"
        )

@app.patch("/groups/{group_id}")
async def update_single_group(group_id: str, req: UpdateGroupRequest):
    """Rename or toggle group expansion."""
    try:
        group = await update_group(group_id=group_id, name=req.name, is_expanded=req.is_expanded)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        return group
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating group {group_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update group: {str(e)}"
        )

@app.delete("/groups/{group_id}")
async def delete_single_group(group_id: str):
    """Delete a group. Its conversations are safely ungrouped."""
    try:
        success = await delete_group(group_id)
        return {"status": "success", "deleted_group_id": group_id}
    except Exception as e:
        logger.error(f"Error deleting group {group_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete group: {str(e)}"
        )

# --- History Endpoints ---

@app.get("/history")
async def get_history(
    conversation_id: Optional[str] = Query(None),
    limit: int = Query(100)
):
    """Retrieve message history, optionally filtered by conversation_id."""
    try:
        messages = await get_recent_history(conversation_id=conversation_id, limit=limit)
        return {"messages": messages}
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch message history: {str(e)}"
        )

@app.delete("/history")
async def clear_history(conversation_id: Optional[str] = Query(None)):
    """Clear chat history: for a specific conversation or all history."""
    try:
        if conversation_id:
            deleted_count = await clear_conversation_history(conversation_id)
            return {"status": "success", "conversation_id": conversation_id, "deleted_messages": deleted_count}
        else:
            deleted_count = await clear_all_history()
            return {"status": "success", "deleted_messages": deleted_count}
    except Exception as e:
        logger.error(f"Error clearing history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear history: {str(e)}"
        )

# --- Chat Streaming Endpoint ---

@app.post("/chat")
async def chat(
    prompt: str = Form(...),
    conversation_id: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
    image: Optional[UploadFile] = File(None),
    model: Optional[str] = Form(None),
    think: Optional[str] = Form("false"),
    is_temporary: Optional[str] = Form("false"),
    context_messages: Optional[str] = Form(None)
):
    """
    Accepts multipart form data:
    - prompt: string
    - conversation_id: optional string
    - images: optional multiple uploaded files
    - image: optional single uploaded file (for backwards compatibility)
    - model: optional model name
    - think: optional thinking mode boolean string
    - is_temporary: optional boolean string (if true, chat is not persisted to SQLite)
    - context_messages: optional JSON string for temporary chat context

    Persists messages scoped to the conversation and streams tokens via SSE.
    Supports single or multiple images passed to multimodal vision models.
    """
    clean_prompt = prompt.strip()

    # Collect all image files (both from `images` list and optional single `image`)
    all_files: List[UploadFile] = []
    if images:
        all_files.extend(images)
    if image and image not in all_files:
        all_files.append(image)

    if not clean_prompt and not all_files:
        raise HTTPException(status_code=400, detail="Either prompt or at least one image must be provided.")

    think_enabled = False
    if think:
        think_enabled = str(think).strip().lower() in ("true", "1", "yes", "on")

    is_temp = str(is_temporary).strip().lower() in ("true", "1", "yes", "on")

    image_b64_list: List[str] = []
    image_data_uris: List[str] = []

    MAX_IMAGE_COUNT = 10
    MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB per image
    ALLOWED_IMAGE_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}

    if len(all_files) > MAX_IMAGE_COUNT:
        raise HTTPException(status_code=400, detail=f"Too many images. Max allowed: {MAX_IMAGE_COUNT} images.")

    for img_file in all_files:
        if img_file and img_file.filename:
            mime = (img_file.content_type or "image/png").lower()
            if mime not in ALLOWED_IMAGE_MIMES:
                raise HTTPException(status_code=400, detail=f"Unsupported format '{mime}'. Allowed: PNG, JPEG, WEBP, GIF.")
            try:
                img_bytes = await img_file.read()
                if len(img_bytes) > MAX_IMAGE_SIZE_BYTES:
                    raise HTTPException(status_code=400, detail=f"Image '{img_file.filename}' exceeds 25 MB limit.")
                if len(img_bytes) > 0:
                    b64 = base64.b64encode(img_bytes).decode("utf-8")
                    image_b64_list.append(b64)
                    image_data_uris.append(f"data:{mime};base64,{b64}")
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Failed to process attached image '{img_file.filename}': {e}")
                raise HTTPException(status_code=400, detail=f"Invalid image file '{img_file.filename}': {str(e)}")

    has_images = len(image_b64_list) > 0
    # Store single string if 1 image, JSON string list if multiple images for clean backwards-compatibility
    image_data_payload: Optional[str] = None
    if image_data_uris:
        if len(image_data_uris) == 1:
            image_data_payload = image_data_uris[0]
        else:
            image_data_payload = json.dumps(image_data_uris)

    if is_temp:
        active_conv_id = "temporary"
        user_msg_id = f"temp-user-{uuid.uuid4().hex[:8]}"

        # Parse context messages passed from frontend for temporary session
        temp_context_list: List[Dict[str, Any]] = []
        if context_messages:
            try:
                parsed = json.loads(context_messages)
                if isinstance(parsed, list):
                    for item in parsed:
                        if isinstance(item, dict) and item.get("content") and item.get("role"):
                            temp_context_list.append({
                                "role": item["role"],
                                "content": item["content"]
                            })
            except Exception as e:
                logger.warning(f"Failed to parse temporary context_messages: {e}")

        # Lean context for CPU (last 6 messages = 3 turns)
        context_payload = temp_context_list[-6:]
    else:
        # Standard persistent SQLite DB path
        active_conv_id = conversation_id.strip() if conversation_id and conversation_id.strip() else None
        if not active_conv_id:
            # Create a new conversation with title extracted from the prompt
            title_summary = clean_prompt.replace("\n", " ") if clean_prompt else "Image Analysis"
            if len(title_summary) > 36:
                title_summary = title_summary[:33] + "..."
            new_conv = await create_conversation(title=title_summary or "New Chat")
            active_conv_id = new_conv["id"]
        else:
            # Update existing conversation timestamp and update default title if appropriate
            await touch_conversation(active_conv_id, auto_title=clean_prompt or "Image Analysis")

        # 1. Fetch recent conversation context scoped to active conversation
        context_payload = await get_context_turns(conversation_id=active_conv_id, turn_count=3)

        # 2. Persist user message to SQLite with conversation_id
        user_msg_id = await insert_message(
            conversation_id=active_conv_id,
            role="user",
            content=clean_prompt,
            has_image=has_images,
            image_data=image_data_payload
        )

    # 3. Construct current message with optional multimodal payload
    current_message = {
        "role": "user",
        "content": clean_prompt
    }
    if image_b64_list:
        current_message["images"] = image_b64_list

    full_chat_payload = context_payload + [current_message]

    # 4. Stream response generator
    async def sse_event_stream():
        # Immediate 2KB comment padding to bypass any browser/proxy network buffering
        yield f": {' ' * 2048}\n\n"

        # Send an acknowledgment event with conversation_id and user_msg_id
        init_event = {
            "type": "init",
            "conversation_id": active_conv_id,
            "user_id": user_msg_id,
            "has_image": has_images,
            "image_count": len(image_b64_list),
            "is_temporary": is_temp
        }
        yield f"data: {json.dumps(init_event)}\n\n"

        assistant_full_text = ""
        is_persisted = False
        persisted_assistant_id = None

        async def persist_assistant_response(text: str, is_partial: bool = False):
            if is_temp:
                # Never persist temporary chats to SQLite database
                return None

            nonlocal is_persisted, persisted_assistant_id
            clean_text = text.strip()
            if not is_persisted and clean_text:
                is_persisted = True
                try:
                    persisted_assistant_id = await asyncio.shield(
                        insert_message(
                            conversation_id=active_conv_id,
                            role="assistant",
                            content=clean_text,
                            has_image=False,
                            image_data=None
                        )
                    )
                    logger.info(
                        f"Persisted {'partial' if is_partial else 'completed'} assistant response "
                        f"(length={len(clean_text)}, id={persisted_assistant_id}, conv={active_conv_id})"
                    )
                    return persisted_assistant_id
                except Exception as e:
                    logger.error(f"Failed to persist assistant message to SQLite: {e}")
                    return None
            return persisted_assistant_id

        try:
            async for chunk in stream_ollama_chat(
                messages=full_chat_payload,
                model=model,
                has_image=has_images,
                think=think_enabled
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
                    if chunk.get("full_content"):
                        assistant_full_text = chunk["full_content"]
                    break

        except (asyncio.CancelledError, GeneratorExit):
            logger.info(
                f"Client disconnected or cancelled generation. "
                f"Saving partial response ({len(assistant_full_text)} chars) to conversation {active_conv_id}."
            )
            await persist_assistant_response(assistant_full_text, is_partial=True)
            raise
        except Exception as e:
            err_type = type(e).__name__
            err_msg = str(e).strip() or err_type
            logger.error(f"Exception during stream ({err_type}): {e}", exc_info=True)
            err_event = {
                "type": "error",
                "error": f"{err_type}: {err_msg}"
            }
            yield f"data: {json.dumps(err_event)}\n\n"
            if not assistant_full_text:
                assistant_full_text = f"An error occurred ({err_type}): {err_msg}"
        finally:
            # Guarantee persistence for any other exit path (normal completion or unhandled error)
            await persist_assistant_response(assistant_full_text)

        # Send final completion event
        final_event = {
            "type": "done",
            "conversation_id": active_conv_id,
            "assistant_id": f"temp-asst-{uuid.uuid4().hex[:8]}" if is_temp else persisted_assistant_id,
            "full_content": assistant_full_text,
            "is_temporary": is_temp
        }
        yield f"data: {json.dumps(final_event)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
