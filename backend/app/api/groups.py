import logging
from fastapi import APIRouter, HTTPException, status
from app.models.group import CreateGroupRequest, UpdateGroupRequest
from app.repositories.group_repo import (
    create_group,
    update_group,
    delete_group,
)

logger = logging.getLogger("local_ai_backend.api.groups")
router = APIRouter(prefix="/groups", tags=["Groups"])

@router.post("", status_code=status.HTTP_201_CREATED)
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

@router.patch("/{group_id}")
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

@router.delete("/{group_id}")
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

