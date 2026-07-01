import { useEffect, useState, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  FolderGit2,
  History,
  LogOut,
  Plus,
  Trash2,
  LayoutDashboard,
  Bot,
  Brain,
  GraduationCap,
  Zap,
  X,
  Shield,
  Bell,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import api from "../services/api";
import logo from "./logo.png";
import "../styles/workspace.css";
import Dashboard from "../pages/Dashboard";
import { getAvatarStyle } from "../utils/avatarHelper";

function Sidebar() {
  const { user, logout } = useAuth();
  const {
    activeModule,
    moduleState,
    newChat,
    loadConversation,
    refreshHistory,
    isSidebarOpen,
    setIsSidebarOpen,
    profileModalOpen,
    setProfileModalOpen,
  } = useWorkspace();

  const navigate = useNavigate();
  const location = useLocation();

  // Notification states
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const notificationRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleNotifications = () => {
    setShowNotifications(!showNotifications);
    setHasNewNotifications(false);
  };

  async function handleDelete(e, module, id) {
    e.stopPropagation();
    try {
      if (module === "automation") {
        await api.delete(`/conversations/${id}?agent_type=automation`);
      } else {
        await api.delete(`/conversations/${id}`);
      }
      refreshHistory(module);
      // If we deleted the active conversation, reset it
      if (moduleState[module].activeId === id) {
        newChat(module);
      }
    } catch (err) {
      console.error("Delete conversation failed", err);
    }
  }

  function handleNewChat() {
    newChat();
    setIsSidebarOpen(false);
    navigate("/workspace");
  }

  const handleLogout = () => {
    logout();
    setIsSidebarOpen(false);
    navigate("/login");
  };

  // Sidebar navigation menu - Dashboard instead of Workspace
  const menu = [
    {
      title: "Projects",
      icon: <FolderGit2 size={16} />,
      path: "/projects",
    },
    {
      title: "Research",
      icon: <Brain size={16} />,
      path: "/research",
    },
    {
      title: "Education",
      icon: <GraduationCap size={16} />,
      path: "/education",
    },
    {
      title: "Automation",
      icon: <Zap size={16} />,
      path: "/automation",
    },
    {
      title: "Executions",
      icon: <History size={16} />,
      path: "/executions",
    },
  ];

  const ADMIN_EMAILS = ["ydvhimanshu461@gmail.com", "admin.neuroforge@gmail.com", "admin@neuroforge.com", "admin@devpilot.ai"];
  if (user && ADMIN_EMAILS.includes(user.email)) {
    menu.push({
      title: "Admin Panel",
      icon: <Shield size={16} style={{ color: "#a78bfa" }} />,
      path: "/admin",
    });
  }

  // Get active module history dynamically
  const activeHistoryModule = activeModule || "conversational";
  const moduleConversations = moduleState[activeHistoryModule]?.conversations || [];
  const activeConversationId = moduleState[activeHistoryModule]?.activeId;

  // Select label and icon based on module
  let historyLabel = "Conversational AI";
  let HistoryIcon = Bot;
  if (activeHistoryModule === "education") {
    historyLabel = "Education AI";
    HistoryIcon = GraduationCap;
  } else if (activeHistoryModule === "research") {
    historyLabel = "Research AI";
    HistoryIcon = Brain;
  } else if (activeHistoryModule === "automation") {
    historyLabel = "Automation AI";
    HistoryIcon = Zap;
  }

  return (
    <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
      {/* Logo Header */}
      <div className="sb-logo-container" style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", width: "100%", padding: "16px 18px 4px" }}>
        {/* Logo Icon Only (Left-aligned, spaced from top and left, no text, no border lines) */}
        <div className="sb-logo" style={{ cursor: "pointer", display: "flex", justifyContent: "flex-start" }} onClick={() => { navigate("/workspace"); setIsSidebarOpen(false); }} id="sb-logo-nav">
          <svg
            width="30"
            height="30"
            viewBox="0 0 100 100"
            className="sb-logo-svg"
            style={{
              color: "#ffffff",
              filter: "drop-shadow(0 0 10px rgba(255, 255, 255, 0.25))"
            }}
          >
            {/* Outer Nodes & Branches */}
            {/* Top middle */}
            <line x1="50" y1="30" x2="50" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="50" cy="15" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Top left */}
            <line x1="41.3" y1="35" x2="36.3" y2="26.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="34" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Top right */}
            <line x1="58.7" y1="35" x2="63.7" y2="26.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="66" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Left top */}
            <line x1="32.7" y1="45" x2="22" y2="45" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Left bottom */}
            <line x1="32.7" y1="55" x2="22" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="55" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Right top */}
            <line x1="67.3" y1="45" x2="78" y2="45" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="82" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Right bottom */}
            <line x1="67.3" y1="55" x2="78" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="82" cy="55" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Bottom left */}
            <line x1="41.3" y1="65" x2="36.3" y2="73.7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="34" cy="77.7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Bottom right */}
            <line x1="58.7" y1="65" x2="63.7" y2="73.7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="66" cy="77.7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Bottom middle */}
            <line x1="50" y1="70" x2="50" y2="82" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="50" cy="85" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

            {/* Central Broken Hexagon */}
            {/* Right-side path */}
            <path d="M 50 30 L 67.3 40 L 67.3 60 L 50 70" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Left-side path with gaps */}
            <path d="M 45 32.5 L 32.7 40 L 32.7 60 L 45 67.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Floating Square dots */}
            <rect x="16" y="29" width="4" height="4" fill="currentColor" />
            <rect x="80" y="67" width="4" height="4" fill="currentColor" />

            {/* Core Text 'NFT' */}
            <text x="50" y="56" fontFamily="system-ui, sans-serif" fontSize="16" fontWeight="bold" fill="currentColor" textAnchor="middle" letterSpacing="0.2">NFT</text>
          </svg>
        </div>

        {/* Mobile Close Button (only shows when sidebar open in mobile drawer) */}
        {isSidebarOpen && (
          <button
            className="sb-mobile-close-btn"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close menu"
            style={{ position: "absolute", right: "14px", top: "20px" }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <button className="sb-new-chat" onClick={handleNewChat} id="sb-btn-new-chat">
        <Plus size={16} />
        New Chat
      </button>

      {/* Top scrollable history - Dynamic based on active workspace module */}
      <div className="sb-history">
        <div className="sb-group">
          <div className="sb-group-label" style={{ color: "#ffffff", fontWeight: "700" }}>
            <HistoryIcon size={13} style={{ marginRight: 2 }} />
            <span>{historyLabel}</span>
          </div>

          <div className="sb-group-items">
            {moduleConversations.length === 0 ? (
              <div className="sb-empty-module">No history</div>
            ) : (
              moduleConversations.slice(0, 20).map((conv) => {
                const isActive = activeConversationId === conv._id;
                return (
                  <div
                    key={conv._id}
                    className={`sb-conv-item ${isActive ? "active" : ""}`}
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
                    <span className="sb-conv-title" title={conv.title || "Untitled Chat"}>
                      {conv.title || "Untitled Chat"}
                    </span>
                    <button
                      className="sb-conv-delete"
                      onClick={(e) => handleDelete(e, activeHistoryModule, conv._id)}
                      title="Delete Chat"
                      aria-label="Delete Chat"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom section containing menu links */}
      <div className="sb-bottom">
        {/* Workspace Menu List */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) => `sb-nav-item ${isActive ? "active" : ""}`}
            >
              {item.icon}
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>

        {/* Powered By NFT Footer */}
        <div style={{
          textAlign: "center",
          padding: "10px 0 2px",
          fontSize: "10px",
          color: "rgba(255, 255, 255, 0.25)",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          marginTop: "12px",
          letterSpacing: "0.3px"
        }}>
          Managed by <strong style={{ color: "rgba(255, 255, 255, 0.45)" }}>NeuroForge Technologies (NFT)</strong>
        </div>

        {/* User Card - Clicking it opens settings profile modal */}
        <div className="sb-user-row" onClick={(e) => { e.stopPropagation(); setProfileModalOpen(true); setIsSidebarOpen(false); }} id="sb-profile-btn" style={{ cursor: "pointer", position: "relative" }}>
          <div className="sb-avatar" style={getAvatarStyle(user?.username)}>{user?.username?.[0]?.toUpperCase() || "U"}</div>
          <span className="sb-username">{user?.username || "User"}</span>
          
          {/* Notifications Bell Icon in User Row */}
          <div className="sb-notification-wrapper" style={{ position: "static" }} ref={notificationRef}>
            <button
              type="button"
              className="sb-logout-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleNotifications();
              }}
              title="Notifications"
              aria-label="Notifications"
              style={{ marginRight: "4px" }}
            >
              <Bell size={14} />
              {hasNewNotifications && (
                <span style={{ 
                  position: "absolute", 
                  top: "2px", 
                  right: "2px", 
                  width: "6px", 
                  height: "6px", 
                  background: "#ffffff", 
                  borderRadius: "50%", 
                  boxShadow: "0 0 6px rgba(255, 255, 255, 0.8)" 
                }} />
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: "absolute",
                bottom: "54px",
                left: "8px",
                right: "8px",
                background: "#1e1e1e",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "10px",
                zIndex: 1001,
                padding: "10px",
                boxShadow: "0 -10px 30px rgba(0,0,0,0.5)",
                color: "#ffffff"
              }}>
                <div style={{ paddingBottom: "6px", fontSize: "13px", color: "#a1a1aa", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", marginBottom: "8px", fontWeight: "600" }}>
                  Notifications
                </div>
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  fontSize: "12px",
                  lineHeight: "1.5"
                }}>
                  <span style={{ color: "#ffffff", fontWeight: "bold", display: "block", marginBottom: "5px" }}>
                    🚀 Incoming Update
                  </span>
                  A complete RAG (Retrieval-Augmented Generation) implementation is coming soon!
                </div>
              </div>
            )}
          </div>

          <button
            className="sb-logout-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;