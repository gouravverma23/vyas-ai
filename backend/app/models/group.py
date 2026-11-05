from typing import Optional
from pydantic import BaseModel

class CreateGroupRequest(BaseModel):
    name: str

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    is_expanded: Optional[bool] = None

