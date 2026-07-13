import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import UnifiedWorkspace from "../components/workspace/UnifiedWorkspace";
import { useAuth } from "../contexts/AuthContext";
import "../styles/workspace.css";

/**
 * WorkspacePage
 *
 * Single main workspace page wrapper.
 * Renders the single root DashboardLayout and holds UnifiedWorkspace content.
 * Routed to /workspace.
 *
 * Includes a premium OS environment welcome loading screen on first redirect from login.
 */
function WorkspacePage() {
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(() => sessionStorage.getItem("show_login_welcome") === "true");
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [wasWelcome] = useState(showWelcome);

  useEffect(() => {
    if (showWelcome) {
      sessionStorage.removeItem("show_login_welcome");
      
      // Increment progress bar to simulate environment boot (2s duration)
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsExiting(true);
            setTimeout(() => setShowWelcome(false), 600);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [showWelcome]);

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      {showWelcome && (
        <div className={`os-welcome-overlay ${isExiting ? "exiting" : ""}`}>
          <div className="os-welcome-content">
            <div className="os-welcome-logo">
              <svg
                width="72"
                height="72"
                viewBox="0 0 100 100"
                style={{
                  color: "#ffffff",
                  filter: "drop-shadow(0 0 12px rgba(255, 255, 255, 0.3))"
                }}
              >
                {/* Brand Nodes & Branches */}
                <line x1="50" y1="30" x2="50" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="50" cy="15" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <line x1="41.3" y1="35" x2="36.3" y2="26.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="34" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <line x1="58.7" y1="35" x2="63.7" y2="26.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="66" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <line x1="32.7" y1="45" x2="22" y2="45" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="18" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <line x1="32.7" y1="55" x2="22" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="18" cy="55" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <line x1="67.3" y1="45" x2="78" y2="45" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="82" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <line x1="67.3" y1="55" x2="78" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="82" cy="55" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <line x1="41.3" y1="65" x2="36.3" y2="73.7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="34" cy="77.7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <line x1="58.7" y1="65" x2="63.7" y2="73.7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="66" cy="77.7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <line x1="50" y1="70" x2="50" y2="82" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="50" cy="85" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

                {/* Central Broken Hexagon */}
                <path d="M 50 30 L 67.3 40 L 67.3 60 L 50 70" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 45 32.5 L 32.7 40 L 32.7 60 L 45 67.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Floating Square dots */}
                <rect x="16" y="29" width="4" height="4" fill="currentColor" />
                <rect x="80" y="67" width="4" height="4" fill="currentColor" />

                {/* Core Text 'NFT' */}
                <text x="50" y="56" fontFamily="system-ui, sans-serif" fontSize="16" fontWeight="bold" fill="currentColor" textAnchor="middle" letterSpacing="0.2">NFT</text>
              </svg>
            </div>
            <h2 className="os-welcome-title">NexusAI OS</h2>
            <p className="os-welcome-subtitle">
              Initializing secure workspace for <span className="os-welcome-user">{user?.username || "Developer"}</span>...
            </p>
            <div className="os-progress-container">
              <div className="os-progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        </div>
      )}

      <DashboardLayout>
        <div 
          className={wasWelcome && isExiting ? "workspace-enter-active" : ""}
          style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          <UnifiedWorkspace />
        </div>
      </DashboardLayout>
    </div>
  );
}

export default WorkspacePage;
