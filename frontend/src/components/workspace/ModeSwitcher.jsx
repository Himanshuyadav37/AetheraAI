import { Bot, Brain, GraduationCap, Wrench, Zap, Plus, Menu } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import "../../styles/workspace.css";

const MODES = [
  {
    id: "engineer",
    label: "Engineer",
    title: "Engineer AI Workspace",
    subtitle: "Build production-ready software using autonomous AI planning, coding, and debugging agents.",
    icon: <Wrench size={16} />,
  },
  {
    id: "conversational",
    label: "Conversational",
    title: "Conversational AI Assistant",
    subtitle: "Multi-layer RAG conversational assistant grounded on projects, files, and organization documents.",
    icon: <Bot size={16} />,
  },
  {
    id: "research",
    label: "Research",
    title: "Research & Analysis AI",
    subtitle: "Perform deep technical market research, comparative studies, and codebase audits.",
    icon: <Brain size={16} />,
  },
  {
    id: "education",
    label: "Education",
    title: "Education & Interview AI",
    subtitle: "Personalized AI tutoring and senior software engineering interview simulations.",
    icon: <GraduationCap size={16} />,
  },
  {
    id: "automation",
    label: "Automation",
    title: "Automation & Integrations",
    subtitle: "Design autonomous workflow integrations, webhooks, and execution pipelines.",
    icon: <Zap size={16} />,
  },
];

function ModeSwitcher() {
  const { activeModule, switchModule, newChat, isSidebarOpen, setIsSidebarOpen } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleModeClick = (modeId) => {
    if (searchParams.get("projectId") || searchParams.get("executionId")) {
      setSearchParams({});
    }
    switchModule(modeId);
  };

  const currentMode = MODES.find((m) => m.id === activeModule) || MODES[0];

  return (
    <header className="ws-topbar">
      {/* Left: Active Module Branding / Title */}
      <div className="ws-topbar-left">
        <button
          type="button"
          className="ws-mobile-menu-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle sidebar menu"
          id="ws-menu-toggle-btn"
        >
          <Menu size={18} />
        </button>

        <div className="ws-topbar-module-info">
          <div className="ws-topbar-icon-box">{currentMode.icon}</div>
          <div className="ws-topbar-text">
            <h1 className="ws-topbar-title">{currentMode.title}</h1>
            <p className="ws-topbar-subtitle">{currentMode.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Right: Modern Classic Tabs + Action Button */}
      <div className="ws-topbar-right">
        <nav className="ws-topbar-tabs" role="tablist" aria-label="AI Modes">
          {MODES.map((mode) => {
            const isActive = activeModule === mode.id;
            return (
              <button
                key={mode.id}
                role="tab"
                aria-selected={isActive}
                className={`ws-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => handleModeClick(mode.id)}
                id={`ws-tab-${mode.id}`}
              >
                {mode.icon}
                <span className="ws-tab-btn-label">{mode.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          className="ws-topbar-new-btn"
          onClick={() => newChat(activeModule)}
          id="ws-topbar-new-btn"
          title="Start a new session"
        >
          <Plus size={15} />
          <span>New Session</span>
        </button>
      </div>
    </header>
  );
}

export default ModeSwitcher;
