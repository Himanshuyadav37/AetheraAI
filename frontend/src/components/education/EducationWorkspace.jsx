import { useEffect, useRef, useState } from "react";

import MessageBubble from "./MessageBubble";
import LoadingBubble from "./LoadingBubble";
import ChatInput from "./ChatInput";

import useConversation from "../../hooks/useConversation";

import "../../styles/education.css";

import { streamEducationAI } from "../../services/EducationApi";

export default function EducationWorkspace() {
  const {
    conversations,
    activeId,
    createConversation,
    updateMessages,
    currentConversation,
  } = useConversation();

  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");

  const liveMessages = useRef([]);
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation?.messages]);

  async function sendMessage(customPrompt) {
    const question = (customPrompt || prompt).trim();
    if (!question || loading) return;

    let chatId = activeId;
    let baseMessages = [];

    if (chatId) {
      const existing = conversations.find((c) => c.id === chatId);
      baseMessages = existing ? [...existing.messages] : [];
    } else {
      chatId = createConversation(question.slice(0, 40));
      baseMessages = [];
    }

    const aiId = crypto.randomUUID();

    const initialMessages = [
      ...baseMessages,
      { id: crypto.randomUUID(), role: "user", content: question },
      { id: aiId, role: "assistant", title: "NexusAI Education AI", mode: "learn", content: "" },
    ];

    liveMessages.current = initialMessages;
    updateMessages(chatId, [...liveMessages.current]);
    setPrompt("");
    setLoading(true);

    try {
      await streamEducationAI(question, (event) => {
        const updated = liveMessages.current.map((msg) => {
          if (msg.id !== aiId) return msg;
          if (event.meta) return { ...msg, title: event.meta.title || msg.title, mode: event.meta.mode || msg.mode };
          if (event.token) return { ...msg, content: msg.content + event.token };
          return msg;
        });
        liveMessages.current = updated;
        updateMessages(chatId, [...updated]);
      });
    } catch (err) {
      const updated = liveMessages.current.map((msg) =>
        msg.id === aiId
          ? { ...msg, title: "Error", mode: "error", content: `# ❌ Error\n\n${err.message}` }
          : msg,
      );
      liveMessages.current = updated;
      updateMessages(chatId, updated);
    } finally {
      setLoading(false);
    }
  }

  const messages = currentConversation?.messages ?? null;

  return (
    <div className="edu-workspace">

      {/* ── Scrollable messages area ── */}
      <div className="edu-messages">
        {messages ? (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onRegenerate={() => sendMessage(message.content)}
              />
            ))}
            {loading && <LoadingBubble />}
            <div ref={bottomRef} />
          </>
        ) : (
          <div className="edu-empty">
            <div className="edu-empty-icon">🎓</div>
            <h2>Welcome to NexusAI Education AI</h2>
            <p>Ask me anything — learn, quiz, code, notes, interview &amp; more.</p>
          </div>
        )}
      </div>

      {/* ── Fixed bottom input ── */}
      <div className="edu-input-bar">
        <ChatInput
          prompt={prompt}
          setPrompt={setPrompt}
          loading={loading}
          onSend={sendMessage}
        />
      </div>

    </div>
  );
}
