import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import ModeSwitcher from "./ModeSwitcher";
import EngineerChat from "./EngineerChat";
import ConversationalChat from "./ConversationalChat";
import ResearchChat from "./ResearchChat";
import EducationChat from "./EducationChat";
import AutomationChat from "./AutomationChat";
import EngineerPanel from "../EngineerPanel";
import DirectoryModal from "./DirectoryModal";
import "../../styles/workspace.css";

function UnifiedWorkspace() {
  const [searchParams] = useSearchParams();
  const { activeModule, switchModule, moduleState, directoryModalOpen, setDirectoryModalOpen } = useWorkspace();
  const { result } = moduleState.engineer;

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
        return (
          <div className="engineer-split-workspace">
            <div className="engineer-chat-pane">
              <EngineerChat />
            </div>
            <div className="engineer-output-pane">
              <EngineerPanel result={result} />
            </div>
          </div>
        );
      case "conversational":
        return <ConversationalChat />;
      case "research":
        return <ResearchChat />;
      case "education":
        return <EducationChat />;
      case "automation":
        return <AutomationChat />;
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
