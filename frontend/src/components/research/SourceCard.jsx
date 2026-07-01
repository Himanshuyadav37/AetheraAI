import { ExternalLink } from "lucide-react";

function buildFallbackUrl(source) {
  const query = encodeURIComponent(source.query || source.title || "research");
  const type = (source.type || source.category || "").toLowerCase();

  if (type.includes("academic")) return `https://scholar.google.com/scholar?q=${query}`;
  if (type.includes("paper")) return `https://arxiv.org/search/?query=${query}&searchtype=all`;
  if (type.includes("code")) return `https://github.com/search?q=${query}&type=repositories`;
  if (type.includes("news")) return `https://www.google.com/search?q=${query}&tbm=nws`;
  if (type.includes("community")) return `https://www.reddit.com/search/?q=${query}`;
  if (type.includes("video")) return `https://www.youtube.com/results?search_query=${query}`;
  if (type.includes("data")) return `https://datasetsearch.research.google.com/search?query=${query}`;
  if (type.includes("patent")) return `https://patents.google.com/?q=${query}`;
  if (type.includes("developer")) return `https://stackoverflow.com/search?q=${query}`;

  return `https://www.google.com/search?q=${query}`;
}

function SourceCard({ source }) {
  const url = source.url || buildFallbackUrl(source);
  const label = source.action_label || "Open Tool";

  return (
    <a
      className="source-card source-card-link"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      <div className="source-card-head">
        <span>{source.type || source.category || "tool"}</span>
        <ExternalLink size={15} />
      </div>
      <h4>{source.title || source.name}</h4>
      <p>{source.description}</p>
      {source.query && <code>{source.query}</code>}
      <div className="source-open-row">
        <span>{label}</span>
        <ExternalLink size={14} />
      </div>
    </a>
  );
}

export default SourceCard;