import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import EngineerChat from "./EngineerChat";
import ConversationalChat from "./ConversationalChat";
import ResearchChat from "./ResearchChat";
import EducationChat from "./EducationChat";
import AutomationChat from "./AutomationChat";
import EngineerPanel from "../EngineerPanel";
import BrainLearningWorkspace from "./BrainLearningWorkspace";
import DirectoryModal from "./DirectoryModal";
import AICanvasPanel from "./AICanvasPanel";
import "../../styles/workspace.css";

function UnifiedWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeModule, switchModule, moduleState, directoryModalOpen, setDirectoryModalOpen, loadConversation } = useWorkspace();
  const { result } = moduleState.engineer;
  const [activeMobileTab, setActiveMobileTab] = useState("chat");

  // Global Interactive Canvas Artifact State
  const [activeCanvasArtifact, setActiveCanvasArtifact] = useState(null);

  const activeId = moduleState[activeModule]?.activeId;
  const prevUrlChatIdRef = useRef(null);

  // Listen for Live Canvas events from CodeBlocks or actions
  useEffect(() => {
    const handleCanvasOpenEvent = (e) => {
      if (e.detail) {
        setActiveCanvasArtifact(e.detail);
      }
    };
    window.addEventListener("nexusai-open-canvas", handleCanvasOpenEvent);
    return () => window.removeEventListener("nexusai-open-canvas", handleCanvasOpenEvent);
  }, []);

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

  const handledProjectKeyRef = useRef(null);
  useEffect(() => {
    const pId = searchParams.get("projectId");
    const eId = searchParams.get("executionId");
    const currentKey = (pId || eId) ? `${pId || ""}_${eId || ""}` : null;

    if (currentKey && currentKey !== handledProjectKeyRef.current) {
      handledProjectKeyRef.current = currentKey;
      if (activeModule !== "engineer") {
        switchModule("engineer");
      }
    } else if (!currentKey) {
      handledProjectKeyRef.current = null;
    }
  }, [searchParams, activeModule, switchModule]);

  function renderModuleContent() {
    switch (activeModule) {
      case "engineer":
        if (result || moduleState.engineer.loading) {
          return (
            <div className="engineer-split-workspace">
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
      {activeCanvasArtifact ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100%", width: "100%", overflow: "hidden" }}>
          <div style={{ height: "100%", overflow: "hidden", minWidth: 0 }}>
            {renderModuleContent()}
          </div>
          <div style={{ height: "100%", overflow: "hidden", minWidth: 0 }}>
            <AICanvasPanel
              artifact={activeCanvasArtifact}
              isOpen={Boolean(activeCanvasArtifact)}
              onClose={() => setActiveCanvasArtifact(null)}
            />
          </div>
        </div>
      ) : (
        renderModuleContent()
      )}
      <DirectoryModal isOpen={directoryModalOpen} onClose={() => setDirectoryModalOpen(false)} />
    </div>
  );
}

export default UnifiedWorkspace;
