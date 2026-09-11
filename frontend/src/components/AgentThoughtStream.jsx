import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Database,
  Code2,
  CheckCircle2,
  Clock,
  Sparkles,
  Terminal
} from "lucide-react";
import "./AgentThoughtStream.css";

export default function AgentThoughtStream({
  steps = [],
  durationMs = 284,
  isExecuting = false,
  agentName = "NexusAI Multi-Agent Mesh"
}) {
  const [isOpen, setIsOpen] = useState(true);

  const defaultSteps = [
    {
      id: "1",
      icon: Database,
      title: "Querying Pinecone Cloud Vector Store",
      detail: "Retrieved 4 relevant semantic chunks from namespace 'nexusai_knowledge'",
      duration: "42ms",
      status: "done"
    },
    {
      id: "2",
      icon: Brain,
      title: "Autonomous Memory Context Injection",
      detail: "Applied user preferences (FastAPI, React, Tailwind, Dark theme)",
      duration: "18ms",
      status: "done"
    },
    {
      id: "3",
      icon: Code2,
      title: "Agent Reasoning & Code Synthesis",
      detail: "Generated modular file tree architecture & type-safe schemas",
      duration: "180ms",
      status: "done"
    },
    {
      id: "4",
      icon: Terminal,
      title: "Self-Healing Verification & Lint Check",
      detail: "Syntax verified with zero compilation errors",
      duration: "44ms",
      status: "done"
    }
  ];

  const activeSteps = steps.length > 0 ? steps : defaultSteps;

  return (
    <div className="agent-thought-container">
      {/* Header Toggle */}
      <div className="agent-thought-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="thought-header-left">
          <div className="thought-pulse-indicator">
            <span className={`pulse-ring ${isExecuting ? "active" : ""}`}></span>
            <Brain size={14} className="thought-brain-icon" />
          </div>
          <span className="thought-title">
            {isExecuting ? "Agent Thinking & Executing..." : `Agent Thought Process (${durationMs}ms)`}
          </span>
          <span className="thought-agent-badge">{agentName}</span>
        </div>

        <div className="thought-header-right">
          <span className="thought-count-badge">{activeSteps.length} steps</span>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {/* Expandable Step Breakdown */}
      {isOpen && (
        <div className="agent-thought-body">
          {activeSteps.map((step, idx) => {
            const Icon = step.icon || Sparkles;
            return (
              <div key={step.id || idx} className="thought-step-item">
                <div className="thought-step-timeline">
                  <div className="thought-step-dot">
                    <CheckCircle2 size={12} className="step-check-icon" />
                  </div>
                  {idx < activeSteps.length - 1 && <div className="thought-step-line"></div>}
                </div>

                <div className="thought-step-content">
                  <div className="thought-step-top">
                    <span className="thought-step-title">{step.title}</span>
                    {step.duration && (
                      <span className="thought-step-duration">
                        <Clock size={10} />
                        {step.duration}
                      </span>
                    )}
                  </div>
                  {step.detail && <p className="thought-step-detail">{step.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
