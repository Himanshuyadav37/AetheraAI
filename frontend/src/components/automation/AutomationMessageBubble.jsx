import AutomationPanel from "./AutomationPanel";

/**
 * AutomationMessageBubble
 *
 * Renders a single message in the automation chat:
 *  - role="user"      → purple bubble (right-aligned)
 *  - role="assistant" → full AutomationPanel (left-aligned)
 *  - role="loading"   → animated loading dots
 */
function AutomationMessageBubble({ message }) {
  const { role, content, result } = message;

  if (role === "user") {
    return (
      <div className="auto-message user">
        <div className="auto-msg-avatar user-av">U</div>
        <div className="auto-msg-body">
          <div className="auto-user-bubble">{content}</div>
        </div>
      </div>
    );
  }

  if (role === "loading") {
    return (
      <div className="auto-loading-bubble">
        <div className="auto-msg-avatar ai-av" style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>⚡</div>
        <div className="auto-loading-content">
          <div className="auto-dots">
            <span /><span /><span />
          </div>
          Analyzing automation request…
        </div>
      </div>
    );
  }

  // assistant message with a result object
  if (role === "assistant" && result) {
    return (
      <div className="auto-message">
        <div className="auto-msg-avatar ai-av">⚡</div>
        <div className="auto-msg-body" style={{ flex: 1, minWidth: 0 }}>
          <AutomationPanel result={result} />
        </div>
      </div>
    );
  }

  // assistant text-only fallback (error states, etc.)
  return (
    <div className="auto-message">
      <div className="auto-msg-avatar ai-av">⚡</div>
      <div className="auto-msg-body">
        <div style={{
          background: "#1a1a1a",
          border: "1px solid #252525",
          borderRadius: 16,
          padding: "16px 20px",
          color: "#e5e5e5",
          fontSize: 14,
          lineHeight: 1.7,
        }}>
          {content}
        </div>
      </div>
    </div>
  );
}

export default AutomationMessageBubble;
