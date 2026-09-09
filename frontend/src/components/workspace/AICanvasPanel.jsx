import React, { useState, useEffect, useRef } from "react";
import { 
  Eye, Code2, Edit3, Download, Copy, Maximize2, Minimize2, 
  X, Monitor, Tablet, Smartphone, Check, Sparkles, FileCode
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import "../../styles/AICanvasPanel.css";

function AICanvasPanel({ artifact, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("preview"); // preview, code, edit
  const [viewportMode, setViewportMode] = useState("desktop"); // desktop (100%), tablet (768px), mobile (375px)
  const [editableCode, setEditableCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (artifact?.content) {
      setEditableCode(artifact.content);
    }
  }, [artifact]);

  if (!isOpen || !artifact) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(editableCode || artifact.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = editableCode || artifact.content || "";
    const isHtml = artifact.type === "html" || artifact.language === "html";
    const filename = `${artifact.title?.toLowerCase().replace(/[^a-z0-9]/g, "-") || "artifact"}.${isHtml ? "html" : "txt"}`;
    
    const blob = new Blob([content], { type: isHtml ? "text/html" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Build sandboxed HTML payload with Tailwind CSS & Google Fonts included
  const generatePreviewHtml = (code) => {
    if (artifact.type === "markdown") {
      return null;
    }

    // Check if code is a full HTML doc or HTML snippet
    const hasHtmlTag = /<html/i.test(code);
    if (hasHtmlTag) {
      return code;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${artifact.title || "NexusAI Canvas"}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #ffffff; color: #09090b; }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
  };

  const previewHtml = generatePreviewHtml(editableCode || artifact.content || "");

  const getViewportWidth = () => {
    if (viewportMode === "mobile") return "375px";
    if (viewportMode === "tablet") return "768px";
    return "100%";
  };

  return (
    <div className={`ai-canvas-wrapper ${isFullscreen ? "canvas-fullscreen-overlay" : ""}`}>
      {/* 1. Canvas Top Header */}
      <div className="canvas-header">
        <div className="canvas-title-area">
          <div className="canvas-title-icon">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="canvas-title-text" title={artifact.title}>
              {artifact.title || "Interactive Artifact"}
            </div>
          </div>
          <span className="canvas-type-badge">
            {artifact.language || artifact.type || "HTML"}
          </span>
        </div>

        {/* 2. Center Tabs (Preview / Code / Edit) */}
        <div className="canvas-tabs-nav">
          <button 
            type="button" 
            className={`canvas-tab-btn ${activeTab === "preview" ? "active" : ""}`}
            onClick={() => setActiveTab("preview")}
          >
            <Eye size={13} />
            Preview
          </button>
          <button 
            type="button" 
            className={`canvas-tab-btn ${activeTab === "code" ? "active" : ""}`}
            onClick={() => setActiveTab("code")}
          >
            <Code2 size={13} />
            Code
          </button>
          <button 
            type="button" 
            className={`canvas-tab-btn ${activeTab === "edit" ? "active" : ""}`}
            onClick={() => setActiveTab("edit")}
          >
            <Edit3 size={13} />
            Edit
          </button>
        </div>

        {/* 3. Right Action Tools */}
        <div className="canvas-actions">
          <button 
            type="button" 
            className="canvas-action-btn" 
            onClick={handleCopyCode}
            title={copied ? "Copied!" : "Copy Code"}
          >
            {copied ? <Check size={14} style={{ color: "#34d399" }} /> : <Copy size={14} />}
          </button>
          <button 
            type="button" 
            className="canvas-action-btn" 
            onClick={handleDownload}
            title="Download Artifact"
          >
            <Download size={14} />
          </button>
          <button 
            type="button" 
            className="canvas-action-btn" 
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button 
            type="button" 
            className="canvas-action-btn" 
            onClick={onClose}
            title="Close Canvas"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 4. Sub-bar with Device Viewport Selector (When in Preview Mode) */}
      {activeTab === "preview" && artifact.type !== "markdown" && (
        <div className="canvas-viewport-bar">
          <span>Sandboxed Live Runtime</span>
          <div className="canvas-device-toggles">
            <button 
              type="button" 
              className={`canvas-device-btn ${viewportMode === "desktop" ? "active" : ""}`}
              onClick={() => setViewportMode("desktop")}
            >
              <Monitor size={12} /> Desktop
            </button>
            <button 
              type="button" 
              className={`canvas-device-btn ${viewportMode === "tablet" ? "active" : ""}`}
              onClick={() => setViewportMode("tablet")}
            >
              <Tablet size={12} /> Tablet
            </button>
            <button 
              type="button" 
              className={`canvas-device-btn ${viewportMode === "mobile" ? "active" : ""}`}
              onClick={() => setViewportMode("mobile")}
            >
              <Smartphone size={12} /> Mobile
            </button>
          </div>
        </div>
      )}

      {/* 5. Main Canvas Body Viewport */}
      <div className="canvas-body">
        {activeTab === "preview" && (
          artifact.type === "markdown" ? (
            <div style={{ width: "100%", height: "100%", background: "#18181b", padding: "24px", borderRadius: "8px", overflow: "auto", color: "#f4f4f5" }}>
              <ReactMarkdown>{editableCode || artifact.content}</ReactMarkdown>
            </div>
          ) : (
            <div 
              className="canvas-iframe-container" 
              style={{ width: getViewportWidth() }}
            >
              <iframe
                ref={iframeRef}
                title="NexusAI Live Sandbox"
                srcDoc={previewHtml}
                className="canvas-iframe"
                sandbox="allow-scripts allow-same-origin allow-modals"
              />
            </div>
          )
        )}

        {activeTab === "code" && (
          <div className="canvas-editor-container">
            <pre className="canvas-code-display">
              <code>{editableCode || artifact.content}</code>
            </pre>
          </div>
        )}

        {activeTab === "edit" && (
          <div className="canvas-editor-container">
            <textarea
              className="canvas-code-textarea"
              value={editableCode}
              onChange={(e) => setEditableCode(e.target.value)}
              placeholder="Type or paste HTML/React code to preview live..."
              spellCheck="false"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default AICanvasPanel;
