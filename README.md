# Local AI Interface

An offline-first, local multimodal AI interface powered by **Ollama**, **FastAPI**, **SQLite (WAL Mode)**, and **React 19 + Vite + Tailwind CSS**.

Run powerful open-source large language models and vision models on your own hardware with zero cloud dependencies, complete data privacy, and a responsive interface designed for technical workflows.

---

## Highlights & Core Features

- **100% Private & Offline**: All computation, embeddings, and chat histories remain strictly on your local machine. No external telemetry or cloud dependencies.
- **Server-Sent Events (SSE) Streaming**: Low-latency token streaming with pause/abort controls and auto-scrolling buffer detection.
- **Deep Thinking Process Toggle**: Dedicated reasoning mode switch in the input bar. Automatically detects `<think>` reasoning tokens and renders them inside an expandable, collapsible thinking accordion.
- **Multimodal Vision Support**: Attach single or multiple local images (via file browser, drag-and-drop, or clipboard paste) to inspect diagrams, extract text, or perform visual analysis with vision-enabled models (e.g., `qwen2.5-vl:3b`, `llava`). Includes full-screen image lightbox inspection.
- **Scientific KaTeX LaTeX Mathematics**: Preprocesses and renders both inline equations (`$f(x)$`, `\(...\)`) and multi-line display blocks (`$$\dots$$`, `\[...\]`, matrices, cases, and aligned systems) cleanly without formatting degradation.
- **Interactive Mermaid Diagrams**: Automatically identifies Mermaid syntax and renders interactive architectural flowcharts, sequence diagrams, entity-relationship models, class diagrams, state machines, and Gantt charts with zoom, pan, copy, and SVG/PNG export.
- **Syntax-Highlighted Code Blocks**: PrismJS syntax highlighting across dozens of languages, featuring language badges, clean line numbers, and one-click clipboard copying.
- **Conversation Organization & Folder Groups**:
  - Organize chats into collapsible folder groups (e.g. *Work*, *Research*, *Projects*).
  - Move conversations between folders via intuitive context menus.
  - Persistent group expansion states stored in SQLite.
  - Full-text search to quickly find previous conversations and messages.
- **Temporary Incognito Chat Mode**: Switch to an ephemeral session with a single click. Temporary messages are stored only in volatile memory and are never written to SQLite or disk.
- **High-Performance Async SQLite with WAL Mode**: Utilizes Python's `aiosqlite` with Write-Ahead Logging (`PRAGMA journal_mode=WAL`) and optimized pragmas (`NORMAL` synchronous, 64MB memory cache), preventing database locks during concurrent reads and writes.

---

## System Architecture

The codebase follows a modular, feature-oriented structure with clean boundaries between presentation, state orchestration, data persistence, and AI streaming:

```
LocalAIInterface/
├── backend/
│   ├── app/
│   │   ├── api/              # Domain-driven FastAPI routers
│   │   │   ├── chat.py           # SSE streaming endpoint with multipart image ingestion
│   │   │   ├── conversations.py  # Conversation & message history endpoints
│   │   │   ├── groups.py         # Folder group CRUD & expansion management
│   │   │   └── system.py         # /health and /models endpoints
│   │   ├── core/             # Configuration & connection management
│   │   │   ├── config.py         # App settings & environment variables
│   │   │   └── database.py       # Async SQLite connection pool with WAL mode pragmas
│   │   ├── models/           # Pydantic validation schemas
│   │   │   ├── conversation.py   # Conversation create/update models
│   │   │   └── group.py          # Group create/update models
│   │   ├── repositories/     # Database access layer
│   │   │   ├── conversation_repo.py # Conversation queries & metadata
│   │   │   ├── group_repo.py        # Group CRUD & ordering queries
│   │   │   └── message_repo.py      # Message storage & history clearing
│   │   ├── services/         # AI integration layer
│   │   │   └── ollama_service.py # Ollama streaming client & TTL model caching
│   │   └── main.py           # Slim FastAPI application factory & CORS setup
│   ├── chat.db               # SQLite database file (WAL mode)
│   ├── requirements.txt      # Python dependencies
│   └── run.py                # Server entry point (Uvicorn runner)
├── frontend/
│   ├── src/
│   │   ├── api/              # Centralized backend HTTP client
│   │   │   ├── client.js         # Base fetch wrapper with error handling
│   │   │   ├── chat.js           # SSE streaming parser & abort controller
│   │   │   ├── conversations.js  # Conversation API calls
│   │   │   ├── groups.js         # Group API calls
│   │   │   └── system.js         # Health & models discovery calls
│   │   ├── components/
│   │   │   ├── chat/             # Conversational UI components
│   │   │   │   ├── ChatMessage.jsx   # Right-aligned user bubbles, left-aligned AI responses
│   │   │   │   └── ChatInput.jsx     # Multimodal input bar with thinking toggle & model selector
│   │   │   ├── common/           # Reusable UI widgets
│   │   │   │   ├── CodeBlock.jsx     # Prism syntax highlighting with copy button
│   │   │   │   └── MermaidBlock.jsx  # Interactive diagram viewer with pan/zoom/export
│   │   │   └── layout/           # Shell and navigation
│   │   │       ├── Header.jsx        # Status badge, model indicator, rename bar
│   │   │       └── Sidebar.jsx       # Collapsible folder tree, search, incognito toggle
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useConversations.js   # Conversation & folder CRUD state management
│   │   │   └── useChat.js            # Message history, SSE streaming, temporary chat
│   │   ├── utils/            # Shared utilities
│   │   │   ├── markdown.js       # KaTeX LaTeX regex preprocessor & Mermaid detector
│   │   │   └── formatters.js     # Timestamp & size formatting helpers
│   │   ├── App.jsx           # Clean root orchestrator (~240 lines)
│   │   ├── index.css         # Tailwind & custom prose typography styling
│   │   └── main.jsx          # React DOM entry point
│   ├── package.json          # Vite + React 19 dependencies
│   └── vite.config.js        # Vite dev server configuration & API proxy
├── README.md
└── .gitignore
```

---

## Prerequisites

Before starting, ensure you have the following installed on your system:

1. **[Python 3.10+](https://www.python.org/downloads/)**
2. **[Node.js 18+](https://nodejs.org/)** and `npm`
3. **[Ollama](https://ollama.com/)** running locally

---

## Quick Start Guide

### 1. Start Ollama and Pull Models

Make sure your local Ollama service is active. Pull your preferred text and vision models:

```bash
# Verify Ollama is running
ollama list

# Pull a lightweight text/reasoning model (default)
ollama pull qwen3.5:4b

# (Optional) Pull a vision-capable multimodal model for image attachments
ollama pull qwen2.5-vl:3b
# or
ollama pull llava
```

---

### 2. Setup and Run the Backend

Open a terminal in the root repository folder:

#### Windows (PowerShell)
```powershell
# 1. Activate the Python virtual environment
.\venv\Scripts\Activate.ps1

# (If PowerShell blocks script execution, run this first):
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Start the FastAPI backend server
python backend/run.py
```

#### Windows (Command Prompt)
```cmd
venv\Scripts\activate.bat
pip install -r backend\requirements.txt
python backend\run.py
```

#### macOS / Linux
```bash
source venv/bin/activate
pip install -r backend/requirements.txt
python backend/run.py
```

The backend server will run at **`http://127.0.0.1:8000`**.  
Verify by visiting `http://127.0.0.1:8000/health`.

---

### 3. Setup and Run the Frontend

Open a **second terminal** and navigate to the `frontend/` directory:

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend will start at **`http://localhost:5173`**.

Open your browser and navigate to **[http://localhost:5173](http://localhost:5173)** to start chatting!

---

## API Endpoints Reference

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Verifies SQLite connectivity and Ollama daemon status. |
| `GET` | `/models` | Returns locally installed Ollama models and the active default model. |
| `GET` | `/conversations` | Lists all conversations and folder groups with message counts. |
| `POST` | `/conversations` | Creates a new conversation, optionally assigned to a folder group. |
| `GET` | `/conversations/{id}` | Fetches conversation metadata and message history for hydration. |
| `PATCH` | `/conversations/{id}` | Renames a conversation or moves it to a new folder group. |
| `DELETE` | `/conversations/{id}` | Deletes a conversation and its messages. |
| `POST` | `/groups` | Creates a new folder group. |
| `PATCH` | `/groups/{id}` | Renames a folder group or toggles its `is_expanded` state. |
| `DELETE` | `/groups/{id}` | Deletes a folder group (contained chats are safely moved to Ungrouped). |
| `GET` | `/history` | Retrieves recent chat messages (`?conversation_id=...&limit=100`). |
| `DELETE` | `/history` | Clears all messages in a conversation or wipes the database. |
| `POST` | `/chat` | Multipart form endpoint (`prompt`, `conversation_id`, `model`, `think`, `images`). Streams responses via Server-Sent Events (SSE). |

---

## Environment Variables (Optional)

Configure runtime parameters by providing environment variables before running `backend/run.py`:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `HOST` | `127.0.0.1` | Host address to bind the Uvicorn server |
| `PORT` | `8000` | Port for the backend API |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API address |
| `DEFAULT_MODEL` | `qwen3.5:4b` | Default LLM selected upon startup |
| `FALLBACK_VISION_MODEL`| `qwen2.5-vl:3b` | Fallback vision model used when images are attached |
| `DB_PATH` | `backend/chat.db` | Location of the persistent SQLite database file |

---

## Tips & Shortcuts

- **Thinking Mode**: Click the **Thinking** switch in the bottom toolbar to enable reasoning outputs. Deep reasoning tokens will appear in a clean, collapsible accordion.
- **Folder Navigation**: Click on any folder group in the sidebar to expand or collapse it; the expansion state persists across refreshes.
- **Move to Folder**: Hover over any chat in the sidebar, click the `•••` options icon, and choose **Move to folder** to organize your workflow.
- **Copy Code & Diagrams**: Every code block and Mermaid diagram includes a single-click copy button, as well as fullscreen and image export options for diagrams.
- **Temporary Chats**: Need a quick scratchpad session? Click **Temp Chat** in the sidebar. No messages or images will be written to disk.
