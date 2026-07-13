import { useEffect, useState, useRef } from "react";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeModule, switchModule, moduleState, directoryModalOpen, setDirectoryModalOpen, loadConversation } = useWorkspace();
  const { result } = moduleState.engineer;
  const [activeMobileTab, setActiveMobileTab] = useState("chat");

   const activeId = moduleState[activeModule]?.activeId;
  const prevUrlChatIdRef = useRef(null);

  // Sync activeId TO URL search parameters
  useEffect(() => {
    const currentChatId = searchParams.get("chatId");
    if (activeId) {
      if (currentChatId !== activeId) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("chatId", activeId);
          return next;
        }, { replace: true });
      }
    } else {
      if (currentChatId) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("chatId");
          return next;
        }, { replace: true });
      }
    }
  }, [activeId, setSearchParams, searchParams]);

   // Load chat FROM URL parameters on mount or param changes
  useEffect(() => {
    const urlChatId = searchParams.get("chatId");
    if (urlChatId && urlChatId !== activeId && urlChatId !== prevUrlChatIdRef.current) {
      loadConversation(activeModule, urlChatId);
    }
    prevUrlChatIdRef.current = urlChatId;
  }, [searchParams, activeModule, activeId, loadConversation]);

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
    <div className={`workspace-root active-module-${activeModule}`}>
      <ModeSwitcher />
      {renderActiveWorkspace()}
      <DirectoryModal isOpen={directoryModalOpen} onClose={() => setDirectoryModalOpen(false)} />
    </div>
  );
}

export default UnifiedWorkspace;
