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
import ShareChatModal from "./ShareChatModal";
import { 
  MessageSquare, 
  Columns, 
  Code2, 
  ChevronRight, 
  ChevronLeft, 
  FolderGit2, 
  Maximize2, 
  Minimize2,
  Share2,
  Plus
} from "lucide-react";

function UnifiedWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeModule, switchModule, moduleState, directoryModalOpen, setDirectoryModalOpen, loadConversation, newChat } = useWorkspace();
  const { result } = moduleState.engineer;
  const [activeMobileTab, setActiveMobileTab] = useState("chat");
  const [workspaceViewMode, setWorkspaceViewMode] = useState("split"); // "split" | "chat" | "workspace"
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
        if (result || moduleState.engineer.loading) {
          return (
            <div className={`engineer-split-workspace mode-${workspaceViewMode}`}>
              {/* Mobile Tab Toggle */}
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
                  📁 Workspace ({filesCount})
                </button>
              </div>

              {/* Floating Pill when Workspace is Folded */}
              {workspaceViewMode === "chat" && (
                <button
                  type="button"
                  className="floating-workspace-pill"
                  onClick={() => setWorkspaceViewMode("split")}
                  title="Expand code workspace alongside chat"
                >
                  <FolderGit2 size={14} style={{ color: "#a78bfa" }} />
                  <span>Open Workspace ({filesCount} files)</span>
                  <ChevronRight size={13} />
                </button>
              )}

              {/* Left Chat Pane */}
              <div className={`engineer-chat-pane ${activeMobileTab === "chat" ? "mobile-show" : "mobile-hide"}`}>
                <EngineerChat />
              </div>

              {/* Right Code & File Workspace Pane */}
              <div className={`engineer-output-pane ${activeMobileTab === "output" ? "mobile-show" : "mobile-hide"}`}>
                <EngineerPanel 
                  result={result} 
                  loading={moduleState.engineer.loading}
                  workspaceViewMode={workspaceViewMode}
                  setWorkspaceViewMode={setWorkspaceViewMode}
                />
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
      {/* Minimal Top-Right Share Button (ChatGPT Style) */}
      {(activeId || result?.execution_id || result?._id || result?.project_id) && (
        <button
          type="button"
          onClick={() => setShareModalOpen(true)}
          style={{
            position: "absolute",
            top: "12px",
            right: "18px",
            zIndex: 40,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 12px",
            borderRadius: "6px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#e4e4e7",
            fontSize: "12px",
            fontWeight: "500",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            transition: "all 0.15s ease",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.color = "#e4e4e7";
          }}
          title="Share this chat"
        >
          <Share2 size={12} />
          <span>Share</span>
        </button>
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
