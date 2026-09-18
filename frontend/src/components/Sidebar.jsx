import { useEffect, useState, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  FolderGit2,
  History,
  LogOut,
  Plus,
  Trash2,
  Bot,
  Brain,
  GraduationCap,
  Zap,
  Wrench,
  Monitor,
  X,
  Bell,
  Plug,
  Sparkles,
  Users,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Search,
  Cpu,
  BookOpen,
  Briefcase,
  Share2,
  BarChart3,
  LogIn,
  Dna,
  Globe,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import ShareChatModal from "./workspace/ShareChatModal";
import api from "../services/api";
import "./Sidebar.css";
import "../styles/workspace.css";
import { getAvatarStyle } from "../utils/avatarHelper";

function Sidebar({ onOpenCommandPalette }) {
  const { user, logout, requireAuth, openAuthModal, openOnboarding, isAdmin } = useAuth();
  const {
    activeModule,
    switchModule,
    moduleState,
    newChat,
    deleteConversation,
    loadConversation,
    refreshHistory,
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    sidebarWidth,
    setSidebarWidth,
    foldedSections,
    toggleSection,
    setProfileModalOpen,
  } = useWorkspace();

  const navigate = useNavigate();
  const location = useLocation();

  // Notification & Changelog modal states
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const notificationRef = useRef(null);

  // History search filter state
  const [historySearch, setHistorySearch] = useState("");
  const [isResizing, setIsResizing] = useState(false);
  const [shareModalState, setShareModalState] = useState({
    isOpen: false,
    conversationId: null,
    module: "engineer",
    title: "",
  });

  // AI Engines Rail configuration (Astra is strictly restricted to Admins)
  const allEngines = [
    { id: "engineer", label: "Craft", icon: <Wrench size={15} />, tag: "CRAFT" },
    { id: "conversational", label: "One", icon: <Bot size={15} />, tag: "ONE" },
    { id: "research", label: "Deep", icon: <Brain size={15} />, tag: "DEEP" },
    { id: "education", label: "Mentor", icon: <GraduationCap size={15} />, tag: "MENTOR" },
    { id: "automation", label: "Agent", icon: <Zap size={15} />, tag: "AGENT" },
    { id: "computer", label: "Astra", icon: <Monitor size={15} />, tag: "ASTRA", adminOnly: true },
  ];

  const engines = allEngines.filter((e) => !e.adminOnly || isAdmin);

  // Active module sessions
  const activeHistoryModule = activeModule || "engineer";
  const moduleConversations = moduleState[activeHistoryModule]?.conversations || [];
  const activeConversationId = moduleState[activeHistoryModule]?.activeId;
  const currentEngineConfig = engines.find((e) => e.id === activeHistoryModule) || engines[0];

  const filteredConversations = moduleConversations.filter((conv) =>
    (conv.title || "Untitled Session").toLowerCase().includes(historySearch.toLowerCase())
  );

  async function handleDelete(e, module, id) {
    if (e) {
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
    }
    if (!id) return;
    try {
      await deleteConversation(module, id);
    } catch (err) {
      console.error("Delete conversation failed", err);
    }
  }

  function handleNewChat() {
    requireAuth(() => {
      newChat(activeModule);
      setIsSidebarOpen(false);
      navigate("/workspace", { replace: true });
    }, "Start New Session", "Sign in to save and manage your chat sessions.");
  }

  const handleLogout = () => {
    logout();
    setIsSidebarOpen(false);
    navigate("/workspace");
  };

  const handleSelectEngine = (engineId) => {
    if (engineId === "computer" && !isAdmin) {
      return;
    }
    const engineObj = engines.find((e) => e.id === engineId);
    const engineName = engineObj ? engineObj.label : "Aethera Engine";
    requireAuth(() => {
      if (engineId !== activeModule) {
        switchModule(engineId);
      }
      setIsSidebarOpen(false);
      navigate("/workspace", { replace: true });
    }, `Switch to ${engineName}`, "Sign in to access specialized autonomous intelligence models.");
  };

  // Keyboard shortcut listener (Ctrl/Cmd+B, Ctrl/Cmd+N, Alt+1..5)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when user is typing in an input or textarea
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebarCollapse();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewChat();
      } else if (e.altKey && ["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        if (engines[idx]) {
          handleSelectEngine(engines[idx].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebarCollapse, activeModule]);

  // Resizable drag handler
  const handleMouseDownResize = (e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      setSidebarWidth(startWidth + delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClickResize = () => {
    setSidebarWidth(264);
  };

  const effectiveWidth = isSidebarCollapsed ? 68 : sidebarWidth;

  return (
    <>
      <aside
        className={`sidebar ${isSidebarOpen ? "open" : ""} ${isSidebarCollapsed ? "collapsed" : ""} ${isResizing ? "resizing" : ""}`}
        style={{
          width: `${effectiveWidth}px`,
          minWidth: isSidebarCollapsed ? "68px" : "210px",
          maxWidth: isSidebarCollapsed ? "68px" : "480px",
        }}
      >
        {/* 1. Brand Header */}
        <div className="sb-brand-header">
          {!isSidebarCollapsed ? (
            <>
              <div
                className="sb-brand-left"
                onClick={() => {
                  navigate("/workspace");
                  setIsSidebarOpen(false);
                }}
                id="sb-logo-nav"
                role="button"
                tabIndex={0}
                title="Aethera AI Workspace"
              >
                <img
                  src="/aethera-logo.svg"
                  alt="Aethera AI"
                  className="sb-brand-logo-img"
                />
              </div>

              <button
                type="button"
                className="sb-collapse-btn"
                onClick={toggleSidebarCollapse}
                title="Fold Sidebar (⌘B)"
                aria-label="Fold Sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            </>
          ) : (
            <div className="sb-collapsed-header">
              <button
                type="button"
                className="sb-collapsed-logo-toggle-btn"
                onClick={toggleSidebarCollapse}
                title="Unfold Sidebar (⌘B)"
                aria-label="Unfold Sidebar"
              >
                <img
                  src="/favicon.svg"
                  alt="Aethera AI"
                  className="sb-collapsed-logo-img default-icon"
                />
                <PanelLeftOpen size={18} className="hover-unfold-icon" />
              </button>
            </div>
          )}

          {isSidebarOpen && (
            <button
              className="sb-mobile-close-btn"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* 2. Primary Action Button & Spotlight Trigger */}
        <div className="sb-action-container">
          {!isSidebarCollapsed ? (
            <div className="sb-action-row">
              <button className="sb-new-btn" onClick={handleNewChat} id="sb-btn-new-chat" title="New Session">
                <span className="sb-new-btn-left">
                  <span className="sb-btn-icon-bubble primary">
                    <Plus size={15} strokeWidth={2.8} />
                  </span>
                  <span className="sb-btn-label">New Session</span>
                </span>
              </button>

              {onOpenCommandPalette && (
                <button
                  type="button"
                  className="sb-cmd-spotlight-icon-btn"
                  onClick={onOpenCommandPalette}
                  title="Quick Search & Commands (⌘K)"
                  aria-label="Quick Search"
                >
                  <Search size={16} strokeWidth={2.2} />
                </button>
              )}
            </div>
          ) : (
            <div className="sb-action-col-collapsed">
              <button
                className="sb-new-btn-collapsed"
                onClick={handleNewChat}
                data-tooltip="New Session (⌘N)"
                aria-label="New Session"
              >
                <Plus size={18} />
              </button>
              {onOpenCommandPalette && (
                <button
                  type="button"
                  className="sb-new-btn-collapsed"
                  onClick={onOpenCommandPalette}
                  data-tooltip="Spotlight (⌘K)"
                  aria-label="Spotlight (⌘K)"
                  style={{ marginTop: "4px" }}
                >
                  <Search size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. Main Scrollable Navigation Area */}
        <div className="sidebar-scroll-area">
          {/* AI Engines Section (Collapsible Folder) */}
          <div className="sb-section-group">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                className="sb-section-header-btn"
                onClick={() => toggleSection("aiEngines")}
              >
                <div className="sb-section-header-left">
                  {foldedSections.aiEngines ? <ChevronDown size={15} strokeWidth={2.4} /> : <ChevronRight size={15} strokeWidth={2.4} />}
                  <span>AI ENGINES</span>
                </div>
                <span className="sb-count-badge">{engines.length}</span>
              </button>
            ) : (
              <div className="sb-collapsed-divider" />
            )}

            {(foldedSections.aiEngines || isSidebarCollapsed) && (
              <div className="sb-engine-list">
                {engines.map((eng) => {
                  const isSelected = activeModule === eng.id && location.pathname === "/workspace";
                  return (
                    <div key={eng.id} className="sb-engine-wrapper">
                      <button
                        className={`sb-engine-item ${isSelected ? "active" : ""} ${isSidebarCollapsed ? "collapsed-item" : ""}`}
                        onClick={() => handleSelectEngine(eng.id)}
                        id={`sb-engine-${eng.id}`}
                        data-tooltip={eng.label}
                      >
                        <div className="sb-engine-item-left">
                          {eng.icon}
                          {!isSidebarCollapsed && <span>{eng.label}</span>}
                        </div>
                      </button>
                    </div>
                  );
                })}

                {/* Standalone Workspaces & Studios */}
                <div className="sb-engine-wrapper">
                  <button
                    type="button"
                    className={`sb-engine-item ${location.pathname === "/agent-studio" ? "active" : ""} ${isSidebarCollapsed ? "collapsed-item" : ""}`}
                    onClick={() => {
                      requireAuth(() => {
                        navigate("/agent-studio");
                        setIsSidebarOpen(false);
                      }, "Open Agent Studio", "Sign in to access Agent Studio.");
                    }}
                    id="sb-nav-agent-studio"
                    data-tooltip="Agent Studio"
                  >
                    <div className="sb-engine-item-left">
                      <Sparkles size={15} style={{ color: "#a855f7" }} />
                      {!isSidebarCollapsed && <span>Agent Studio</span>}
                    </div>
                  </button>
                </div>

                <div className="sb-engine-wrapper">
                  <button
                    type="button"
                    className={`sb-engine-item ${location.pathname === "/teams" ? "active" : ""} ${isSidebarCollapsed ? "collapsed-item" : ""}`}
                    onClick={() => {
                      requireAuth(() => {
                        navigate("/teams");
                        setIsSidebarOpen(false);
                      }, "Open Team Space", "Sign in to access Team Space.");
                    }}
                    id="sb-nav-teams"
                    data-tooltip="Team Space"
                  >
                    <div className="sb-engine-item-left">
                      <Users size={15} style={{ color: "#3b82f6" }} />
                      {!isSidebarCollapsed && <span>Team Space</span>}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recent Threads for Active Engine (Collapsible Folder) */}
          {!isSidebarCollapsed && (
            <div className="sb-section-group">
              <button
                type="button"
                className="sb-section-header-btn"
                onClick={() => toggleSection("history")}
              >
                <div className="sb-section-header-left">
                  {foldedSections.history ? <ChevronDown size={15} strokeWidth={2.4} /> : <ChevronRight size={15} strokeWidth={2.4} />}
                  <span>{currentEngineConfig.label} History</span>
                </div>
                <span className="sb-count-badge">{moduleConversations.length}</span>
              </button>

              {foldedSections.history && (
                <div className="sb-history-wrapper">
                  {moduleConversations.length > 3 && (
                    <div className="sb-search-box">
                      <Search size={12} className="sb-search-icon" />
                      <input
                        type="text"
                        placeholder="Filter sessions..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="sb-search-input"
                      />
                      {historySearch && (
                        <button
                          type="button"
                          className="sb-search-clear"
                          onClick={() => setHistorySearch("")}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  )}

                  <div className="sb-threads-list">
                    {filteredConversations.length === 0 ? (
                      <div className="sb-empty-threads">
                        {historySearch ? "No matching sessions" : "No session history yet"}
                      </div>
                    ) : (
                      filteredConversations.slice(0, 20).map((conv) => {
                        const isActive = activeConversationId === conv._id && location.pathname === "/workspace";
                        return (
                          <div
                            key={conv._id}
                            className={`sb-thread-item ${isActive ? "active" : ""}`}
                            onClick={() => {
                              loadConversation(activeHistoryModule, conv._id);
                              setIsSidebarOpen(false);
                              navigate(`/workspace?chatId=${conv._id}`);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                loadConversation(activeHistoryModule, conv._id);
                                setIsSidebarOpen(false);
                                navigate(`/workspace?chatId=${conv._id}`);
                              }
                            }}
                          >
                            <div className="sb-thread-left">
                              <span className="sb-thread-module-tag">{currentEngineConfig.tag}</span>
                              <span className="sb-thread-title" title={conv.title || "Untitled Session"}>
                                {conv.title || "Untitled Session"}
                              </span>
                            </div>
                            <div className="sb-thread-actions" style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <button
                                className="sb-thread-share"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShareModalState({
                                    isOpen: true,
                                    conversationId: conv._id,
                                    module: activeHistoryModule,
                                    title: conv.title || "Untitled Session",
                                  });
                                }}
                                title="Share Conversation"
                                aria-label="Share Conversation"
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#71717a",
                                  cursor: "pointer",
                                  padding: "3px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: "4px"
                                }}
                              >
                                <Share2 size={12} />
                              </button>
                              <button
                                className="sb-thread-delete"
                                onClick={(e) => handleDelete(e, activeHistoryModule, conv._id || conv.id)}
                                title="Delete Session"
                                aria-label="Delete Session"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Footer User Hub */}
        <div className="sb-footer">
          {!isSidebarCollapsed ? (
            <div
              className="sb-user-card"
              onClick={(e) => {
                e.stopPropagation();
                if (user) {
                  navigate("/profile");
                  setIsSidebarOpen(false);
                } else {
                  openAuthModal(null, "Welcome to Aethera AI", "Sign in or create an account to unlock all features.");
                }
              }}
              id="sb-profile-btn"
              role="button"
              tabIndex={0}
              title={user ? "Account Preferences & Settings" : "Click to Sign In"}
            >
              <div className="sb-user-left">
                <div className="sb-user-avatar-wrapper">
                  <div
                    className="sb-user-avatar"
                    style={getAvatarStyle(user?.username || "Guest User")}
                  >
                    {user ? (user?.username?.[0]?.toUpperCase() || "U") : "G"}
                  </div>
                  <span className={`sb-user-status-dot ${user ? "online" : ""}`} />
                </div>
                <div className="sb-user-meta">
                  <span className="sb-user-name">{user?.username || "Guest User"}</span>
                  <span className="sb-user-subtext">
                    {user ? (isAdmin ? "Admin Console" : "Active Workspace") : "Sign in to sync"}
                  </span>
                </div>
              </div>

              {user ? (
                <div className="sb-user-actions" ref={notificationRef}>
                  <button
                    type="button"
                    className="sb-icon-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setWhatsNewOpen(true);
                      setHasNewNotifications(false);
                    }}
                    title="System Changelog & Updates"
                    aria-label="System Updates"
                  >
                    <Bell size={13} />
                    {hasNewNotifications && <span className="sb-badge-dot" />}
                  </button>

                  <button
                    type="button"
                    className="sb-icon-action-btn logout"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                    }}
                    title="Logout Session"
                    aria-label="Logout"
                  >
                    <LogOut size={13} />
                  </button>
                </div>
              ) : (
                <div className="sb-user-actions">
                  <button
                    type="button"
                    className="sb-icon-action-btn signin-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAuthModal();
                    }}
                    title="Sign In / Login"
                    aria-label="Sign In"
                  >
                    <LogIn size={13} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              className="sb-user-card-collapsed"
              onClick={(e) => {
                e.stopPropagation();
                if (user) {
                  navigate("/profile");
                } else {
                  openAuthModal();
                }
              }}
              data-tooltip={user?.username || "Guest User"}
            >
              <div
                className="sb-user-avatar"
                style={getAvatarStyle(user?.username || "Guest User")}
              >
                {user ? (user?.username?.[0]?.toUpperCase() || "U") : "G"}
              </div>
            </div>
          )}
        </div>

        {/* 5. Resizable Right Edge Cursor Drag Handle */}
        {!isSidebarCollapsed && (
          <div
            className={`sb-resize-handle ${isResizing ? "resizing" : ""}`}
            onMouseDown={handleMouseDownResize}
            onDoubleClick={handleDoubleClickResize}
            title="Drag to resize sidebar width · Double-click to reset"
          />
        )}
      </aside>

      {/* System Changelog & Updates Modal */}
      {whatsNewOpen && (
        <div className="sb-whatsnew-backdrop" onClick={() => setWhatsNewOpen(false)}>
          <div className="sb-whatsnew-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sb-whatsnew-header">
              <div className="sb-whatsnew-title">
                <span className="sb-whatsnew-sparkle">✨</span>
                <div>
                  <h3>Aethera Enterprise OS 2.5 Changelog</h3>
                  <p>Recent platform enhancements, security patches & telemetry updates</p>
                </div>
              </div>
              <button
                type="button"
                className="sb-whatsnew-close"
                onClick={() => setWhatsNewOpen(false)}
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="sb-whatsnew-body">
              <div className="sb-whatsnew-item">
                <div className="sb-whatsnew-item-header">
                  <h4 className="sb-whatsnew-item-title">🔐 Enterprise Auth & SOC2 Type II Security</h4>
                  <span className="sb-whatsnew-tag">SECURITY</span>
                </div>
                <p className="sb-whatsnew-item-desc">
                  Completely revamped authentication with 256-Bit TLS encryption, SOC2 compliance badges, verified Google OAuth, and secure 6-digit OTP verification.
                </p>
              </div>

              <div className="sb-whatsnew-item">
                <div className="sb-whatsnew-item-header">
                  <h4 className="sb-whatsnew-item-title">🌓 Universal Dark & Light Mode Engine</h4>
                  <span className="sb-whatsnew-tag">DESIGN SYSTEM</span>
                </div>
                <p className="sb-whatsnew-item-desc">
                  100% crisp legibility across all modules: Admin Panel (`/admin`), Team Space (`/team-workspace`), Agent Studio (`/agent-studio`), and Workspaces with pure white cards and deep slate typography.
                </p>
              </div>

              <div className="sb-whatsnew-item">
                <div className="sb-whatsnew-item-header">
                  <h4 className="sb-whatsnew-item-title">⚡ LLM Cost & Quota Vault with Semantic Routing</h4>
                  <span className="sb-whatsnew-tag">AI ENGINE</span>
                </div>
                <p className="sb-whatsnew-item-desc">
                  Real-time dynamic complexity routing between Groq Llama 3.3 Fast (140ms latency) and Frontier Gemini/Claude models with departmental budget hard caps and dollar spend tracking.
                </p>
              </div>

              <div className="sb-whatsnew-item">
                <div className="sb-whatsnew-item-header">
                  <h4 className="sb-whatsnew-item-title">🏢 Collaborative Team Space & AI Co-Pilot</h4>
                  <span className="sb-whatsnew-tag">COLLABORATION</span>
                </div>
                <p className="sb-whatsnew-item-desc">
                  Real-time team chat channels with `@aethera` AI synthesis, collaborative Kanban sprint board with 1-click AI goal breakdown, and shared enterprise prompt vault.
                </p>
              </div>

              <div className="sb-whatsnew-item">
                <div className="sb-whatsnew-item-header">
                  <h4 className="sb-whatsnew-item-title">🛡️ AI Safety Guardrails & Live Incident Audits</h4>
                  <span className="sb-whatsnew-tag">COMPLIANCE</span>
                </div>
                <p className="sb-whatsnew-item-desc">
                  Active PII redaction, jailbreak shields, contextual RAG grounding checks, and live Atlas cluster latency telemetry.
                </p>
              </div>

              <div className="sb-whatsnew-item">
                <div className="sb-whatsnew-item-header">
                  <h4 className="sb-whatsnew-item-title">🚀 Aethera OS Environment Bootloader v2.5</h4>
                  <span className="sb-whatsnew-tag">CORE OS</span>
                </div>
                <p className="sb-whatsnew-item-desc">
                  Dynamic multi-stage neural mesh boot sequence, isolated sandbox execution, and hardware health verification on startup.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sb-whatsnew-footer">
              <button
                type="button"
                className="sb-whatsnew-btn"
                onClick={() => setWhatsNewOpen(false)}
              >
                Dismiss & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Conversation Modal */}
      <ShareChatModal
        isOpen={shareModalState.isOpen}
        onClose={() => setShareModalState((prev) => ({ ...prev, isOpen: false }))}
        conversationId={shareModalState.conversationId}
        module={shareModalState.module}
        title={shareModalState.title}
      />
    </>
  );
}

export default Sidebar;