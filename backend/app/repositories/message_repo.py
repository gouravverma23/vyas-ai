from typing import List, Dict, Any, Optional
from app.core.database import get_db

async def insert_message(
    conversation_id: str,
    role: str,
    content: str,
    has_image: bool = False,
    image_data: Optional[str] = None
) -> int:
    """Insert a message linked to a conversation and return its ID."""
    async with get_db() as db:
        async with db.execute("SELECT id FROM conversations WHERE id = ?;", (conversation_id,)) as cursor:
            if not await cursor.fetchone():
                await db.execute(
                    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, 'New Chat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
                    (conversation_id,)
                )

        cursor = await db.execute(
            """
            INSERT INTO messages (conversation_id, role, content, has_image, image_data, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (conversation_id, role, content, 1 if has_image else 0, image_data)
        )
        await db.execute("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (conversation_id,))
        await db.commit()
        return cursor.lastrowid

async def get_recent_history(
    conversation_id: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Retrieve messages in chronological order, optionally filtered by conversation_id."""
    async with get_db() as db:
        if conversation_id:
            query = """
                SELECT id, conversation_id, role, content, has_image, image_data, created_at
                FROM messages
                WHERE conversation_id = ?
                ORDER BY id ASC
                LIMIT ?
            """
            params = (conversation_id, limit)
        else:
            query = """
                SELECT id, conversation_id, role, content, has_image, image_data, created_at
                FROM messages
                ORDER BY id DESC
                LIMIT ?
            """
            params = (limit,)

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            if not conversation_id:
                rows = list(reversed(rows))
            return [
                {
                    "id": row["id"],
                    "conversation_id": row["conversation_id"],
                    "role": row["role"],
                    "content": row["content"],
                    "has_image": bool(row["has_image"]),
                    "image_data": row["image_data"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]

async def get_context_turns(
    conversation_id: Optional[str] = None,
    turn_count: int = 3
) -> List[Dict[str, Any]]:
    """Query recent turns for LLM context, scoped to conversation_id."""
    message_limit = turn_count * 2
    async with get_db() as db:
        if conversation_id:
            query = """
                SELECT role, content
                FROM messages
                WHERE conversation_id = ?
                ORDER BY id DESC
                LIMIT ?
            """
            params = (conversation_id, message_limit)
        else:
            query = """
                SELECT role, content
                FROM messages
                ORDER BY id DESC
                LIMIT ?
            """
            params = (message_limit,)

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            raw_messages = [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]

            cleaned_messages: List[Dict[str, Any]] = []
            for msg in raw_messages:
                content = (msg.get("content") or "").strip()
                if not content:
                    continue
                if cleaned_messages and cleaned_messages[-1]["role"] == msg["role"]:
                    cleaned_messages[-1]["content"] += f"\n\n{content}"
                else:
                    cleaned_messages.append({"role": msg["role"], "content": content})

            return cleaned_messages

async def clear_conversation_history(conversation_id: str) -> int:
    """Clear messages for a specific conversation."""
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM messages WHERE conversation_id = ?;", (conversation_id,))
        await db.execute("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (conversation_id,))
        await db.commit()
        return cursor.rowcount

async def clear_all_history() -> int:
    """Clear all chat messages and conversations from the database."""
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM messages;")
        await db.execute("DELETE FROM conversations;")
        await db.execute("DELETE FROM conversation_groups;")
        await db.commit()
        return cursor.rowcount

