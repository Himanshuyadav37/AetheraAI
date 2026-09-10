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
import { 
  MessageSquare, 
  Columns, 
  Code2, 
  ChevronRight, 
  ChevronLeft,
  FolderGit2,
  Maximize2,
  Minimize2
} from "lucide-react";

function UnifiedWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeModule, switchModule, moduleState, directoryModalOpen, setDirectoryModalOpen, loadConversation } = useWorkspace();
  const { result } = moduleState.engineer;
  const [activeMobileTab, setActiveMobileTab] = useState("chat");
  const [workspaceViewMode, setWorkspaceViewMode] = useState("split"); // "split" | "chat" | "workspace"

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
                {/* Mode Controller Header */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 14px",
                  background: "rgba(18, 18, 24, 0.7)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                  backdropFilter: "blur(10px)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FolderGit2 size={14} style={{ color: "#8b5cf6" }} />
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#e4e4e7" }}>
                      Project Workspace ({filesCount} files)
                    </span>
                  </div>

                  <div className="ws-fold-control-bar">
                    <button
                      type="button"
                      className={`ws-fold-btn ${workspaceViewMode === "split" ? "active" : ""}`}
                      onClick={() => setWorkspaceViewMode("split")}
                      title="Split View (Chat + Code)"
                    >
                      <Columns size={12} />
                      <span>Split</span>
                    </button>
                    <button
                      type="button"
                      className={`ws-fold-btn ${workspaceViewMode === "workspace" ? "active" : ""}`}
                      onClick={() => setWorkspaceViewMode("workspace")}
                      title="Full Screen Code Editor"
                    >
                      <Maximize2 size={12} />
                      <span>Full Code</span>
                    </button>
                    <button
                      type="button"
                      className="ws-fold-btn"
                      onClick={() => setWorkspaceViewMode("chat")}
                      title="Fold Workspace (Full Chat View)"
                    >
                      <ChevronRight size={12} />
                      <span>Fold</span>
                    </button>
                  </div>
                </div>

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
