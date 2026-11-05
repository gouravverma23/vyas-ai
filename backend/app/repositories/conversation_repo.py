import uuid
from typing import List, Dict, Any, Optional
from app.core.database import get_db

async def list_conversations() -> List[Dict[str, Any]]:
    """Retrieve all conversations ordered by recent activity, including message count and group info."""
    async with get_db() as db:
        async with db.execute("""
            SELECT 
                c.id,
                c.title,
                c.group_id,
                g.name as group_name,
                c.created_at,
                c.updated_at,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
                (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) as last_message
            FROM conversations c
            LEFT JOIN conversation_groups g ON c.group_id = g.id
            ORDER BY c.updated_at DESC;
        """) as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "id": row["id"],
                    "title": row["title"],
                    "group_id": row["group_id"],
                    "group_name": row["group_name"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "message_count": row["message_count"],
                    "last_message": row["last_message"][:80] if row["last_message"] else None
                }
                for row in rows
            ]

async def create_conversation(title: str = "New Chat", group_id: Optional[str] = None) -> Dict[str, Any]:
    """Create a new conversation, optionally assigned to a group."""
    conv_id = f"conv-{uuid.uuid4().hex[:10]}"
    clean_title = title.strip() or "New Chat"
    clean_group_id = group_id.strip() if group_id and group_id.strip() else None

    async with get_db() as db:
        if clean_group_id:
            async with db.execute("SELECT id FROM conversation_groups WHERE id = ?;", (clean_group_id,)) as cursor:
                if not await cursor.fetchone():
                    clean_group_id = None

        await db.execute(
            """
            INSERT INTO conversations (id, title, group_id, created_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """,
            (conv_id, clean_title, clean_group_id)
        )
        await db.commit()

        group_name = None
        if clean_group_id:
            async with db.execute("SELECT name FROM conversation_groups WHERE id = ?;", (clean_group_id,)) as cursor:
                row = await cursor.fetchone()
                if row:
                    group_name = row["name"]

    return {
        "id": conv_id,
        "title": clean_title,
        "group_id": clean_group_id,
        "group_name": group_name,
        "message_count": 0,
        "last_message": None
    }

async def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
    """Get single conversation info."""
    async with get_db() as db:
        async with db.execute("""
            SELECT 
                c.id, c.title, c.group_id, g.name as group_name, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
            FROM conversations c
            LEFT JOIN conversation_groups g ON c.group_id = g.id
            WHERE c.id = ?;
        """, (conv_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "title": row["title"],
                "group_id": row["group_id"],
                "group_name": row["group_name"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "message_count": row["message_count"]
            }

async def update_conversation(
    conv_id: str,
    title: Optional[str] = None,
    group_id: Optional[str] = None,
    clear_group: bool = False
) -> Optional[Dict[str, Any]]:
    """Update conversation title or group assignment."""
    async with get_db() as db:
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(title.strip() or "Untitled Chat")
        if clear_group:
            updates.append("group_id = NULL")
        elif group_id is not None:
            updates.append("group_id = ?")
            params.append(group_id.strip() if group_id.strip() else None)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(conv_id)
            await db.execute(
                f"UPDATE conversations SET {', '.join(updates)} WHERE id = ?;",
                tuple(params)
            )
            await db.commit()

    return await get_conversation(conv_id)

async def touch_conversation(conv_id: str, auto_title: Optional[str] = None):
    """Update conversation updated_at timestamp, and optionally update title if still default."""
    async with get_db() as db:
        if auto_title:
            async with db.execute("SELECT title FROM conversations WHERE id = ?;", (conv_id,)) as cursor:
                row = await cursor.fetchone()
                if row and row["title"] in ("New Chat", "Untitled Chat", ""):
                    clean_title = auto_title.strip().replace("\n", " ")
                    if len(clean_title) > 36:
                        clean_title = clean_title[:33] + "..."
                    await db.execute(
                        "UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;",
                        (clean_title, conv_id)
                    )
                    await db.commit()
                    return

        await db.execute("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (conv_id,))
        await db.commit()

async def delete_conversation(conv_id: str) -> bool:
    """Delete a conversation and all its messages."""
    async with get_db() as db:
        await db.execute("DELETE FROM messages WHERE conversation_id = ?;", (conv_id,))
        cursor = await db.execute("DELETE FROM conversations WHERE id = ?;", (conv_id,))
        await db.commit()
        return cursor.rowcount > 0

