import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import MarkdownRenderer from "../components/education/MarkdownRenderer";
import "./PublicAgentChat.css";


export default function PublicAgentChat() {
  const { agentId } = useParams();
  const [agent, setAgent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(true);
  const bottomRef = useRef(null);

  // Load public agent metadata
  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await api.get(`/api/custom-agents/public/${agentId}`);
        const data = res.data;
        setAgent(data);
        setMessages([
          {
            role: "assistant",
            content: data.embed_theme?.greeting || `Hello! I am ${data.name}. How can I help you today?`
          }
        ]);
      } catch {
        setNotFound(true);
      } finally {
        setAgentLoading(false);
      }
    }
    fetchAgent();
  }, [agentId]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post(`/api/custom-agents/public/${agentId}/chat`, {
        prompt: text,
        history: newMessages.slice(-8)
      });
      setMessages([...newMessages, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      const errMsg = err?.response?.data?.detail || "Failed to get a response. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: `⚠️ ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  }

  // ── Loading State ──────────────────────────────────
  if (agentLoading) {
    return (
      <div className="pac-fullscreen">
        <div className="pac-loader">
          <div className="pac-spinner" />
          <p>Loading agent...</p>
        </div>
      </div>
    );
  }

  // ── Not Found State ─────────────────────────────────
  if (notFound) {
    return (
      <div className="pac-fullscreen">
        <div className="pac-not-found">
          <span className="pac-nf-icon">🤖</span>
          <h2>Agent Not Found</h2>
          <p>This agent may have been removed or is not publicly available.</p>
        </div>
      </div>
    );
  }

  // ── Main Chat UI ────────────────────────────────────
  return (
    <div className="pac-fullscreen">
      {/* Header */}
      <div className="pac-header">
        <div className="pac-header-inner">
          <span className="pac-avatar">{agent?.avatar || "🤖"}</span>
          <div>
            <h1 className="pac-name">{agent?.name}</h1>
            {agent?.description && (
              <p className="pac-desc">{agent.description}</p>
            )}
          </div>
          <div className="pac-badge">AI Agent</div>
        </div>
      </div>

      {/* Messages */}
      <div className="pac-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`pac-msg pac-msg-${msg.role}`}>
            {msg.role === "assistant" && (
              <span className="pac-msg-avatar">{agent?.avatar || "🤖"}</span>
            )}
            <div className="pac-msg-bubble">
              {msg.role === "assistant" ? (
                <MarkdownRenderer>{msg.content}</MarkdownRenderer>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="pac-msg pac-msg-assistant">
            <span className="pac-msg-avatar">{agent?.avatar || "🤖"}</span>
            <div className="pac-msg-bubble pac-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pac-input-area">
        <form className="pac-input-form" onSubmit={handleSend}>
          <input
            className="pac-input"
            type="text"
            placeholder={`Message ${agent?.name || "AI Agent"}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button
            className="pac-send-btn"
            type="submit"
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <svg className="pac-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
        <p className="pac-powered">Powered by <strong>NexusAI</strong></p>
      </div>
    </div>
  );
}
