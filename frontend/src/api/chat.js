import { API_BASE } from './client';

/**
 * Initiates an SSE chat stream with Ollama via the backend /chat endpoint.
 * Accepts FormData with prompt, optional images, model, thinking mode, and conversation ID.
 */
export async function streamChat({
  prompt,
  conversationId,
  images = [],
  model,
  think = false,
  isTemporary = false,
  contextMessages = null,
  signal,
  onInit = () => {},
  onChunk = () => {},
  onError = () => {},
  onDone = () => {}
}) {
  const formData = new FormData();
  formData.append('prompt', prompt);

  if (conversationId && !isTemporary) {
    formData.append('conversation_id', conversationId);
  }
  if (model) {
    formData.append('model', model);
  }
  if (think) {
    formData.append('think', 'true');
  }
  if (isTemporary) {
    formData.append('is_temporary', 'true');
    if (contextMessages) {
      formData.append('context_messages', JSON.stringify(contextMessages));
    }
  }

  images.forEach((img) => {
    if (img.file) {
      formData.append('images', img.file);
    }
  });

  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    body: formData,
    signal
  });

  if (!response.ok) {
    let errorMsg = `Server error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) errorMsg = errJson.detail;
    } catch {
      // Fallback
    }
    throw new Error(errorMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;

      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6).trim();
        if (dataStr === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'init') {
            onInit(parsed);
          } else if (parsed.type === 'chunk') {
            onChunk(parsed.token || '');
          } else if (parsed.type === 'error') {
            onError(parsed.error || 'Stream error');
          } else if (parsed.type === 'done') {
            onDone(parsed);
          }
        } catch (err) {
          console.warn('Failed to parse SSE JSON chunk:', dataStr, err);
        }
      }
    }
  }
}

