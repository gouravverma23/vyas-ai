import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';

export default function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  const getHighlightedCode = () => {
    const lang = language ? language.toLowerCase() : 'text';
    if (Prism.languages[lang]) {
      return Prism.highlight(value, Prism.languages[lang], lang);
    }
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-white/10 bg-[#121212] shadow-2xl group">
      {/* Code block header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1A1A1A] border-b border-white/5 text-xs text-zinc-400 select-none">
        <span className="font-mono text-zinc-300 font-medium lowercase tracking-wide">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all text-xs focus:outline-none"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto p-4 text-[13px] font-mono leading-relaxed bg-[#0E0E0E]">
        <pre className="!bg-transparent !p-0 !m-0 !overflow-visible">
          <code
            dangerouslySetInnerHTML={{ __html: getHighlightedCode() }}
            className={`language-${language || 'text'}`}
          />
        </pre>
      </div>
    </div>
  );
}

