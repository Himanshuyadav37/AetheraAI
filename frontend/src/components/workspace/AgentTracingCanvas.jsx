import { useState, useMemo } from "react";
import { 
  Play, 
  Map, 
  Code, 
  CheckCircle, 
  Bug, 
  Send, 
  Check, 
  AlertTriangle,
  Clock,
  ChevronRight
} from "lucide-react";
import "../../styles/workspace.css";

const NODE_POSITIONS = {
  start: { x: 80, y: 150, label: "Start", icon: Play },
  planner: { x: 220, y: 150, label: "Planner", icon: Map },
  coder: { x: 380, y: 150, label: "Coder", icon: Code },
  tester: { x: 540, y: 150, label: "Tester", icon: CheckCircle },
  debugger: { x: 460, y: 300, label: "Debugger", icon: Bug },
  deployer: { x: 700, y: 150, label: "Deployer", icon: Send },
  complete: { x: 860, y: 150, label: "Complete", icon: Check }
};

export default function AgentTracingCanvas({ steps = [], activeNode = null }) {
  const [selectedAgent, setSelectedAgent] = useState(null);

  // Group steps by agent for detail logs
  const stepsByAgent = useMemo(() => {
    const groups = {};
    steps.forEach(step => {
      const agent = step.agent;
      if (!groups[agent]) groups[agent] = [];
      groups[agent].push(step);
    });
    return groups;
  }, [steps]);

  // Compute status for each agent node
  const nodeStatuses = useMemo(() => {
    const statuses = {
      start: "completed",
      planner: "pending",
      coder: "pending",
      tester: "pending",
      debugger: "pending",
      deployer: "pending",
      complete: "pending"
    };

    if (steps.length > 0) {
      statuses.planner = "completed"; // Once we start, planner has at least run
    }

    steps.forEach(step => {
      const agent = step.agent;
      if (statuses[agent] !== undefined) {
        // failed > in_progress > completed > pending
        if (step.status === "failed") {
          statuses[agent] = "failed";
        } else if (step.status === "in_progress") {
          statuses[agent] = "in_progress";
        } else if (step.status === "completed" && statuses[agent] !== "failed") {
          statuses[agent] = "completed";
        }
      }
    });

    // If deployer is completed, then complete is completed
    if (statuses.deployer === "completed") {
      statuses.complete = "completed";
    }
    // If debugger was executed, its path is active/completed
    
    return statuses;
  }, [steps]);

  // Determine active flow lines
  const flowActive = useMemo(() => {
    const active = {
      "start-planner": nodeStatuses.planner !== "pending",
      "planner-coder": nodeStatuses.coder !== "pending",
      "coder-tester": nodeStatuses.tester !== "pending",
      "tester-debugger": nodeStatuses.debugger !== "pending" && steps.some(s => s.agent === "debugger"),
      "debugger-tester": nodeStatuses.debugger === "completed" && nodeStatuses.tester === "in_progress",
      "tester-deployer": nodeStatuses.deployer !== "pending" && nodeStatuses.debugger !== "in_progress",
      "deployer-complete": nodeStatuses.complete === "completed"
    };
    return active;
  }, [nodeStatuses, steps]);

  const activeLogs = selectedAgent ? stepsByAgent[selectedAgent] || [] : [];

  return (
    <div className="agent-canvas-container">
      {/* Visual Canvas Panel (Temporarily hidden from user view)
      <div className="canvas-viewport">
        <svg className="canvas-svg" viewBox="0 0 950 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="inactiveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
            </linearGradient>
          </defs>

          <line 
            x1="120" y1="150" x2="180" y2="150" 
            stroke={flowActive["start-planner"] ? "url(#activeGrad)" : "url(#inactiveGrad)"} 
            strokeWidth={flowActive["start-planner"] ? "3" : "2"}
            className={flowActive["start-planner"] ? "flow-line-active" : ""}
          />

          <line 
            x1="260" y1="150" x2="340" y2="150" 
            stroke={flowActive["planner-coder"] ? "url(#activeGrad)" : "url(#inactiveGrad)"} 
            strokeWidth={flowActive["planner-coder"] ? "3" : "2"}
            className={flowActive["planner-coder"] ? "flow-line-active" : ""}
          />

          <line 
            x1="420" y1="150" x2="500" y2="150" 
            stroke={flowActive["coder-tester"] ? "url(#activeGrad)" : "url(#inactiveGrad)"} 
            strokeWidth={flowActive["coder-tester"] ? "3" : "2"}
            className={flowActive["coder-tester"] ? "flow-line-active" : ""}
          />

          <path 
            d="M 540,170 C 540,240 500,300 460,300" 
            stroke={flowActive["tester-debugger"] ? "url(#activeGrad)" : "url(#inactiveGrad)"} 
            strokeWidth={flowActive["tester-debugger"] ? "3" : "2"}
            fill="none"
            className={flowActive["tester-debugger"] ? "flow-line-active" : ""}
          />

          <path 
            d="M 460,300 C 420,300 380,240 380,170" 
            stroke={flowActive["debugger-tester"] ? "url(#activeGrad)" : "url(#inactiveGrad)"} 
            strokeWidth={flowActive["debugger-tester"] ? "3" : "2"}
            fill="none"
            className={flowActive["debugger-tester"] ? "flow-line-active" : ""}
          />

          <line 
            x1="580" y1="150" x2="660" y2="150" 
            stroke={flowActive["tester-deployer"] ? "url(#activeGrad)" : "url(#inactiveGrad)"} 
            strokeWidth={flowActive["tester-deployer"] ? "3" : "2"}
            className={flowActive["tester-deployer"] ? "flow-line-active" : ""}
          />

          <line 
            x1="740" y1="150" x2="820" y2="150" 
            stroke={flowActive["deployer-complete"] ? "url(#activeGrad)" : "url(#inactiveGrad)"} 
            strokeWidth={flowActive["deployer-complete"] ? "3" : "2"}
            className={flowActive["deployer-complete"] ? "flow-line-active" : ""}
          />
        </svg>

        {Object.entries(NODE_POSITIONS).map(([nodeId, pos]) => {
          const status = nodeStatuses[nodeId] || "pending";
          const Icon = pos.icon;
          const isSelected = selectedAgent === nodeId;
          const hasLogs = stepsByAgent[nodeId]?.length > 0;

          return (
            <div 
              key={nodeId}
              className={`canvas-node ${nodeId} ${status} ${isSelected ? "selected" : ""} ${hasLogs ? "interactive" : ""}`}
              style={{ left: `${(pos.x / 950) * 100}%`, top: `${(pos.y / 400) * 100}%` }}
              onClick={() => hasLogs && setSelectedAgent(nodeId)}
            >
              <div className="node-icon-wrapper">
                <Icon size={20} />
              </div>
              <span className="node-label">{pos.label}</span>
              {status === "in_progress" && <div className="node-pulse"></div>}
            </div>
          );
        })}
      </div>
      */}

      {/* Side Logs Panel */}
      <div className="canvas-logs-panel" style={{ borderLeft: "none" }}>
        <h3 className="panel-title">
          {selectedAgent ? `${NODE_POSITIONS[selectedAgent]?.label} Logs` : "Execution Timeline"}
        </h3>
        
        <div className="logs-container">
          {selectedAgent ? (
            activeLogs.map((log, index) => (
              <div key={index} className={`log-item ${log.status}`}>
                <div className="log-header">
                  <span className={`status-badge ${log.status}`}>{log.status}</span>
                  <span className="log-time">
                    <Clock size={12} style={{ marginRight: 4 }} />
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="log-message">{log.message}</p>
                {log.details && (
                  <pre className="log-details">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          ) : (
            <div className="timeline-overview">
              {steps.length === 0 ? (
                <div className="empty-logs">
                  <Play size={24} className="spinning" />
                  <p>Booting engineering environment...</p>
                </div>
              ) : (
                steps.map((log, index) => (
                  <div key={index} className="overview-row" onClick={() => setSelectedAgent(log.agent)}>
                    <ChevronRight size={14} className="row-arrow" />
                    <span className={`badge ${log.agent}`}>{log.agent}</span>
                    <span className="row-message">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        {selectedAgent && (
          <button className="back-btn" onClick={() => setSelectedAgent(null)}>
            View Entire Timeline
          </button>
        )}
      </div>
    </div>
  );
}
