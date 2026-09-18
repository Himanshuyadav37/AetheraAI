import { useState, useEffect } from "react";
import { useLocation, NavLink, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useAuth } from "../contexts/AuthContext";
import ProfileModal from "../components/workspace/ProfileModal";
import CommandPalette from "../components/CommandPalette";
import { Menu, Bot, FolderGit2, Users, User, Sliders, Search, X } from "lucide-react";
import { getAvatarStyle } from "../utils/avatarHelper";

import "./DashboardLayout.css";

function DashboardLayout({ children }) {
  const { isSidebarOpen, setIsSidebarOpen, profileModalOpen, setProfileModalOpen } = useWorkspace();
  const { user } = useAuth();
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isWorkspace = location.pathname === "/workspace";

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="layout">
      {isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}
      <Sidebar onOpenCommandPalette={() => setCmdPaletteOpen(true)} />

      <div className="main-area">
        <header className="mobile-header-bar">
          <button 
            type="button" 
            className="mobile-sidebar-toggle-btn" 
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar menu"
          >
            <Menu size={22} />
          </button>
          
          <div className="mobile-header-brand" onClick={() => navigate("/workspace")}>
            <img 
              src="/aethera-logo.svg" 
              alt="Aethera AI" 
              className="mobile-header-logo"
            />
            <span className="mobile-header-title">Aethera</span>
          </div>

          <div className="mobile-header-actions">
            <button
              type="button"
              className="mobile-header-action-btn"
              onClick={() => setCmdPaletteOpen(true)}
              aria-label="Spotlight search"
            >
              <Search size={18} />
            </button>
            <button
              type="button"
              className="mobile-header-avatar-btn"
              onClick={() => setProfileModalOpen(true)}
              aria-label="Open settings"
            >
              <div
                className="mobile-avatar-circle"
                style={{
                  background: user ? getAvatarStyle(user.username || user.email) : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                }}
              >
                {user?.username ? user.username.charAt(0).toUpperCase() : <User size={13} />}
              </div>
            </button>
          </div>
        </header>

        <main className={isWorkspace ? "content workspace-content" : "content"}>
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
          <NavLink
            to="/workspace"
            className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}
          >
            <Bot size={20} />
            <span>AI Workspace</span>
          </NavLink>

          <NavLink
            to="/projects"
            className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}
          >
            <FolderGit2 size={20} />
            <span>Projects</span>
          </NavLink>

          <NavLink
            to="/agent-studio"
            className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}
          >
            <Sliders size={20} />
            <span>Studio</span>
          </NavLink>

          <NavLink
            to="/teams"
            className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}
          >
            <Users size={20} />
            <span>Teams</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}
          >
            <User size={20} />
            <span>Profile</span>
          </NavLink>
        </nav>
      </div>

      {/* Spotlight Command Palette (Cmd + K) */}
      <CommandPalette isOpen={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />

      {/* Preferences Settings Modal overlay at root layout level */}
      <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  );
}

export default DashboardLayout;