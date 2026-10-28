import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Trash2,
  RefreshCw,
  ChevronDown,
  Check,
  Wifi,
  WifiOff,
  PanelLeft,
  PanelLeftClose,
  Edit3,
  Folder,
  X
} from 'lucide-react';

export default function Header({
  ollamaStatus,
  availableModels,
  currentModel,
  setCurrentModel,
  onClearHistory,
  onRefreshStatus,
  messageCount,
  sidebarOpen,
  onToggleSidebar,
  activeConversation,
  onRenameActiveConversation
}) {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleText, setEditingTitleText] = useState('');
  const titleInputRef = useRef(null);

  const isOnline = ollamaStatus?.online ?? false;

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleStartRename = () => {
    if (activeConversation) {
      setEditingTitleText(activeConversation.title || 'Untitled Chat');
      setIsEditingTitle(true);
    }
  };

  const handleSaveRename = () => {
    if (editingTitleText.trim() && activeConversation) {
      onRenameActiveConversation?.(editingTitleText.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 w-full border-b border-white/[0.08] bg-[#0A0A0C]/90 backdrop-blur-xl px-3 md:px-5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left Side: Sidebar Toggle + Breadcrumb / Active Conversation Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Toggle Sidebar Button */}
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all flex-shrink-0"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {/* Active Conversation Title & Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            {activeConversation?.group_name && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 flex-shrink-0">
                <Folder className="w-3.5 h-3.5 text-indigo-400" />
                <span className="truncate max-w-[120px]">{activeConversation.group_name}</span>
                <span className="text-zinc-600">/</span>
              </div>
            )}

            {isEditingTitle ? (
              <div className="flex items-center gap-1 bg-[#18181B] border border-indigo-500/40 rounded-xl px-2 py-0.5 shadow-sm">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editingTitleText}
                  onChange={(e) => setEditingTitleText(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  className="bg-transparent text-sm font-semibold text-white focus:outline-none max-w-xs sm:max-w-md"
                />
                <button
                  onClick={handleSaveRename}
                  className="p-1 text-emerald-400 hover:text-emerald-300"
                  title="Save (Enter)"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-200"
                  title="Cancel (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={handleStartRename}
                className="group flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-1 rounded-xl transition-colors min-w-0"
                title="Click to rename conversation"
              >
                <h1 className="text-sm font-semibold tracking-tight text-white truncate max-w-[200px] sm:max-w-sm md:max-w-md">
                  {activeConversation?.title || 'New Chat'}
                </h1>
                <Edit3 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Architecture Badges & Model Dropdown & Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* SQLite WAL badge (Hidden on mobile) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-zinc-400">
            <Database className="w-3 h-3 text-cyan-400" />
            <span>SQLite WAL</span>
          </div>

          {/* Ollama status indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/5 text-[11px]"
            title={isOnline ? 'Ollama daemon is online' : 'Ollama daemon is offline'}
          >
            {isOnline ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                <span className="hidden sm:inline">Online</span>
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}
          </div>

          {/* Model Selection Dropdown */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161618] hover:bg-[#1E1E22] border border-white/10 text-xs font-medium text-zinc-200 transition-all shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="font-mono text-zinc-100 max-w-[100px] sm:max-w-[140px] truncate">
                {currentModel}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {modelDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setModelDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#161618] border border-white/10 p-1.5 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1.5 text-[10px] uppercase font-semibold tracking-wider text-zinc-400 border-b border-white/5">
                    Local Models
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
                    {availableModels.length > 0 ? (
                      availableModels.map((m) => (
                        <button
                          key={m}
                          onClick={() => {
                            setCurrentModel(m);
                            setModelDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors font-mono ${
                            currentModel === m
                              ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                              : 'text-zinc-300 hover:bg-white/5'
                          }`}
                        >
                          <span className="truncate">{m}</span>
                          {currentModel === m && (
                            <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 ml-1" />
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-zinc-400 text-[11px]">
                        No models discovered. Ensure Ollama is running.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Refresh connection status */}
          <button
            onClick={onRefreshStatus}
            className="p-2 rounded-xl bg-[#161618] hover:bg-[#1E1E22] border border-white/10 text-zinc-400 hover:text-zinc-200 transition-all text-xs"
            title="Refresh Ollama & DB status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Clear history button */}
          <button
            onClick={onClearHistory}
            disabled={messageCount === 0}
            className={`p-2 rounded-xl border border-white/10 transition-all text-xs flex items-center gap-1.5 ${
              messageCount > 0
                ? 'bg-[#161618] hover:bg-rose-500/10 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400 cursor-pointer'
                : 'bg-transparent border-transparent text-zinc-400 cursor-not-allowed'
            }`}
            title="Clear Current Conversation History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Clear</span>
          </button>
        </div>
      </div>
    </header>
  );
}
