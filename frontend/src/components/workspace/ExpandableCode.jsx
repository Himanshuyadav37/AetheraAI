import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const PREVIEW_LINES = 8;

function ExpandableCode({ value }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const lines = text.split("\n");
  const isLong = lines.length > PREVIEW_LINES;
  const [expanded, setExpanded] = useState(false);
  const displayedText = !expanded && isLong ? lines.slice(0, PREVIEW_LINES).join("\n") : text;

  return (
    <div className={`ws-expandable-code ${isLong && !expanded ? "is-collapsed" : ""}`}>
      <pre>{displayedText}</pre>
      {isLong && (
        <button
          type="button"
          className="ws-show-more-btn"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export default ExpandableCode;