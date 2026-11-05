import uuid
from typing import List, Dict, Any, Optional
from app.core.database import get_db

async def list_groups() -> List[Dict[str, Any]]:
    """List all conversation groups with their conversation count."""
    async with get_db() as db:
        async with db.execute("""
            SELECT 
                g.id, 
                g.name, 
                g.is_expanded, 
                g.created_at, 
                g.updated_at,
                COUNT(c.id) as conversation_count
            FROM conversation_groups g
            LEFT JOIN conversations c ON c.group_id = g.id
            GROUP BY g.id
            ORDER BY g.created_at ASC;
        """) as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "is_expanded": bool(row["is_expanded"]),
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "conversation_count": row["conversation_count"]
                }
                for row in rows
            ]

async def create_group(name: str) -> Dict[str, Any]:
    """Create a new conversation group."""
    group_id = f"grp-{uuid.uuid4().hex[:10]}"
    clean_name = name.strip() or "Untitled Group"
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO conversation_groups (id, name, is_expanded, created_at, updated_at)
            VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """,
            (group_id, clean_name)
        )
        await db.commit()
    return {
        "id": group_id,
        "name": clean_name,
        "is_expanded": True,
        "conversation_count": 0
    }

async def update_group(
    group_id: str,
    name: Optional[str] = None,
    is_expanded: Optional[bool] = None
) -> Optional[Dict[str, Any]]:
    """Update group name or expansion state."""
    async with get_db() as db:
        updates = []
        params = []
        if name is not None:
            updates.append("name = ?")
            params.append(name.strip())
        if is_expanded is not None:
            updates.append("is_expanded = ?")
            params.append(1 if is_expanded else 0)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(group_id)
            await db.execute(
                f"UPDATE conversation_groups SET {', '.join(updates)} WHERE id = ?;",
                tuple(params)
            )
            await db.commit()

        async with db.execute(
            "SELECT id, name, is_expanded, created_at, updated_at FROM conversation_groups WHERE id = ?;",
            (group_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "is_expanded": bool(row["is_expanded"]),
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"]
                }
    return None

async def delete_group(group_id: str) -> bool:
    """Delete a group; its conversations will become ungrouped (group_id = NULL)."""
    async with get_db() as db:
        await db.execute("UPDATE conversations SET group_id = NULL WHERE group_id = ?;", (group_id,))
        cursor = await db.execute("DELETE FROM conversation_groups WHERE id = ?;", (group_id,))
        await db.commit()
        return cursor.rowcount > 0

