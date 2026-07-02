import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import ModeSwitcher from "./ModeSwitcher";
import EngineerChat from "./EngineerChat";
import ConversationalChat from "./ConversationalChat";
import ResearchChat from "./ResearchChat";
import EducationChat from "./EducationChat";
import AutomationChat from "./AutomationChat";
import EngineerPanel from "../EngineerPanel";
import BrainLearningWorkspace from "./BrainLearningWorkspace";
import DirectoryModal from "./DirectoryModal";
import "../../styles/workspace.css";

function UnifiedWorkspace() {
  const [searchParams] = useSearchParams();
  const { activeModule, switchModule, moduleState, directoryModalOpen, setDirectoryModalOpen } = useWorkspace();
  const { result } = moduleState.engineer;
  const [activeMobileTab, setActiveMobileTab] = useState("chat");

  useEffect(() => {
    if (searchParams.get("projectId") || searchParams.get("executionId")) {
      if (activeModule !== "engineer") {
        switchModule("engineer");
      }
    }
  }, [searchParams, activeModule, switchModule]);

  console.log("UnifiedWorkspace render: activeModule =", activeModule, "result =", result);

  function renderActiveWorkspace() {
    switch (activeModule) {
      case "engineer":
        if (result || moduleState.engineer.loading) {
          return (
            <div className="engineer-split-workspace">
              {/* Mobile-only tab navigation switcher */}
              <div className="engineer-mobile-tabs">
                <button
                  type="button"
                  className={`mobile-tab-btn ${activeMobileTab === "chat" ? "active" : ""}`}
                  onClick={() => setActiveMobileTab("chat")}
                >
                  💬 Chat
                </button>
                <button
                  type="button"
                  className={`mobile-tab-btn ${activeMobileTab === "output" ? "active" : ""}`}
                  onClick={() => setActiveMobileTab("output")}
                >
                  📁 Workspace Files
                </button>
              </div>

              <div className={`engineer-chat-pane ${activeMobileTab === "chat" ? "mobile-show" : "mobile-hide"}`}>
                <EngineerChat />
              </div>
              <div className={`engineer-output-pane ${activeMobileTab === "output" ? "mobile-show" : "mobile-hide"}`}>
                <EngineerPanel result={result} loading={moduleState.engineer.loading} />
              </div>
            </div>
          );
        }
        return <EngineerChat />;
      case "conversational":
        return <ConversationalChat />;
      case "research":
        return <ResearchChat />;
      case "education":
        return <EducationChat />;
      case "automation":
        return <AutomationChat />;
      case "brain":
        return <BrainLearningWorkspace />;
      default:
        return <EngineerChat />;
    }
  }

  return (
    <div className="workspace-root">
      <ModeSwitcher />
      {renderActiveWorkspace()}
      <DirectoryModal isOpen={directoryModalOpen} onClose={() => setDirectoryModalOpen(false)} />
    </div>
  );
}

export default UnifiedWorkspace;
