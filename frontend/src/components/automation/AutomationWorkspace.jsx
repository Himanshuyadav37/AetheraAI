import { useCallback, useEffect, useRef, useState } from "react";
import AutomationSidebar from "./AutomationSidebar";
import AutomationChatInput from "./AutomationChatInput";
import AutomationEmptyState from "./AutomationEmptyState";
import AutomationMessageBubble from "./AutomationMessageBubble";
import {
  generateAutomation,
  listAutomationConversations,
  getAutomationConversation,
} from "../../services/AutomationApi";
import "../../styles/automation.css";

/**
 * AutomationWorkspace
 *
 * Main workspace for the Automation AI module.
 * Layout: [Left Sidebar] | [Chat Area + Input]
 *
 * Conversation persistence: MongoDB via API
 */
function AutomationWorkspace() {
  // ── State ──────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState(null); // null = no conversation selected
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);

  // ── Load conversation list from MongoDB on mount ────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const convs = await listAutomationConversations();
        setConversations(convs);
      } catch {
        setConversations([]);
      }
    }
    load();
  }, []);

  // ── Auto-scroll on new messages ────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Select a conversation by ID ────────────────────────────────────────
  async function handleSelectConversation(id) {
    if (id === activeId) return;
    try {
      const conv = await getAutomationConversation(id);
      setActiveId(id);
      // Map DB message format → component format
      const mapped = (conv.messages || []).map((m, idx) => ({
        id: `${id}-${idx}`,
        role: m.role,
        content: m.content,
        result: m.result || null,
      }));
      setMessages(mapped);
    } catch {
      setMessages([]);
    }
  }

  // ── Start a new conversation ───────────────────────────────────────────
  function handleNew() {
    setActiveId(null);
    setMessages(null); // shows empty state
  }

  // ── Handle conversation deleted from sidebar ───────────────────────────
  function handleDeleted(id) {
    setConversations((prev) => prev.filter((c) => c._id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages(null);
    }
  }

  // ── Send a prompt ──────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (prompt) => {
      if (!prompt.trim() || loading) return;

      const userMsg = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        result: null,
      };
      const loadingMsg = {
        id: crypto.randomUUID(),
        role: "loading",
        content: "",
        result: null,
      };

      // Optimistically add user + loading messages
      setMessages((prev) => {
        const base = prev ?? [];
        return [...base, userMsg, loadingMsg];
      });
      setLoading(true);

      try {
        const result = await generateAutomation(
          prompt,
          activeId,   // existing conversation ID or null → backend creates new
          null,       // platform: let backend detect from prompt
        );

        const conversationId = result.conversation_id;

        const aiMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.title || "Workflow Generated",
          result,
        };

        // Replace loading bubble with real response
        setMessages((prev) =>
          (prev || []).filter((m) => m.role !== "loading").concat(aiMsg),
        );

        // Update active conversation
        setActiveId(conversationId);

        // Refresh sidebar conversation list
        const updatedConvs = await listAutomationConversations();
        setConversations(updatedConvs);

      } catch (err) {
        const errMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ Error: ${err.message || "Something went wrong. Please try again."}`,
          result: null,
        };
        setMessages((prev) =>
          (prev || []).filter((m) => m.role !== "loading").concat(errMsg),
        );
      } finally {
        setLoading(false);
      }
    },
    [activeId, loading],
  );

  // ── Handle example card click (fill input + send) ──────────────────────
  function handleExample(text) {
    handleSend(text);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="auto-workspace">
      {/* ── Left Sidebar ─────────────────────────────────────────── */}
      <AutomationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNew={handleNew}
        onDeleted={handleDeleted}
      />

      {/* ── Main Chat Area ───────────────────────────────────────── */}
      <div className="auto-main">
        <div className="auto-messages">
          {messages === null ? (
            /* No conversation selected → show empty/welcome state */
            <AutomationEmptyState onExample={handleExample} />
          ) : messages.length === 0 ? (
            <AutomationEmptyState onExample={handleExample} />
          ) : (
            <>
              {messages.map((msg) => (
                <AutomationMessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* ── Fixed Input ────────────────────────────────────────── */}
        <AutomationChatInput onSend={handleSend} loading={loading} />
      </div>
    </div>
  );
}

export default AutomationWorkspace;
