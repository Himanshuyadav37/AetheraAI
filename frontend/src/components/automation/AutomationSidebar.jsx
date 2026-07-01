import { Plus, Trash2, Workflow } from "lucide-react";
import { deleteAutomationConversation } from "../../services/AutomationApi";

function AutomationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDeleted,
}) {
  async function handleDelete(e, id) {
    e.stopPropagation();
    try {
      await deleteAutomationConversation(id);
      onDeleted(id);
    } catch {
      // silently ignore
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  return (
    <aside className="auto-sidebar">
      <div className="auto-sidebar-header">
        <h3>Automations</h3>
        <button className="auto-new-btn" onClick={onNew} id="btn-new-automation">
          <Plus size={14} />
          New
        </button>
      </div>

      <div className="auto-sidebar-list">
        {conversations.length === 0 && (
          <div className="auto-sidebar-empty">
            No automations yet.<br />Describe your first workflow!
          </div>
        )}

        {conversations.map((conv) => (
          <div
            key={conv._id}
            className={`auto-conv-item ${activeId === conv._id ? "active" : ""}`}
            onClick={() => onSelect(conv._id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelect(conv._id)}
          >
            <div className="auto-conv-icon">
              <Workflow size={16} />
            </div>
            <div className="auto-conv-info">
              <div className="auto-conv-title">{conv.title || "Automation"}</div>
              <div className="auto-conv-date">{formatDate(conv.updated_at)}</div>
            </div>
            <button
              className="auto-conv-delete"
              onClick={(e) => handleDelete(e, conv._id)}
              title="Delete"
              aria-label="Delete automation"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default AutomationSidebar;
