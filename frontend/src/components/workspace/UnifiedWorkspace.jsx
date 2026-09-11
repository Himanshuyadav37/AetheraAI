import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import EngineerChat from "./EngineerChat";
import ConversationalChat from "./ConversationalChat";
import ResearchChat from "./ResearchChat";
import EducationChat from "./EducationChat";
import AutomationChat from "./AutomationChat";
import BrainLearningWorkspace from "./BrainLearningWorkspace";
import DirectoryModal from "./DirectoryModal";
import AICanvasPanel from "./AICanvasPanel";
import "../../styles/workspace.css";
import ShareChatModal from "./ShareChatModal";
import { 
  Share2
} from "lucide-react";

function UnifiedWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeModule, switchModule, moduleState, directoryModalOpen, setDirectoryModalOpen, loadConversation } = useWorkspace();
  const { result } = moduleState.engineer;
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Global Interactive Canvas Artifact State
  const [activeCanvasArtifact, setActiveCanvasArtifact] = useState(null);

  const activeId = moduleState[activeModule]?.activeId;
  const prevUrlChatIdRef = useRef(null);
  const prevModuleRef = useRef(activeModule);
  const isInternalStateChangeRef = useRef(false);

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
    const currentProjectId = searchParams.get("projectId");
    const currentExecutionId = searchParams.get("executionId");

    if (activeId) {
      if (currentChatId !== activeId) {
        isInternalStateChangeRef.current = true;
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("chatId", activeId);
          return next;
        }, { replace: true });
      }
    } else {
      if (currentChatId || currentProjectId || currentExecutionId) {
        isInternalStateChangeRef.current = true;
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("chatId");
          next.delete("projectId");
          next.delete("executionId");
          return next;
        }, { replace: true });
      }
    }
  }, [activeId, setSearchParams, searchParams]);

  // Load chat FROM URL parameters on mount or param changes (respecting module switches)
  useEffect(() => {
    if (prevModuleRef.current !== activeModule) {
      prevModuleRef.current = activeModule;
      prevUrlChatIdRef.current = null;
      const newModuleActiveId = moduleState[activeModule]?.activeId;
      if (!newModuleActiveId && searchParams.toString()) {
        isInternalStateChangeRef.current = true;
        setSearchParams({}, { replace: true });
      }
      return;
    }

    const urlChatId = searchParams.get("chatId");
    if (urlChatId && urlChatId !== activeId && urlChatId !== prevUrlChatIdRef.current && !isInternalStateChangeRef.current) {
      prevUrlChatIdRef.current = urlChatId;
      loadConversation(activeModule, urlChatId);
    }
    isInternalStateChangeRef.current = false;
  }, [searchParams, activeModule, activeId, loadConversation, moduleState, setSearchParams]);

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

  const filesCount = (result?.fixed_code?.files || result?.generated_code?.files || []).length;

  function renderModuleContent() {
    switch (activeModule) {
      case "engineer":
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
      {/* Minimal Top-Right Action Strip (Share & Quick Tools) */}
      {(activeId || result?.execution_id || result?._id || result?.project_id) && (
        <div className="ws-top-actions-strip">
          <button
            type="button"
            className="ws-share-btn"
            onClick={() => setShareModalOpen(true)}
            title="Share this conversation"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
      </div>

      <DirectoryModal isOpen={directoryModalOpen} onClose={() => setDirectoryModalOpen(false)} />

      {/* Share Conversation Modal for Active Module */}
      <ShareChatModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        conversationId={activeId || result?.execution_id || result?._id || result?.project_id}
        module={activeModule}
        title={
          result?.project_plan?.project_name ||
          moduleState[activeModule]?.conversations?.find((c) => c._id === (activeId || result?.execution_id))?.title ||
          moduleState[activeModule]?.messages?.[0]?.content?.slice(0, 45) ||
          `${activeModule.toUpperCase()} Session`
        }
        messagesCount={moduleState[activeModule]?.messages?.length || 0}
      />
    </div>
  );
}

export default UnifiedWorkspace;
