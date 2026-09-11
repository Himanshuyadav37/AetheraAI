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
  X,
  Shield,
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
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import ShareChatModal from "./workspace/ShareChatModal";
import api from "../services/api";
import "./Sidebar.css";
import "../styles/workspace.css";
import { getAvatarStyle } from "../utils/avatarHelper";

function Sidebar({ onOpenCommandPalette }) {
  const { user, logout, requireAuth, openAuthModal } = useAuth();
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

  // AI Engines Rail configuration
  const engines = [
    { id: "engineer", label: "Engineer AI", icon: <Wrench size={15} />, tag: "ENG", shortcut: "⌥1" },
    { id: "conversational", label: "Conversational AI", icon: <Bot size={15} />, tag: "CHAT", shortcut: "⌥2" },
    { id: "research", label: "Research AI", icon: <Brain size={15} />, tag: "RES", shortcut: "⌥3" },
    { id: "education", label: "Education AI", icon: <GraduationCap size={15} />, tag: "EDU", shortcut: "⌥4" },
    { id: "automation", label: "Automation AI", icon: <Zap size={15} />, tag: "AUTO", shortcut: "⌥5" },
  ];

  // System tools menu
  const systemMenu = [
    {
      title: "Agent Studio",
      icon: <Sparkles size={15} />,
      path: "/agent-studio",
    },
    {
      title: "Team Spaces",
      icon: <Users size={15} />,
      path: "/teams",
    },
    {
      title: "Integrations & API",
      icon: <Plug size={15} />,
      path: "/integrations",
    },
    {
      title: "Projects",
      icon: <FolderGit2 size={15} />,
      path: "/projects",
    },
    {
      title: "MCP Servers",
      icon: <Cpu size={15} />,
      path: "/mcp",
    },
  ];

  const ADMIN_EMAILS = [
    "ydvhimanshu461@gmail.com",
  ];
  if (user && ADMIN_EMAILS.includes(user.email?.toLowerCase()?.trim())) {
    systemMenu.push({
      title: "Admin Panel",
      icon: <Shield size={15} />,
      path: "/admin",
    });
  }

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
    const engineObj = engines.find((e) => e.id === engineId);
    const engineName = engineObj ? engineObj.label : "NexusAI Engine";
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
                title="NEXUSAI Studio Workspace"
              >
                <span className="sb-brand-name">NEXUSAI</span>
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
                className="sb-expand-btn"
                onClick={toggleSidebarCollapse}
                data-tooltip="Unfold Sidebar (⌘B)"
                aria-label="Unfold Sidebar"
              >
                <PanelLeftOpen size={17} />
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
            <>
              <button className="sb-new-btn" onClick={handleNewChat} id="sb-btn-new-chat">
                <span className="sb-new-btn-left">
                  <span className="sb-btn-icon-bubble primary">
                    <Plus size={14} strokeWidth={2.8} />
                  </span>
                  <span className="sb-btn-label">New Session</span>
                </span>
                <span className="sb-shortcut-badge">⌘N</span>
              </button>

              {onOpenCommandPalette && (
                <button
                  type="button"
                  className="sb-cmd-spotlight-btn"
                  onClick={onOpenCommandPalette}
                  title="Quick Command Search (⌘K)"
                >
                  <span className="sb-cmd-left">
                    <span className="sb-btn-icon-bubble secondary">
                      <Search size={13} strokeWidth={2.2} />
                    </span>
                    <span className="sb-cmd-label">Quick Search...</span>
                  </span>
                  <span className="sb-shortcut-badge secondary">⌘K</span>
                </button>
              )}
            </>
          ) : (
            <>
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
            </>
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
                <span className="sb-count-badge">5</span>
              </button>
            ) : (
              <div className="sb-collapsed-divider" />
            )}

            {(foldedSections.aiEngines || isSidebarCollapsed) && (
              <div className="sb-engine-list">
                {engines.map((eng) => {
                  const isSelected = activeModule === eng.id && location.pathname === "/workspace";
                  return (
                    <button
                      key={eng.id}
                      className={`sb-engine-item ${isSelected ? "active" : ""} ${isSidebarCollapsed ? "collapsed-item" : ""}`}
                      onClick={() => handleSelectEngine(eng.id)}
                      id={`sb-engine-${eng.id}`}
                      data-tooltip={`${eng.label} (${eng.shortcut})`}
                    >
                      <div className="sb-engine-item-left">
                        {eng.icon}
                        {!isSidebarCollapsed && <span>{eng.label}</span>}
                      </div>
                      {!isSidebarCollapsed && (
                        <div className="sb-engine-item-right">
                          <span className="sb-engine-shortcut">{eng.shortcut}</span>
                          {isSelected && <span className="sb-active-indicator" />}
                        </div>
                      )}
                      {isSidebarCollapsed && isSelected && <span className="sb-active-indicator-dot" />}
                    </button>
                  );
                })}
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

          {/* System & Workspace Tools (Collapsible Folder) */}
          <div className="sb-section-group">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                className="sb-section-header-btn"
                onClick={() => toggleSection("system")}
              >
                <div className="sb-section-header-left">
                  {foldedSections.system ? <ChevronDown size={15} strokeWidth={2.4} /> : <ChevronRight size={15} strokeWidth={2.4} />}
                  <span>SYSTEM & WORKSPACE</span>
                </div>
                <span className="sb-count-badge">{systemMenu.length}</span>
              </button>
            ) : (
              <div className="sb-collapsed-divider" />
            )}

            {(foldedSections.system || isSidebarCollapsed) && (
              <nav className="sb-system-nav">
                {systemMenu.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      requireAuth(() => {
                        navigate(item.path);
                        setIsSidebarOpen(false);
                      }, `Open ${item.title}`, "Sign in to access platform tools, projects, and integrations.");
                    }}
                    className={`sb-system-link ${location.pathname === item.path ? "active" : ""} ${isSidebarCollapsed ? "collapsed-link" : ""}`}
                    data-tooltip={item.title}
                    style={{ width: "100%", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", font: "inherit" }}
                  >
                    {item.icon}
                    {!isSidebarCollapsed && <span>{item.title}</span>}
                  </button>
                ))}
              </nav>
            )}
          </div>
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
                  openAuthModal(null, "Welcome to NexusAI", "Sign in or create an account to unlock all features.");
                }
              }}
              id="sb-profile-btn"
              role="button"
              tabIndex={0}
              title={user ? "Account Preferences & Settings" : "Click to Sign In"}
            >
              <div className="sb-user-left">
                <div 
                  className="sb-user-avatar" 
                  style={getAvatarStyle(user?.username || "Guest User")}
                >
                  {user ? (user?.username?.[0]?.toUpperCase() || "U") : "G"}
                </div>
                <div className="sb-user-meta">
                  <span className="sb-user-name">{user?.username || "Guest User"}</span>
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
                    className="sb-icon-action-btn"
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

          {!isSidebarCollapsed && (
            <div className="sb-copyright-note">
              Managed by <strong>NexusAI Technologies</strong>
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
                  <h3>NexusAI Enterprise OS 2.5 Changelog</h3>
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
                  Real-time team chat channels with `@nexus` AI synthesis, collaborative Kanban sprint board with 1-click AI goal breakdown, and shared enterprise prompt vault.
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
                  <h4 className="sb-whatsnew-item-title">🚀 NexusAI OS Environment Bootloader v2.5</h4>
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