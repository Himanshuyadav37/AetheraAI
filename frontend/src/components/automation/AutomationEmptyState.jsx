import { Zap } from "lucide-react";

const EXAMPLES = [
  {
    emoji: "📋",
    text: "When a contact form is submitted, save data to Google Sheets, send confirmation email via Gmail, and notify team on Slack",
  },
  {
    emoji: "💳",
    text: "When a Stripe payment succeeds, add customer to Notion CRM, send WhatsApp receipt, and update Google Sheets revenue tracker",
  },
  {
    emoji: "📅",
    text: "Every Monday at 9AM, fetch last week's Airtable tasks, create summary report, and post it to Microsoft Teams",
  },
  {
    emoji: "🛒",
    text: "When a WooCommerce order is placed, send order confirmation email, update inventory in Notion, and alert warehouse on Slack",
  },
  {
    emoji: "🐙",
    text: "When a GitHub PR is merged to main, run tests via GitHub Actions, deploy to AWS, and notify team on Discord",
  },
  {
    emoji: "📝",
    text: "When a Typeform response arrives, save to Airtable, send personalized welcome email, and create task in ClickUp",
  },
];

function AutomationEmptyState({ onExample }) {
  return (
    <div className="auto-empty">
      <div className="auto-empty-icon">
        <Zap size={36} />
      </div>
      <h2>Automation Architect</h2>
      <p>
        Describe any workflow in plain English and I'll generate a complete,
        production-ready automation with workflow JSON, diagram, credentials,
        deployment guide, and testing checklist.
      </p>

      <div className="auto-examples">
        {EXAMPLES.map((ex, i) => (
          <div
            key={i}
            className="auto-example-card"
            onClick={() => onExample(ex.text)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onExample(ex.text)}
            id={`example-${i}`}
          >
            <span className="example-emoji">{ex.emoji}</span>
            <p>{ex.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AutomationEmptyState;
