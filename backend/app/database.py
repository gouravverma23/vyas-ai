import os
import uuid
import aiosqlite
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

DB_PATH = os.getenv("DB_PATH", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "chat.db")))

@asynccontextmanager
async def get_db():
    """Async context manager for SQLite database connection with WAL mode enabled."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode = WAL;")
    await db.execute("PRAGMA synchronous = NORMAL;")
    await db.execute("PRAGMA busy_timeout = 5000;")
    await db.execute("PRAGMA foreign_keys = ON;")
    try:
        yield db
    finally:
        await db.close()

async def init_db():
    """Initialize SQLite database schema, foreign keys, migrations and indexes."""
    async with get_db() as db:
        # 1. Groups table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversation_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_expanded INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Conversations table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                group_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES conversation_groups(id) ON DELETE SET NULL
            );
        """)

        # 3. Messages table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                has_image INTEGER NOT NULL DEFAULT 0,
                image_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
        """)

        # Check if conversation_id column exists in messages (migration for existing DBs)
        async with db.execute("PRAGMA table_info(messages);") as cursor:
            columns = [row["name"] for row in await cursor.fetchall()]
            if "conversation_id" not in columns:
                await db.execute("ALTER TABLE messages ADD COLUMN conversation_id TEXT;")

        # Migrate any orphaned messages that have conversation_id NULL
        async with db.execute("SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IS NULL;") as cursor:
            res = await cursor.fetchone()
            orphaned_count = res["cnt"] if res else 0

        if orphaned_count > 0:
            default_conv_id = "conv-migrated-initial"
            # Check if this conv exists
            async with db.execute("SELECT id FROM conversations WHERE id = ?;", (default_conv_id,)) as cursor:
                conv_exists = await cursor.fetchone()
            
            if not conv_exists:
                await db.execute(
                    """
                    INSERT INTO conversations (id, title, group_id, created_at, updated_at)
                    VALUES (?, 'Previous Conversation', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                    """,
                    (default_conv_id,)
                )
            
            await db.execute(
                "UPDATE messages SET conversation_id = ? WHERE conversation_id IS NULL;",
                (default_conv_id,)
            )

        # Create indexes
        await db.execute("CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_conversations_group_id ON conversations(group_id);")
        await db.commit()

# --- Group Operations ---

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

async def update_group(group_id: str, name: Optional[str] = None, is_expanded: Optional[bool] = None) -> Optional[Dict[str, Any]]:
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

        async with db.execute("SELECT id, name, is_expanded, created_at, updated_at FROM conversation_groups WHERE id = ?;", (group_id,)) as cursor:
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

# --- Conversation Operations ---

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
        # Check if group exists if group_id provided
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

        # Get group name
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
                    # Update title to summary of first prompt
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

# --- Message Operations ---

async def insert_message(
    conversation_id: str,
    role: str,
    content: str,
    has_image: bool = False,
    image_data: Optional[str] = None
) -> int:
    """Insert a message linked to a conversation and return its ID."""
    async with get_db() as db:
        # Verify conversation exists or create on the fly
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

async def get_recent_history(conversation_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
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

async def get_context_turns(conversation_id: Optional[str] = None, turn_count: int = 3) -> List[Dict[str, Any]]:
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
