import { useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";

const PLATFORM_HINTS = [
  "n8n",
  "Make.com",
  "Zapier",
  "Power Automate",
  "GitHub Actions",
  "Webhook",
];

const EXAMPLE_PROMPTS = [
  "When a contact form is submitted, save to Google Sheets and send confirmation email",
  "Every Monday, pull data from Airtable, generate a report and send to Slack",
  "When a Stripe payment succeeds, update Notion CRM and send WhatsApp confirmation",
];

function AutomationChatInput({ onSend, loading }) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const val = prompt.trim();
    if (!val || loading) return;
    onSend(val);
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleInput(e) {
    setPrompt(e.target.value);
    // Auto-grow textarea
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
  }

  return (
    <div className="auto-input-bar">
      <div className="auto-input-wrapper">
        <textarea
          ref={textareaRef}
          id="automation-prompt-input"
          rows={1}
          value={prompt}
          onInput={handleInput}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your automation in plain English… e.g. 'When someone fills my contact form, save to Sheets, email them, notify Slack'"
          disabled={loading}
        />
        <button
          className="auto-send-btn"
          onClick={handleSend}
          disabled={!prompt.trim() || loading}
          id="btn-send-automation"
          aria-label="Send"
        >
          <SendHorizonal size={17} />
        </button>
      </div>

      <div className="auto-input-hints">
        {PLATFORM_HINTS.map((hint) => (
          <span
            key={hint}
            className="auto-hint-chip"
            onClick={() =>
              setPrompt((prev) =>
                prev ? `${prev} (use ${hint})` : `Use ${hint}: `,
              )
            }
          >
            {hint}
          </span>
        ))}
      </div>
    </div>
  );
}

export default AutomationChatInput;
