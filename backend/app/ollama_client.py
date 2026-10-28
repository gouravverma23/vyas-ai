import os
import json
import logging
import asyncio
import time
import httpx
from typing import AsyncGenerator, List, Dict, Any, Optional

logger = logging.getLogger("local_ai_backend.ollama")

# Default to 127.0.0.1 to prevent Windows IPv6 [::1] connection timeout delays
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "qwen3.5:4b")
FALLBACK_VISION_MODEL = os.getenv("FALLBACK_VISION_MODEL", "qwen2.5-vl:3b")

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
    Supports thinking tokens (for models like qwen3.5:4b) and standard content.
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
        "keep_alive": "60m",  # Keep model resident in RAM to eliminate 30s cold-start delays
        "options": {
            "temperature": 0.7,
            "num_ctx": 2048,  # Lean context window for 3x faster CPU prompt evaluation
            "num_thread": 4,   # Use all available CPU cores
        }
    }

    accumulated_content = []
    is_in_thinking_mode = False

    client_timeout = httpx.Timeout(connect=20.0, read=300.0, write=60.0, pool=60.0)
    try:
        async with httpx.AsyncClient(timeout=client_timeout) as client:
            try:
                async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload) as response:
                    if response.status_code != 200:
                        error_detail = await response.aread()
                        error_text = error_detail.decode("utf-8", errors="replace")

                        # Fallback for vision if image error
                        if has_image and target_model != FALLBACK_VISION_MODEL and FALLBACK_VISION_MODEL in available:
                            notice = f"*[Model '{target_model}' encountered error with multimodal input. Retrying with fallback vision model '{FALLBACK_VISION_MODEL}'...]*\n\n"
                            yield {"token": notice, "is_thinking": False, "done": False}
                            payload["model"] = FALLBACK_VISION_MODEL
                            async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload) as fallback_resp:
                                if fallback_resp.status_code == 200:
                                    async for line in fallback_resp.aiter_lines():
                                        if not line:
                                            continue
                                        try:
                                            chunk = json.loads(line)
                                            msg = chunk.get("message", {})
                                            token = msg.get("content", "")
                                            done = chunk.get("done", False)
                                            if token:
                                                accumulated_content.append(token)
                                                yield {"token": token, "is_thinking": False, "done": False}
                                            if done:
                                                break
                                        except json.JSONDecodeError:
                                            continue
                                    yield {"token": "", "is_thinking": False, "done": True, "full_content": "".join(accumulated_content)}
                                    return
                                else:
                                    fallback_err = await fallback_resp.aread()
                                    yield {
                                        "token": f"Error from fallback Ollama: {fallback_err.decode('utf-8', errors='replace')}",
                                        "is_thinking": False,
                                        "done": True,
                                        "full_content": f"Error: {fallback_err.decode('utf-8')}"
                                    }
                                    return

                        yield {
                            "token": f"Error from Ollama ({response.status_code}): {error_text}",
                            "is_thinking": False,
                            "done": True,
                            "full_content": f"Error from Ollama: {error_text}"
                        }
                        return

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            msg = chunk.get("message", {})
                            thinking_token = msg.get("thinking", "")
                            content_token = msg.get("content", "")
                            done = chunk.get("done", False)

                            if thinking_token:
                                if not is_in_thinking_mode:
                                    is_in_thinking_mode = True
                                    header = "> *Thinking Process:*\n> "
                                    accumulated_content.append(header)
                                    yield {"token": header, "is_thinking": True, "done": False}
                                
                                formatted_t = thinking_token.replace("\n", "\n> ")
                                accumulated_content.append(formatted_t)
                                yield {"token": formatted_t, "is_thinking": True, "done": False}

                            if content_token:
                                if is_in_thinking_mode:
                                    is_in_thinking_mode = False
                                    divider = "\n\n---\n\n"
                                    accumulated_content.append(divider)
                                    yield {"token": divider, "is_thinking": False, "done": False}

                                accumulated_content.append(content_token)
                                yield {"token": content_token, "is_thinking": False, "done": False}

                            if done:
                                break
                        except json.JSONDecodeError:
                            continue

            except httpx.ConnectError:
                err_msg = f"Cannot connect to Ollama at {OLLAMA_BASE_URL}. Please ensure Ollama is running (`ollama serve`)."
                yield {"token": err_msg, "is_thinking": False, "done": True, "full_content": err_msg}
                return

        yield {"token": "", "is_thinking": False, "done": True, "full_content": "".join(accumulated_content)}

    except asyncio.CancelledError:
        logger.info("Inference streaming cancelled by client or task abort.")
        return
    except Exception as e:
        err_type = type(e).__name__
        err_str = str(e).strip()
        err_detail = f"{err_type}: {err_str}" if err_str else err_type
        logger.error(f"Inference streaming error ({err_type}): {e}", exc_info=True)
        err_msg = f"Inference streaming error: {err_detail}"
        yield {"token": err_msg, "is_thinking": False, "done": True, "full_content": err_msg}
