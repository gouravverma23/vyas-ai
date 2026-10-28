import React, { useState } from 'react';
import { Cpu, Database, Trash2, RefreshCw, ChevronDown, Check, Wifi, WifiOff } from 'lucide-react';

export default function Header({
  ollamaStatus,
  availableModels,
  currentModel,
  setCurrentModel,
  onClearHistory,
  onRefreshStatus,
  messageCount
}) {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const isOnline = ollamaStatus?.online ?? false;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/[0.08] bg-[#0A0A0A]/85 backdrop-blur-xl px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Branding & Architecture Badges */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/20">
            <Cpu className="w-5 h-5" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#0A0A0A] ${
                isOnline ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">
                Local AI Interface
              </h1>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Offline-First
              </span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-zinc-400">
              {/* SQLite WAL badge */}
              <span className="flex items-center gap-1 text-zinc-400">
                <Database className="w-3 h-3 text-cyan-400" />
                <span>SQLite WAL Mode</span>
              </span>
              <span>•</span>
              {/* Ollama status */}
              <span className="flex items-center gap-1">
                {isOnline ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> Ollama Ready
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> Ollama Offline
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Model Selector & Actions */}
        <div className="flex items-center gap-2">
          {/* Model Selection Dropdown */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161616] hover:bg-[#1E1E1E] border border-white/10 text-xs font-medium text-zinc-200 transition-all shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="font-mono text-zinc-100">{currentModel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {modelDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setModelDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl glass-dropdown p-1.5 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
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
            className="p-2 rounded-xl bg-[#161616] hover:bg-[#1E1E1E] border border-white/10 text-zinc-400 hover:text-zinc-200 transition-all text-xs"
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
                ? 'bg-[#161616] hover:bg-rose-500/10 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400 cursor-pointer'
                : 'bg-transparent border-transparent text-zinc-400 cursor-not-allowed'
            }`}
            title="Clear Chat History (SQLite)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Clear</span>
          </button>
        </div>
      </div>
    </header>
  );
}
