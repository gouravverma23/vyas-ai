import os
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
    try:
        yield db
    finally:
        await db.close()

async def init_db():
    """Initialize SQLite database schema and indexes."""
    async with get_db() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                has_image INTEGER NOT NULL DEFAULT 0,
                image_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);")
        await db.commit()

async def insert_message(role: str, content: str, has_image: bool = False, image_data: Optional[str] = None) -> int:
    """Insert a new message and return its generated ID."""
    async with get_db() as db:
        cursor = await db.execute(
            """
            INSERT INTO messages (role, content, has_image, image_data, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (role, content, 1 if has_image else 0, image_data)
        )
        await db.commit()
        return cursor.lastrowid

async def get_recent_history(limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve the last `limit` messages in chronological order to hydrate the chat UI."""
    async with get_db() as db:
        async with db.execute(
            """
            SELECT id, role, content, has_image, image_data, created_at
            FROM messages
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
            messages = [
                {
                    "id": row["id"],
                    "role": row["role"],
                    "content": row["content"],
                    "has_image": bool(row["has_image"]),
                    "image_data": row["image_data"],
                    "created_at": row["created_at"],
                }
                for row in reversed(rows)
            ]
            return messages

async def get_context_turns(turn_count: int = 10) -> List[Dict[str, Any]]:
    """
    Query the last 8-10 turns (approx 16-20 messages) for LLM context.
    Returns messages formatted for Ollama: [{"role": role, "content": content}]
    """
    message_limit = turn_count * 2
    async with get_db() as db:
        async with db.execute(
            """
            SELECT role, content
            FROM messages
            ORDER BY id DESC
            LIMIT ?
            """,
            (message_limit,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]

async def clear_all_history() -> int:
    """Clear all chat messages from the database."""
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM messages;")
        await db.commit()
        return cursor.rowcount
