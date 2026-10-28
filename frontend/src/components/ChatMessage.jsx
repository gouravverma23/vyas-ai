import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, Image as ImageIcon, Sparkles, Maximize2, X } from 'lucide-react';
import CodeBlock from './CodeBlock';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [expandedImage, setExpandedImage] = useState(false);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div
      className={`group relative flex w-full gap-4 px-4 py-5 transition-colors ${
        isUser
          ? 'bg-transparent justify-end'
          : 'bg-[#121212]/40 border-y border-white/[0.03]'
      }`}
    >
      <div
        className={`flex max-w-4xl w-full gap-4 ${
          isUser ? 'flex-row-reverse max-w-2xl' : 'flex-row'
        }`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 border border-white/10 flex items-center justify-center text-indigo-400 shadow-md ring-1 ring-white/10">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
          )}
        </div>

        {/* Message Body */}
        <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : 'text-left'}`}>
          {/* Header info */}
          <div
            className={`flex items-center gap-2 mb-1.5 text-xs text-zinc-400 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            <span className="font-semibold text-zinc-300">
              {isUser ? 'You' : 'Assistant (Local Ollama)'}
            </span>
            {message.created_at && (
              <span className="text-zinc-400 text-[11px]">
                {formatTime(message.created_at)}
              </span>
            )}
            {message.isStreaming && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                Generating...
              </span>
            )}
          </div>

          {/* Attached Image if present */}
          {(message.has_image || message.image_data) && (
            <div className={`mb-3 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
              <div className="relative group/img rounded-xl overflow-hidden border border-white/10 bg-[#141414] shadow-lg max-w-xs transition-all hover:border-indigo-500/50">
                {message.image_data ? (
                  <img
                    src={message.image_data}
                    alt="Uploaded user media"
                    className="max-h-56 w-auto object-cover rounded-xl cursor-pointer"
                    onClick={() => setExpandedImage(true)}
                  />
                ) : (
                  <div className="p-3 flex items-center gap-2 text-xs text-zinc-400">
                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                    <span>Multimodal Image Attached</span>
                  </div>
                )}
                {message.image_data && (
                  <button
                    onClick={() => setExpandedImage(true)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white"
                    title="Click to expand"
                  >
                    <Maximize2 className="w-5 h-5 drop-shadow" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Text Bubble / Markdown */}
          <div
            className={`inline-block text-left text-[14px] leading-relaxed break-words rounded-2xl ${
              isUser
                ? 'bg-gradient-to-br from-indigo-600/90 to-indigo-700/80 text-white px-4 py-2.5 shadow-md shadow-indigo-900/20 border border-indigo-500/30'
                : 'text-zinc-200 prose-custom w-full'
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : message.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    if (!inline && (match || codeString.includes('\n'))) {
                      return (
                        <CodeBlock
                          language={match ? match[1] : ''}
                          value={codeString}
                        />
                      );
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : message.isStreaming ? (
              <span className="inline-flex items-center gap-2 text-zinc-400 text-xs py-1 font-mono">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <span>Thinking / Generating tokens...</span>
              </span>
            ) : null}

            {/* Blinking cursor for streaming response */}
            {!isUser && message.isStreaming && message.content && <span className="cursor-blink" />}
          </div>

          {/* Action toolbar (copy button, etc) */}
          <div
            className={`flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            <button
              onClick={handleCopyMessage}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded hover:bg-white/5 transition-all"
              title="Copy message"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Image Modal */}
      {expandedImage && message.image_data && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setExpandedImage(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={message.image_data}
              alt="Enlarged multimodal preview"
              className="max-h-[85vh] max-w-full rounded-xl object-contain border border-white/20 shadow-2xl"
            />
            <button
              onClick={() => setExpandedImage(false)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
