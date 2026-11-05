import base64
import json
import logging
import asyncio
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.config import (
    MAX_IMAGE_COUNT,
    MAX_IMAGE_SIZE_BYTES,
    ALLOWED_IMAGE_MIMES
)
from app.repositories.conversation_repo import create_conversation, touch_conversation
from app.repositories.message_repo import insert_message, get_context_turns
from app.services.ollama_service import stream_ollama_chat

logger = logging.getLogger("local_ai_backend.api.chat")
router = APIRouter(tags=["Chat"])

@router.post("/chat")
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
    - image: optional single uploaded file (backwards compatibility)
    - model: optional model name
    - think: optional thinking mode boolean string
    - is_temporary: optional boolean string (if true, chat is not persisted to SQLite)
    - context_messages: optional JSON string for temporary chat context
    """
    clean_prompt = prompt.strip()

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
    image_data_payload: Optional[str] = None
    if image_data_uris:
        if len(image_data_uris) == 1:
            image_data_payload = image_data_uris[0]
        else:
            image_data_payload = json.dumps(image_data_uris)

    if is_temp:
        active_conv_id = "temporary"
        user_msg_id = f"temp-user-{uuid.uuid4().hex[:8]}"

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

        context_payload = temp_context_list[-6:]
    else:
        active_conv_id = conversation_id.strip() if conversation_id and conversation_id.strip() else None
        if not active_conv_id:
            title_summary = clean_prompt.replace("\n", " ") if clean_prompt else "Image Analysis"
            if len(title_summary) > 36:
                title_summary = title_summary[:33] + "..."
            new_conv = await create_conversation(title=title_summary or "New Chat")
            active_conv_id = new_conv["id"]
        else:
            await touch_conversation(active_conv_id, auto_title=clean_prompt or "Image Analysis")

        context_payload = await get_context_turns(conversation_id=active_conv_id, turn_count=3)
        user_msg_id = await insert_message(
            conversation_id=active_conv_id,
            role="user",
            content=clean_prompt,
            has_image=has_images,
            image_data=image_data_payload
        )

    current_message = {
        "role": "user",
        "content": clean_prompt
    }
    if image_b64_list:
        current_message["images"] = image_b64_list

    full_chat_payload = context_payload + [current_message]

    async def sse_event_stream():
        # 2KB comment padding to avoid proxy buffering
        yield f": {' ' * 2048}\n\n"

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
                f"Client disconnected during generation. "
                f"Saving partial response ({len(assistant_full_text)} chars) to {active_conv_id}."
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
            await persist_assistant_response(assistant_full_text)

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

