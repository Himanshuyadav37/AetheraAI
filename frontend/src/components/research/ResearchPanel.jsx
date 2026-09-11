import { useState } from "react";
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
  Sparkles,
  Printer
} from "lucide-react";
import SourceCard from "./SourceCard";
import MarkdownRenderer from "../education/MarkdownRenderer";

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

  function downloadReportAsPdf(e) {
    e?.stopPropagation();
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export the research report as a PDF.");
      return;
    }

    const reportHtml = document.querySelector(".research-output-card .ws-markdown")?.innerHTML || report;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle} - NexusAI Research Dossier</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #0f172a;
              background: #ffffff;
              padding: 40px;
              margin: 0 auto;
              max-width: 860px;
              line-height: 1.65;
            }
            .pdf-header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .pdf-badge {
              display: inline-block;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #0284c7;
              background: #f0f9ff;
              border: 1px solid #bae6fd;
              padding: 2px 8px;
              border-radius: 4px;
              margin-bottom: 8px;
            }
            .pdf-title {
              font-size: 24px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 6px 0;
            }
            .pdf-meta {
              font-size: 12px;
              color: #64748b;
            }
            h1 { font-size: 20px; color: #0f172a; margin-top: 24px; }
            h2 { font-size: 16px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px; }
            h3 { font-size: 14px; color: #334155; margin-top: 18px; }
            p, li { font-size: 13px; color: #334155; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12.5px; }
            th { background: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; padding: 8px 10px; font-weight: 600; text-align: left; }
            td { border: 1px solid #e2e8f0; padding: 8px 10px; color: #334155; vertical-align: top; }
            tr:nth-child(even) td { background: #f8fafc; }
            code { background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-size: 11.5px; font-family: monospace; }
            pre { background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; font-size: 11px; overflow-x: auto; }
            blockquote { border-left: 3px solid #0284c7; padding-left: 12px; color: #475569; margin: 12px 0; font-style: italic; }
            .pdf-footer {
              margin-top: 40px;
              padding-top: 12px;
              border-top: 1px solid #e2e8f0;
              font-size: 11px;
              color: #94a3b8;
              display: flex;
              justify-content: space-between;
            }
            @media print {
              body { padding: 0; }
              @page { margin: 1.5cm; size: A4; }
            }
          </style>
        </head>
        <body>
          <div class="pdf-header">
            <span class="pdf-badge">NexusAI Autonomous Research Dossier</span>
            <h1 class="pdf-title">${reportTitle}</h1>
            <div class="pdf-meta">
              <span>Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span> • 
              <span>Sources Synthesized: ${sources.length}</span> • 
              <span>Intelligence Status: Verified</span>
            </div>
          </div>
          <div class="pdf-body">
            ${reportHtml}
          </div>
          <div class="pdf-footer">
            <span>Generated by NexusAI Autonomous Intelligence Engine</span>
            <span>NexusAI Research AI</span>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

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
      borderRadius: "10px",
      overflow: "hidden",
      padding: "0",
      backdropFilter: "blur(12px)",
      margin: "4px 0",
      maxWidth: "680px",
      width: "100%",
      boxSizing: "border-box",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)"
    }}>
      {/* Top Foldable Control Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          cursor: "pointer",
          userSelect: "none",
          background: "rgba(255, 255, 255, 0.03)",
          borderBottom: isExpanded ? "1px solid rgba(255, 255, 255, 0.06)" : "none",
          flexWrap: "wrap",
          gap: "8px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
          <div style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            background: "linear-gradient(135deg, #0284c7, #38bdf8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            flexShrink: 0
          }}>
            <Globe size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {reportTitle}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
              <span style={{ fontSize: "10.5px", color: "#38bdf8", fontWeight: "600" }}>
                ✓ Synthesized Dossier
              </span>
              <span style={{ fontSize: "10.5px", color: "#71717a" }}>
                {sources.length} sources • {result.status || "completed"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "5px",
              padding: "4px 8px",
              color: "#d4d4d8",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              cursor: "pointer"
            }}
            title="Copy Report"
          >
            {copied ? <Check size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={downloadReportAsPdf}
            style={{
              background: "rgba(56, 189, 248, 0.15)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "5px",
              padding: "4px 10px",
              color: "#38bdf8",
              fontSize: "11px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(56, 189, 248, 0.15)"
            }}
            title="Export Report as PDF Document"
          >
            <Printer size={12} />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: "none",
              border: "none",
              color: "#a1a1aa",
              padding: "3px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
          >
            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded Report Content */}
      {isExpanded && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Main Synthesized Report Body */}
          <div className="ws-markdown" style={{ fontSize: "13px", lineHeight: "1.65", color: "#e4e4e7" }}>
            <MarkdownRenderer>{report || "No comprehensive report available."}</MarkdownRenderer>
          </div>

          {/* Foldable Sources and Web Tools Grid */}
          {sources.length > 0 && (
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "8px",
              overflow: "hidden"
            }}>
              <div 
                onClick={() => setIsSourcesOpen(!isSourcesOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  cursor: "pointer",
                  userSelect: "none",
                  background: isSourcesOpen ? "rgba(255, 255, 255, 0.03)" : "transparent"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Globe size={13} style={{ color: "#38bdf8" }} />
                  <span style={{ fontSize: "11.5px", fontWeight: "600", color: "#f4f4f5", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Cited Sources & Research Tools ({sources.length})
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", color: "#38bdf8" }}>
                    {isSourcesOpen ? "Hide Sources" : "View Sources"}
                  </span>
                  {isSourcesOpen ? <ChevronDown size={13} style={{ color: "#38bdf8" }} /> : <ChevronRight size={13} style={{ color: "#71717a" }} />}
                </div>
              </div>

              {isSourcesOpen && (
                <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
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
              borderRadius: "8px",
              overflow: "hidden"
            }}>
              <div 
                onClick={() => setIsAuditOpen(!isAuditOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  cursor: "pointer",
                  userSelect: "none",
                  background: isAuditOpen ? "rgba(16, 185, 129, 0.06)" : "transparent"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={14} style={{ color: "#34d399" }} />
                  <span style={{ fontSize: "11.5px", fontWeight: "700", textTransform: "uppercase", color: "#34d399", letterSpacing: "0.4px" }}>
                    Autonomous Fact & Validation Audit
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", color: "#34d399" }}>
                    {isAuditOpen ? "Hide Audit" : "View Audit"}
                  </span>
                  {isAuditOpen ? <ChevronDown size={13} style={{ color: "#34d399" }} /> : <ChevronRight size={13} style={{ color: "#34d399" }} />}
                </div>
              </div>

              {isAuditOpen && (
                <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(16, 185, 129, 0.12)", fontSize: "12px", color: "#a7f3d0", lineHeight: "1.6" }}>
                  <MarkdownRenderer>{result.review}</MarkdownRenderer>
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