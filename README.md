# Local AI Interface

An offline-capable, local-first multimodal chat interface powered by **Ollama**, **FastAPI**, **SQLite (WAL mode)**, and **React + Vite + Tailwind CSS**.

---

## Features

- **Local & Private**: Runs 100% locally on your machine with zero external cloud dependencies.
- **FastAPI + Async SQLite Backend**: High-performance backend utilizing asynchronous SQLite with Write-Ahead Logging (`WAL`) mode for fast concurrent message persistence and context retrieval.
- **Ollama Integration & Thinking Switch**: Seamless streaming response over Server-Sent Events (SSE). Includes a **Thinking ON/OFF** toggle switch right in the input bar — keep it OFF for instant replies, or turn it ON for deep step-by-step reasoning tokens.
- **Modern Responsive Frontend**: Built with React 19, Tailwind CSS, Lucide icons, Prism syntax highlighting, and React Markdown.
- **Chat Persistence**: Hydrates conversation history across page reloads with one-click clear history capability.

---

## Project Structure

```
LocalAIInterface/
├── backend/
│   ├── app/
│   │   ├── api/              # Domain-driven FastAPI routers (chat, conversations, groups, system)
│   │   ├── core/             # Configuration & async SQLite connection manager (WAL mode)
│   │   ├── models/           # Pydantic validation schemas (conversation, group)
│   │   ├── repositories/     # Data access layer (conversation_repo, group_repo, message_repo)
│   │   ├── services/         # Ollama streaming client, model caching, and health services
│   │   ├── database.py       # Backwards-compatible database re-export shim
│   │   ├── ollama_client.py  # Backwards-compatible client re-export shim
│   │   └── main.py           # Application factory mounting routers and CORS middleware
│   ├── chat.db               # SQLite database file (WAL mode)
│   ├── requirements.txt      # Python dependencies
│   └── run.py                # Server entry point (Uvicorn runner)
├── frontend/
│   ├── src/
│   │   ├── api/              # Centralized API service layer (client, chat, conversations, groups, system)
│   │   ├── components/
│   │   │   ├── chat/         # Chat-specific UI (ChatMessage, ChatInput)
│   │   │   ├── common/       # Reusable components (CodeBlock with Prism, MermaidBlock with zoom/export)
│   │   │   └── layout/       # Shell layout (Header with status, Sidebar with collapsible groups)
│   │   ├── hooks/            # Custom React hooks (useConversations, useChat)
│   │   ├── utils/            # Shared utilities (markdown LaTeX preprocessor, formatters)
│   │   ├── App.jsx           # Clean application root orchestrator (~240 lines)
│   │   ├── index.css         # Tailwind & custom styling
│   │   └── main.jsx          # React DOM entry point
│   ├── package.json          # Node dependencies & scripts
│   ├── tailwind.config.js    # Tailwind CSS configuration
│   └── vite.config.js        # Vite dev server configuration & API proxy
├── .vscode/
│   └── settings.json         # Editor settings
└── README.md
```

---

## Prerequisites

Before running the project, make sure you have installed:

1. **[Python 3.10+](https://www.python.org/downloads/)**
2. **[Node.js 18+](https://nodejs.org/)** & npm
3. **[Ollama](https://ollama.com/)** running locally

---

## Quick Start Guide

### 1. Start Ollama and Pull a Model

Make sure Ollama is running and download your preferred model (e.g., `qwen3.5:4b`):

```bash
# Verify Ollama is running
ollama list

# If not already installed, pull the default model:
ollama pull qwen3.5:4b
```

> **Multimodal Vision Note**: For image attachments, ensure you have a vision-capable model pulled (such as `qwen2.5-vl:3b` or `llava`).

---

### 2. Setup and Run the Backend

Open a terminal in the root `LocalAIInterface` directory:

#### Windows (PowerShell)

```powershell
# 1. Activate the existing virtual environment (or run: python -m venv venv)
.\venv\Scripts\Activate.ps1

# (If PowerShell blocks script execution, run this first):
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 2. Install Python dependencies
pip install -r backend/requirements.txt

# 3. Start the FastAPI backend
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

The backend server will start at **`http://127.0.0.1:8000`**.  
You can verify it by opening `http://127.0.0.1:8000/health` in your browser.

---

### 3. Setup and Run the Frontend

Open a **second terminal** and navigate to the `frontend` folder:

```bash
cd frontend

# Install Node dependencies (if not already installed)
npm install

# Start the Vite development server
npm run dev
```

The frontend will run at **`http://localhost:5173`**.

---

### 4. Access the Application

Open your browser and navigate to:

👉 **[http://localhost:5173](http://localhost:5173)**

The frontend automatically connects to the backend at `http://127.0.0.1:8000` and displays:
- Connection status indicator (green badge when connected to Ollama)
- Installed local models in the dropdown
- Chat message history loaded from SQLite
- Input box with file attachment support for images

---

## Environment Variables (Optional)

You can customize runtime behavior by setting environment variables before launching `backend/run.py`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HOST` | `127.0.0.1` | Backend host address |
| `PORT` | `8000` | Backend port |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `DEFAULT_MODEL` | `qwen3.5:4b` | Default LLM model |
| `FALLBACK_VISION_MODEL` | `qwen2.5-vl:3b` | Fallback model used when an image is attached |
| `DB_PATH` | `backend/chat.db` | Path to the SQLite database file |

---

## API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check verifying SQLite and Ollama connectivity |
| `GET` | `/models` | Returns list of locally installed Ollama models |
| `GET` | `/history` | Retrieves recent chat history (`?limit=50`) |
| `DELETE` | `/history` | Clears all stored messages from SQLite |
| `POST` | `/chat` | Multipart form (`prompt`, optional `image`, `model`). Returns an SSE token stream |

---

## Troubleshooting

- **Ollama Connection Failed (`Ollama Offline` badge)**:  
  Ensure Ollama is started by running `ollama serve` in a terminal or launching the Ollama desktop app. Verify `http://localhost:11434/api/version` returns a valid JSON response.
- **PowerShell Script Execution Error (`cannot be loaded because running scripts is disabled`)**:  
  Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` before activating the virtual environment.
- **Editor warning: `Unknown at rule @tailwind`**:  
  This is an IDE CSS validator warning and does not affect the build. A `.vscode/settings.json` file is included in this repository to automatically ignore this warning.