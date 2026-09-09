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
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import api from "../services/api";
import "./Sidebar.css";
import "../styles/workspace.css";
import { getAvatarStyle } from "../utils/avatarHelper";

function Sidebar() {
  const { user, logout } = useAuth();
  const {
    activeModule,
    switchModule,
    moduleState,
    newChat,
    loadConversation,
    refreshHistory,
    isSidebarOpen,
    setIsSidebarOpen,
    setProfileModalOpen,
  } = useWorkspace();

  const navigate = useNavigate();
  const location = useLocation();

  // Notification states
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const notificationRef = useRef(null);

  async function handleDelete(e, module, id) {
    e.stopPropagation();
    try {
      if (module === "automation") {
        await api.delete(`/conversations/${id}?agent_type=automation`);
      } else {
        await api.delete(`/conversations/${id}`);
      }
      refreshHistory(module);
      if (moduleState[module]?.activeId === id) {
        newChat(module);
      }
    } catch (err) {
      console.error("Delete conversation failed", err);
    }
  }

  function handleNewChat() {
    newChat(activeModule);
    setIsSidebarOpen(false);
    if (location.pathname !== "/workspace") {
      navigate("/workspace");
    }
  }

  const handleLogout = () => {
    logout();
    setIsSidebarOpen(false);
    navigate("/login");
  };

  const handleSelectEngine = (engineId) => {
    switchModule(engineId);
    setIsSidebarOpen(false);
    if (location.pathname !== "/workspace") {
      navigate("/workspace");
    }
  };

  // AI Engines Rail
  const engines = [
    { id: "engineer", label: "Engineer AI", icon: <Wrench size={15} />, tag: "ENG" },
    { id: "conversational", label: "Conversational AI", icon: <Bot size={15} />, tag: "CHAT" },
    { id: "research", label: "Research AI", icon: <Brain size={15} />, tag: "RES" },
    { id: "education", label: "Education AI", icon: <GraduationCap size={15} />, tag: "EDU" },
    { id: "automation", label: "Automation AI", icon: <Zap size={15} />, tag: "AUTO" },
  ];

  // System tools menu
  const systemMenu = [
    {
      title: "Projects",
      icon: <FolderGit2 size={15} />,
      path: "/projects",
    },
    {
      title: "Executions",
      icon: <History size={15} />,
      path: "/executions",
    },
    {
      title: "MCP Servers",
      icon: <Plug size={15} />,
      path: "/mcp",
    },
  ];

  const ADMIN_EMAILS = [
    "ydvhimanshu461@gmail.com",
    "admin.nexusai@gmail.com",
    "admin@nexusai.com",
    "admin@devpilot.ai",
    "ydvvhimanshu461@gmail.com",
    "himanshuydv00001@gmail.com",
  ];
  if (user && ADMIN_EMAILS.includes(user.email)) {
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

  return (
    <>
      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        {/* 1. Brand Header */}
        <div className="sb-brand-header">
          <div
            className="sb-brand-left"
            onClick={() => {
              navigate("/workspace");
              setIsSidebarOpen(false);
            }}
            id="sb-logo-nav"
            role="button"
            tabIndex={0}
          >
            <div className="sb-brand-icon-box">
              <svg width="20" height="20" viewBox="0 0 100 100" style={{ color: "#ffffff" }}>
                <line x1="50" y1="30" x2="50" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <circle cx="50" cy="15" r="4.5" fill="none" stroke="currentColor" strokeWidth="3" />
                <line x1="41.3" y1="35" x2="36.3" y2="26.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <circle cx="34" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="3" />
                <line x1="58.7" y1="35" x2="63.7" y2="26.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <circle cx="66" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="3" />
                <line x1="32.7" y1="45" x2="22" y2="45" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <circle cx="18" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="3" />
                <line x1="67.3" y1="45" x2="78" y2="45" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <circle cx="82" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="3" />
                <path d="M 50 30 L 67.3 40 L 67.3 60 L 50 70" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 45 32.5 L 32.7 40 L 32.7 60 L 45 67.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <text x="50" y="56" fontFamily="system-ui, sans-serif" fontSize="16" fontWeight="bold" fill="currentColor" textAnchor="middle">NFT</text>
              </svg>
            </div>
            <div className="sb-brand-meta">
              <div className="sb-brand-title-row">
                <span className="sb-brand-name">NexusAI</span>
                <span className="sb-brand-tag">OS 2.0</span>
              </div>
            </div>
          </div>

          <div className="sb-status-pill">
            <span className="sb-status-dot" />
            <span>LIVE</span>
          </div>

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

        {/* 2. Primary Action Button */}
        <div className="sb-action-container">
          <button className="sb-new-btn" onClick={handleNewChat} id="sb-btn-new-chat">
            <span className="sb-new-btn-left">
              <Plus size={15} />
              <span>New Session</span>
            </span>
            <span className="sb-shortcut-badge">⌘N</span>
          </button>
        </div>

        {/* 3. Main Scrollable Navigation Area */}
        <div className="sidebar-scroll-area">
          {/* AI Engines Section */}
          <div className="sb-section-label">
            <span>AI Engines</span>
            <span className="sb-count-badge">5</span>
          </div>

          <div className="sb-engine-list">
            {engines.map((eng) => {
              const isSelected = activeModule === eng.id && location.pathname === "/workspace";
              return (
                <button
                  key={eng.id}
                  className={`sb-engine-item ${isSelected ? "active" : ""}`}
                  onClick={() => handleSelectEngine(eng.id)}
                  id={`sb-engine-${eng.id}`}
                >
                  <div className="sb-engine-item-left">
                    {eng.icon}
                    <span>{eng.label}</span>
                  </div>
                  {isSelected && <span className="sb-active-indicator" />}
                </button>
              );
            })}
          </div>

          {/* Recent Threads for Active Engine */}
          <div className="sb-section-label" style={{ marginTop: "4px" }}>
            <span>{currentEngineConfig.label} History</span>
            <span className="sb-count-badge">{moduleConversations.length}</span>
          </div>

          <div className="sb-threads-list">
            {moduleConversations.length === 0 ? (
              <div className="sb-empty-threads">No session history yet</div>
            ) : (
              moduleConversations.slice(0, 15).map((conv) => {
                const isActive = activeConversationId === conv._id && location.pathname === "/workspace";
                return (
                  <div
                    key={conv._id}
                    className={`sb-thread-item ${isActive ? "active" : ""}`}
                    onClick={() => {
                      loadConversation(activeHistoryModule, conv._id);
                      setIsSidebarOpen(false);
                      if (location.pathname !== "/workspace") {
                        navigate("/workspace");
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        loadConversation(activeHistoryModule, conv._id);
                        setIsSidebarOpen(false);
                        if (location.pathname !== "/workspace") navigate("/workspace");
                      }
                    }}
                  >
                    <div className="sb-thread-left">
                      <span className="sb-thread-module-tag">{currentEngineConfig.tag}</span>
                      <span className="sb-thread-title" title={conv.title || "Untitled Session"}>
                        {conv.title || "Untitled Session"}
                      </span>
                    </div>
                    <button
                      className="sb-thread-delete"
                      onClick={(e) => handleDelete(e, activeHistoryModule, conv._id)}
                      title="Delete Session"
                      aria-label="Delete Session"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 4. Footer System Navigation & User Hub */}
        <div className="sb-footer">
          <div className="sb-section-label" style={{ padding: "0 4px 2px" }}>
            <span>System</span>
          </div>

          <nav className="sb-system-nav">
            {systemMenu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) => `sb-system-link ${isActive ? "active" : ""}`}
              >
                {item.icon}
                <span>{item.title}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Hub Card */}
          <div
            className="sb-user-card"
            onClick={(e) => {
              e.stopPropagation();
              setProfileModalOpen(true);
              setIsSidebarOpen(false);
            }}
            id="sb-profile-btn"
            role="button"
            tabIndex={0}
          >
            <div className="sb-user-left">
              <div className="sb-user-avatar" style={getAvatarStyle(user?.username)}>
                {user?.username?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="sb-user-meta">
                <span className="sb-user-name">{user?.username || "Developer"}</span>
                <span className="sb-user-plan">PRO OS</span>
              </div>
            </div>

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
          </div>

          <div className="sb-copyright-note">
            Managed by <strong>NexusAI Technologies</strong>
          </div>
        </div>
      </aside>

      {/* What's New Modal Popup */}
      {whatsNewOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setWhatsNewOpen(false)}
        >
          <div
            style={{
              background: "#111114",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "520px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                background: "#18181b",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>✨</span> NexusAI OS 2.0 Changelog
              </h3>
              <button
                type="button"
                onClick={() => setWhatsNewOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#a1a1aa",
                  cursor: "pointer",
                  fontSize: "18px",
                  padding: "4px",
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div
              style={{
                padding: "20px",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                }}
              >
                <h4 style={{ margin: "0 0 4px 0", color: "#ffffff", fontSize: "13px", fontWeight: "600" }}>
                  Autonomous Agent Self-Learning Loop
                </h4>
                <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px", lineHeight: "1.5" }}>
                  AI Coder and Debugger agents continuously analyze compilation diagnostics and persist execution lessons.
                </p>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                }}
              >
                <h4 style={{ margin: "0 0 4px 0", color: "#ffffff", fontSize: "13px", fontWeight: "600" }}>
                  Industrial Monochromatic Design System
                </h4>
                <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px", lineHeight: "1.5" }}>
                  Clean, distraction-free obsidian palette with high-contrast typography, micro-interactions, and modular navigation rail.
                </p>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                }}
              >
                <h4 style={{ margin: "0 0 4px 0", color: "#ffffff", fontSize: "13px", fontWeight: "600" }}>
                  Document RAG Ingestion Pipeline
                </h4>
                <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px", lineHeight: "1.5" }}>
                  Background vector embedding generation for uploaded technical specs, schemas, and API references.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "flex-end",
                background: "#18181b",
              }}
            >
              <button
                type="button"
                onClick={() => setWhatsNewOpen(false)}
                style={{
                  background: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  color: "#09090b",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;