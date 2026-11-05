import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Trash2,
  RefreshCw,
  Check,
  Wifi,
  WifiOff,
  PanelLeft,
  PanelLeftClose,
  Edit3,
  Folder,
  X,
  Ghost
} from 'lucide-react';

export default function Header({
  ollamaStatus,
  onClearHistory,
  onRefreshStatus,
  messageCount,
  sidebarOpen,
  onToggleSidebar,
  activeConversation,
  onRenameActiveConversation,
  isTemporaryMode = false,
  onExitTemporaryChat
}) {
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
    <header className="sticky top-0 z-20 w-full border-b border-white/[0.08] bg-[#0A0A0C]/90 backdrop-blur-xl px-3 md:px-5 py-2.5 select-none">
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

          {/* Active Conversation Title & Breadcrumb OR Temporary Chat Badge */}
          {isTemporaryMode ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 shadow-sm">
                <Ghost className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-xs font-semibold">Temporary Chat</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Not Saved
                </span>
              </div>
              <button
                onClick={onExitTemporaryChat}
                className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-300 hover:text-white transition-all flex items-center gap-1 border border-white/10"
                title="Exit temporary chat and return to saved conversations"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Exit</span>
              </button>
            </div>
          ) : activeConversation ? (
            <div className="flex items-center gap-2 min-w-0">
              {activeConversation.group_name && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 font-medium px-2 py-0.5 rounded-lg bg-white/5 border border-white/5">
                  <Folder className="w-3 h-3 text-indigo-400" />
                  <span className="truncate max-w-[120px]">{activeConversation.group_name}</span>
                  <span className="text-zinc-600">/</span>
                </div>
              )}

              {isEditingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editingTitleText}
                    onChange={(e) => setEditingTitleText(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={handleSaveRename}
                    className="bg-[#141416] text-white text-xs font-semibold px-2 py-1 rounded-lg border border-indigo-500/70 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[200px] sm:max-w-[320px]"
                  />
                  <button
                    onClick={handleSaveRename}
                    className="p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    title="Save title"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={handleStartRename}
                  className="flex items-center gap-1.5 group/rename cursor-pointer hover:bg-white/5 px-2 py-1 rounded-lg transition-colors min-w-0"
                  title="Click to rename conversation"
                >
                  <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate max-w-[200px] sm:max-w-[340px]">
                    {activeConversation.title || 'Untitled Chat'}
                  </h1>
                  <Edit3 className="w-3 h-3 text-zinc-500 opacity-0 group-hover/rename:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
          ) : (
            <h1 className="text-xs sm:text-sm font-semibold text-zinc-300">New Conversation</h1>
          )}
        </div>

        {/* Right Side: Status Badges & Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {/* SQLite WAL DB indicator */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-300 text-xs font-mono select-none"
            title="Local SQLite storage active with Write-Ahead Logging"
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">SQLite</span>
          </div>

          {/* Ollama Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-medium transition-all select-none ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
            title={
              isOnline
                ? `Ollama v${ollamaStatus?.version || ''} online`
                : 'Ollama offline. Make sure Ollama daemon is running.'
            }
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="hidden md:inline font-mono">
                  {ollamaStatus?.version ? `v${ollamaStatus.version}` : 'Connected'}
                </span>
                <span className="md:hidden">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Refresh status button */}
          <button
            onClick={onRefreshStatus}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all"
            title="Check connection status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Clear history button */}
          <button
            onClick={onClearHistory}
            disabled={messageCount === 0}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-medium ${
              messageCount > 0
                ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-300 hover:text-rose-200 cursor-pointer'
                : 'bg-white/[0.02] border-white/5 text-zinc-600 cursor-not-allowed'
            }`}
            title={activeConversation ? 'Clear messages in this chat' : 'Clear chat history'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>
    </header>
  );
}

