import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchConversation, clearHistory as apiClearHistory } from '../api/conversations';
import { fetchHealth, fetchModels } from '../api/system';
import { streamChat } from '../api/chat';

export function useChat({ activeConversationId, onConversationCreated, onTouchConversation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  const [currentModel, setCurrentModel] = useState('qwen3.5:4b');
  const [availableModels, setAvailableModels] = useState(['qwen3.5:4b']);
  const [ollamaStatus, setOllamaStatus] = useState({ online: false, version: '' });

  // Temporary (incognito) chat state
  const [isTemporaryMode, setIsTemporaryMode] = useState(false);
  const [temporaryMessages, setTemporaryMessages] = useState([]);

  const abortControllerRef = useRef(null);

  // Fetch Ollama health and available models
  const refreshSystemStatus = useCallback(async () => {
    try {
      const healthData = await fetchHealth();
      setOllamaStatus(healthData?.ollama || { online: false, version: '' });

      const modelsData = await fetchModels();
      const list = modelsData?.models || [];
      if (list.length > 0) {
        setAvailableModels(list);
        if (!list.includes(currentModel)) {
          setCurrentModel(list[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to refresh system status:', err);
      setOllamaStatus({ online: false, version: '' });
    }
  }, [currentModel]);

  useEffect(() => {
    refreshSystemStatus();
  }, [refreshSystemStatus]);

  // Load messages whenever activeConversationId changes (unless in temporary mode)
  useEffect(() => {
    if (isTemporaryMode) return;
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    async function loadMessages() {
      try {
        const data = await fetchConversation(activeConversationId);
        if (isMounted) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load messages for conversation:', err);
        if (isMounted) setMessages([]);
      }
    }

    loadMessages();
    return () => {
      isMounted = false;
    };
  }, [activeConversationId, isTemporaryMode]);

  // Send message and initiate SSE streaming
  const handleSendMessage = useCallback(async (customPrompt) => {
    const promptText = (typeof customPrompt === 'string' ? customPrompt : input).trim();
    if (!promptText && attachedImages.length === 0) return;
    if (isStreaming) return;

    const currentImages = [...attachedImages];
    setInput('');
    setAttachedImages([]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Construct local user message preview
    const imagePayload = currentImages.map((img) => img.previewUrl);
    const userMessagePreview = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: promptText,
      has_image: currentImages.length > 0,
      image_data: imagePayload.length === 1 ? imagePayload[0] : JSON.stringify(imagePayload),
      created_at: new Date().toISOString()
    };

    // Construct placeholder assistant message
    const assistantMessagePreview = {
      id: `local-asst-${Date.now()}`,
      role: 'assistant',
      content: '',
      has_image: false,
      isStreaming: true,
      created_at: new Date().toISOString()
    };

    if (isTemporaryMode) {
      setTemporaryMessages((prev) => [...prev, userMessagePreview, assistantMessagePreview]);
    } else {
      setMessages((prev) => [...prev, userMessagePreview, assistantMessagePreview]);
    }

    const contextMessages = isTemporaryMode
      ? temporaryMessages.map((m) => ({ role: m.role, content: m.content }))
      : null;

    try {
      await streamChat({
        prompt: promptText,
        conversationId: activeConversationId,
        images: currentImages,
        model: currentModel,
        think: isThinkingEnabled,
        isTemporary: isTemporaryMode,
        contextMessages,
        signal: abortController.signal,

        onInit: (initData) => {
          if (!isTemporaryMode && initData.conversation_id && initData.conversation_id !== activeConversationId) {
            onConversationCreated?.(initData.conversation_id);
          }
        },

        onChunk: (token) => {
          const updateFn = (prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
              next[lastIdx] = {
                ...next[lastIdx],
                content: next[lastIdx].content + token
              };
            }
            return next;
          };

          if (isTemporaryMode) {
            setTemporaryMessages(updateFn);
          } else {
            setMessages(updateFn);
          }
        },

        onError: (errorText) => {
          const updateFn = (prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
              next[lastIdx] = {
                ...next[lastIdx],
                content: `${next[lastIdx].content}\n\n[Error: ${errorText}]`,
                isStreaming: false
              };
            }
            return next;
          };

          if (isTemporaryMode) {
            setTemporaryMessages(updateFn);
          } else {
            setMessages(updateFn);
          }
        },

        onDone: (doneData) => {
          const finalizeFn = (prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
              next[lastIdx] = {
                ...next[lastIdx],
                id: doneData.assistant_id || next[lastIdx].id,
                content: doneData.full_content || next[lastIdx].content,
                isStreaming: false
              };
            }
            return next;
          };

          if (isTemporaryMode) {
            setTemporaryMessages(finalizeFn);
          } else {
            setMessages(finalizeFn);
            onTouchConversation?.(doneData.conversation_id);
          }
        }
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Chat stream failed:', err);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [
    input,
    attachedImages,
    isStreaming,
    activeConversationId,
    currentModel,
    isThinkingEnabled,
    isTemporaryMode,
    temporaryMessages,
    onConversationCreated,
    onTouchConversation
  ]);

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const handleClearHistory = useCallback(async () => {
    if (isTemporaryMode) {
      setTemporaryMessages([]);
      return;
    }

    if (!activeConversationId && messages.length === 0) return;
    if (window.confirm('Clear all messages in this conversation?')) {
      try {
        await apiClearHistory(activeConversationId);
        setMessages([]);
      } catch (err) {
        console.error('Failed to clear history:', err);
      }
    }
  }, [isTemporaryMode, activeConversationId, messages.length]);

  const handleStartTemporaryChat = useCallback(() => {
    setIsTemporaryMode(true);
    setTemporaryMessages([]);
  }, []);

  const handleExitTemporaryChat = useCallback(() => {
    setIsTemporaryMode(false);
    setTemporaryMessages([]);
  }, []);

  const displayMessages = isTemporaryMode ? temporaryMessages : messages;

  return {
    messages: displayMessages,
    input,
    setInput,
    attachedImages,
    setAttachedImages,
    isStreaming,
    isThinkingEnabled,
    setIsThinkingEnabled,
    currentModel,
    setCurrentModel,
    availableModels,
    ollamaStatus,
    isTemporaryMode,
    handleSendMessage,
    handleStopStreaming,
    handleClearHistory,
    refreshSystemStatus,
    handleStartTemporaryChat,
    handleExitTemporaryChat,
  };
}
