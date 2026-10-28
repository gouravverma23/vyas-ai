import React, { useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Square, Sparkles, Brain } from 'lucide-react';

export default function ChatInput({
  input,
  setInput,
  attachedImage,
  setAttachedImage,
  isStreaming,
  isThinkingEnabled = false,
  setIsThinkingEnabled,
  onSend,
  onStop,
  disabled
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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
      if (!isStreaming && (input.trim() || attachedImage)) {
        onSend();
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setAttachedImage({ file, previewUrl });
    }
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const previewUrl = URL.createObjectURL(file);
            setAttachedImage({ file, previewUrl });
            e.preventDefault();
            break;
          }
        }
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setAttachedImage({ file, previewUrl });
    }
  };

  const removeAttachedImage = () => {
    if (attachedImage?.previewUrl) {
      URL.revokeObjectURL(attachedImage.previewUrl);
    }
    setAttachedImage(null);
  };

  return (
    <div
      className="max-w-4xl mx-auto w-full px-4 pb-4 pt-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Staged Image Preview Area */}
      {attachedImage && (
        <div className="mb-2.5 flex items-center gap-3 bg-[#161616] border border-white/10 rounded-xl p-2.5 max-w-sm shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="relative group rounded-lg overflow-hidden border border-white/10 w-16 h-16 bg-black flex-shrink-0">
            <img
              src={attachedImage.previewUrl}
              alt="Staged upload preview"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <p className="text-xs font-medium text-zinc-200 truncate">
              {attachedImage.file.name || 'Attached Image'}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {(attachedImage.file.size / 1024).toFixed(1)} KB • Multimodal payload
            </p>
          </div>
          <button
            type="button"
            onClick={removeAttachedImage}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/30"
            title="Remove attached image"
          >
            <X className="w-4 h-4" />
          </button>
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
            attachedImage
              ? 'Ask anything about this image...'
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
          {/* Left actions: Attach image & Thinking switch */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/webp, image/gif"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                attachedImage
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
              title="Attach image for vision model"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-[12px]">Attach Image</span>
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
                disabled={(!input.trim() && !attachedImage) || disabled}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                  input.trim() || attachedImage
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
