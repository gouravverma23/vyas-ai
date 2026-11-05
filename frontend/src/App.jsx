import React, { useState, useEffect, useRef } from 'react';
import { Header, Sidebar } from './components/layout';
import { ChatMessage, ChatInput } from './components/chat';
import { useConversations, useChat } from './hooks';
import { Sparkles, RefreshCw, Terminal, Eye, Database, Ghost } from 'lucide-react';

const STARTER_CHIPS = [
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

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });

  const {
    conversations,
    groups,
    activeConversationId,
    activeConversation: persistentConversation,
    isLoading: loadingConversations,
    loadConversations,
    handleSelectConversation,
    handleNewConversation,
    handleRenameConversation,
    handleDeleteConversation,
    handleCreateGroup,
    handleRenameGroup,
    handleToggleGroup,
    handleDeleteGroup,
    handleMoveConversationToGroup
  } = useConversations();

  const {
    messages,
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
    handleExitTemporaryChat
  } = useChat({
    activeConversationId,
    onConversationCreated: (newId) => loadConversations(newId),
    onTouchConversation: () => loadConversations(activeConversationId)
  });

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_open', String(next));
      return next;
    });
  };

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

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  const activeConversation = isTemporaryMode
    ? { id: 'temporary', title: 'Temporary Chat', is_temporary: true }
    : persistentConversation;

  const onSelectConversationItem = (convId) => {
    if (isTemporaryMode) {
      handleExitTemporaryChat();
    }
    handleSelectConversation(convId);
  };

  const onNewChatItem = async (groupId = null) => {
    if (isTemporaryMode) {
      handleExitTemporaryChat();
    }
    await handleNewConversation(groupId);
  };

  return (
    <div className="flex h-screen w-screen bg-[#0A0A0C] text-zinc-100 overflow-hidden font-sans">
      {/* Collapsible Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggleOpen={handleToggleSidebar}
        conversations={conversations}
        groups={groups}
        activeConversationId={activeConversationId}
        isTemporaryMode={isTemporaryMode}
        onStartTemporaryChat={handleStartTemporaryChat}
        onExitTemporaryChat={handleExitTemporaryChat}
        onSelectConversation={onSelectConversationItem}
        onNewChat={onNewChatItem}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onMoveConversation={handleMoveConversationToGroup}
        onCreateGroup={handleCreateGroup}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
        onToggleGroupExpand={handleToggleGroup}
      />

      {/* Main Chat Workspace */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden bg-[#0A0A0C]">
        <Header
          ollamaStatus={ollamaStatus}
          onClearHistory={handleClearHistory}
          onRefreshStatus={refreshSystemStatus}
          messageCount={messages.length}
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

        {/* Message Scroll View */}
        <main
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2 md:px-6 py-4 flex flex-col justify-start"
        >
          <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
            {/* Temporary Chat Notice Banner */}
            {isTemporaryMode && messages.length > 0 && (
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
            {messages.length === 0 && !loadingConversations && (
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
                  {STARTER_CHIPS.map((chip, idx) => {
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

            {/* Loading Indicator */}
            {loadingConversations && !isTemporaryMode && (
              <div className="my-auto py-12 flex flex-col items-center justify-center text-zinc-400 gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs font-medium">Hydrating conversation from SQLite...</span>
              </div>
            )}

            {/* Message Stream List */}
            <div className="flex flex-col space-y-1">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </main>

        {/* Input Bar */}
        <footer className="w-full bg-[#0A0A0C]/95 border-t border-white/[0.06] backdrop-blur-md">
          <ChatInput
            input={input}
            setInput={setInput}
            attachedImages={attachedImages}
            setAttachedImages={setAttachedImages}
            isStreaming={isStreaming}
            isThinkingEnabled={isThinkingEnabled}
            setIsThinkingEnabled={setIsThinkingEnabled}
            onSend={() => handleSendMessage()}
            onStop={handleStopStreaming}
            disabled={loadingConversations && !isTemporaryMode}
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
