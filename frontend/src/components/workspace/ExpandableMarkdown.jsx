import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import MarkdownRenderer from "../education/MarkdownRenderer";

const MAX_PREVIEW_CHARS = 1200;
const MAX_PREVIEW_LINES = 18;

function ExpandableMarkdown({ children, content }) {
  const value = typeof content === "string" ? content : (children || "");
  const isLong = value.length > MAX_PREVIEW_CHARS || value.split("\n").length > MAX_PREVIEW_LINES;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`ws-expandable-markdown ${isLong && !expanded ? "is-collapsed" : ""}`}>
      <MarkdownRenderer>{value}</MarkdownRenderer>
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

export default ExpandableMarkdown;