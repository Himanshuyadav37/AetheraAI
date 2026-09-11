import { useState, useMemo } from "react";
import { 
  Check, 
  X, 
  ChevronDown, 
  ChevronRight, 
  ArrowRight,
  Cpu, 
  Code2, 
  FileCode,
  Sliders,
  Terminal,
  Globe,
  Sparkles,
  AlertCircle
} from "lucide-react";
import "./AgentLiveTimeline.css";

function extractStepInfo(step, idx) {
  if (!step) {
    return {
      message: `Step ${idx + 1}`,
      agent: `STEP ${idx + 1}`,
      status: "completed",
      timestamp: null,
      details: null
    };
  }

  if (typeof step === "string") {
    return {
      message: step,
      agent: `STEP ${idx + 1}`,
      status: "completed",
      timestamp: null,
      details: null
    };
  }

  // It's an object
  const status = step.status || "completed";
  const timestamp = step.timestamp || null;
  const details = step.details || null;

  // Extract message
  let message = "";
  if (step.message) {
    message = step.message;
  } else if (step.description) {
    message = step.description;
  } else if (step.title) {
    message = step.title;
  } else if (step.name && step.purpose) {
    message = `${step.name}: ${step.purpose}`;
  } else if (step.name) {
    message = step.name;
  } else if (step.step_name) {
    message = step.step_name;
  } else if (step.text) {
    message = step.text;
  } else if (step.action) {
    message = step.action;
  } else {
    // Fallback if object has unknown fields
    const values = Object.values(step).filter(v => typeof v === "string" && v.length > 0);
    message = values.length > 0 ? values.join(" - ") : `Execution Step ${idx + 1}`;
  }

  // Extract agent / badge
  let agent = "";
  if (step.agent) {
    agent = step.agent;
  } else if (step.title && step.description) {
    agent = step.title.length <= 25 ? step.title : (step.step ? `STEP ${step.step}` : `STEP ${idx + 1}`);
  } else if (step.platform) {
    agent = step.platform;
  } else if (step.node_id) {
    agent = step.node_id;
  } else if (step.step !== undefined) {
    agent = `STEP ${step.step}`;
  } else {
    agent = `STEP ${idx + 1}`;
  }

  return {
    message,
    agent,
    status,
    timestamp,
    details
  };
}

export default function AgentLiveTimeline({ steps = [], loading = false }) {
  // If loading, default to open or active view; if completed, keep collapsed by default
  const [isOpen, setIsOpen] = useState(() => loading);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const toggleExpand = (idx, e) => {
    e?.stopPropagation();
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const hasFailedStep = useMemo(() => {
    if (!steps || steps.length === 0) return false;
    const last = steps[steps.length - 1];
    if (typeof last === "object" && last !== null) {
      return last?.status === "failed" || last?.status === "error";
    }
    return false;
  }, [steps]);

  // Normalized steps
  const normalizedSteps = useMemo(() => {
    if (!steps || !Array.isArray(steps)) return [];
    return steps.map((s, idx) => extractStepInfo(s, idx));
  }, [steps]);

  // Latest active step info
  const latestStepInfo = useMemo(() => {
    if (normalizedSteps.length === 0) return null;
    return normalizedSteps[normalizedSteps.length - 1];
  }, [normalizedSteps]);

  const getStepIcon = (agent, message) => {
    const s = `${agent || ""} ${message || ""}`.toLowerCase();
    
    if (s.includes("search") || s.includes("google") || s.includes("scan") || s.includes("web") || s.includes("retriev")) {
      return <Globe size={13} className="step-ico-globe" />;
    }
    if (s.includes("code") || s.includes("write") || s.includes("compile") || s.includes("coder")) {
      return <Code2 size={13} className="step-ico-code" />;
    }
    if (s.includes("file") || s.includes("diff") || s.includes("save") || s.includes("structur")) {
      return <FileCode size={13} className="step-ico-file" />;
    }
    if (s.includes("terminal") || s.includes("command") || s.includes("exec") || s.includes("run")) {
      return <Terminal size={13} className="step-ico-term" />;
    }
    if (s.includes("plan") || s.includes("route") || s.includes("blueprint") || s.includes("planner")) {
      return <Cpu size={13} className="step-ico-cpu" />;
    }
    if (s.includes("test") || s.includes("qa") || s.includes("tester")) {
      return <Sparkles size={13} className="step-ico-test" />;
    }
    return <Sliders size={13} className="step-ico-default" />;
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
              <span className="gpt-flow-arrow-live">
                <ArrowRight size={11} />
              </span>
            </div>
          ) : hasFailedStep ? (
            <AlertCircle size={14} className="gpt-icon-error" />
          ) : (
            <div className="gpt-complete-icon-box">
              <Check size={12} className="gpt-icon-success" />
            </div>
          )}

          <div className="gpt-header-title-box">
            {loading ? (
              <span className="gpt-live-text">
                {latestStepInfo?.message || "Orchestrating agent workflows..."}
              </span>
            ) : (
              <span className="gpt-complete-title">
                {hasFailedStep ? "Execution encountered an issue" : "Execution Pipeline Trace"}
              </span>
            )}
          </div>
        </div>

        <div className="gpt-header-right">
          <span className="gpt-steps-pill">
            {normalizedSteps.length} {normalizedSteps.length === 1 ? "step" : "steps"}
          </span>
          <button 
            type="button" 
            className="gpt-expand-chevron"
            aria-label={isOpen ? "Collapse trace" : "Expand trace"}
          >
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {/* Expandable Step Trace Body */}
      {isOpen && (
        <div className="gpt-timeline-body">
          <div className="gpt-steps-stream">
            {normalizedSteps.map((step, idx) => {
              const isExpanded = expandedIndex === idx;
              const status = step.status || "completed";
              const isLast = idx === normalizedSteps.length - 1;
              const icon = getStepIcon(step.agent, step.message);

              return (
                <div key={idx} className={`gpt-step-item status-${status}`}>
                  {/* Left Rail Line & Moving Workflow Arrow */}
                  <div className="gpt-step-rail">
                    <div className={`gpt-step-arrow-node ${status}`}>
                      {status === "completed" && (
                        <span className="step-arrow-completed">
                          <Check size={10} />
                        </span>
                      )}
                      {status === "failed" && (
                        <span className="step-arrow-failed">
                          <X size={10} />
                        </span>
                      )}
                      {status === "in_progress" && (
                        <span className="step-arrow-active">
                          <ArrowRight size={10} />
                        </span>
                      )}
                      {status === "pending" && (
                        <span className="step-arrow-pending">
                          <ArrowRight size={9} />
                        </span>
                      )}
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
                            <span className={`gpt-agent-badge agent-${String(step.agent).toLowerCase().replace(/[^a-z0-9]/g, "")}`}>
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
