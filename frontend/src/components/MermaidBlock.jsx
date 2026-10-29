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

// Track initialization state
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

// Helper to decode HTML entities if passed by markdown parser
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
  const [activeTab, setActiveTab] = useState('diagram'); // 'diagram' | 'code'
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
    const currentId = `mermaid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    renderCounterRef.current += 1;
    const currentCounter = renderCounterRef.current;

    // Debounce rendering slightly during streaming to avoid excessive layout thrashing
    const renderTimeout = setTimeout(async () => {
      if (!cleanedCode) {
        if (isMounted) {
          setSvgContent('');
          setIsRendering(false);
        }
        return;
      }

      try {
        setIsRendering(true);
        // Test parsing before rendering
        await mermaid.parse(cleanedCode);

        // Render diagram to SVG
        const { svg, bindFunctions } = await mermaid.render(currentId, cleanedCode);

        if (isMounted && currentCounter === renderCounterRef.current) {
          setSvgContent(svg);
          setRenderError(null);
          setIsRendering(false);

          // Allow DOM to update then bind interactive handlers if provided by Mermaid
          setTimeout(() => {
            if (containerRef.current) {
              const svgEl = containerRef.current.querySelector('svg');
              if (svgEl && typeof bindFunctions === 'function') {
                bindFunctions(containerRef.current);
              }
            }
          }, 0);
        }
      } catch (err) {
        // Cleanup any stray error container Mermaid might insert
        const strayEl = document.getElementById(`d${currentId}`);
        if (strayEl) {
          strayEl.remove();
        }

        if (isMounted && currentCounter === renderCounterRef.current) {
          // If model is still actively streaming tokens, the syntax might just be incomplete
          if (isStreaming) {
            setIsRendering(true);
          } else {
            setRenderError(err.message || 'Syntax error in Mermaid diagram');
            setIsRendering(false);
          }
        }
      }
    }, isStreaming ? 250 : 50);

    return () => {
      isMounted = false;
      clearTimeout(renderTimeout);
      const strayEl = document.getElementById(`d${currentId}`);
      if (strayEl) {
        strayEl.remove();
      }
    };
  }, [cleanedCode, isStreaming]);

  // Copy raw mermaid syntax
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(cleanedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy mermaid code:', err);
    }
  };

  // Download SVG
  const handleDownloadSVG = () => {
    if (!svgContent) return;
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mermaid-diagram-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to download SVG:', err);
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.2).toFixed(1)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(1)));
  const handleZoomReset = () => setZoom(1);

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-white/10 bg-[#121214] shadow-2xl group/mermaid">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#1A1A1E] border-b border-white/5 select-none text-xs">
        {/* Left: Diagram title & tab selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-medium text-zinc-300">
            <Workflow className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-zinc-200">Mermaid Diagram</span>
          </div>

          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5 ml-2">
            <button
              onClick={() => setActiveTab('diagram')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === 'diagram'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Diagram</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === 'code'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>Code</span>
            </button>
          </div>
        </div>

        {/* Right: Actions (Zoom, Download, Fullscreen, Copy) */}
        <div className="flex items-center gap-1.5 text-zinc-400">
          {activeTab === 'diagram' && svgContent && !renderError && (
            <>
              {/* Zoom controls */}
              <div className="hidden sm:flex items-center bg-white/5 rounded-md px-1 py-0.5 border border-white/5 gap-1">
                <button
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <button
                  onClick={handleZoomReset}
                  title="Reset Zoom"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-white/10 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>{Math.round(zoom * 100)}%</span>
                </button>
                <button
                  onClick={handleZoomIn}
                  title="Zoom In"
                  className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>

              {/* Download SVG */}
              <button
                onClick={handleDownloadSVG}
                title="Download SVG"
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-xs"
              >
                {downloadSuccess ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">SVG</span>
              </button>

              {/* Fullscreen Expand */}
              <button
                onClick={() => setIsFullscreen(true)}
                title="View Fullscreen"
                className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Copy Code Button */}
          <button
            onClick={handleCopyCode}
            aria-label="Copy Mermaid Code"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
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

      {/* Main Content Area */}
      <div className="bg-[#0D0D11] min-h-[140px] relative">
        {activeTab === 'code' ? (
          <div className="p-0">
            <CodeBlock language="mermaid" value={cleanedCode} />
          </div>
        ) : (
          <div className="relative p-4 sm:p-6 overflow-hidden flex items-center justify-center min-h-[180px]">
            {/* If actively rendering or streaming incomplete syntax */}
            {isRendering && !svgContent && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-zinc-400">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                <span className="text-xs font-medium tracking-wide">
                  {isStreaming ? 'Generating Mermaid diagram...' : 'Rendering diagram...'}
                </span>
              </div>
            )}

            {/* Error display if syntax fails when not streaming */}
            {renderError && !isStreaming && (
              <div className="w-full flex flex-col items-center justify-center gap-2.5 py-6 px-4 text-center">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="max-w-md">
                  <p className="text-xs font-semibold text-zinc-200">
                    Failed to render Mermaid diagram
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 font-mono">
                    {renderError}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('code')}
                  className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium transition-colors"
                >
                  View Mermaid Code
                </button>
              </div>
            )}

            {/* Rendered SVG Container */}
            {svgContent && !renderError && (
              <div
                ref={containerRef}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out'
                }}
                className="w-full flex items-center justify-center overflow-x-auto select-none [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:block [&>svg]:mx-auto filter drop-shadow-md"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isFullscreen && svgContent && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-150"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Modal Header */}
          <div
            className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#141416]/90"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Workflow className="w-5 h-5 text-indigo-400" />
              <span className="font-semibold text-white text-sm">Mermaid Diagram Preview</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Modal Zoom controls */}
              <div className="flex items-center bg-white/10 rounded-lg px-2 py-1 gap-2">
                <button
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  className="p-1 rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomReset}
                  title="Reset Zoom"
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-zinc-200 hover:bg-white/10"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{Math.round(zoom * 100)}%</span>
                </button>
                <button
                  onClick={handleZoomIn}
                  title="Zoom In"
                  className="p-1 rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Download */}
              <button
                onClick={handleDownloadSVG}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                {downloadSuccess ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download SVG</span>
              </button>

              {/* Close */}
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Canvas */}
          <div
            className="flex-1 overflow-auto flex items-center justify-center p-8 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={modalContainerRef}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out'
              }}
              className="max-w-6xl max-h-[85vh] [&>svg]:max-w-full [&>svg]:max-h-[80vh] [&>svg]:h-auto [&>svg]:mx-auto filter drop-shadow-2xl"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
