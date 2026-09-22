import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, SendHorizonal, Square, Sparkles, Bot, CheckCircle2, AlertCircle, Plus, Wand2, Code, MessageSquare, Search, GraduationCap, Workflow } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import api, {
  getBaseURL,
  openAuthenticatedEventSource,
} from "../../services/api";
import TypewriterHeading from "./TypewriterHeading";
import "../../styles/workspace.css";

const SUPERVISOR_TITLES = [
  "What will you build today?",
  "What would you like Aethera to do?",
  "Ask Aethera to build, research, explain...",
  "Ship products, research markets, automate workflows.",
];

const PLACEHOLDER =
  "Describe the system you want to build (e.g. Real-Time Analytics Pipeline in FastAPI & Redis)...";

const AGENT_OPTIONS = [
  {
    id: null,
    label: "Auto",
    description: "Supervisor decides",
    icon: Wand2,
    color: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  },
  {
    id: "engineer",
    label: "Engineer",
    description: "Build software",
    icon: Code,
    color: "linear-gradient(135deg, #3b82f6, #06b6d4)",
  },
  {
    id: "conversational",
    label: "Conversational",
    description: "Chat & writing",
    icon: MessageSquare,
    color: "linear-gradient(135deg, #10b981, #14b8a6)",
  },
  {
    id: "research",
    label: "Research",
    description: "Deep research",
    icon: Search,
    color: "linear-gradient(135deg, #f59e0b, #ef4444)",
  },
  {
    id: "education",
    label: "Education",
    description: "Learn & explain",
    icon: GraduationCap,
    color: "linear-gradient(135deg, #8b5cf6, #ec4899)",
  },
  {
    id: "automation",
    label: "Automation",
    description: "Workflows & n8n",
    icon: Workflow,
    color: "linear-gradient(135deg, #84cc16, #10b981)",
  },
];

function SupervisorChat() {
  const { workspaceMode, setAutoModeMessages, autoModeMessages } = useWorkspace();
  const { user, requireAuth } = useAuth();
  const isAutomatic = workspaceMode === "automatic";

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [execution, setExecution] = useState(null);
  const [error, setError] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(() => {
    try {
      const saved = sessionStorage.getItem("aethera_supervisor_agent");
      return saved === "auto" ? null : saved || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("aethera_supervisor_agent", selectedAgent || "auto");
    } catch {}
  }, [selectedAgent]);

  const eventSourceRef = useRef(null);
  const pollTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const executionIdRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const lastLocalMessagesLen = useRef(0);
  const externalResetInProgress = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, execution]);

  // ── Single combined sync + reset effect ──────────────────────────
  // Syncs messages UP to WorkspaceContext AND safely handles external
  // "new chat" resets (autoModeMessages → []) WITHOUT the race.
  useEffect(() => {
    const prevLocalLen = lastLocalMessagesLen.current;
    const curLocalLen = messages.length;
    const curAutoLen = autoModeMessages.length;

    // 1. Always push local messages UP to the context first.
    setAutoModeMessages(messages);

    // 2. Honest external reset detection.
    //    This only fires WHEN:
    //      • We previously already HAD content (prevLocalLen > 0) AND
    //      • Our local messages still have content (curLocalLen > 0) AND
    //      • The context autoModeMessages was just CLEARED to empty (curAutoLen === 0).
    //    This means "New Session" was clicked in the sidebar or another
    //    component reset autoModeMessages on purpose. We then mirror it.
    //
    //    CRITICALLY: If prevLocalLen was 0 (we just added the very first
    //    message ourselves in this render cycle), we NEVER reset because
    //    curAutoLen's stale 0 value is just the race — not an external reset.
    const isHonestExternalReset =
      curAutoLen === 0 && prevLocalLen > 0 && curLocalLen > 0;

    if (isHonestExternalReset) {
      if (eventSourceRef.current) {
        try { eventSourceRef.current.close(); } catch {}
        eventSourceRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      executionIdRef.current = null;
      setMessages([]);
      setExecution(null);
      setError("");
      setInput("");
      setLoading(false);
      lastLocalMessagesLen.current = 0;
      return;
    }

    lastLocalMessagesLen.current = curLocalLen;
  }, [messages, autoModeMessages, setAutoModeMessages]);

  const handleInput = useCallback((e) => {
    const target = e.target;
    setInput(target.value);
    if (target) {
      target.style.height = "auto";
      target.style.height = Math.min(target.scrollHeight, 160) + "px";
    }
  }, []);

  const cleanupExecutionListeners = useCallback(() => {
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const appendAssistantEvent = useCallback((event) => {
    if (!mountedRef.current) return;

    const payload = event?.data ?? event;

    const text =
      payload?.message ||
      payload?.content ||
      payload?.output ||
      payload?.thought ||
      payload?.detail ||
      event?.message ||
      event?.content ||
      event?.output ||
      event?.thought ||
      event?.detail ||
      "";

    if (!text) return;

    const resolvedType =
      event?.event_type ||
      event?.type ||
      payload?.event_type ||
      payload?.type ||
      "update";

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role: "assistant",
        content: String(text),
        eventType: resolvedType,
      },
    ]);
  }, []);

  const applyExecutionEvent = useCallback(
    (event) => {
      if (!event || !mountedRef.current) return;

      const payload = event?.data ?? event;

      const eventType = String(
        event.event_type ||
        event.type ||
        payload.event_type ||
        payload.type ||
        payload.status ||
        event.status ||
        ""
      ).toLowerCase();

      setExecution((prev) => ({
        ...(prev || {}),
        ...payload,
        ...event,
        execution_id:
          event.execution_id ||
          payload.execution_id ||
          prev?.execution_id ||
          executionIdRef.current,
      }));

      if (
        eventType === "step" ||
        eventType === "agent" ||
        eventType === "thought" ||
        eventType === "status" ||
        eventType === "routing" ||
        eventType === "message"
      ) {
        appendAssistantEvent(event);
      }

      if (eventType === "complete" || eventType === "completed") {
        const resultPayload = event?.data ?? event;
        if (
          resultPayload?.result ||
          resultPayload?.output ||
          resultPayload?.content ||
          event?.result ||
          event?.output ||
          event?.content
        ) {
          appendAssistantEvent({
            message:
              event?.output ||
              event?.content ||
              resultPayload?.output ||
              resultPayload?.content ||
              (typeof (event?.result ?? resultPayload?.result) === "string"
                ? (event?.result || resultPayload?.result)
                : "Execution completed."),
            event_type: "complete",
          });
        }

        setLoading(false);
        cleanupExecutionListeners();
      }

      if (
        eventType === "failed" ||
        eventType === "error" ||
        eventType === "cancelled" ||
        eventType === "stopped"
      ) {
        const failure =
          event.error ||
          event.message ||
          event.detail ||
          payload.error ||
          payload.message ||
          payload.detail ||
          "Automatic execution failed.";

        setError(String(failure));
        setLoading(false);
        cleanupExecutionListeners();
      }
    },
    [appendAssistantEvent, cleanupExecutionListeners]
  );

  const startPollingFallback = useCallback(
    (executionId) => {
      if (!executionId) return;

      pollTimerRef.current = setInterval(async () => {
        try {
          const response = await api.get(`/ai/executions/${executionId}`);
          const data = response.data;

          if (!mountedRef.current) return;

          setExecution((prev) => ({ ...(prev || {}), ...data }));

          const status = String(data?.status || "").toLowerCase();

          if (
            status === "completed" ||
            status === "complete" ||
            status === "failed" ||
            status === "cancelled" ||
            status === "stopped"
          ) {
            if (data?.result || data?.final_output || data?.output) {
              appendAssistantEvent({
                message:
                  data.final_output ||
                  data.output ||
                  (typeof data.result === "string"
                    ? data.result
                    : "Execution completed."),
                event_type: status,
              });
            }

            if (status === "failed") {
              setError(data?.error || "Automatic execution failed.");
            }

            setLoading(false);
            cleanupExecutionListeners();
          }
        } catch (pollError) {
          console.warn("Supervisor execution polling failed:", pollError);
        }
      }, 2000);
    },
    [appendAssistantEvent, cleanupExecutionListeners]
  );

  const subscribeToExecution = useCallback(
    (executionId) => {
      if (!executionId) return;

      cleanupExecutionListeners();

      const streamUrl = `${getBaseURL()}/ai/${executionId}/stream`;

      try {
        const source = openAuthenticatedEventSource(streamUrl);
        eventSourceRef.current = source;

        source.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            applyExecutionEvent(parsed);
          } catch {
            if (event.data) {
              applyExecutionEvent({
                event_type: "message",
                message: event.data,
              });
            }
          }
        };

        source.onerror = () => {
          try {
            source.close();
          } catch {}
          eventSourceRef.current = null;

          startPollingFallback(executionId);
        };
      } catch (streamError) {
        console.warn("Supervisor SSE subscription failed:", streamError);
        startPollingFallback(executionId);
      }
    },
    [
      applyExecutionEvent,
      cleanupExecutionListeners,
      startPollingFallback,
    ]
  );

  const handleSend = useCallback(
    async (event) => {
      event?.preventDefault();

      const prompt = input.trim();
      if (!prompt || loading || !isAutomatic) return;

      setInput("");
      setError("");
      setLoading(true);

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-user`,
          role: "user",
          content: prompt,
        },
      ]);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      try {
        const payload = {
          idea: prompt,
          workspace_mode: "automatic",
          agent_type: selectedAgent || undefined,
        };

        const response = await api.post("/ai/execute-project", payload);
        const data = response.data || {};
        const executionId = data.execution_id;

        if (!executionId) {
          throw new Error("Backend did not return an execution_id.");
        }

        executionIdRef.current = executionId;

        setExecution({
          ...data,
          execution_id: executionId,
          status: data.status || "running",
          workspace_mode: "automatic",
          requested_agent_type: selectedAgent || null,
        });

        const routingMsg =
          "🚀 Request received. " +
          (selectedAgent
            ? `Using **${AGENT_OPTIONS.find((a) => a.id === selectedAgent)?.label || selectedAgent}** agent (user selected).`
            : "Supervisor is analyzing the request and routing to the best agent...");
        setMessages((prev) => [
          ...prev,
          {
            id: `ack-${Date.now()}`,
            role: "assistant",
            content: routingMsg,
            eventType: "routing",
          },
        ]);

        subscribeToExecution(executionId);
      } catch (requestError) {
        console.error("Automatic execution request failed:", requestError);

        const message =
          requestError?.response?.data?.detail ||
          requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to start the automatic execution.";

        setError(String(message));
        setLoading(false);
      }
    },
    [input, loading, isAutomatic, subscribeToExecution, selectedAgent]
  );

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !loading && isAutomatic) {
        requireAuth(
          () => handleSend(),
          "Authentication Required",
          "Sign in to chat with the Supervisor."
        );
      }
    }
  }, [input, loading, isAutomatic, handleSend, requireAuth]);

  const handleStop = useCallback(async () => {
    const executionId = executionIdRef.current;
    if (!executionId) return;

    try {
      await api.post(`/ai/executions/${executionId}/stop`);
    } catch (stopError) {
      console.error("Failed to stop Supervisor execution:", stopError);
    } finally {
      setLoading(false);
      cleanupExecutionListeners();
      setExecution((prev) => ({
        ...(prev || {}),
        status: "stopped",
      }));
    }
  }, [cleanupExecutionListeners]);

  if (!isAutomatic) return null;

  function getAvatarStyleSeed(username) {
    if (!username) return { background: "#3f3f46", color: "#ffffff" };
    const colors = [
      "linear-gradient(135deg, #6366f1, #8b5cf6)",
      "linear-gradient(135deg, #ec4899, #8b5cf6)",
      "linear-gradient(135deg, #3b82f6, #06b6d4)",
      "linear-gradient(135deg, #10b981, #14b8a6)",
      "linear-gradient(135deg, #f59e0b, #ef4444)",
      "linear-gradient(135deg, #8b5cf6, #ec4899)",
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
    return { background: colors[hash % colors.length], color: "#fff" };
  }

  const userAvatarStyle = getAvatarStyleSeed(user?.username || user?.email);

  return (
    <div
      className="ws-chat"
      style={{
        height: "100%",
      }}
    >
      <div className="ws-messages">
        {messages.length === 0 && !loading && (
          <div className="ws-empty">
            <div className="ws-empty-hero clean-minimal">
              <TypewriterHeading titles={SUPERVISOR_TITLES} />
              <p className="hero-subtitle">
                Select an agent below, or leave on <strong>Auto</strong> to let the Supervisor intelligently route your request to the best subsystem.
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`ws-message ${message.role === "user" ? "user" : ""}`}
          >
            <div
              className={`ws-avatar ${message.role === "user" ? "user-av" : "ai-av"}`}
              style={message.role === "user" ? userAvatarStyle : undefined}
            >
              {message.role === "user"
                ? user?.username?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"
                : <Bot size={12} />}
            </div>
            <div className="ws-msg-body">
              {message.role === "user" ? (
                <div className="ws-user-bubble ws-markdown" style={{ whiteSpace: "pre-wrap" }}>
                  {message.content}
                </div>
              ) : (
                <div className="ws-ai-response" style={{ whiteSpace: "pre-wrap" }}>
                  {message.eventType && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.72rem",
                        opacity: 0.65,
                        marginBottom: 8,
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                      }}
                    >
                      <Sparkles size={11} />
                      Supervisor
                      {message.eventType ? ` · ${message.eventType}` : ""}
                    </div>
                  )}
                  {message.content}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="ws-message">
            <div className="ws-avatar ai-av thinking">
              <Bot size={12} />
            </div>
            <div className="ws-msg-body">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  padding: "12px 16px",
                  background: "rgba(24, 24, 27, 0.55)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 12,
                }}
              >
                <Loader2 size={15} className="spin" />
                Supervisor is orchestrating the request…
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239, 68, 68, 0.08)",
              color: "#fca5a5",
              fontSize: "0.85rem",
              lineHeight: 1.5,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {execution?.status &&
          ["completed", "complete"].includes(
            String(execution.status).toLowerCase()
          ) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                color: "var(--text-secondary)",
                fontSize: "0.78rem",
                marginTop: 4,
                paddingLeft: 44,
              }}
            >
              <CheckCircle2 size={13} />
              Execution completed · {execution.execution_id}
            </div>
          )}

        <div ref={bottomRef} />
      </div>

      <div
        style={{
          padding: "0 16px 10px 16px",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
        }}
      >
        {AGENT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = selectedAgent === opt.id;
          return (
            <button
              key={opt.id ?? "auto"}
              type="button"
              disabled={loading}
              onClick={() => setSelectedAgent(opt.id)}
              title={opt.description}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                border: isActive
                  ? "1px solid rgba(255,255,255,0.45)"
                  : "1px solid rgba(255,255,255,0.08)",
                background: isActive
                  ? `${opt.color}22`
                  : "rgba(24, 24, 27, 0.6)",
                color: isActive ? "#fff" : "var(--text-secondary)",
                fontSize: "0.78rem",
                fontWeight: isActive ? 600 : 500,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
                transition: "all 0.15s ease",
                letterSpacing: "0.01em",
                boxShadow: isActive
                  ? `0 0 0 1px ${opt.color}33 inset, 0 4px 18px ${opt.color}22`
                  : "none",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = isActive
                    ? "rgba(255,255,255,0.45)"
                    : "rgba(255,255,255,0.08)";
                }
              }}
            >
              <Icon size={13} style={{ opacity: isActive ? 1 : 0.85 }} />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="ws-input-bar">
        <div className="ws-input-inner">
          <div className="ws-attach-menu-container">
            <button
              type="button"
              className="ws-attach-btn"
              onClick={() => requireAuth(() => {}, "Authentication Required", "Sign in to use tools and attachments.")}
              title="Tools & attachments"
              aria-label="Tools & attachments"
            >
              <Plus size={18} />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onInput={handleInput}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            disabled={loading}
            id="supervisor-input"
          />
          {loading ? (
            <button
              type="button"
              className="ws-send-btn ws-stop-btn"
              onClick={handleStop}
              id="supervisor-stop-btn"
              title="Stop Execution"
              aria-label="Stop execution"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              className="ws-send-btn"
              onClick={(e) => requireAuth(() => { handleSend(e); }, "Authentication Required", "Sign in to chat with the Supervisor.")}
              disabled={!input.trim()}
              id="supervisor-send-btn"
              aria-label="Send to Supervisor"
            >
              <SendHorizonal size={16} />
            </button>
          )}
        </div>
        <div className="ws-input-hint">
          Agent: <strong style={{ color: "var(--text-primary)" }}>
            {selectedAgent ? AGENT_OPTIONS.find(a => a.id === selectedAgent)?.label || "Auto" : "Auto"}
          </strong> · Press Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

export default SupervisorChat;
