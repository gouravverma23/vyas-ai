import uvicorn
import os
import sys

# Ensure backend directory is in python sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    print(f"Starting Local AI Interface Backend on http://{host}:{port} ...")
    uvicorn.run("app.main:app", host=host, port=port, reload=True, log_level="info")
