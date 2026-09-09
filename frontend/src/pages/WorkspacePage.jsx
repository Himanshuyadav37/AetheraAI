import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, Cpu, Terminal, CheckCircle2 } from "lucide-react";
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
 * Includes a Silicon Valley enterprise OS environment initialization screen on first redirect from login.
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
      
      // Increment progress bar to simulate environment boot (1.8s duration)
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsExiting(true);
            setTimeout(() => setShowWelcome(false), 500);
            return 100;
          }
          return prev + 5;
        });
      }, 75);
      return () => clearInterval(interval);
    }
  }, [showWelcome]);

  const getBootStatusText = () => {
    if (progress < 25) return "Connecting to NexusAI Enterprise Neural Mesh...";
    if (progress < 50) return "Mounting Vector Memory & RAG Knowledge Bases...";
    if (progress < 75) return "Securing Isolated Code Execution Sandboxes...";
    if (progress < 100) return "Establishing End-to-End Encrypted Session...";
    return `Workspace Ready. Welcome, ${user?.username || user?.email?.split("@")[0] || "Developer"}!`;
  };

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      {showWelcome && (
        <div className={`os-welcome-overlay ${isExiting ? "exiting" : ""}`}>
          <div className="os-welcome-content">
            <div className="os-welcome-badge">
              <Sparkles size={13} />
              <span>NEXUSAI OS v2.5 ENTERPRISE</span>
            </div>

            <div className="os-welcome-logo-box">
              <Cpu size={36} className="os-welcome-pulse-icon" />
            </div>

            <h2 className="os-welcome-title">NexusAI OS</h2>

            <div className="os-welcome-dynamic-status">
              <span className="os-status-spinner"></span>
              <p className="os-welcome-subtitle">
                {getBootStatusText()}
              </p>
            </div>

            <div className="os-progress-container">
              <div className="os-progress-bar" style={{ width: `${progress}%` }}></div>
            </div>

            <div className="os-welcome-meta-footer">
              <div className="os-meta-item">
                <ShieldCheck size={12} />
                <span>Encrypted Session</span>
              </div>
              <div className="os-meta-item">
                <Terminal size={12} />
                <span>Sandbox Verified</span>
              </div>
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
