import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Query, Body
from app.models.conversation import CreateConversationRequest, UpdateConversationRequest
from app.repositories.conversation_repo import (
    list_conversations,
    create_conversation,
    get_conversation,
    update_conversation,
    delete_conversation,
)
from app.repositories.group_repo import list_groups
from app.repositories.message_repo import (
    get_recent_history,
    clear_conversation_history,
    clear_all_history,
)

logger = logging.getLogger("local_ai_backend.api.conversations")
router = APIRouter(tags=["Conversations & History"])

@router.get("/conversations")
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

@router.post("/conversations", status_code=status.HTTP_201_CREATED)
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

@router.get("/conversations/{conversation_id}")
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

@router.patch("/conversations/{conversation_id}")
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

@router.delete("/conversations/{conversation_id}")
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

# --- History Endpoints ---

@router.get("/history")
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

@router.delete("/history")
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

