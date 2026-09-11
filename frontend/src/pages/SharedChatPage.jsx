import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { Globe, ArrowRight, Share2, Copy, Check, MessageSquare, Sparkles, Terminal, Code2, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import api, { getBaseURL } from "../services/api";
import MarkdownRenderer from "../components/education/MarkdownRenderer";
import AgentLiveTimeline from "../components/workspace/AgentLiveTimeline";
import LiveWebPreview from "../components/LiveWebPreview";
import "../styles/workspace.css";

const MODULE_CONFIG = {
  engineer: { name: "Autonomous Engineer", icon: "🚀", tag: "Code & Software", color: "#ffffff" },
  conversational: { name: "Conversational AI", icon: "💬", tag: "General Intelligence", color: "#ffffff" },
  research: { name: "Deep Research", icon: "🔬", tag: "Synthesis & Reports", color: "#ffffff" },
  education: { name: "Interactive Tutor", icon: "🎓", tag: "Learning & Code Walkthrough", color: "#ffffff" },
  automation: { name: "Workflow Automation", icon: "⚡", tag: "Pipelines & Tools", color: "#ffffff" },
};

export default function SharedChatPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const module = searchParams.get("module") || "engineer";

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);

  useEffect(() => {
    if (!id) return;

    async function fetchSharedConversation() {
      try {
        setLoading(true);
        setError("");

        let convData = null;
        if (module === "automation") {
          const res = await api.get(`/automation/conversations/${id}`);
          convData = res.data;
        } else if (module === "research") {
          const res = await api.get(`/research/sessions/${id}`);
          convData = res.data;
        } else {
          const res = await api.get(`/conversations/${id}`);
          convData = res.data;
        }

        if (!convData) {
          setError("Conversation not found or has been removed.");
          return;
        }

        setConversation(convData);
        const parsedMsgs = (convData.messages || []).map((m, i) => ({
          id: `${id}-${i}`,
          role: m.role,
          content: m.content,
          result: m.result || (m.role === "assistant" && convData.generated_code ? convData : null),
          attachments: m.attachments || null,
        }));
        setMessages(parsedMsgs);

        // Check if there is an engineer project result
        const lastWithResult = [...parsedMsgs].reverse().find((m) => m.result?.generated_code || m.result?.fixed_code);
        if (lastWithResult?.result) {
          setPreviewResult(lastWithResult.result);
        }
      } catch (err) {
        console.error("Failed to load shared chat:", err);
        setError(err.response?.data?.detail || err.message || "Failed to load shared conversation.");
      } finally {
        setLoading(false);
      }
    }

    fetchSharedConversation();
  }, [id, module]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenInWorkspace = () => {
    navigate(`/workspace?module=${module}&chatId=${id}`);
  };

  const currentConfig = MODULE_CONFIG[module] || MODULE_CONFIG.conversational;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#f4f4f5",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          height: "56px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(14, 14, 17, 0.8)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            to="/workspace"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textDecoration: "none",
              color: "#ffffff",
              fontWeight: "700",
              fontSize: "15px",
              letterSpacing: "-0.02em",
            }}
          >
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "6px",
                background: "#ffffff",
                color: "#09090b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "13px",
              }}
            >
              N
            </div>
            <span>NexusAI</span>
          </Link>

          <span style={{ color: "#3f3f46" }}>/</span>

          <span
            style={{
              fontSize: "11.5px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#a1a1aa",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>{currentConfig.icon}</span>
            <span>{currentConfig.name}</span>
          </span>

          <span
            style={{
              fontSize: "11px",
              color: "#71717a",
              background: "rgba(255, 255, 255, 0.03)",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            Public Shared View
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#f4f4f5",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            {copied ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
            <span>{copied ? "Link Copied!" : "Copy Link"}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenInWorkspace}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              background: "#ffffff",
              color: "#09090b",
              fontSize: "12px",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(255, 255, 255, 0.1)",
            }}
          >
            <span>Open in Workspace</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, maxWidth: "880px", width: "100%", margin: "0 auto", padding: "24px 20px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#a1a1aa" }}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>⚡</div>
            <p style={{ fontSize: "14px" }}>Loading shared conversation...</p>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "24px",
              background: "rgba(239, 68, 68, 0.05)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "12px",
              textAlign: "center",
              color: "#fca5a5",
            }}
          >
            <p style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 8px 0" }}>⚠️ Error</p>
            <p style={{ fontSize: "13px", color: "#a1a1aa", margin: "0 0 16px 0" }}>{error}</p>
            <Link
              to="/workspace"
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: "#ffffff",
                color: "#09090b",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "600",
                fontSize: "12px",
              }}
            >
              Go to Workspace
            </Link>
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Conversation Header */}
            <div
              style={{
                paddingBottom: "16px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#ffffff", letterSpacing: "-0.01em" }}>
                {conversation?.title || "Shared NexusAI Conversation"}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#71717a" }}>
                <span>{messages.length} messages</span>
                <span>•</span>
                <span>{currentConfig.name}</span>
                {conversation?.created_at && (
                  <>
                    <span>•</span>
                    <span>{new Date(conversation.created_at).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>

            {/* Messages Thread */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    padding: "16px",
                    borderRadius: "10px",
                    background: msg.role === "user" ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "4px",
                          background: msg.role === "user" ? "rgba(255, 255, 255, 0.08)" : "#ffffff",
                          color: msg.role === "user" ? "#ffffff" : "#09090b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          fontWeight: "700",
                        }}
                      >
                        {msg.role === "user" ? "U" : "AI"}
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#d4d4d8" }}>
                        {msg.role === "user" ? "User Prompt" : "NexusAI Response"}
                      </span>
                    </div>
                  </div>

                  {msg.result?.execution_steps && msg.result.execution_steps.length > 0 && (
                    <div style={{ margin: "6px 0" }}>
                      <AgentLiveTimeline steps={msg.result.execution_steps} loading={false} />
                    </div>
                  )}

                  <div className="ws-markdown" style={{ fontSize: "13.5px", lineHeight: "1.6", color: "#e4e4e7" }}>
                    <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Web Preview Action for Engineer Projects */}
            {previewResult && (previewResult.fixed_code?.files || previewResult.generated_code?.files) && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "13.5px", fontWeight: "600", color: "#ffffff" }}>
                    🚀 Interactive Web Project Sandbox Available
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>
                    This project includes generated code files ready for real-time live preview.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenInWorkspace}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    background: "#ffffff",
                    color: "#09090b",
                    fontSize: "12px",
                    fontWeight: "600",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Globe size={13} />
                  <span>Launch Live Preview in Workspace</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
