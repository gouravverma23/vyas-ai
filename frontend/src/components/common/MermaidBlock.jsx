import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import {
  Workflow,
  Eye,
  Code2,
  Copy,
  Check,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  AlertCircle,
  Loader2
} from 'lucide-react';
import CodeBlock from './CodeBlock';

let isMermaidInitialized = false;

function ensureMermaidInitialized() {
  if (isMermaidInitialized) return;
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'antiscript',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      suppressErrorRendering: true,
      themeVariables: {
        darkMode: true,
        background: '#121214',
        primaryColor: '#6366f1',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#818cf8',
        lineColor: '#94a3b8',
        secondaryColor: '#1e1e24',
        tertiaryColor: '#18181b',
        mainBkg: '#18181b',
        nodeBorder: '#6366f1',
        clusterBkg: '#121214',
        clusterBorder: '#3f3f46',
        titleColor: '#e0e7ff',
        edgeLabelBackground: '#18181b',
        nodeTextColor: '#f8fafc',
        actorBorder: '#6366f1',
        actorBkg: '#1e1e2e',
        actorTextColor: '#f8fafc',
        actorLineColor: '#818cf8',
        signalColor: '#818cf8',
        signalTextColor: '#f8fafc',
        labelBoxBkgColor: '#18181b',
        labelBoxBorderColor: '#6366f1',
        labelTextColor: '#f8fafc',
        loopTextColor: '#f8fafc',
        noteBorderColor: '#eab308',
        noteBkgColor: '#27272a',
        noteTextColor: '#fef08a',
        activationBorderColor: '#818cf8',
        activationBkgColor: '#312e81',
        sequenceNumberColor: '#ffffff'
      }
    });
    isMermaidInitialized = true;
  } catch (err) {
    console.warn('Mermaid initialization warning:', err);
  }
}

function cleanMermaidCode(raw) {
  if (!raw) return '';
  return raw
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export default function MermaidBlock({ code, isStreaming = false }) {
  const [activeTab, setActiveTab] = useState('diagram');
  const [svgContent, setSvgContent] = useState('');
  const [renderError, setRenderError] = useState(null);
  const [isRendering, setIsRendering] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const containerRef = useRef(null);
  const modalContainerRef = useRef(null);
  const renderCounterRef = useRef(0);

  const cleanedCode = cleanMermaidCode(code);

  useEffect(() => {
    ensureMermaidInitialized();

    let isMounted = true;
    const renderId = `mermaid-svg-${Date.now()}-${++renderCounterRef.current}`;

    async function renderDiagram() {
      if (!cleanedCode) {
        setIsRendering(false);
        return;
      }

      setIsRendering(true);
      try {
        const { svg } = await mermaid.render(renderId, cleanedCode);
        if (isMounted) {
          setSvgContent(svg);
          setRenderError(null);
          setIsRendering(false);
        }
      } catch (err) {
        const tempElement = document.getElementById(renderId);
        if (tempElement) {
          tempElement.remove();
        }

        if (isMounted) {
          setRenderError(err?.message || 'Failed to render diagram syntax.');
          setIsRendering(false);
        }
      }
    }

    renderDiagram();

    return () => {
      isMounted = false;
      const el = document.getElementById(renderId);
      if (el) el.remove();
    };
  }, [cleanedCode]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(cleanedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy mermaid code:', err);
    }
  };

  const handleDownloadSvg = () => {
    if (!svgContent) return;
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `diagram-${Date.now()}.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to download SVG:', err);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-white/10 bg-[#121214] shadow-2xl group">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#1A1A1E] border-b border-white/5 text-xs text-zinc-400 select-none">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-indigo-400" />
          <span className="font-medium text-zinc-300">Mermaid Diagram</span>

          {isStreaming && (
            <span className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              Streaming
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Tab Switcher */}
          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5 mr-1">
            <button
              onClick={() => setActiveTab('diagram')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === 'diagram'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Diagram</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === 'code'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          {/* Copy Code */}
          <button
            onClick={handleCopyCode}
            aria-label="Copy Mermaid source"
            title="Copy diagram source"
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all text-xs"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Download SVG */}
          {activeTab === 'diagram' && svgContent && !renderError && (
            <button
              onClick={handleDownloadSvg}
              aria-label="Download SVG"
              title="Download diagram as SVG"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all text-xs"
            >
              {downloadSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Zoom Controls */}
          {activeTab === 'diagram' && svgContent && !renderError && (
            <div className="flex items-center gap-0.5 ml-1 border-l border-white/10 pl-1.5">
              <button
                onClick={handleZoomIn}
                title="Zoom in"
                className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomOut}
                title="Zoom out"
                className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              {zoom !== 1 && (
                <button
                  onClick={handleResetZoom}
                  title="Reset zoom"
                  className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Fullscreen Button */}
          {activeTab === 'diagram' && svgContent && !renderError && (
            <button
              onClick={() => setIsFullscreen(true)}
              aria-label="View diagram fullscreen"
              title="View fullscreen"
              className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors ml-0.5"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="relative p-4 overflow-x-auto min-h-[160px] flex items-center justify-center bg-[#0C0C0E]">
        {activeTab === 'diagram' ? (
          <>
            {isRendering && (
              <div className="flex items-center gap-2.5 text-zinc-400 text-xs py-8">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Rendering diagram...</span>
              </div>
            )}

            {!isRendering && renderError ? (
              <div className="w-full p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                <div className="flex items-center gap-2 font-semibold text-rose-400 mb-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Diagram Syntax Error</span>
                </div>
                <p className="text-zinc-400 mb-3 font-sans">
                  The diagram syntax could not be parsed by Mermaid.
                </p>
                <div className="bg-black/50 p-2.5 rounded border border-white/5 font-mono text-[11px] overflow-x-auto whitespace-pre">
                  {cleanedCode}
                </div>
              </div>
            ) : null}

            {!isRendering && !renderError && svgContent ? (
              <div
                ref={containerRef}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}
                className="w-full flex justify-center items-center py-2 overflow-visible select-none"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            ) : null}
          </>
        ) : (
          <div className="w-full">
            <CodeBlock language="mermaid" value={cleanedCode} />
          </div>
        )}
      </div>

      {/* Fullscreen Modal View */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-6 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 text-zinc-200">
            <div className="flex items-center gap-2">
              <Workflow className="w-5 h-5 text-indigo-400" />
              <span className="font-semibold text-sm">Diagram Inspector</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadSvg}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white"
              >
                <Download className="w-4 h-4" />
                <span>Export SVG</span>
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            ref={modalContainerRef}
            className="flex-1 overflow-auto flex items-center justify-center p-8 select-none"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      )}
    </div>
  );
}

