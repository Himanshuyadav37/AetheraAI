import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Zap } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { listAutomationConversations, deleteAutomationConversation } from "../services/AutomationApi";
import "./Projects.css";

function AutomationHistoryPage() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { loadConversation, activeModule, switchModule } = useWorkspace();

  async function loadWorkflows() {
    try {
      setLoading(true);
      const res = await listAutomationConversations();
      setWorkflows(res || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load automation blueprints");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeModule !== "automation") {
      switchModule("automation");
    }
    loadWorkflows();
  }, [activeModule, switchModule]);

  async function handleDelete(id) {
    const confirmDelete = window.confirm("Are you sure you want to delete this automation blueprint?");
    if (!confirmDelete) return;

    try {
      await deleteAutomationConversation(id);
      setWorkflows((prev) => prev.filter((w) => w._id !== id));
    } catch {
      alert("Failed to delete blueprint.");
    }
  }

  return (
    <DashboardLayout>
      <div className="projects-page">
        <div className="page-header">
          <h1>Automation AI History</h1>
          <p>Browse all past generated workflow automations and blueprints</p>
        </div>

        {loading ? (
          <div className="page-state">Loading Automations...</div>
        ) : error ? (
          <div className="page-state error">{error}</div>
        ) : workflows.length === 0 ? (
          <div className="page-state">
            No automations found. <Link to="/workspace" style={{ color: "#8b5cf6", textDecoration: "underline" }}>Start a new one</Link>
          </div>
        ) : (
          <div className="projects-grid">
            {workflows.map((wf) => (
              <div key={wf._id} className="project-card">
                <button
                  className="delete-project-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(wf._id);
                  }}
                  title="Delete Blueprint"
                >
                  <Trash2 size={16} />
                </button>

                <div
                  className="project-card-link"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    loadConversation("automation", wf._id);
                    navigate("/workspace");
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Zap size={16} style={{ color: "#a3a3a3" }} />
                    <span style={{ fontSize: 12, color: "#a3a3a3", textTransform: "uppercase", fontWeight: "600" }}>Automation Blueprint</span>
                  </div>
                  <h3>{wf.title || "Untitled Automation"}</h3>
                  <small style={{ display: "block", marginTop: 8 }}>
                    {wf.updated_at ? new Date(wf.updated_at).toLocaleString() : ""}
                  </small>
                </div>

                <button
                  className="continue-link"
                  onClick={() => {
                    loadConversation("automation", wf._id);
                    navigate("/workspace");
                  }}
                >
                  Open in Workspace →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AutomationHistoryPage;
