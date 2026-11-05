"""
Compatibility module: re-exports from app.core.database and app.repositories.
Prefer importing directly from app.core or app.repositories in new code.
"""
from app.core.database import get_db, init_db
from app.repositories.group_repo import list_groups, create_group, update_group, delete_group
from app.repositories.conversation_repo import (
    list_conversations,
    create_conversation,
    get_conversation,
    update_conversation,
    touch_conversation,
    delete_conversation,
)
from app.repositories.message_repo import (
    insert_message,
    get_recent_history,
    get_context_turns,
    clear_conversation_history,
    clear_all_history,
)

__all__ = [
    "get_db",
    "init_db",
    "list_groups",
    "create_group",
    "update_group",
    "delete_group",
    "list_conversations",
    "create_conversation",
    "get_conversation",
    "update_conversation",
    "touch_conversation",
    "delete_conversation",
    "insert_message",
    "get_recent_history",
    "get_context_turns",
    "clear_conversation_history",
    "clear_all_history",
]
