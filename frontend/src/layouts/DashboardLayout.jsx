import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useWorkspace } from "../contexts/WorkspaceContext";
import ProfileModal from "../components/workspace/ProfileModal";
import { Menu } from "lucide-react";

import "./DashboardLayout.css";

function DashboardLayout({ children }) {
  const { isSidebarOpen, setIsSidebarOpen, profileModalOpen, setProfileModalOpen } = useWorkspace();
  const location = useLocation();
  const isWorkspace = location.pathname === "/workspace";

  return (
    <div className="layout">
      {isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.6)",
            zIndex: 1050,
            backdropFilter: "blur(4px)",
            animation: "fadeIn 0.2s ease"
          }}
        />
      )}
      <Sidebar />

      <div className="main-area">
        <div className="mobile-header-bar">
          <button 
            type="button" 
            className="mobile-sidebar-toggle-btn" 
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="mobile-header-logo-title">
            <span style={{ fontWeight: 700, color: "#fff", fontSize: 16 }}>NexusAI</span>
          </div>
          <div style={{ width: 32 }} /> {/* Empty spacer to balance layout */}
        </div>

        <main className={isWorkspace ? "content workspace-content" : "content"}>
          {children}
        </main>
      </div>

      {/* Preferences Settings Modal overlay at root layout level */}
      <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  );
}

export default DashboardLayout;