import { useState } from "react";
import MermaidDiagram from "../education/MermaidDiagram";
import {
  Clipboard,
  ClipboardCheck,
  Download,
  FileJson,
  FileText,
  GitBranch,
  Key,
  Layers,
  List,
  Rocket,
  Shield,
  TestTube,
  TriangleAlert,
  Workflow,
  Zap,
} from "lucide-react";
import "../../styles/automation.css";

// ─── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { key: "overview",    label: "Overview",   icon: <Layers size={14} /> },
  { key: "diagram",     label: "Diagram",    icon: <Workflow size={14} /> },
  { key: "nodes",       label: "Nodes",      icon: <GitBranch size={14} /> },
  { key: "steps",       label: "Steps",      icon: <List size={14} /> },
  { key: "json",        label: "JSON",       icon: <FileJson size={14} /> },
  { key: "credentials", label: "Credentials",icon: <Key size={14} /> },
  { key: "deployment",  label: "Deploy",     icon: <Rocket size={14} /> },
  { key: "testing",     label: "Testing",    icon: <TestTube size={14} /> },
  { key: "errors",      label: "Errors",     icon: <TriangleAlert size={14} /> },
  { key: "security",    label: "Security",   icon: <Shield size={14} /> },
];

// ─── Simple Markdown renderer for the text sections ───────────────────────────
function SimpleMarkdown({ text }) {
  if (!text) return <p className="auto-markdown-section" style={{ color: "#666" }}>No content available.</p>;

  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(<h2 key={i}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i}>{line.slice(4)}</h3>);
    } else if (line.startsWith("#### ")) {
      elements.push(<h4 key={i} style={{ color: "#e5e5e5", margin: "16px 0 8px", fontSize: "14px" }}>{line.slice(5)}</h4>);
    } else if (line.startsWith("| ") && line.endsWith(" |")) {
      // Table — collect rows
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!lines[i].match(/^\|[\s\-|]+\|$/)) {
          tableLines.push(lines[i]);
        }
        i++;
      }
      elements.push(
        <table key={`tbl-${elements.length}`}>
          <thead>
            <tr>
              {tableLines[0]?.split("|").filter(Boolean).map((cell, ci) => (
                <th key={ci}>{cell.trim()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableLines.slice(1).map((row, ri) => (
              <tr key={ri}>
                {row.split("|").filter(Boolean).map((cell, ci) => (
                  <td key={ci}>{cell.trim()}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    } else if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
      const checked = line.startsWith("- [x]");
      elements.push(
        <div key={i} style={{ display: "flex", gap: 8, margin: "5px 0", alignItems: "flex-start" }}>
          <span style={{ color: checked ? "#34d399" : "#555", marginTop: 2 }}>{checked ? "✓" : "○"}</span>
          <span style={{ color: "#bbb", fontSize: 13 }}>{line.slice(6)}</span>
        </div>
      );
    } else if (line.startsWith("- ")) {
      elements.push(<li key={i}>{line.slice(2)}</li>);
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(<li key={i}>{line.replace(/^\d+\.\s/, "")}</li>);
    } else if (line.trim() === "") {
      elements.push(<br key={i} />);
    } else if (line.trim()) {
      elements.push(<p key={i}>{line}</p>);
    }

    i++;
  }

  return <div className="auto-markdown-section">{elements}</div>;
}

// ─── AutomationPanel ─────────────────────────────────────────────────────────
function AutomationPanel({ result }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const {
    title = "Automation Workflow",
    description = "",
    platform = "n8n",
    platform_alternatives = [],
    workflow_json,
    workflow_mermaid = "",
    workflow_ascii = "",
    nodes = [],
    steps = [],
    credentials = [],
    deployment = "",
    testing = "",
    error_handling = "",
    security_notes = "",
    validation_errors = [],
    validation_warnings = [],
    apps = [],
    complexity = "medium",
  } = result;

  // ── Copy JSON ────────────────────────────────────────────────────────
  function handleCopyJson() {
    const json = JSON.stringify(workflow_json, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Download helpers ─────────────────────────────────────────────────
  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadJson() {
    downloadFile(
      JSON.stringify(workflow_json, null, 2),
      `${title.replace(/\s+/g, "_")}.json`,
      "application/json",
    );
  }

  function handleDownloadMarkdown() {
    const md = [
      `# ${title}`,
      ``,
      `> ${description}`,
      ``,
      `**Platform:** ${platform}`,
      ``,
      `## Workflow Diagram (ASCII)`,
      `\`\`\``,
      workflow_ascii,
      `\`\`\``,
      ``,
      `## Execution Steps`,
      ...steps.map((s) => `${s.step}. **${s.title}** — ${s.description}`),
      ``,
      `## Required Credentials`,
      ...credentials.map((c) => `- **${c.name}**: ${c.description}`),
      ``,
      `## Deployment`,
      deployment,
      ``,
      `## Testing`,
      testing,
      ``,
      `## Error Handling`,
      error_handling,
      ``,
      `## Security`,
      security_notes,
    ].join("\n");
    downloadFile(md, `${title.replace(/\s+/g, "_")}.md`, "text/markdown");
  }

  function handleDownloadTxt() {
    const txt = [
      `AUTOMATION: ${title}`,
      `Platform: ${platform}`,
      ``,
      description,
      ``,
      `FLOW`,
      `----`,
      workflow_ascii,
      ``,
      `STEPS`,
      `-----`,
      ...steps.map((s) => `${s.step}. ${s.title}: ${s.description}`),
      ``,
      `CREDENTIALS REQUIRED`,
      `--------------------`,
      ...credentials.map((c) => `- ${c.name}: ${c.description}`),
    ].join("\n");
    downloadFile(txt, `${title.replace(/\s+/g, "_")}.txt`, "text/plain");
  }

  // ── Tab content render ───────────────────────────────────────────────
  function renderTabContent() {
    switch (activeTab) {
      case "overview":
        return (
          <div>
            <div className="auto-overview-grid">
              <div className="auto-stat-card">
                <div className="auto-stat-label">Platform</div>
                <div className="auto-stat-value">{platform}</div>
              </div>
              <div className="auto-stat-card">
                <div className="auto-stat-label">Complexity</div>
                <div className="auto-stat-value" style={{ textTransform: "capitalize" }}>{complexity}</div>
              </div>
              <div className="auto-stat-card">
                <div className="auto-stat-label">Nodes</div>
                <div className="auto-stat-value">{nodes.length || "—"}</div>
              </div>
              <div className="auto-stat-card">
                <div className="auto-stat-label">Credentials</div>
                <div className="auto-stat-value">{credentials.length}</div>
              </div>
            </div>

            {apps.length > 0 && (
              <>
                <div className="auto-section-label">Apps & Services</div>
                <div className="auto-apps-list">
                  {apps.map((app, i) => (
                    <span key={i} className="auto-app-chip">{app}</span>
                  ))}
                </div>
              </>
            )}

            {platform_alternatives.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="auto-section-label">Also works with</div>
                <div className="auto-apps-list">
                  {platform_alternatives.map((p, i) => (
                    <span key={i} className="auto-app-chip" style={{ borderStyle: "dashed" }}>{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "diagram":
        return (
          <div>
            {workflow_mermaid && (
              <>
                <div className="auto-section-label" style={{ marginBottom: 14 }}>Mermaid Flowchart</div>
                <div className="auto-mermaid-wrapper">
                  <MermaidDiagram chart={workflow_mermaid} />
                </div>
              </>
            )}

            {workflow_ascii && (
              <div className="auto-ascii-box">
                <h4>ASCII Flow</h4>
                <pre>{workflow_ascii}</pre>
              </div>
            )}

            {!workflow_mermaid && !workflow_ascii && (
              <p style={{ color: "#666" }}>No diagram available.</p>
            )}
          </div>
        );

      case "nodes":
        return (
          <div className="auto-nodes-list">
            {nodes.length === 0 && <p style={{ color: "#666" }}>No nodes available.</p>}
            {nodes.map((node, i) => (
              <div key={node.id || i} className="auto-node-card">
                <div className="auto-node-icon">
                  {node.type === "trigger" ? <Zap size={18} /> : <GitBranch size={18} />}
                </div>
                <div className="auto-node-info">
                  <h4>{node.name}</h4>
                  <span className="auto-node-type-badge">{node.type}</span>
                  <p>{node.purpose}</p>
                  {node.config && Object.keys(node.config).length > 0 && (
                    <code style={{ fontSize: 12, color: "#666", marginTop: 6, display: "block" }}>
                      {JSON.stringify(node.config)}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case "steps":
        return (
          <div className="auto-steps-list">
            {steps.length === 0 && <p style={{ color: "#666" }}>No steps available.</p>}
            {steps.map((step, i) => (
              <div key={i} className="auto-step-item">
                <div className="auto-step-connector">
                  <div className="auto-step-number">{step.step || i + 1}</div>
                  {i < steps.length - 1 && <div className="auto-step-line" />}
                </div>
                <div className="auto-step-body">
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        );

      case "json":
        return (
          <div>
            <div className="auto-json-toolbar">
              <button
                className={`auto-action-btn primary ${copied ? "copy-success" : ""}`}
                onClick={handleCopyJson}
                id="btn-copy-json"
              >
                {copied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
                {copied ? "Copied!" : "Copy JSON"}
              </button>
              <button
                className="auto-action-btn secondary"
                onClick={handleDownloadJson}
                id="btn-download-json"
              >
                <Download size={14} />
                Download JSON
              </button>
            </div>
            <pre className="auto-json-pre">
              {JSON.stringify(workflow_json, null, 2)}
            </pre>
          </div>
        );

      case "credentials":
        return (
          <div className="auto-cred-list">
            {credentials.length === 0 && (
              <p style={{ color: "#666" }}>No credentials required for this workflow.</p>
            )}
            {credentials.map((cred, i) => (
              <div key={i} className="auto-cred-card">
                <div className="auto-cred-icon">
                  <Key size={18} />
                </div>
                <div className="auto-cred-info">
                  <h4>
                    {cred.name}
                    {cred.required !== false && (
                      <span className="auto-required-badge">Required</span>
                    )}
                  </h4>
                  <p>{cred.description || cred.setup}</p>
                  {cred.setup_url && (
                    <a
                      href={cred.setup_url}
                      target="_blank"
                      rel="noreferrer"
                      className="auto-cred-link"
                    >
                      Setup Guide ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case "deployment":
        return <SimpleMarkdown text={deployment} />;

      case "testing":
        return <SimpleMarkdown text={testing} />;

      case "errors":
        return <SimpleMarkdown text={error_handling} />;

      case "security":
        return <SimpleMarkdown text={security_notes} />;

      default:
        return null;
    }
  }

  return (
    <div className="automation-panel">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="auto-panel-header">
        <div className="auto-panel-title-row">
          <h2>{title}</h2>
          <span className="auto-platform-badge">{platform}</span>
        </div>

        {description && <p className="auto-panel-desc">{description}</p>}

        {platform_alternatives.length > 0 && (
          <div className="auto-platform-alts">
            <span>Also works with:</span>
            {platform_alternatives.map((p, i) => (
              <span key={i} className="auto-alt-chip">{p}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Validation Notices ───────────────────────────────── */}
      {(validation_errors.length > 0 || validation_warnings.length > 0) && (
        <div className="auto-validation-bar">
          {validation_errors.map((e, i) => (
            <div key={i} className="auto-validation-error">
              <TriangleAlert size={14} />
              {e}
            </div>
          ))}
          {validation_warnings.map((w, i) => (
            <div key={i} className="auto-validation-warning">
              <TriangleAlert size={14} />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* ── Tab Navigation ──────────────────────────────────── */}
      <div className="auto-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`auto-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            id={`tab-${tab.key}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────── */}
      <div className="auto-tab-content">
        {renderTabContent()}
      </div>

      {/* ── Download Row ─────────────────────────────────────── */}
      <div className="auto-download-row">
        <button className="auto-dl-btn" onClick={handleDownloadJson} id="btn-dl-json">
          <FileJson size={14} />
          JSON
        </button>
        <button className="auto-dl-btn" onClick={handleDownloadMarkdown} id="btn-dl-md">
          <FileText size={14} />
          Markdown
        </button>
        <button className="auto-dl-btn" onClick={handleDownloadTxt} id="btn-dl-txt">
          <FileText size={14} />
          TXT
        </button>
      </div>
    </div>
  );
}

export default AutomationPanel;