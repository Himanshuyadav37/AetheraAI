import { Bot, Brain, GraduationCap, Wrench, Zap, Cpu } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import "../../styles/workspace.css";

const MODES = [
  { id: "engineer",       label: "Engineer",      icon: <Wrench size={16} /> },
  { id: "conversational", label: "Conversational", icon: <Bot size={16} /> },
  { id: "research",       label: "Research",      icon: <Brain size={16} /> },
  { id: "education",      label: "Education",     icon: <GraduationCap size={16} /> },
  { id: "automation",     label: "Automation",    icon: <Zap size={16} /> },
];

function ModeSwitcher() {
  const { activeModule, switchModule } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleModeClick = (modeId) => {
    if (searchParams.get("projectId") || searchParams.get("executionId")) {
      setSearchParams({});
    }
    switchModule(modeId);
  };

  return (
    <div className="mode-switcher" role="tablist" aria-label="AI Mode">
      <div className="mode-switcher-track">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            role="tab"
            aria-selected={activeModule === mode.id}
            className={`mode-btn ${activeModule === mode.id ? "active" : ""}`}
            onClick={() => handleModeClick(mode.id)}
            id={`mode-btn-${mode.id}`}
          >
            {mode.icon}
            <span className="mode-btn-label">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ModeSwitcher;
