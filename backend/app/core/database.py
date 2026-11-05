import aiosqlite
import logging
from contextlib import asynccontextmanager
from app.core.config import DB_PATH

logger = logging.getLogger("local_ai_backend.database")

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

        # Migration check: ensure conversation_id column exists
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

        # Create indexes for optimal lookup performance
        await db.execute("CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_conversations_group_id ON conversations(group_id);")
        await db.commit()
        logger.info("Database initialized successfully with WAL mode.")

