import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Brain, 
  Download, 
  FileText, 
  SearchCheck, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check, 
  Globe, 
  ShieldCheck, 
  Sparkles 
} from "lucide-react";
import SourceCard from "./SourceCard";

function ResearchPanel({ result }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const sources = result.sources || result.web_sources || [];
  const report = result.report || result.message || result.summary || "";
  const reportTitle = result.topic || result.query || result.title || "Autonomous Research Report";
  const reportName = result.report_file?.name || `research-report-${result.research_session_id || "synthesis"}.md`;

  function downloadReport(e) {
    e?.stopPropagation();
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleCopy(e) {
    e?.stopPropagation();
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="output-card research-output-card" style={{
      background: "rgba(18, 18, 24, 0.7)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "12px",
      overflow: "hidden",
      padding: "0",
      backdropFilter: "blur(12px)",
      margin: "6px 0",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
    }}>
      {/* Top Foldable Control Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          cursor: "pointer",
          userSelect: "none",
          background: "rgba(255, 255, 255, 0.03)",
          borderBottom: isExpanded ? "1px solid rgba(255, 255, 255, 0.06)" : "none",
          flexWrap: "wrap",
          gap: "10px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #0284c7, #38bdf8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            flexShrink: 0
          }}>
            <Globe size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {reportTitle}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
              <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "600" }}>
                ✓ Synthesized Dossier
              </span>
              <span style={{ fontSize: "11px", color: "#71717a" }}>
                {sources.length} sources • {result.status || "completed"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              padding: "5px 10px",
              color: "#d4d4d8",
              fontSize: "11.5px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer"
            }}
          >
            {copied ? <Check size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={downloadReport}
            style={{
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "6px",
              padding: "5px 10px",
              color: "#38bdf8",
              fontSize: "11.5px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer"
            }}
          >
            <Download size={12} />
            <span>Download .md</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: "none",
              border: "none",
              color: "#a1a1aa",
              padding: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Report Content */}
      {isExpanded && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Main Synthesized Report Body */}
          <div className="ws-markdown" style={{ fontSize: "13px", lineHeight: "1.65", color: "#e4e4e7" }}>
            <ReactMarkdown>{report || "No comprehensive report available."}</ReactMarkdown>
          </div>

          {/* Foldable Sources and Web Tools Grid */}
          {sources.length > 0 && (
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "10px",
              overflow: "hidden"
            }}>
              <div 
                onClick={() => setIsSourcesOpen(!isSourcesOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  cursor: "pointer",
                  userSelect: "none",
                  background: isSourcesOpen ? "rgba(255, 255, 255, 0.03)" : "transparent"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Globe size={14} style={{ color: "#38bdf8" }} />
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#f4f4f5", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Cited Sources & Research Tools ({sources.length})
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#38bdf8" }}>
                    {isSourcesOpen ? "Hide Sources" : "View Sources"}
                  </span>
                  {isSourcesOpen ? <ChevronDown size={14} style={{ color: "#38bdf8" }} /> : <ChevronRight size={14} style={{ color: "#71717a" }} />}
                </div>
              </div>

              {isSourcesOpen && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
                    {sources.map((source, index) => (
                      <SourceCard key={`${source.title || source.name}-${index}`} source={source} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Foldable Quality Audit Review */}
          {result.review && (
            <div style={{
              background: "rgba(16, 185, 129, 0.04)",
              border: "1px solid rgba(16, 185, 129, 0.18)",
              borderRadius: "10px",
              overflow: "hidden"
            }}>
              <div 
                onClick={() => setIsAuditOpen(!isAuditOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  cursor: "pointer",
                  userSelect: "none",
                  background: isAuditOpen ? "rgba(16, 185, 129, 0.06)" : "transparent"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={15} style={{ color: "#34d399" }} />
                  <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "#34d399", letterSpacing: "0.4px" }}>
                    Autonomous Fact & Validation Audit
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#34d399" }}>
                    {isAuditOpen ? "Hide Audit" : "View Audit"}
                  </span>
                  {isAuditOpen ? <ChevronDown size={14} style={{ color: "#34d399" }} /> : <ChevronRight size={14} style={{ color: "#34d399" }} />}
                </div>
              </div>

              {isAuditOpen && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(16, 185, 129, 0.12)", fontSize: "12.5px", color: "#a7f3d0", lineHeight: "1.6" }}>
                  <ReactMarkdown>{result.review}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ResearchPanel;