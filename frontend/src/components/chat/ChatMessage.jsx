import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { User, Copy, Check, Image as ImageIcon, Sparkles, Maximize2, X } from 'lucide-react';
import { CodeBlock, MermaidBlock } from '../common';
import { preprocessLaTeX, isMermaidCode } from '../../utils/markdown';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState(null);

  const handleCopy = async () => {
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

  // Helper to parse single or multiple images safely
  const parseImages = (imageData) => {
    if (!imageData) return [];
    if (Array.isArray(imageData)) return imageData;
    if (typeof imageData === 'string') {
      const trimmed = imageData.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // Fall back to treating as single URL
        }
      }
      return [trimmed];
    }
    return [];
  };

  const imagesList = parseImages(message.image_data);

  // Extract thinking content and final response
  const rawContent = message.content || '';
  let thinkingContent = '';
  let mainContent = rawContent;

  const thinkStart = rawContent.indexOf('<think>');
  if (thinkStart !== -1) {
    const thinkEnd = rawContent.indexOf('</think>', thinkStart);
    if (thinkEnd !== -1) {
      thinkingContent = rawContent.substring(thinkStart + 7, thinkEnd).trim();
      mainContent = (rawContent.substring(0, thinkStart) + rawContent.substring(thinkEnd + 8)).trim();
    } else {
      thinkingContent = rawContent.substring(thinkStart + 7).trim();
      mainContent = rawContent.substring(0, thinkStart).trim();
    }
  }

  const processedMainContent = preprocessLaTeX(mainContent);
  const processedThinkingContent = preprocessLaTeX(thinkingContent);

  return (
    <div
      className={`group relative flex w-full px-4 py-4 md:px-6 transition-colors ${
        isUser
          ? 'bg-transparent justify-end'
          : 'bg-[#121214]/40 border-y border-white/[0.03] justify-start'
      }`}
    >
      <div
        className={`flex w-full gap-3 md:gap-4 ${
          isUser ? 'flex-row-reverse max-w-2xl' : 'flex-row max-w-4xl'
        }`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#1C1C20] border border-white/10 flex items-center justify-center text-indigo-400 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content Column */}
        <div className={`flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start flex-1'}`}>
          {/* Header (Role & Timestamp) */}
          <div
            className={`flex items-center gap-2 mb-1.5 text-xs ${
              isUser ? 'flex-row-reverse text-indigo-300/80' : 'text-zinc-400'
            }`}
          >
            <span className="font-semibold">{isUser ? 'You' : 'Local AI'}</span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {formatTime(message.created_at)}
            </span>
          </div>

          {/* Attached Images Grid */}
          {imagesList.length > 0 && (
            <div className={`flex flex-wrap gap-2.5 mb-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {imagesList.map((imgUri, idx) => (
                <div
                  key={idx}
                  className="relative group/img rounded-xl overflow-hidden border border-white/10 bg-black/40 max-w-[200px] max-h-[160px] shadow-md cursor-pointer hover:border-indigo-500/50 transition-all"
                  onClick={() => setExpandedImageUrl(imgUri)}
                >
                  <img
                    src={imgUri}
                    alt="Attached preview"
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Maximize2 className="w-4 h-4 drop-shadow" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* User Bubble or Assistant Markdown View */}
          {isUser ? (
            <div className="inline-block text-left text-[14px] leading-relaxed break-words rounded-2xl bg-gradient-to-br from-indigo-600/90 to-indigo-700/80 text-white px-4 py-2.5 shadow-md shadow-indigo-900/20 border border-indigo-500/30 whitespace-pre-wrap">
              {message.content}
            </div>
          ) : (
            <div className="w-full space-y-3">
              {/* Thinking process accordion (collapsible) */}
              {thinkingContent && (
                <details className="group/think my-2 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs overflow-hidden transition-all">
                  <summary className="flex items-center gap-2 px-3.5 py-2.5 text-indigo-300 font-medium cursor-pointer hover:bg-indigo-500/10 transition-colors select-none">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span>Thinking Process</span>
                    <span className="text-[10px] text-zinc-500 font-mono ml-auto">
                      Click to inspect
                    </span>
                  </summary>
                  <div className="px-4 py-3 border-t border-indigo-500/10 text-zinc-400 font-sans text-xs leading-relaxed space-y-2 select-text bg-black/20">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[
                        [
                          rehypeKatex,
                          {
                            output: 'html',
                            throwOnError: false,
                          },
                        ],
                      ]}
                    >
                      {processedThinkingContent}
                    </ReactMarkdown>
                  </div>
                </details>
              )}

              {/* Render Markdown with KaTeX math & Mermaid integration */}
              <div className="prose-custom w-full max-w-none text-[14px] leading-relaxed select-text text-zinc-100">
                {processedMainContent ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[
                      [
                        rehypeKatex,
                        {
                          output: 'html',
                          throwOnError: false,
                        },
                      ],
                    ]}
                    components={{
                      code({ node: _node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match ? match[1].toLowerCase() : '';
                        const codeString = String(children).replace(/\n$/, '');

                        if (!inline && isMermaidCode(lang, codeString)) {
                          return <MermaidBlock code={codeString} isStreaming={Boolean(message.isStreaming)} />;
                        }

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
                    {processedMainContent}
                  </ReactMarkdown>
                ) : (
                  message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
                  )
                )}
              </div>

              {/* Assistant Message Actions Toolbar */}
              {!message.isStreaming && rawContent && (
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <button
                    onClick={handleCopy}
                    aria-label="Copy full response"
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 text-xs transition-colors"
                    title="Copy message"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Image Modal View */}
      {expandedImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setExpandedImageUrl(null)}
        >
          <button
            onClick={() => setExpandedImageUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Close image view"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={expandedImageUrl}
            alt="Expanded view"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/10"
          />
        </div>
      )}
    </div>
  );
}
