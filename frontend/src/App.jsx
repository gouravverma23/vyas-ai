import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { Sparkles, RefreshCw, Terminal, Eye, Database, Ghost, ShieldAlert } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });

  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  // Temporary (unsaved / incognito) chat state
  const [isTemporaryMode, setIsTemporaryMode] = useState(false);
  const [temporaryMessages, setTemporaryMessages] = useState([]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  const [currentModel, setCurrentModel] = useState('qwen3.5:4b');
  const [availableModels, setAvailableModels] = useState(['qwen3.5:4b']);
  const [ollamaStatus, setOllamaStatus] = useState({ online: false, version: '' });
  const [loadingHistory, setLoadingHistory] = useState(true);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  // Toggle and persist sidebar state
  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_open', String(next));
      return next;
    });
  };

  // Auto-scroll handler
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current && shouldAutoScrollRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
      shouldAutoScrollRef.current = isNearBottom;
    }
  };

  // Fetch all conversations & groups
  const fetchConversations = async (targetActiveId = null) => {
    try {
      const res = await fetch(`${API_BASE}/conversations`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      const convList = data.conversations || [];
      const grpList = data.groups || [];

      setConversations(convList);
      setGroups(grpList);

      if (!isTemporaryMode) {
        let nextActiveId = targetActiveId || activeConversationId;
        if (!nextActiveId || !convList.some((c) => c.id === nextActiveId)) {
          if (convList.length > 0) {
            nextActiveId = convList[0].id;
          } else {
            nextActiveId = null;
          }
        }

        if (nextActiveId !== activeConversationId) {
          setActiveConversationId(nextActiveId);
          if (nextActiveId) {
            loadConversationMessages(nextActiveId);
          } else {
            setMessages([]);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load conversations from backend:', err);
    }
  };

  // Load messages for a specific conversation
  const loadConversationMessages = async (convId) => {
    if (!convId || isTemporaryMode) {
      setMessages([]);
      return;
    }
    try {
      setLoadingHistory(true);
      const res = await fetch(`${API_BASE}/history?conversation_id=${encodeURIComponent(convId)}&limit=100`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.warn(`Failed to load history for ${convId}:`, err);
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
          if (!modelsData.models.includes(currentModel)) {
            setCurrentModel(modelsData.default || modelsData.models[0]);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to reach backend API:', err);
      setOllamaStatus({ online: false, error: 'Cannot connect to backend server' });
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
    fetchSystemStatus();

    const interval = setInterval(fetchSystemStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // When activeConversationId changes and not in temporary mode, load its messages
  useEffect(() => {
    if (activeConversationId && !isTemporaryMode) {
      loadConversationMessages(activeConversationId);
    }
  }, [activeConversationId, isTemporaryMode]);

  // Current active messages depending on temporary mode
  const displayMessages = isTemporaryMode ? temporaryMessages : messages;

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom(false);
  }, [displayMessages.length]);

  // Active conversation object
  const activeConversation = isTemporaryMode
    ? { id: 'temporary', title: 'Temporary Chat', is_temporary: true }
    : conversations.find((c) => c.id === activeConversationId) || null;

  // --- Temporary Chat Actions ---

  const handleStartTemporaryChat = () => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setIsTemporaryMode(true);
    setTemporaryMessages([]);
    setInput('');
    setAttachedImage(null);
  };

  const handleExitTemporaryChat = () => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setIsTemporaryMode(false);
    setTemporaryMessages([]);
    if (conversations.length > 0) {
      const targetId = activeConversationId && conversations.some(c => c.id === activeConversationId)
        ? activeConversationId
        : conversations[0].id;
      setActiveConversationId(targetId);
      loadConversationMessages(targetId);
    }
  };

  // --- Conversation Actions ---

  const handleSelectConversation = (convId) => {
    if (!isTemporaryMode && convId === activeConversationId) return;
    if (isStreaming) {
      handleStopStreaming();
    }
    if (isTemporaryMode) {
      setIsTemporaryMode(false);
      setTemporaryMessages([]);
    }
    setActiveConversationId(convId);
  };

  const handleNewChat = async (groupId = null) => {
    if (isStreaming) {
      handleStopStreaming();
    }
    if (isTemporaryMode) {
      setIsTemporaryMode(false);
      setTemporaryMessages([]);
    }
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat', group_id: groupId })
      });
      if (!res.ok) throw new Error('Failed to create new conversation');
      const newConv = await res.json();
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
    } catch (err) {
      console.error('Error creating new conversation:', err);
    }
  };

  const handleRenameConversation = async (convId, newTitle) => {
    if (isTemporaryMode || convId === 'temporary') return;
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
    );
    try {
      await fetch(`${API_BASE}/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
    } catch (err) {
      console.error(`Failed to rename conversation ${convId}:`, err);
    }
  };

  const handleDeleteConversation = async (convId) => {
    if (isTemporaryMode || convId === 'temporary') return;
    try {
      const res = await fetch(`${API_BASE}/conversations/${convId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const remaining = conversations.filter((c) => c.id !== convId);
        setConversations(remaining);
        if (activeConversationId === convId) {
          if (remaining.length > 0) {
            setActiveConversationId(remaining[0].id);
          } else {
            handleNewChat();
          }
        }
      }
    } catch (err) {
      console.error(`Error deleting conversation ${convId}:`, err);
    }
  };

  const handleMoveConversation = async (convId, targetGroupId) => {
    if (isTemporaryMode || convId === 'temporary') return;
    const targetGroup = groups.find((g) => g.id === targetGroupId);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              group_id: targetGroupId,
              group_name: targetGroup ? targetGroup.name : null
            }
          : c
      )
    );

    try {
      await fetch(`${API_BASE}/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: targetGroupId,
          clear_group: !targetGroupId
        })
      });
      fetchConversations(activeConversationId);
    } catch (err) {
      console.error(`Error moving conversation ${convId}:`, err);
    }
  };

  // --- Group Actions ---

  const handleCreateGroup = async (name) => {
    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const newGroup = await res.json();
        setGroups((prev) => [...prev, newGroup]);
        return newGroup;
      }
    } catch (err) {
      console.error('Error creating group:', err);
    }
    return null;
  };

  const handleRenameGroup = async (groupId, newName) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name: newName } : g))
    );
    setConversations((prev) =>
      prev.map((c) => (c.group_id === groupId ? { ...c, group_name: newName } : c))
    );
    try {
      await fetch(`${API_BASE}/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
    } catch (err) {
      console.error('Error renaming group:', err);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setConversations((prev) =>
      prev.map((c) => (c.group_id === groupId ? { ...c, group_id: null, group_name: null } : c))
    );
    try {
      await fetch(`${API_BASE}/groups/${groupId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  const handleToggleGroupExpand = async (groupId, isExpanded) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, is_expanded: isExpanded } : g))
    );
    try {
      await fetch(`${API_BASE}/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_expanded: isExpanded })
      });
    } catch (err) {
      console.error('Error updating group expand state:', err);
    }
  };

  // Clear current conversation messages
  const handleClearHistory = async () => {
    if (isTemporaryMode) {
      setTemporaryMessages([]);
      return;
    }

    if (!activeConversationId) return;
    if (!window.confirm('Clear messages for this conversation from SQLite?')) {
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/history?conversation_id=${encodeURIComponent(activeConversationId)}`,
        { method: 'DELETE' }
      );
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

    if (isTemporaryMode) {
      setTemporaryMessages((prev) =>
        prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
      );
    } else {
      setMessages((prev) =>
        prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
      );
      // Refresh conversation list to update preview and message count
      setTimeout(() => {
        fetchConversations(activeConversationId);
      }, 400);
    }
  };

  // Send message and stream response
  const handleSendMessage = async (customPrompt) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend && !attachedImage) return;
    if (isStreaming) return;

    let optimisticImageData = null;
    const stagedImage = attachedImage;

    if (stagedImage) {
      optimisticImageData = stagedImage.previewUrl;
    }

    const tempUserId = `user-${Date.now()}`;
    const tempAssistantId = `assistant-${Date.now()}`;

    // Optimistic UI update
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

    if (isTemporaryMode) {
      setTemporaryMessages((prev) => [...prev, userMessage, assistantMessage]);
    } else {
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
    }

    setInput('');
    setAttachedImage(null);
    setIsStreaming(true);
    shouldAutoScrollRef.current = true;
    scrollToBottom(true);

    // Setup FormData for multipart upload
    const formData = new FormData();
    formData.append('prompt', promptToSend);
    formData.append('model', currentModel);
    formData.append('think', isThinkingEnabled ? 'true' : 'false');

    if (isTemporaryMode) {
      formData.append('is_temporary', 'true');
      // Pass previous temporary messages as context for LLM
      const contextList = temporaryMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content
      }));
      formData.append('context_messages', JSON.stringify(contextList));
    } else if (activeConversationId) {
      formData.append('conversation_id', activeConversationId);
    }

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

      const updateTargetMessages = (updater) => {
        if (isTemporaryMode) {
          setTemporaryMessages(updater);
        } else {
          setMessages(updater);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

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
              if (!isTemporaryMode && event.conversation_id && event.conversation_id !== activeConversationId) {
                setActiveConversationId(event.conversation_id);
              }
              if (event.user_id) {
                updateTargetMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === tempUserId ? { ...msg, id: event.user_id } : msg
                  )
                );
              }
            } else if (event.type === 'chunk') {
              accumulatedAssistantText += event.token;
              updateTargetMessages((prev) =>
                prev.map((msg) =>
                  msg.id === tempAssistantId
                    ? { ...msg, content: accumulatedAssistantText }
                    : msg
                )
              );
              scrollToBottom(false);
            } else if (event.type === 'done') {
              updateTargetMessages((prev) =>
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
              // In persistent mode, refresh conversation list to update titles and timestamps
              if (!isTemporaryMode) {
                fetchConversations(event.conversation_id || activeConversationId);
              }
            } else if (event.type === 'error') {
              accumulatedAssistantText += `\n\n**Error:** ${event.error}`;
              updateTargetMessages((prev) =>
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
            accumulatedAssistantText += dataPayload;
            updateTargetMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantId
                  ? { ...msg, content: accumulatedAssistantText }
                  : msg
              )
            );
            scrollToBottom(false);
          }
        }
      }

      updateTargetMessages((prev) =>
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
        const updateTargetMessages = isTemporaryMode ? setTemporaryMessages : setMessages;
        updateTargetMessages((prev) =>
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
    <div className="flex h-screen w-screen bg-[#0A0A0C] text-zinc-100 overflow-hidden font-sans">
      {/* Sleek Left Sidebar (Collapsible to focused icon rail as shown in UI reference) */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggleOpen={handleToggleSidebar}
        conversations={conversations}
        groups={groups}
        activeConversationId={activeConversationId}
        isTemporaryMode={isTemporaryMode}
        onStartTemporaryChat={handleStartTemporaryChat}
        onExitTemporaryChat={handleExitTemporaryChat}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onMoveConversation={handleMoveConversation}
        onCreateGroup={handleCreateGroup}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
        onToggleGroupExpand={handleToggleGroupExpand}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden bg-[#0A0A0C]">
        {/* Top Header */}
        <Header
          ollamaStatus={ollamaStatus}
          onClearHistory={handleClearHistory}
          onRefreshStatus={fetchSystemStatus}
          messageCount={displayMessages.length}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          activeConversation={activeConversation}
          isTemporaryMode={isTemporaryMode}
          onExitTemporaryChat={handleExitTemporaryChat}
          onRenameActiveConversation={(newTitle) => {
            if (activeConversationId && !isTemporaryMode) {
              handleRenameConversation(activeConversationId, newTitle);
            }
          }}
        />

        {/* Chat Scroll View */}
        <main
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2 md:px-6 py-4 flex flex-col justify-start"
        >
          <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
            {/* Temporary Chat Notice Banner (when messages are present) */}
            {isTemporaryMode && temporaryMessages.length > 0 && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-300 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <Ghost className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
                  <span>
                    <strong>Temporary Chat:</strong> Messages in this conversation are not saved to SQLite history and will be discarded when you exit or refresh.
                  </span>
                </div>
                <button
                  onClick={handleExitTemporaryChat}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium ml-3 flex-shrink-0 transition-colors"
                >
                  Exit
                </button>
              </div>
            )}

            {/* Empty Conversation Welcome State */}
            {displayMessages.length === 0 && !loadingHistory && (
              <div className="my-auto py-12 flex flex-col items-center text-center animate-in fade-in duration-300">
                <div className="relative mb-6">
                  {isTemporaryMode ? (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-orange-600 flex items-center justify-center text-white shadow-2xl shadow-amber-500/30 ring-1 ring-white/20">
                      <Ghost className="w-8 h-8" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 ring-1 ring-white/20">
                      <Sparkles className="w-8 h-8" />
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md border text-[10px] font-mono ${
                      isTemporaryMode
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {isTemporaryMode ? 'Unsaved' : 'Offline'}
                  </span>
                </div>

                <h2 className="text-xl font-bold tracking-tight text-white mb-2">
                  {isTemporaryMode
                    ? 'Temporary Incognito Chat'
                    : activeConversation?.title && activeConversation.title !== 'New Chat'
                    ? activeConversation.title
                    : 'Local-First Multimodal AI Interface'}
                </h2>
                <p className="text-zinc-400 text-sm max-w-md mb-8 leading-relaxed">
                  {isTemporaryMode
                    ? 'Messages in this session are kept purely in memory and are never written to your SQLite database or history files.'
                    : `Powered by FastAPI backend, persistent SQLite in WAL mode, and your local Ollama daemon (${currentModel}).`}
                </p>

                {/* Starter Suggestion Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl px-2">
                  {starterChips.map((chip, idx) => {
                    const Icon = chip.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(chip.prompt)}
                        className="flex flex-col items-start p-3.5 rounded-xl bg-[#141416] hover:bg-[#1C1C20] border border-white/5 hover:border-indigo-500/30 text-left transition-all group shadow-sm hover:shadow-indigo-500/10"
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
            {loadingHistory && !isTemporaryMode && (
              <div className="my-auto py-12 flex flex-col items-center justify-center text-zinc-400 gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs font-medium">Hydrating conversation from SQLite...</span>
              </div>
            )}

            {/* Message List */}
            <div className="flex flex-col space-y-1">
              {displayMessages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </main>

        {/* Bottom Sticky Input Section */}
        <footer className="w-full bg-[#0A0A0C]/95 border-t border-white/[0.06] backdrop-blur-md">
          <ChatInput
            input={input}
            setInput={setInput}
            attachedImage={attachedImage}
            setAttachedImage={setAttachedImage}
            isStreaming={isStreaming}
            isThinkingEnabled={isThinkingEnabled}
            setIsThinkingEnabled={setIsThinkingEnabled}
            onSend={() => handleSendMessage()}
            onStop={handleStopStreaming}
            disabled={loadingHistory && !isTemporaryMode}
            isTemporaryMode={isTemporaryMode}
            availableModels={availableModels}
            currentModel={currentModel}
            setCurrentModel={setCurrentModel}
          />
        </footer>
      </div>
    </div>
  );
}
