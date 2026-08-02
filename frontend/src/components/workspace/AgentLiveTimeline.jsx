import { useState } from "react";
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  Cpu, 
  Code, 
  FileText,
  Search,
  Sliders,
  Terminal
} from "lucide-react";
import "./AgentLiveTimeline.css";

export default function AgentLiveTimeline({ steps = [], loading = false }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const toggleExpand = (idx) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const getStepIcon = (agent, stepName) => {
    const s = stepName ? String(stepName).toLowerCase() : "";
    const a = agent ? String(agent).toLowerCase() : "";
    
    if (s.includes("search") || s.includes("google") || s.includes("scan")) return <Search size={14} />;
    if (s.includes("code") || s.includes("write") || s.includes("compile") || a === "coder") return <Code size={14} />;
    if (s.includes("file") || s.includes("diff") || s.includes("save")) return <FileText size={14} />;
    if (s.includes("terminal") || s.includes("command")) return <Terminal size={14} />;
    if (s.includes("planner") || s.includes("route")) return <Cpu size={14} />;
    return <Sliders size={14} />;
  };

  const renderStepDetails = (step) => {
    const details = step.details || {};
    const hasDetails = Object.keys(details).length > 0;
    
    if (!hasDetails) return null;

    // Check for git diff / file change details
    const file = details.file || details.path;
    const additions = details.additions || details.added_lines;
    const deletions = details.deletions || details.removed_lines;
    const argumentsObj = details.arguments;

    return (
      <div className="step-timeline-details">
        {file && (
          <div className="detail-file-stat">
            <span className="file-icon">📄</span>
            <span className="file-name">{file}</span>
            {additions !== undefined && (
              <span className="stat-add">+{additions}</span>
            )}
            {deletions !== undefined && (
              <span className="stat-del">-{deletions}</span>
            )}
          </div>
        )}
        
        {argumentsObj && (
          <div className="detail-arguments">
            <span className="args-label">Arguments:</span>
            <pre className="args-json">{JSON.stringify(argumentsObj, null, 2)}</pre>
          </div>
        )}

        {!file && !argumentsObj && (
          <pre className="details-raw">{JSON.stringify(details, null, 2)}</pre>
        )}
      </div>
    );
  };

  return (
    <div className="agent-timeline-widget">
      <div className="timeline-widget-header">
        <span className="pulsing-radar-dot" style={{ display: loading ? "inline-block" : "none" }} />
        <h3>{loading ? "Agent Execution Feed" : "Execution Timeline"}</h3>
        <span className="timeline-badge">{steps.length} {steps.length === 1 ? "step" : "steps"}</span>
      </div>

      <div className="timeline-steps-list">
        {steps.map((step, idx) => {
          const isExpanded = expandedIndex === idx;
          const status = step.status || "completed";
          const icon = getStepIcon(step.agent, step.step);
          
          return (
            <div key={idx} className={`timeline-step-row ${status}`}>
              <div className="timeline-node-line">
                <div className={`status-node-dot ${status}`}>
                  {status === "completed" && <CheckCircle size={14} className="node-icon-completed" />}
                  {status === "failed" && <XCircle size={14} className="node-icon-failed" />}
                  {status === "in_progress" && <span className="node-pulse-spinner" />}
                  {status === "pending" && <Clock size={12} className="node-icon-pending" />}
                </div>
                {idx !== steps.length - 1 && <div className="timeline-vertical-segment" />}
              </div>

              <div className="timeline-content-card">
                <div className="timeline-card-header" onClick={() => step.details && toggleExpand(idx)}>
                  <div className="header-meta">
                    <span className="agent-tag">{step.agent || "System"}</span>
                    <span className="step-timestamp">
                      {step.timestamp ? new Date(step.timestamp).toLocaleTimeString() : ""}
                    </span>
                  </div>

                  <div className="header-message-row">
                    <div className="step-type-icon">{icon}</div>
                    <p className="step-main-msg">{step.message}</p>
                    
                    {step.details && (
                      <button className="expand-details-btn" type="button">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && renderStepDetails(step)}
              </div>
            </div>
          );
        })}

        {loading && steps.length === 0 && (
          <div className="timeline-empty-loading">
            <span className="loading-orbit-spinner" />
            <p>Initializing agent environment...</p>
          </div>
        )}
      </div>
    </div>
  );
}
