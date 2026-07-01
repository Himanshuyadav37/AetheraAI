import ReactMarkdown from "react-markdown";
import { Brain, Download, FileText, SearchCheck } from "lucide-react";
import ResearchTimeline from "./ResearchTimeline";
import SourceCard from "./SourceCard";

function ReportViewer({ report, review }) {
  return (
    <div className="research-report-shell">
      <section className="research-report-main">
        <ReactMarkdown>{report || "No report generated yet."}</ReactMarkdown>
      </section>

      {review && (
        <aside className="research-review-panel">
          <h3>Quality Review</h3>
          <ReactMarkdown>{review}</ReactMarkdown>
        </aside>
      )}
    </div>
  );
}

function ResearchPanel({ result }) {
  if (!result) return null;

  const sources = result.sources || [];
  const report = result.report || result.message || "";
  const reportName = result.report_file?.name || `research-report-${result.research_session_id || "draft"}.md`;

  function downloadReport() {
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

  return (
    <div className="output-card research-output-card">
      <div className="research-title-row">
        <div>
          <h2>Research Report</h2>
          <p>{result.research_session_id ? `Session ${result.research_session_id}` : "Research AI"}</p>
        </div>

        <div className="research-actions">
          <button className="download-btn" type="button" onClick={downloadReport}>
            <Download size={16} />
            Download .md
          </button>
          <span className="workspace-status">
            <SearchCheck size={17} />
            {result.status || "completed"}
          </span>
        </div>
      </div>

      <div className="result-grid research-stats-grid">
        <div className="result-box">
          <span>Agent</span>
          <h3>{result.agent || "research"}</h3>
        </div>
        <div className="result-box">
          <span>Workflow Steps</span>
          <h3>{result.timeline?.length || 0}</h3>
        </div>
        <div className="result-box">
          <span>Research Tools</span>
          <h3>{sources.length}</h3>
        </div>
      </div>

      <div className="section report-section">
        <h3><FileText size={18} /> Final Report</h3>
        <ReportViewer report={report} review={result.review} />
      </div>

      {sources.length > 0 && (
        <div className="section">
          <h3>Research Tools</h3>
          <div className="source-grid">
            {sources.map((source, index) => (
              <SourceCard key={`${source.title}-${index}`} source={source} />
            ))}
          </div>
        </div>
      )}

      <div className="section research-secondary-grid">
        <div>
          <h3><Brain size={18} /> Research Plan</h3>
          <div className="debug-box research-plan-box">{result.plan}</div>
        </div>
        <div>
          <h3>Execution Timeline</h3>
          <ResearchTimeline steps={result.timeline || []} />
        </div>
      </div>
    </div>
  );
}

export default ResearchPanel;