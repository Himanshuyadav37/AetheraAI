import React from "react";
import {
  Database,
  Cpu,
  Brain,
  GitBranch,
  Activity,
  CreditCard,
  Command
} from "lucide-react";
import "./StatusBar.css";

export default function StatusBar({ onOpenCommandPalette }) {
  return (
    <footer className="pro-status-bar">
      {/* Left System Metrics */}
      <div className="status-bar-left">
        <div className="status-pill status-pill-pinecone" title="Pinecone Serverless Cloud Vector Database">
          <Database size={12} className="status-icon pinecone-icon" />
          <span className="status-label">Pinecone Cloud</span>
          <span className="status-badge-mini">aws/us-east-1</span>
        </div>

        <div className="status-pill status-pill-model" title="Primary Agent LLM Engine">
          <Cpu size={12} className="status-icon" />
          <span className="status-label">Groq Llama-3.3 70B</span>
          <span className="status-badge-mini speed-badge">48 t/s</span>
        </div>

        <div className="status-pill status-pill-memory" title="Continuous User & Global Autonomous Memory">
          <Brain size={12} className="status-icon memory-icon" />
          <span className="status-label">Memory: Synced</span>
        </div>
      </div>

      {/* Center Command Palette Quick Trigger */}
      <div className="status-bar-center" onClick={onOpenCommandPalette}>
        <div className="status-cmd-trigger">
          <Command size={11} />
          <span>Cmd + K</span>
          <span className="cmd-label-text">Spotlight</span>
        </div>
      </div>

      {/* Right Developer & Account Metrics */}
      <div className="status-bar-right">
        <div className="status-pill" title="Current Git Branch">
          <GitBranch size={12} className="status-icon" />
          <span className="status-label">main*</span>
        </div>

        <div className="status-pill" title="Workspace Compute Credits">
          <CreditCard size={12} className="status-icon" />
          <span className="status-label">1,840 / 2,000 Credits</span>
        </div>

        <div className="status-pill status-pill-latency" title="System Latency">
          <span className="status-dot-pulse"></span>
          <span className="status-label">38ms</span>
        </div>
      </div>
    </footer>
  );
}
