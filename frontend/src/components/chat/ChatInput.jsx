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
    if (!files.length) return;

    const MAX_ALLOWED = 10;
    const remainingSlots = MAX_ALLOWED - currentImages.length;
    if (remainingSlots <= 0) {
      alert(`Maximum of ${MAX_ALLOWED} images can be attached.`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 25 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 25 MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const newImg = {
          file,
          previewUrl: event.target.result,
          name: file.name
        };
        updateImages((prev) => [...prev, newImg]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    updateImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          if (currentImages.length >= 10) {
            alert('Maximum of 10 images can be attached.');
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            const newImg = {
              file,
              previewUrl: event.target.result,
              name: 'pasted-image.png'
            };
            updateImages((prev) => [...prev, newImg]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 select-none">
      <div
        className={`relative flex flex-col rounded-2xl border transition-all duration-200 shadow-xl ${
          isTemporaryMode
            ? 'bg-[#121217] border-purple-500/30 shadow-purple-500/5 focus-within:border-purple-500/60'
            : 'bg-[#141416] border-white/10 shadow-black/40 focus-within:border-indigo-500/50'
        }`}
      >
        {/* Temporary Mode Alert Pill inside input top */}
        {isTemporaryMode && (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 border-b border-purple-500/20 bg-purple-500/10 text-purple-300 text-[11px] font-medium rounded-t-2xl">
            <Ghost className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Incognito Session Active: Messages and attachments will not be saved to disk.</span>
          </div>
        )}

        {/* Attached Images Horizontal Preview Bar */}
        {currentImages.length > 0 && (
          <div className="flex flex-wrap gap-2.5 p-3 border-b border-white/5 bg-black/20">
            {currentImages.map((img, idx) => (
              <div
                key={idx}
                className="relative group w-16 h-16 rounded-xl overflow-hidden border border-white/15 bg-black/40 flex-shrink-0 shadow-md"
              >
                <img
                  src={img.previewUrl}
                  alt={img.name || `Preview ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 hover:bg-rose-600 text-white transition-colors"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {currentImages.length < 10 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-xl border border-dashed border-white/20 hover:border-indigo-500/60 flex flex-col items-center justify-center text-zinc-400 hover:text-indigo-400 transition-colors bg-white/[0.02]"
                title="Add another image"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[9px] mt-0.5 font-medium">Add</span>
              </button>
            )}
          </div>
        )}

        {/* Text input area */}
        <div className="flex items-end px-3 py-2.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isTemporaryMode
                ? 'Type in incognito mode (Shift+Enter for newline)...'
                : 'Send a message or attach images (Shift+Enter for newline)...'
            }
            rows={1}
            disabled={disabled}
            className="flex-1 max-h-[180px] bg-transparent text-[14px] text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed px-2 py-1 select-text"
          />

          {/* Hidden multi-file file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/5 bg-[#101012] rounded-b-2xl text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            {/* Model Selector Dropdown */}
            {availableModels && availableModels.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  disabled={isStreaming}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors border border-white/5 text-xs font-mono disabled:opacity-50"
                  title="Choose local Ollama model"
                >
                  <span className="truncate max-w-[130px] font-medium">{currentModel}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>

                {modelDropdownOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-0 bottom-full mb-2 w-48 bg-[#18181C] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 text-xs font-mono"
                  >
                    <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500 border-b border-white/5 select-none">
                      Local Models
                    </div>
                    {availableModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          if (setCurrentModel) setCurrentModel(m);
                          setModelDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                          m === currentModel
                            ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{m}</span>
                        {m === currentModel && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Attach Image Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || currentImages.length >= 10}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors ${
                currentImages.length > 0
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                  : 'bg-white/5 hover:bg-white/10 border-white/5 text-zinc-400 hover:text-zinc-200'
              } disabled:opacity-40`}
              title="Attach up to 10 images (PNG, JPG, WEBP, GIF)"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">
                {currentImages.length > 0 ? `${currentImages.length} attached` : 'Attach Image'}
              </span>
            </button>

            {/* Thinking Mode Toggle Button */}
            {setIsThinkingEnabled && (
              <button
                type="button"
                onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                disabled={isStreaming}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors ${
                  isThinkingEnabled
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-white/5 hover:bg-white/10 border-white/5 text-zinc-400 hover:text-zinc-200'
                } disabled:opacity-40`}
                title="Toggle chain-of-thought thinking visibility"
              >
                <Brain className={`w-3.5 h-3.5 ${isThinkingEnabled ? 'text-indigo-400' : ''}`} />
                <span className="hidden sm:inline font-medium">
                  {isThinkingEnabled ? 'Thinking On' : 'Thinking Off'}
                </span>
              </button>
            )}
          </div>

          {/* Send / Stop Generation Button */}
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors shadow-sm"
                title="Stop streaming response"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={disabled || (!input.trim() && currentImages.length === 0)}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white transition-all shadow-md shadow-indigo-600/30 active:scale-95"
                title="Send message (Enter)"
              >
                <Send className="w-3.5 h-3.5 ml-0.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

