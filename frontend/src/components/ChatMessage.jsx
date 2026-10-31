import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { User, Copy, Check, Image as ImageIcon, Sparkles, Maximize2, X } from 'lucide-react';
import CodeBlock from './CodeBlock';
import MermaidBlock from './MermaidBlock';

// Pre-process LLM text so math renders reliably
function preprocessLaTeX(content) {
  if (!content) return '';

  return (
    content
      // 1. Convert display brackets \[ ... \] to $$ ... $$
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`)
      // 2. Convert inline brackets \( ... \) to $ ... $
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`)
      // 3. Ensure $$ display blocks that share a line with text have surrounding newlines for block parsing
      .replace(/([^\n])\s*\$\$([\s\S]*?)\$\$/g, '$1\n\n$$\n$2\n$$\n\n')
      // 4. In math environments (cases, aligned, matrix, etc.), fix collapsed row break backslashes
      .replace(/\\begin\{(cases|aligned|matrix|pmatrix|bmatrix)\}([\s\S]*?)\\end\{\1\}/g, (match, env, inner) => {
        let fixedInner = inner
          // Fix single \ before & (common in aligned)
          .replace(/([^\\])\\\s*(&)/g, '$1\\\\\n$2')
          // Fix single \ before newline
          .replace(/([^\\])\\\s*(\r?\n)/g, '$1\\\\\n');

        if (env === 'cases') {
          // In cases, fix single \ followed by space and non-backslash that is followed by &
          // e.g. "if x = 1 \ 1 - p &" -> "if x = 1 \\ 1 - p &"
          fixedInner = fixedInner.replace(/([^\\])\\\s+([^\\&]+&)/g, '$1\\\\\n$2');
        }

        return `\\begin{${env}}${fixedInner}\\end{${env}}`;
      })
  );
}

// Auto-detect Mermaid diagrams whether declared as ```mermaid or via diagram syntax
function isMermaidCode(lang, code) {
  const normalizedLang = (lang || '').toLowerCase().trim();
  if (normalizedLang === 'mermaid') return true;
  if (!code) return false;
  const trimmed = code.trim();
  const mermaidPattern = /^(?:%%\{init.*?%%[\r\n\s]*)?(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|quadrantChart|xychart-beta|timeline|sankey-beta|kanban|block-beta|architecture-beta|C4Context|zenuml)\b/i;
  return mermaidPattern.test(trimmed);
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState(null);

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

  // Parse image_data which could be a single data URI or a JSON array of data URIs
  const getImages = () => {
    if (!message.image_data) return [];
    if (Array.isArray(message.image_data)) return message.image_data;
    if (typeof message.image_data === 'string') {
      const trimmed = message.image_data.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // fallback to single string
        }
      }
      return [trimmed];
    }
    return [];
  };

  const images = getImages();

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

          {/* Attached Images Gallery (Supports single or multiple images) */}
          {(images.length > 0 || message.has_image) && (
            <div className={`mb-3 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
              {images.length === 1 ? (
                /* Single Image View */
                <div className="relative group/img rounded-xl overflow-hidden border border-white/10 bg-[#141414] shadow-lg max-w-xs transition-all hover:border-indigo-500/50">
                  <img
                    src={images[0]}
                    alt="Uploaded user media"
                    className="max-h-56 w-auto object-cover rounded-xl cursor-pointer"
                    onClick={() => setExpandedImageUrl(images[0])}
                  />
                  <button
                    onClick={() => setExpandedImageUrl(images[0])}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white"
                    title="Click to expand"
                  >
                    <Maximize2 className="w-5 h-5 drop-shadow" />
                  </button>
                </div>
              ) : images.length === 2 ? (
                /* Two Images Side-by-Side */
                <div className="grid grid-cols-2 gap-2 max-w-sm sm:max-w-md">
                  {images.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative group/img rounded-xl overflow-hidden border border-white/10 bg-[#141414] shadow-md transition-all hover:border-indigo-500/50"
                    >
                      <img
                        src={src}
                        alt={`Uploaded user media ${idx + 1}`}
                        className="h-36 sm:h-44 w-full object-cover cursor-pointer"
                        onClick={() => setExpandedImageUrl(src)}
                      />
                      <button
                        onClick={() => setExpandedImageUrl(src)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white"
                        title="Click to expand"
                      >
                        <Maximize2 className="w-4 h-4 drop-shadow" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : images.length > 2 ? (
                /* 3+ Images Responsive Grid */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md sm:max-w-lg">
                  {images.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative group/img rounded-xl overflow-hidden border border-white/10 bg-[#141414] shadow-md transition-all hover:border-indigo-500/50"
                    >
                      <img
                        src={src}
                        alt={`Uploaded user media ${idx + 1}`}
                        className="h-28 sm:h-32 w-full object-cover cursor-pointer"
                        onClick={() => setExpandedImageUrl(src)}
                      />
                      <button
                        onClick={() => setExpandedImageUrl(src)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white"
                        title="Click to expand"
                      >
                        <Maximize2 className="w-4 h-4 drop-shadow" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback placeholder */
                <div className="p-3 rounded-xl border border-white/10 bg-[#141414] flex items-center gap-2 text-xs text-zinc-400">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  <span>Multimodal Image Attached</span>
                </div>
              )}
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
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[
                  [
                    rehypeKatex,
                    {
                      output: 'htmlAndMathml',
                      throwOnError: false,
                    },
                  ],
                ]}
                components={{
                  code({ node: _node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const lang = match ? match[1].toLowerCase() : '';
                    const codeString = String(children).replace(/\n$/, '');

                    // Auto-render Mermaid diagrams
                    if (!inline && isMermaidCode(lang, codeString)) {
                      return (
                        <MermaidBlock
                          code={codeString}
                          isStreaming={message.isStreaming}
                        />
                      );
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
                  }
                }}
              >
                {preprocessLaTeX(message.content)}
              </ReactMarkdown>
            ) : message.isStreaming ? (
              <span className="cursor-blink" />
            ) : null}
          </div>

          {/* Assistant message action buttons */}
          {!isUser && !message.isStreaming && message.content && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleCopyMessage}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 text-xs transition-colors"
                title="Copy response"
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
          )}
        </div>
      </div>

      {/* Expanded Image Lightbox Modal */}
      {expandedImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setExpandedImageUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img
              src={expandedImageUrl}
              alt="Enlarged multimodal preview"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain border border-white/20 shadow-2xl"
            />
            <button
              onClick={() => setExpandedImageUrl(null)}
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
