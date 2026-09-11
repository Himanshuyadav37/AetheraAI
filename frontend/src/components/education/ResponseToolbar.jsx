import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Download,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";
import "./ResponseToolbar.css";

function ResponseToolbar({ content, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'like' | 'dislike' | null
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  function exportMarkdown() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-response-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function shareResponse() {
    if (navigator.share) {
      navigator.share({
        title: "NexusAI Education Session",
        text: content,
      }).catch(() => {});
    } else {
      copyResponse();
    }
  }

  function toggleSpeech() {
    if (!("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  }

  function handleFeedback(type) {
    setFeedback((prev) => (prev === type ? null : type));
  }

  return (
    <div className="ws-micro-toolbar" role="toolbar" aria-label="Message actions">
      <button
        type="button"
        className={`ws-micro-btn ${copied ? "is-active" : ""}`}
        onClick={copyResponse}
        title={copied ? "Copied to clipboard!" : "Copy message"}
        aria-label="Copy message"
      >
        {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
        {copied && <span className="ws-micro-label">Copied</span>}
      </button>

      {onRegenerate && (
        <button
          type="button"
          className="ws-micro-btn"
          onClick={onRegenerate}
          title="Regenerate response"
          aria-label="Regenerate response"
        >
          <RotateCcw size={13} />
        </button>
      )}

      <div className="ws-micro-divider" />

      <button
        type="button"
        className={`ws-micro-btn ${feedback === "like" ? "is-liked" : ""}`}
        onClick={() => handleFeedback("like")}
        title="Good response"
        aria-label="Thumbs up"
      >
        <ThumbsUp size={13} />
      </button>

      <button
        type="button"
        className={`ws-micro-btn ${feedback === "dislike" ? "is-disliked" : ""}`}
        onClick={() => handleFeedback("dislike")}
        title="Bad response"
        aria-label="Thumbs down"
      >
        <ThumbsDown size={13} />
      </button>

      <div className="ws-micro-divider" />

      <button
        type="button"
        className={`ws-micro-btn ${isSpeaking ? "is-speaking" : ""}`}
        onClick={toggleSpeech}
        title={isSpeaking ? "Stop reading" : "Read aloud"}
        aria-label="Read aloud"
      >
        {isSpeaking ? <VolumeX size={13} className="text-speaking" /> : <Volume2 size={13} />}
      </button>

      <button
        type="button"
        className="ws-micro-btn"
        onClick={exportMarkdown}
        title="Export Markdown file"
        aria-label="Download Markdown"
      >
        <Download size={13} />
      </button>

      <button
        type="button"
        className="ws-micro-btn"
        onClick={shareResponse}
        title="Share"
        aria-label="Share"
      >
        <Share2 size={13} />
      </button>
    </div>
  );
}

export default ResponseToolbar;