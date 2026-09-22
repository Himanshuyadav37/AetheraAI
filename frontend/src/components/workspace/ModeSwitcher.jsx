import { Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import "../../styles/workspace.css";

function ModeSwitcher() {
  const {
    activeModule,
    workspaceMode,
    setWorkspaceMode,
    moduleState,
    autoModeMessages,
  } = useWorkspace();

  const [searchParams, setSearchParams] = useSearchParams();

  const handleWorkspaceModeChange = (nextMode) => {
    if (nextMode !== "automatic" && nextMode !== "manual") return;

    setWorkspaceMode(nextMode);

    if (nextMode === "automatic" && searchParams.toString()) {
      setSearchParams({}, { replace: true });
    }
  };

  const isAutomatic = workspaceMode === "automatic";

  const hasChatMessages = isAutomatic
    ? autoModeMessages.length > 0
    : (moduleState[activeModule]?.messages?.length > 0 || moduleState[activeModule]?.activeId);

  if (hasChatMessages) return null;

  return (
    <div className="ws-mode-capsule-container">
      <div
        className="ws-mode-capsule"
        role="group"
        aria-label="Workspace mode"
      >
        <button
          type="button"
          className={`ws-mode-capsule-btn ${
            workspaceMode === "automatic" ? "active" : ""
          }`}
          aria-pressed={workspaceMode === "automatic"}
          onClick={() => handleWorkspaceModeChange("automatic")}
        >
          <Sparkles size={14} />
          Automatic
        </button>

        <button
          type="button"
          className={`ws-mode-capsule-btn ${
            workspaceMode === "manual" ? "active" : ""
          }`}
          aria-pressed={workspaceMode === "manual"}
          onClick={() => handleWorkspaceModeChange("manual")}
        >
          Manual
        </button>
      </div>
    </div>
  );
}

export default ModeSwitcher;
