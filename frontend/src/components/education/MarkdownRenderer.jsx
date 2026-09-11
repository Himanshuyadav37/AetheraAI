import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidDiagram from "./MermaidDiagram";
import CodeBlock from "./CodeBlock";
import CollapsibleSection from "./CollapsibleSection";

function getSectionMeta(rawTitle) {
  const t = rawTitle.toLowerCase();
  
  if (t.includes("practice") || t.includes("question") || t.includes("quiz") || t.includes("exercise")) {
    return {
      variant: "practice",
      badge: "Practice & Quiz",
      defaultOpen: false, // Folded by default as requested
    };
  }
  if (t.includes("ascii") || t.includes("diagram") || t.includes("architecture") || t.includes("flowchart") || t.includes("workflow")) {
    return {
      variant: "diagram",
      badge: "Diagram & Architecture",
      defaultOpen: false, // Folded by default as requested
    };
  }
  if (t.includes("step-by-step") || t.includes("working") || t.includes("process") || t.includes("algorithm")) {
    return {
      variant: "step",
      badge: "Step-by-Step Flow",
      defaultOpen: true,
    };
  }
  if (t.includes("comparison") || t.includes("difference") || t.includes(" versus ") || t.includes(" vs")) {
    return {
      variant: "code",
      badge: "Comparison Table",
      defaultOpen: true,
    };
  }
  if (t.includes("advantage") || t.includes("limitation") || t.includes("pro") || t.includes("con")) {
    return {
      variant: "default",
      badge: "Trade-offs",
      defaultOpen: true,
    };
  }
  if (t.includes("common mistake") || t.includes("pitfall") || t.includes("tip")) {
    return {
      variant: "default",
      badge: "Tips & Pitfalls",
      defaultOpen: true,
    };
  }
  
  return null;
}

const markdownComponents = {
  h1: ({ children }) => (
    <div className="md-section">
      <h1 className="md-h1">{children}</h1>
    </div>
  ),
  h2: ({ children }) => (
    <div className="md-section">
      <h2 className="md-h2">{children}</h2>
    </div>
  ),
  h3: ({ children }) => (
    <div className="md-section">
      <h3 className="md-h3">{children}</h3>
    </div>
  ),
  h4: ({ children }) => (
    <h4 className="md-h4">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="md-p">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="md-ul">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="md-ol">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="md-li">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="md-strong">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="md-em">{children}</em>
  ),
  hr: () => (
    <hr className="md-hr" />
  ),
  blockquote: ({ children }) => (
    <blockquote className="md-blockquote">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="table-wrapper">
      <table className="md-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead>{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr>{children}</tr>
  ),
  th: ({ children }) => (
    <th>{children}</th>
  ),
  td: ({ children }) => (
    <td>{children}</td>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="md-image" />
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
      {children}
    </a>
  ),
  code({ inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeStr = String(children || "");
    const hasNewline = codeStr.includes("\n");

    if (inline || (!hasNewline && !match)) {
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );
    }

    return (
      <CodeBlock
        language={match ? match[1] : "text"}
        code={codeStr.replace(/\n$/, "")}
      />
    );
  },
};

function normalizeMarkdownText(text) {
  if (typeof text !== "string") return text;
  let clean = text;

  // 1. Fix single-line concatenated markdown table rows:
  // e.g. "| col1 | col2 | |---|---| | row1a | row1b |" or "| col1 ||---|---|| row1 |"
  clean = clean.replace(/\|\s*\|\s*/g, "|\n| ");

  // 2. Ensure table header has clean newlines before it if attached directly to preceding text
  clean = clean.replace(/([^\n])\n?(\|[\s\S]+?\|---)/g, "$1\n\n$2");

  // 3. Normalize bullet points with <br> like "<br>• " or "<br>* " into newlines
  clean = clean.replace(/<br\s*\/?>\s*([•\-\*])/gi, "\n* ");

  return clean;
}

function MarkdownRenderer({ children }) {
  const normalized = useMemo(() => {
    return normalizeMarkdownText(children);
  }, [children]);

  // If normalized is not a string, render directly
  if (typeof normalized !== "string") {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {normalized}
      </ReactMarkdown>
    );
  }

  // Parse sections split by \n## or \n--- \n##
  const parsedSections = useMemo(() => {
    const raw = (normalized || "").trim();
    if (!raw.includes("## ")) {
      return null;
    }

    // Split by lines starting with ##
    const lines = raw.split("\n");
    const sections = [];
    let currentTitle = null;
    let currentLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("## ")) {
        if (currentTitle !== null || currentLines.length > 0) {
          sections.push({
            title: currentTitle,
            content: currentLines.join("\n").trim()
          });
        }
        currentTitle = line.replace(/^##\s+/, "").trim();
        currentLines = [];
      } else if (line.trim() === "---" && (i + 1 < lines.length) && lines[i + 1].startsWith("## ")) {
        // Skip divider before a new H2 section
        continue;
      } else {
        currentLines.push(line);
      }
    }

    if (currentTitle !== null || currentLines.length > 0) {
      sections.push({
        title: currentTitle,
        content: currentLines.join("\n").trim()
      });
    }

    return sections;
  }, [normalized]);

  if (!parsedSections || parsedSections.length === 0) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {normalized}
      </ReactMarkdown>
    );
  }

  return (
    <div className="smart-markdown-container">
      {parsedSections.map((sec, idx) => {
        // Lead / Intro section before any H2
        if (!sec.title) {
          if (!sec.content) return null;
          return (
            <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {sec.content}
            </ReactMarkdown>
          );
        }

        const meta = getSectionMeta(sec.title);

        // Special collapsible section (Practice Questions, ASCII Diagram, Step-by-Step, etc.)
        if (meta) {
          return (
            <CollapsibleSection
              key={idx}
              title={sec.title}
              variant={meta.variant}
              badge={meta.badge}
              defaultOpen={meta.defaultOpen}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {sec.content}
              </ReactMarkdown>
            </CollapsibleSection>
          );
        }

        // Standard H2 section
        return (
          <div key={idx} className="md-section-block">
            <div className="md-section">
              <h2 className="md-h2">{sec.title}</h2>
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {sec.content}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}

export default MarkdownRenderer;