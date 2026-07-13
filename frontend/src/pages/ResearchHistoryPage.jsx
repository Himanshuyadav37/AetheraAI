import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, MessageSquare, Brain } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useWorkspace } from "../contexts/WorkspaceContext";
import api from "../services/api";
import "./Projects.css";

function ResearchHistoryPage() {
  const navigate = useNavigate();
  const { loadConversation } = useWorkspace();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSessions() {
    try {
      setLoading(true);
      const res = await api.get("/research/sessions");
      setSessions(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load research history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function handleDelete(id) {
    const confirmDelete = window.confirm("Are you sure you want to delete this research session?");
    if (!confirmDelete) return;

    try {
      await api.delete(`/research/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s._id !== id));
    } catch {
      alert("Failed to delete session.");
    }
  }

  return (
    <DashboardLayout>
      <div className="projects-page">
        <div className="page-header">
          <h1>Research AI History</h1>
          <p>Browse all past research sessions and competitor analyses</p>
        </div>

        {loading ? (
          <div className="page-state">Loading Research Sessions...</div>
        ) : error ? (
          <div className="page-state error">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="page-state">
            No research sessions found. <Link to="/workspace" style={{ color: "#8b5cf6", textDecoration: "underline" }}>Start a new one</Link>
          </div>
        ) : (
          <div className="projects-grid">
            {sessions.map((session) => (
              <div key={session._id} className="project-card">
                <button
                  className="delete-project-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(session._id);
                  }}
                  title="Delete Session"
                >
                  <Trash2 size={16} />
                </button>

                <div
                  className="project-card-link"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    loadConversation("research", session._id);
                    navigate("/workspace");
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Brain size={16} style={{ color: "#a3a3a3" }} />
                    <span style={{ fontSize: 12, color: "#a3a3a3", textTransform: "uppercase", fontWeight: "600" }}>Research Session</span>
                  </div>
                  <h3>{session.title || "Untitled Research"}</h3>
                  <small style={{ display: "block", marginTop: 8 }}>
                    {session.updated_at ? new Date(session.updated_at).toLocaleString() : ""}
                  </small>
                </div>

                <button
                  className="continue-link"
                  onClick={() => {
                    loadConversation("research", session._id);
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

export default ResearchHistoryPage;
