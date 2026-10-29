import React, { useRef, useEffect, useState } from 'react';
import { Send, Image as ImageIcon, X, Square, Brain, Ghost, ChevronDown, Check, Plus } from 'lucide-react';

export default function ChatInput({
  input,
  setInput,
  attachedImages = [],
  setAttachedImages,
  attachedImage,
  setAttachedImage,
  isStreaming,
  isThinkingEnabled = false,
  setIsThinkingEnabled,
  onSend,
  onStop,
  disabled,
  isTemporaryMode = false,
  availableModels = [],
  currentModel,
  setCurrentModel
}) {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Normalize images support whether array or single image prop is provided
  const currentImages = attachedImages && attachedImages.length > 0
    ? attachedImages
    : (attachedImage ? [attachedImage] : []);

  const updateImages = (updater) => {
    if (setAttachedImages) {
      if (typeof updater === 'function') {
        setAttachedImages(updater);
      } else {
        setAttachedImages(updater);
      }
    } else if (setAttachedImage) {
      if (typeof updater === 'function') {
        const next = updater(currentImages);
        setAttachedImage(next[0] || null);
      } else {
        setAttachedImage(updater[0] || null);
      }
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && (input.trim() || currentImages.length > 0)) {
        onSend();
      }
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      const newItems = imageFiles.map((file, idx) => ({
        id: `img-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }));
      updateImages((prev) => [...prev, ...newItems]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      const newItems = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            newItems.push({
              id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
              file,
              previewUrl: URL.createObjectURL(file)
            });
          }
        }
      }
      if (newItems.length > 0) {
        updateImages((prev) => [...prev, ...newItems]);
        e.preventDefault();
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      const newItems = imageFiles.map((file, idx) => ({
        id: `img-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }));
      updateImages((prev) => [...prev, ...newItems]);
    }
  };

  const removeAttachedImage = (idToRemove) => {
    updateImages((prev) => {
      const item = prev.find((img) => img.id === idToRemove);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((img) => img.id !== idToRemove);
    });
  };

  const clearAllImages = () => {
    currentImages.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    updateImages([]);
  };

  return (
    <div
      className="max-w-4xl mx-auto w-full px-4 pb-4 pt-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Staged Multiple Images Preview Area */}
      {currentImages.length > 0 && (
        <div className="mb-2.5 p-2 rounded-2xl bg-[#141416]/95 border border-white/10 backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between px-2 py-1 mb-1.5 text-xs text-zinc-400 border-b border-white/5">
            <div className="flex items-center gap-1.5 font-medium text-zinc-300">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Attached Images ({currentImages.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 font-medium"
                title="Add more images"
              >
                <Plus className="w-3 h-3" /> Add More
              </button>
              <span className="text-zinc-600">•</span>
              <button
                type="button"
                onClick={clearAllImages}
                className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors font-medium"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Horizontal scrollable image cards */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 px-1 scrollbar-thin">
            {currentImages.map((img, index) => (
              <div
                key={img.id || index}
                className="relative group/card flex-shrink-0 w-24 rounded-xl overflow-hidden border border-white/10 bg-black/60 shadow-md transition-all hover:border-indigo-500/40"
              >
                <div className="w-24 h-20 bg-black flex items-center justify-center overflow-hidden">
                  <img
                    src={img.previewUrl}
                    alt={img.file?.name || `Attached ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-1 px-1.5 bg-[#18181A] border-t border-white/5">
                  <p className="text-[10px] text-zinc-300 truncate" title={img.file?.name}>
                    {img.file?.name || `Image ${index + 1}`}
                  </p>
                  <p className="text-[9px] text-zinc-500 font-mono">
                    {img.file?.size ? `${(img.file.size / 1024).toFixed(0)} KB` : 'Ready'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachedImage(img.id)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/80 hover:bg-rose-600 text-white opacity-90 group-hover/card:opacity-100 transition-all shadow-md"
                  title="Remove this image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Input Capsule */}
      <div className="relative flex flex-col rounded-2xl bg-[#141414] border border-white/10 focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-2xl">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isTemporaryMode
              ? 'Message in temporary chat (not saved to database)...'
              : currentImages.length > 0
              ? `Ask anything about the ${currentImages.length} attached image${currentImages.length > 1 ? 's' : ''}...`
              : isThinkingEnabled
              ? 'Message Ollama (Deep thinking mode ON)...'
              : 'Message Ollama (Fast mode, instant reply)...'
          }
          rows={1}
          disabled={disabled}
          className="w-full bg-transparent text-[14.5px] text-zinc-100 placeholder-zinc-400 resize-none px-4 pt-3.5 pb-2.5 focus:outline-none min-h-[48px] max-h-[180px] leading-relaxed"
        />

        {/* Bottom Toolbar inside the input capsule */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          {/* Left actions: Model Selector + Attach images & Thinking switch */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Model Selection Dropdown (Inside Input Box) */}
            {setCurrentModel && currentModel && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  disabled={isStreaming}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-zinc-200 transition-all shadow-sm group disabled:opacity-50"
                  title="Select local Ollama model"
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
                  <span className="font-mono text-zinc-100 max-w-[100px] sm:max-w-[140px] truncate text-[11.5px]">
                    {currentModel}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-transform flex-shrink-0" />
                </button>

                {modelDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setModelDropdownOpen(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-[#18181B] border border-white/10 p-1.5 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2.5 py-1.5 text-[10px] uppercase font-semibold tracking-wider text-zinc-400 border-b border-white/5 flex items-center justify-between">
                        <span>Local Models</span>
                        <span className="font-mono text-[9px] text-zinc-500">{availableModels.length} available</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
                        {availableModels.length > 0 ? (
                          availableModels.map((m) => (
                            <button
                              key={m}
                              type="button"
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
            )}

            {/* Attach Images (Multiple enabled) */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/webp, image/gif"
              multiple
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                currentImages.length > 0
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
              title="Attach one or more images for multimodal vision models"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-[12px]">
                {currentImages.length > 0 ? `Images (${currentImages.length})` : 'Attach Images'}
              </span>
            </button>

            {/* Thinking on/off switch */}
            {setIsThinkingEnabled && (
              <button
                type="button"
                onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                disabled={isStreaming}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all select-none border ${
                  isThinkingEnabled
                    ? 'bg-violet-600/20 text-violet-300 border-violet-500/40 shadow-sm shadow-violet-900/30'
                    : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border-white/5'
                }`}
                title={
                  isThinkingEnabled
                    ? 'Thinking Mode is ON: Model will reason through internal thinking tokens before answering'
                    : 'Thinking Mode is OFF: Model answers instantly without thinking tokens (Fast)'
                }
              >
                <Brain
                  className={`w-3.5 h-3.5 transition-transform ${
                    isThinkingEnabled ? 'text-violet-400 scale-110' : 'text-zinc-400'
                  }`}
                />
                <span className="text-[12px] flex items-center gap-1.5">
                  <span className="hidden sm:inline">Thinking:</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      isThinkingEnabled
                        ? 'bg-violet-500/30 text-violet-200'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {isThinkingEnabled ? 'ON' : 'OFF'}
                  </span>
                </span>
              </button>
            )}
          </div>

          {/* Right actions: Send or Stop */}
          <div className="flex items-center gap-2">
            {isTemporaryMode && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                <Ghost className="w-3 h-3" /> Incognito (Unsaved)
              </span>
            )}

            <span className="hidden md:inline text-[11px] text-zinc-400 mr-1 select-none">
              Enter to send • Shift+Enter for newline
            </span>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-medium transition-all shadow-lg shadow-rose-900/20"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={(!input.trim() && currentImages.length === 0) || disabled}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                  input.trim() || currentImages.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95'
                    : 'bg-white/5 text-zinc-400 cursor-not-allowed'
                }`}
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
