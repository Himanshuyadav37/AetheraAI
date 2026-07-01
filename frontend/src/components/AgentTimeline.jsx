import {
  MessageSquare,
  Cpu,
  Search,
  Sliders,
  ShieldCheck,
  Rocket
} from "lucide-react";

import "./AgentTimeline.css";

function AgentTimeline() {
  const steps = [
    {
      title: "User Request",
      icon: <MessageSquare size={24} />,
      status: "active",
      desc: "Prompt submitted to AI OS"
    },
    {
      title: "AI Routing",
      icon: <Cpu size={24} />,
      status: "active",
      desc: "Maps prompt to module"
    },
    {
      title: "Context RAG",
      icon: <Search size={24} />,
      status: "active",
      desc: "Retrieve memory & context"
    },
    {
      title: "Agent Execution",
      icon: <Sliders size={24} />,
      status: "active",
      desc: "Multi-agent execution"
    },
    {
      title: "Quality Check",
      icon: <ShieldCheck size={24} />,
      status: "active",
      desc: "Validator reviews output"
    },
    {
      title: "Compiled Result",
      icon: <Rocket size={24} />,
      status: "active",
      desc: "Output rendered in workspace"
    }
  ];

  return (
    <div className="workflow-card">
      <div className="workflow-top">
        <h2>System Workflow</h2>
        <span className="workflow-subtitle">Request Pipeline</span>
        <div className="workflow-status">
          <span className="status-dot"></span>
          All Systems Active
        </div>
      </div>

      <div className="workflow-container">
        {steps.map((step, index) => (
          <div className={`workflow-step ${step.status}`} key={step.title}>
            <div className="workflow-icon">{step.icon}</div>
            <div className="workflow-text">
              <p>{step.title}</p>
              <span className="agent-status active" style={{ fontSize: "11px", opacity: 0.8 }}>
                {step.desc}
              </span>
            </div>
            {index !== 5 && <div className="workflow-line" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentTimeline;