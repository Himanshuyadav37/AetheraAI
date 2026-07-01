import { useEffect, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import api from "../../services/api";

function ResearchHistory({ onSelect }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadSessions() {
    try {
      const response = await api.get("/research/sessions");
      setSessions(response.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSession(id, event) {
    event.stopPropagation();
    try {
      await api.delete(`/research/sessions/${id}`);
      setSessions(prev => prev.filter(session => session._id !== id));
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  if (loading) {
    return <div className="output-card">Loading research history...</div>;
  }

  return (
    <div className="output-card">
      <h2>Research History</h2>
      <div className="research-history-list">
        {sessions.length === 0 && <p className="timeline-empty">No research sessions yet.</p>}
        {sessions.map(session => (
          <button
            key={session._id}
            className="research-history-item"
            onClick={() => onSelect?.(session)}
          >
            <FileText size={18} />
            <span>{session.title || "Untitled Research"}</span>
            <small>{session.updated_at ? new Date(session.updated_at).toLocaleDateString() : ""}</small>
            <span
              className="research-delete-btn"
              role="button"
              tabIndex={0}
              onClick={event => deleteSession(session._id, event)}
              onKeyDown={event => {
                if (event.key === "Enter") deleteSession(session._id, event);
              }}
            >
              <Trash2 size={15} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ResearchHistory;