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
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
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
    <>
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
                setWhatsNewOpen(true);
                setHasNewNotifications(false);
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

      {/* What's New Modal Popup */}
      {whatsNewOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }} onClick={() => setWhatsNewOpen(false)}>
          <div style={{
            background: "rgba(24, 24, 27, 0.75)",
            backdropFilter: "blur(16px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "520px",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.5)"
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
            }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>✨</span> What&apos;s New in NeuroForge
              </h3>
              <button 
                type="button" 
                onClick={() => setWhatsNewOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#a1a1aa",
                  cursor: "pointer",
                  fontSize: "20px",
                  padding: "4px"
                }}
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Feature 1 */}
              <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "10px",
                padding: "14px"
              }}>
                <h4 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "14px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🧠</span> Agent Brain (Self-Learning Loop)
                </h4>
                <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px", lineHeight: "1.5" }}>
                  Our AI Coder and Debugger agents now continuously analyze their compilation errors, write down "lessons learned", and apply them to all future builds to prevent bugs automatically.
                </p>
              </div>

              {/* Feature 2 */}
              <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "10px",
                padding: "14px"
              }}>
                <h4 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "14px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>📁</span> Contextual learnings
                </h4>
                <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px", lineHeight: "1.5" }}>
                  Access compiled debugging lessons directly from the completed output section of your projects using the new <strong>View Learnings</strong> action button.
                </p>
              </div>

              {/* Feature 3 */}
              <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "10px",
                padding: "14px"
              }}>
                <h4 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "14px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>📊</span> Full-Width Timeline Logs
                </h4>
                <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px", lineHeight: "1.5" }}>
                  Enjoy a clean, high-performance, full-width text timeline displaying execution steps of the multi-agent graph dynamically during runs.
                </p>
              </div>

              {/* Feature 4 */}
              <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "10px",
                padding: "14px"
              }}>
                <h4 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "14px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🔒</span> Windows SQLite Resilience
                </h4>
                <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px", lineHeight: "1.5" }}>
                  Fixed local vector storage panics on Windows running Python 3.13, ensuring zero crashes on startup or project initialization.
                </p>
              </div>

              {/* Upcoming Updates Section */}
              <div style={{ marginTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "16px" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#a78bfa", fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <span>🚀</span> Upcoming Updates
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "8px", padding: "10px 12px" }}>
                    <strong style={{ fontSize: "12px", color: "#e4e4e7", display: "block", marginBottom: "4px" }}>🤖 Multi-LLM Orchestration</strong>
                    <span style={{ fontSize: "11px", color: "#a1a1aa", lineHeight: "1.4" }}>Integrations for Claude 3.5 Sonnet & Gemini 1.5 Pro with model-specific task routing.</span>
                  </div>
                  <div style={{ background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "8px", padding: "10px 12px" }}>
                    <strong style={{ fontSize: "12px", color: "#e4e4e7", display: "block", marginBottom: "4px" }}>🔌 Dynamic MCP Server Registry</strong>
                    <span style={{ fontSize: "11px", color: "#a1a1aa", lineHeight: "1.4" }}>Connect local tools, databases, and filesystem access directly to the engineering agent.</span>
                  </div>
                  <div style={{ background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "8px", padding: "10px 12px" }}>
                    <strong style={{ fontSize: "12px", color: "#e4e4e7", display: "block", marginBottom: "4px" }}>🖥️ Monaco Code Editor & Web Sandbox</strong>
                    <span style={{ fontSize: "11px", color: "#a1a1aa", lineHeight: "1.4" }}>VS Code-style editor and interactive browser sandbox for instant hot-reload previews.</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{
              padding: "12px 20px",
              borderTop: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              justifyContent: "flex-end",
              background: "#121214"
            }}>
              <button 
                type="button" 
                onClick={() => setWhatsNewOpen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  color: "#ffffff",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;