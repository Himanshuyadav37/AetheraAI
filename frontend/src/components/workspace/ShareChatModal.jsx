import { useState } from "react";
import { Share2, Check, Copy, ExternalLink, Globe, X, Sparkles } from "lucide-react";

const MODULE_LABELS = {
  engineer: { name: "Autonomous Engineer", icon: "🚀", tag: "Code & Build" },
  conversational: { name: "Conversational AI", icon: "💬", tag: "General Chat" },
  research: { name: "Deep Research", icon: "🔬", tag: "Synthesis & Reports" },
  education: { name: "Interactive Tutor", icon: "🎓", tag: "Learning & Quiz" },
  automation: { name: "Workflow Automation", icon: "⚡", tag: "Pipelines & Ops" },
};

export default function ShareChatModal({
  isOpen,
  onClose,
  conversationId,
  module = "engineer",
  title = "Untitled Session",
  messagesCount = 0,
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !conversationId) return null;

  const shareUrl = `${window.location.origin}/share/chat/${conversationId}?module=${module}`;
  const config = MODULE_LABELS[module] || MODULE_LABELS.conversational;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `NexusAI Chat: ${title}`,
          text: `Check out this ${config.name} conversation on NexusAI:`,
          url: shareUrl,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Native share error:", err);
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#0e0e11",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "14px",
          padding: "24px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
              }}
            >
              <Share2 size={16} style={{ color: "#ffffff" }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#ffffff" }}>
                Share Conversation
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>
                Anyone with this link can view this chat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#a1a1aa",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Chat Info Card */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                color: "#ffffff",
                fontWeight: "600",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span>{config.icon}</span> {config.name}
            </span>
            {messagesCount > 0 && (
              <span style={{ fontSize: "11px", color: "#71717a" }}>
                {messagesCount} messages
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "#e4e4e7",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={title}
          >
            {title}
          </span>
        </div>

        {/* Share Link Input Box */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: "500", color: "#d4d4d8" }}>
            Shareable Public URL
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              readOnly
              value={shareUrl}
              style={{
                flex: 1,
                padding: "8px 12px",
                background: "#09090b",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                borderRadius: "8px",
                color: "#a1a1aa",
                fontSize: "12.5px",
                outline: "none",
                fontFamily: "monospace",
              }}
              onClick={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                background: copied ? "#22c55e" : "#ffffff",
                color: copied ? "#ffffff" : "#09090b",
                fontWeight: "600",
                fontSize: "12.5px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "flex", gap: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "14px" }}>
          {navigator.share && (
            <button
              type="button"
              onClick={handleNativeShare}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              <Share2 size={13} />
              <span>Share Via Device</span>
            </button>
          )}
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: "500",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <ExternalLink size={13} />
            <span>Open Public View</span>
          </a>
        </div>
      </div>
    </div>
  );
}
