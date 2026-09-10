import { useState, useMemo } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  Cpu, 
  Code2, 
  FileCode,
  Search,
  Sliders,
  Terminal,
  Globe,
  Sparkles,
  Layers,
  AlertCircle
} from "lucide-react";
import "./AgentLiveTimeline.css";

export default function AgentLiveTimeline({ steps = [], loading = false }) {
  // If loading, default to open or active view; if completed, keep collapsed by default
  const [isOpen, setIsOpen] = useState(() => loading);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const toggleExpand = (idx, e) => {
    e?.stopPropagation();
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const hasFailedStep = useMemo(() => {
    if (steps.length === 0) return false;
    const last = steps[steps.length - 1];
    return last?.status === "failed" || last?.status === "error";
  }, [steps]);

  // Latest active step
  const latestStep = useMemo(() => {
    if (steps.length === 0) return null;
    return steps[steps.length - 1];
  }, [steps]);

  const getStepIcon = (agent, stepName) => {
    const s = stepName ? String(stepName).toLowerCase() : "";
    const a = agent ? String(agent).toLowerCase() : "";
    
    if (s.includes("search") || s.includes("google") || s.includes("scan") || s.includes("web") || s.includes("retriev")) {
      return <Globe size={14} className="step-ico-globe" />;
    }
    if (s.includes("code") || s.includes("write") || s.includes("compile") || a === "coder") {
      return <Code2 size={14} className="step-ico-code" />;
    }
    if (s.includes("file") || s.includes("diff") || s.includes("save") || s.includes("structur")) {
      return <FileCode size={14} className="step-ico-file" />;
    }
    if (s.includes("terminal") || s.includes("command") || s.includes("exec")) {
      return <Terminal size={14} className="step-ico-term" />;
    }
    if (s.includes("plan") || s.includes("route") || s.includes("blueprint") || a === "planner") {
      return <Cpu size={14} className="step-ico-cpu" />;
    }
    if (s.includes("test") || s.includes("qa") || a === "tester") {
      return <Sparkles size={14} className="step-ico-test" />;
    }
    return <Sliders size={14} className="step-ico-default" />;
  };

  const renderStepDetails = (step) => {
    const details = step.details || {};
    const hasDetails = Object.keys(details).length > 0;
    
    if (!hasDetails) return null;

    const file = details.file || details.path || details.project_name;
    const additions = details.additions || details.added_lines;
    const deletions = details.deletions || details.removed_lines;
    const argumentsObj = details.arguments;

    return (
      <div className="gpt-step-details">
        {file && (
          <div className="gpt-detail-file">
            <span className="gpt-file-badge">📄 {file}</span>
            {additions !== undefined && <span className="stat-add">+{additions}</span>}
            {deletions !== undefined && <span className="stat-del">-{deletions}</span>}
          </div>
        )}
        
        {argumentsObj && (
          <div className="gpt-detail-args">
            <span className="args-label">Parameters:</span>
            <pre className="args-json">{JSON.stringify(argumentsObj, null, 2)}</pre>
          </div>
        )}

        {!file && !argumentsObj && (
          <pre className="gpt-details-raw">{JSON.stringify(details, null, 2)}</pre>
        )}
      </div>
    );
  };

  if (!loading && (!steps || steps.length === 0)) {
    return null;
  }

  return (
    <div className={`gpt-timeline-container ${loading ? "is-loading" : "is-completed"} ${hasFailedStep ? "has-failed" : ""}`}>
      {/* Header / Bar */}
      <div 
        className="gpt-timeline-header"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
      >
        <div className="gpt-header-left">
          {loading ? (
            <div className="gpt-live-indicator">
              <span className="gpt-spinner-ring" />
              {latestStep ? getStepIcon(latestStep.agent, latestStep.step || latestStep.message) : <Sparkles size={14} />}
            </div>
          ) : hasFailedStep ? (
            <AlertCircle size={15} className="gpt-icon-error" />
          ) : (
            <CheckCircle2 size={15} className="gpt-icon-success" />
          )}

          <div className="gpt-header-title-box">
            {loading ? (
              <span className="gpt-live-text">
                {latestStep?.message || "Orchestrating agent workflows..."}
              </span>
            ) : (
              <span className="gpt-complete-title">
                {hasFailedStep ? "Execution encountered an issue" : "Thought & Execution Trace"}
              </span>
            )}
          </div>
        </div>

        <div className="gpt-header-right">
          <span className="gpt-steps-pill">
            {steps.length} {steps.length === 1 ? "step" : "steps"}
          </span>
          <button 
            type="button" 
            className="gpt-expand-chevron"
            aria-label={isOpen ? "Collapse trace" : "Expand trace"}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {/* Expandable Step Trace Body */}
      {isOpen && (
        <div className="gpt-timeline-body">
          <div className="gpt-steps-stream">
            {steps.map((step, idx) => {
              const isExpanded = expandedIndex === idx;
              const status = step.status || "completed";
              const isLast = idx === steps.length - 1;
              const icon = getStepIcon(step.agent, step.step || step.message);

              return (
                <div key={idx} className={`gpt-step-item status-${status}`}>
                  {/* Left Rail Line & Dot */}
                  <div className="gpt-step-rail">
                    <div className={`gpt-step-dot ${status}`}>
                      {status === "completed" && <div className="dot-inner dot-success" />}
                      {status === "failed" && <div className="dot-inner dot-failed" />}
                      {status === "in_progress" && <span className="dot-inner dot-pulse" />}
                      {status === "pending" && <div className="dot-inner dot-pending" />}
                    </div>
                    {!isLast && <div className="gpt-rail-line" />}
                  </div>

                  {/* Step Content */}
                  <div className="gpt-step-content">
                    <div 
                      className="gpt-step-row"
                      onClick={(e) => step.details && toggleExpand(idx, e)}
                      style={{ cursor: step.details ? "pointer" : "default" }}
                    >
                      <div className="gpt-step-icon-wrapper">
                        {icon}
                      </div>

                      <div className="gpt-step-text-wrap">
                        <div className="gpt-step-top">
                          {step.agent && (
                            <span className={`gpt-agent-badge agent-${step.agent.toLowerCase()}`}>
                              {step.agent}
                            </span>
                          )}
                          {step.timestamp && (
                            <span className="gpt-timestamp">
                              {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="gpt-step-message">{step.message}</p>
                      </div>

                      {step.details && (
                        <div className="gpt-step-action-arrow">
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </div>
                      )}
                    </div>

                    {/* Expandable Diff / Details */}
                    {isExpanded && renderStepDetails(step)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
