import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { Bot, Sparkles, AlertCircle, RefreshCw, Terminal, Eye, Database } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentModel, setCurrentModel] = useState('qwen3.5:4b');
  const [availableModels, setAvailableModels] = useState(['qwen3.5:4b']);
  const [ollamaStatus, setOllamaStatus] = useState({ online: false, version: '' });
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [systemError, setSystemError] = useState(null);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  // Auto-scroll handler
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current && shouldAutoScrollRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    }
  };

  // Detect user scroll up to avoid fighting manual scroll
  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
      shouldAutoScrollRef.current = isNearBottom;
    }
  };

  // Hydrate chat history on mount
  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch(`${API_BASE}/history?limit=50`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setSystemError(null);
    } catch (err) {
      console.warn('Failed to load history from backend:', err);
      // Backend might still be starting up
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch Ollama status & model list
  const fetchSystemStatus = async () => {
    try {
      const [healthRes, modelsRes] = await Promise.all([
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/models`)
      ]);

      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setOllamaStatus(healthData.ollama || { online: false });
        if (healthData.ollama?.default_model && !currentModel) {
          setCurrentModel(healthData.ollama.default_model);
        }
      }

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        if (modelsData.models && modelsData.models.length > 0) {
          setAvailableModels(modelsData.models);
          // If currentModel not in list, pick default
          if (!modelsData.models.includes(currentModel)) {
            setCurrentModel(modelsData.default || modelsData.models[0]);
          }
        }
      }
      setSystemError(null);
    } catch (err) {
      console.warn('Failed to reach backend API:', err);
      setOllamaStatus({ online: false, error: 'Cannot connect to backend server' });
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchSystemStatus();

    // Periodic health check every 15 seconds
    const interval = setInterval(fetchSystemStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  // Handle clearing chat history
  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all chat history from SQLite?')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/history`, { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
      } else {
        alert('Failed to clear history on backend.');
      }
    } catch (err) {
      console.error('Error clearing history:', err);
      alert('Error connecting to backend.');
    }
  };

  // Stop streaming generation
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  };

  // Send message and stream response
  const handleSendMessage = async (customPrompt) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend && !attachedImage) return;

    if (isStreaming) return;

    // Read image as base64 for optimistic UI display
    let optimisticImageData = null;
    const stagedImage = attachedImage;

    if (stagedImage) {
      optimisticImageData = stagedImage.previewUrl;
    }

    const tempUserId = `user-${Date.now()}`;
    const tempAssistantId = `assistant-${Date.now()}`;

    // 1. Optimistic UI update: Insert user message and streaming assistant placeholder
    const userMessage = {
      id: tempUserId,
      role: 'user',
      content: promptToSend,
      has_image: Boolean(stagedImage),
      image_data: optimisticImageData,
      created_at: new Date().toISOString()
    };

    const assistantMessage = {
      id: tempAssistantId,
      role: 'assistant',
      content: '',
      has_image: false,
      image_data: null,
      created_at: new Date().toISOString(),
      isStreaming: true
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setAttachedImage(null);
    setIsStreaming(true);
    shouldAutoScrollRef.current = true;
    scrollToBottom(true);

    // Setup FormData for multipart upload
    const formData = new FormData();
    formData.append('prompt', promptToSend);
    formData.append('model', currentModel);
    if (stagedImage?.file) {
      formData.append('image', stagedImage.file);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Backend responded with HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser or empty body returned.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedAssistantText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete trailing fragment in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          const dataPayload = trimmedLine.slice(6).trim();
          if (dataPayload === '[DONE]') {
            break;
          }

          try {
            const event = JSON.parse(dataPayload);

            if (event.type === 'init') {
              // Update optimistic user message id if needed
              if (event.user_id) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === tempUserId ? { ...msg, id: event.user_id } : msg
                  )
                );
              }
            } else if (event.type === 'chunk') {
              accumulatedAssistantText += event.token;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === tempAssistantId
                    ? { ...msg, content: accumulatedAssistantText }
                    : msg
                )
              );
              scrollToBottom(true);
            } else if (event.type === 'done') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === tempAssistantId
                    ? {
                        ...msg,
                        id: event.assistant_id || msg.id,
                        content: event.full_content || accumulatedAssistantText,
                        isStreaming: false
                      }
                    : msg
                )
              );
            } else if (event.type === 'error') {
              accumulatedAssistantText += `\n\n**Error:** ${event.error}`;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === tempAssistantId
                    ? {
                        ...msg,
                        content: accumulatedAssistantText,
                        isStreaming: false
                      }
                    : msg
                )
              );
            }
          } catch (jsonErr) {
            // Raw text token fallback if non-JSON SSE
            accumulatedAssistantText += dataPayload;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantId
                  ? { ...msg, content: accumulatedAssistantText }
                  : msg
              )
            );
            scrollToBottom(true);
          }
        }
      }

      // Finalize isStreaming on assistant message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantId ? { ...msg, isStreaming: false } : msg
        )
      );
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Stream generation aborted by user.');
      } else {
        console.error('Streaming request failed:', err);
        const errMsg = `Failed to stream response from backend: ${err.message}`;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempAssistantId
              ? {
                  ...msg,
                  content: msg.content
                    ? `${msg.content}\n\n*Stream interrupted: ${err.message}*`
                    : `⚠️ ${errMsg}`,
                  isStreaming: false
                }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      scrollToBottom(true);
    }
  };

  const starterChips = [
    {
      title: 'Multimodal Vision',
      prompt: 'Attach an image and ask: What is in this image? Explain in detail.',
      icon: Eye
    },
    {
      title: 'SQLite WAL Mode',
      prompt: 'Explain how SQLite Write-Ahead Logging (WAL) mode improves concurrent read and write performance.',
      icon: Database
    },
    {
      title: 'Async Python Streaming',
      prompt: 'Write an asynchronous Python HTTP client that consumes a chunked SSE stream using httpx.',
      icon: Terminal
    }
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0A0A0A] text-zinc-100 overflow-hidden font-sans">
      {/* Top Navigation Header */}
      <Header
        ollamaStatus={ollamaStatus}
        availableModels={availableModels}
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        onClearHistory={handleClearHistory}
        onRefreshStatus={fetchSystemStatus}
        messageCount={messages.length}
      />

      {/* Main Chat Scroll View */}
      <main
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 md:px-6 py-4 flex flex-col justify-start"
      >
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
          {/* Empty Conversation Welcome State */}
          {messages.length === 0 && !loadingHistory && (
            <div className="my-auto py-12 flex flex-col items-center text-center animate-in fade-in duration-300">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 ring-1 ring-white/20">
                  <Sparkles className="w-8 h-8" />
                </div>
                <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                  Offline
                </span>
              </div>

              <h2 className="text-xl font-bold tracking-tight text-white mb-2">
                Local-First Multimodal AI Interface
              </h2>
              <p className="text-zinc-400 text-sm max-w-md mb-8 leading-relaxed">
                Powered by FastAPI backend, persistent SQLite in WAL mode, and your local Ollama daemon (<span className="text-indigo-400 font-mono font-medium">{currentModel}</span>).
              </p>

              {/* Starter Suggestion Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl px-2">
                {starterChips.map((chip, idx) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(chip.prompt)}
                      className="flex flex-col items-start p-3.5 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] border border-white/5 hover:border-indigo-500/30 text-left transition-all group shadow-sm hover:shadow-indigo-500/10"
                    >
                      <div className="flex items-center gap-2 mb-2 text-indigo-400 group-hover:text-indigo-300">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-semibold text-zinc-200">
                          {chip.title}
                        </span>
                      </div>
                      <p className="text-[12px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {chip.prompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading History Indicator */}
          {loadingHistory && (
            <div className="my-auto py-12 flex flex-col items-center justify-center text-zinc-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs font-medium">Hydrating chat history from SQLite...</span>
            </div>
          )}

          {/* Message List */}
          <div className="flex flex-col space-y-1">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Bottom Sticky Input Section */}
      <footer className="w-full bg-[#0A0A0A]/95 border-t border-white/[0.06] backdrop-blur-md">
        <ChatInput
          input={input}
          setInput={setInput}
          attachedImage={attachedImage}
          setAttachedImage={setAttachedImage}
          isStreaming={isStreaming}
          onSend={() => handleSendMessage()}
          onStop={handleStopStreaming}
          disabled={loadingHistory}
        />
      </footer>
    </div>
  );
}
