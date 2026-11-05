from typing import Optional
from pydantic import BaseModel

class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Chat"
    group_id: Optional[str] = None

class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    group_id: Optional[str] = None
    clear_group: Optional[bool] = False

