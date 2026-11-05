import json
import logging
import time
import httpx
from typing import AsyncGenerator, List, Dict, Any, Optional
from app.core.config import OLLAMA_BASE_URL, DEFAULT_MODEL

logger = logging.getLogger("local_ai_backend.ollama")

_cached_models: List[str] = []
_models_cache_timestamp: float = 0.0
_CACHE_TTL_SECONDS: float = 30.0

async def get_available_models(force_refresh: bool = False) -> List[str]:
    """Fetch list of locally installed Ollama models with a 30s TTL cache to avoid latency spikes."""
    global _cached_models, _models_cache_timestamp
    now = time.time()
    if not force_refresh and _cached_models and (now - _models_cache_timestamp < _CACHE_TTL_SECONDS):
        return _cached_models

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
                if models:
                    _cached_models = models
                    _models_cache_timestamp = now
                    return _cached_models
    except Exception as e:
        logger.warning(f"Failed to fetch models from Ollama: {e}")

    return _cached_models if _cached_models else [DEFAULT_MODEL]

async def check_ollama_health() -> Dict[str, Any]:
    """Check connectivity to Ollama server."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/version")
            if resp.status_code == 200:
                models = await get_available_models()
                return {
                    "online": True,
                    "version": resp.json().get("version", "unknown"),
                    "models": models,
                    "default_model": DEFAULT_MODEL,
                }
    except Exception as e:
        return {
            "online": False,
            "error": str(e),
            "models": [],
            "default_model": DEFAULT_MODEL,
        }
    return {
        "online": False,
        "error": "Failed to connect to Ollama",
        "models": [],
        "default_model": DEFAULT_MODEL,
    }

async def stream_ollama_chat(
    messages: List[Dict[str, Any]],
    model: Optional[str] = None,
    has_image: bool = False,
    think: bool = False
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Stream tokens from Ollama's POST /api/chat.
    Supports thinking tokens and standard content.
    Yields dict objects:
      {"token": "...", "is_thinking": False, "done": False}
    Final yield:
      {"token": "", "done": True, "full_content": "..."}
    """
    target_model = model or DEFAULT_MODEL
    available = await get_available_models()

    if available and target_model not in available:
        match = next((m for m in available if m.startswith(target_model) or target_model.startswith(m)), None)
        if match:
            target_model = match
        elif DEFAULT_MODEL in available:
            target_model = DEFAULT_MODEL
        elif available:
            target_model = available[0]

    payload: Dict[str, Any] = {
        "model": target_model,
        "messages": messages,
        "stream": True,
        "think": think,
        "keep_alive": "60m",
    }

    thinking_state = {"in_tag": False}
    full_response_text = ""

    def process_thinking_tags(text: str, current_in_tag: bool):
        parts = []
        i = 0
        while i < len(text):
            if not current_in_tag:
                start_idx = text.find("<think>", i)
                if start_idx == -1:
                    parts.append((text[i:], False))
                    break
                else:
                    if start_idx > i:
                        parts.append((text[i:start_idx], False))
                    current_in_tag = True
                    i = start_idx + len("<think>")
            else:
                end_idx = text.find("</think>", i)
                if end_idx == -1:
                    parts.append((text[i:], True))
                    break
                else:
                    parts.append((text[i:end_idx], True))
                    current_in_tag = False
                    i = end_idx + len("</think>")
        return parts, current_in_tag

    timeout = httpx.Timeout(180.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    raise RuntimeError(f"Ollama returned {response.status_code}: {error_body.decode(errors='replace')}")

                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        msg = data.get("message", {})
                        token = msg.get("content", "")
                        done = data.get("done", False)

                        if token:
                            full_response_text += token
                            parts, thinking_state["in_tag"] = process_thinking_tags(
                                token, thinking_state["in_tag"]
                            )
                            for part_text, is_think in parts:
                                if part_text:
                                    yield {
                                        "token": part_text,
                                        "is_thinking": is_think,
                                        "done": False
                                    }

                        if done:
                            yield {
                                "token": "",
                                "is_thinking": False,
                                "done": True,
                                "full_content": full_response_text
                            }
                            return
        except Exception as e:
            logger.error(f"Error in stream_ollama_chat: {e}")
            raise

