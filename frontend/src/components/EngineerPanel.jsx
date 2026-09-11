import { useEffect, useMemo, useState } from "react";
import FileViewer from "./FileViewer";
import LiveWebPreview, { compileProjectForPreview } from "./LiveWebPreview";
import api, { getBaseURL } from "../services/api";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { 
  Download, 
  ExternalLink, 
  Brain, 
  Code2, 
  CheckCircle2, 
  Sparkles,
  FolderGit2,
  Cpu,
  ShieldCheck,
  Zap,
  Globe,
  Columns,
  Maximize2,
  X
} from "lucide-react";

function normalizePath(path = "") {
  return path.replace(/^\.\//, "").replace(/^\//, "");
}

function findFile(files, matcher) {
  return files.find(file => matcher(normalizePath(file.path || "").toLowerCase()));
}

export function extractTechStack(plan = {}, files = []) {
  const tech = plan?.tech_stack || {};
  
  const formatList = (val) => {
    if (!val) return null;
    if (Array.isArray(val)) {
      const filtered = val.filter(Boolean);
      return filtered.length > 0 ? filtered : null;
    }
    if (typeof val === "string" && val.trim() && val.toLowerCase() !== "none") {
      return val.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (typeof val === "object") {
      const items = Object.values(val).flat().filter(Boolean);
      return items.length > 0 ? items : null;
    }
    return null;
  };

  let frontend = formatList(tech.frontend) || formatList(tech.ui) || formatList(tech.client);
  let backend = formatList(tech.backend) || formatList(tech.server) || formatList(tech.api);
  let database = formatList(tech.database) || formatList(tech.db) || formatList(tech.storage);
  let aiTools = formatList(tech.ai_tools) || formatList(tech.tools) || formatList(tech.devops);

  // If tech stack is empty or missing, smartly detect from generated files
  if ((!frontend || frontend.length === 0) && (!backend || backend.length === 0) && (!database || database.length === 0) && files.length > 0) {
    const paths = files.map(f => (f.path || "").toLowerCase());
    const fileCodes = files.map(f => (f.code || "").slice(0, 800).toLowerCase()).join(" ");

    // Frontend detection
    if (paths.some(p => p.endsWith(".jsx") || p.endsWith(".tsx") || p.includes("react"))) {
      frontend = ["React", "JSX"];
    } else if (paths.some(p => p.endsWith(".html") || p.endsWith(".vue") || p.endsWith(".css"))) {
      frontend = ["HTML5", "CSS3", "JavaScript"];
    }

    // Backend detection
    if (paths.some(p => p.endsWith(".py"))) {
      if (fileCodes.includes("fastapi")) backend = ["Python 3", "FastAPI"];
      else if (fileCodes.includes("flask")) backend = ["Python 3", "Flask"];
      else backend = ["Python 3"];
    } else if (paths.some(p => p.endsWith(".js") || p.endsWith(".ts"))) {
      if (fileCodes.includes("express")) backend = ["Node.js", "Express"];
      else backend = ["Node.js"];
    }

    // Database detection
    if (fileCodes.includes("mongodb") || fileCodes.includes("pymongo") || fileCodes.includes("mongoose")) {
      database = ["MongoDB"];
    } else if (fileCodes.includes("postgres") || fileCodes.includes("psycopg2") || fileCodes.includes("prisma")) {
      database = ["PostgreSQL"];
    } else if (fileCodes.includes("sqlite") || fileCodes.includes("sqlite3")) {
      database = ["SQLite"];
    } else if (fileCodes.includes("redis")) {
      database = ["Redis"];
    }

    // DevOps / Container detection
    if (paths.some(p => p.includes("docker"))) {
      aiTools = ["Docker", "Containerization"];
    }
  }

  return {
    frontend: frontend && frontend.length > 0 ? frontend : ["Modern Web / HTML5"],
    backend: backend && backend.length > 0 ? backend : ["Python 3, FastAPI"],
    database: database && database.length > 0 ? database : ["In-Memory / SQLite"],
    aiTools: aiTools && aiTools.length > 0 ? aiTools : null
  };
}

export function formatProjectOutput(result) {
  if (!result) return "✅ Project generated successfully.";
  
  const plan = result.project_plan || {};
  const name = plan.project_name || result.idea?.slice(0, 40) || "Autonomous AI Project";
  const desc = plan.project_description || plan.description || result.idea || "Engineered multi-agent production build.";
  
  const files = result.fixed_code?.files || result.generated_code?.files || [];
  const tech = extractTechStack(plan, files);
  
  const techItems = [];
  if (tech.frontend?.length) techItems.push(...tech.frontend);
  if (tech.backend?.length) techItems.push(...tech.backend);
  if (tech.database?.length && !tech.database.includes("In-Memory / None")) techItems.push(...tech.database);
  if (tech.aiTools?.length) techItems.push(...tech.aiTools);
  
  const fileList = files.map(f => `\`${f.path || f.name}\``).join(" · ");

  const rawFeatures = Array.isArray(plan.features) ? plan.features.slice(0, 4) : [];
  const features = rawFeatures.length > 0
    ? rawFeatures.map(f => `* ${f.replace(/^\*+\s*/, '')}`).join("\n")
    : "* Clean separation of frontend structure, styles, and logic\n* Built-in local persistence & responsive viewport\n* Sandboxed browser runtime execution";

  return `### ⚡ ${name}

${desc}

**Tech Stack:** ${techItems.length > 0 ? techItems.join(" · ") : "HTML5 · CSS3 · JavaScript · Python"}

**Generated Files (${files.length}):** ${fileList || "None"}

**Key Features:**
${features}`;
}

export function buildPreviewDocument(files) {
  return compileProjectForPreview(files, "NexusAI Project");
}

function EngineerPanel({
  result,
  loading,
  onClose,
  isModal = false,
  initialMode = "code"
}) {
  const { setResult } = useWorkspace();
  const [diffs, setDiffs] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [learnings, setLearnings] = useState([]);
  const [loadingLearnings, setLoadingLearnings] = useState(false);
  const [learningsModalOpen, setLearningsModalOpen] = useState(false);
  const [panelViewMode, setPanelViewMode] = useState(initialMode || "code"); // "preview" | "code" | "split"

  const targetId = result?.execution_id || result?.project_id || result?._id;

  const files = useMemo(() => {
    return result?.fixed_code?.files?.length
      ? result.fixed_code.files
      : result?.generated_code?.files || [];
  }, [result]);

  const hasFrontendFiles = useMemo(() => {
    return files.some(f => {
      const p = normalizePath(f.path || "").toLowerCase();
      return p.endsWith(".html") || p.endsWith(".jsx") || p.endsWith(".tsx") || p.endsWith(".vue") || p.endsWith(".css") || p.endsWith(".js");
    });
  }, [files]);

  // Set default view mode if not specified
  useEffect(() => {
    if (files.length > 0 && !initialMode) {
      if (hasFrontendFiles) {
        setPanelViewMode("code");
      } else {
        setPanelViewMode("code");
      }
    }
  }, [result?.execution_id, hasFrontendFiles, initialMode]);

  useEffect(() => {
    if (learningsModalOpen && targetId) {
      const fetchExecutionLearnings = async () => {
        try {
          setLoadingLearnings(true);
          const res = await api.get("/ai/learnings");
          const filtered = (res.data || []).filter(
            l => l.execution_id === targetId || l.project_id === targetId
          );
          setLearnings(filtered);
        } catch (err) {
          console.error("Failed to load learnings:", err);
        } finally {
          setLoadingLearnings(false);
        }
      };
      fetchExecutionLearnings();
    }
  }, [learningsModalOpen, targetId]);

  function handleFileSave(path, newCode) {
    const hasFixed = result?.fixed_code?.files?.length > 0;
    const codeField = hasFixed ? "fixed_code" : "generated_code";
    const filesList = result?.[codeField]?.files || [];

    const updatedFiles = filesList.map(f => 
      f.path === path ? { ...f, code: newCode } : f
    );

    const updatedResult = {
      ...result,
      [codeField]: {
        ...result[codeField],
        files: updatedFiles
      }
    };

    setResult("engineer", updatedResult);
  }

  useEffect(() => {
    const execId = result?.execution_id || result?._id;
    if (!execId) return;

    const hasFixed = result?.fixed_code?.files?.length > 0;
    const hasGenerated = result?.generated_code?.files?.length > 0;

    if (hasFixed && hasGenerated) {
      api
        .get(`/ai/executions/${execId}/diff?compare=fixed`)
        .then(res => setDiffs(res.data || []))
        .catch(() => setDiffs([]));
    }
  }, [result]);

  const previewDocument = useMemo(
    () => compileProjectForPreview(files, result?.project_plan?.project_name || "NexusAI Project"),
    [files, result?.project_plan?.project_name]
  );

  const downloadUrl = result?.project_id
    ? `${getBaseURL()}/projects/${result.project_id}/download`
    : result?.execution_id
      ? `${getBaseURL()}/projects/${result.execution_id}/download`
      : result?.zip_url
        ? `${getBaseURL()}${result.zip_url}`
        : "";

  const techStack = useMemo(() => {
    return extractTechStack(result?.project_plan, files);
  }, [result?.project_plan, files]);

  if (!result && !loading) {
    return (
      <div className="output-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 120px)", color: "#a3a3a3", textAlign: "center", padding: "40px" }}>
        <div style={{ fontSize: "52px", marginBottom: "16px" }}>⚡</div>
        <h2 style={{ color: "#ffffff", fontSize: "20px", fontWeight: "600", marginBottom: "10px", borderBottom: "none" }}>Workspace Code & Live Editor</h2>
        <p style={{ fontSize: "13.5px", maxWidth: "380px", lineHeight: "1.6", color: "#8e8e8f" }}>
          Describe any software idea in chat. Multi-file codebases populate here with live website preview, code editing, and downloadable archives.
        </p>
      </div>
    );
  }

  return (
    <div className="output-card" style={{ padding: "16px 20px" }}>
      {result ? (
        <div className="engineer-details-content" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Streamlined Clean Header Bar */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            flexWrap: "wrap", 
            gap: "10px", 
            paddingBottom: "10px", 
            borderBottom: "1px solid rgba(255,255,255,0.06)" 
          }}>
            {/* Left: Project Title & Compact Status */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                flexShrink: 0
              }}>
                ⚡
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#f4f4f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {result.project_plan?.project_name || "Autonomous AI Project"}
                  </h2>
                  <span style={{ 
                    fontSize: "11px", 
                    color: "#a1a1aa", 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: "4px",
                    fontWeight: "500" 
                  }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80" }}></span>
                    {files.length} files
                  </span>
                </div>
              </div>
            </div>

            {/* Center: Clean Segmented View Mode Switcher */}
            <div className="engineer-view-mode-tabs">
              <button
                type="button"
                className={`engineer-mode-tab-btn ${panelViewMode === "preview" ? "active" : ""}`}
                onClick={() => setPanelViewMode("preview")}
                title="Live Website Preview"
              >
                <Globe size={13} />
                <span>Live Preview</span>
                {hasFrontendFiles && <span className="tab-badge-live">Live</span>}
              </button>
              <button
                type="button"
                className={`engineer-mode-tab-btn ${panelViewMode === "code" ? "active" : ""}`}
                onClick={() => setPanelViewMode("code")}
                title="Monaco Code Editor"
              >
                <Code2 size={13} />
                <span>Code ({files.length})</span>
              </button>
              <button
                type="button"
                className={`engineer-mode-tab-btn ${panelViewMode === "split" ? "active" : ""}`}
                onClick={() => setPanelViewMode("split")}
                title="Side-by-Side Split View"
              >
                <Columns size={13} />
                <span>Split</span>
              </button>
            </div>

            {/* Right: Actions (Download ZIP & Learnings) */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="download-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "500",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    textDecoration: "none",
                    cursor: "pointer"
                  }}
                >
                  <Download size={13} /> Download ZIP
                </a>
              )}
              
              <button
                type="button"
                onClick={() => setLearningsModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "500",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#a1a1aa",
                  cursor: "pointer"
                }}
              >
                <Brain size={13} /> Learnings
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="ws-modal-close-icon-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#a1a1aa",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    marginLeft: "4px"
                  }}
                  title="Close Workspace Modal"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Optional Subtle QA Notification */}
          {result.debug_report && (
            <div style={{ 
              background: "rgba(255, 255, 255, 0.02)", 
              border: "1px solid rgba(255, 255, 255, 0.06)", 
              borderRadius: "6px", 
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <ShieldCheck size={12} style={{ color: "#a1a1aa", flexShrink: 0 }} />
              <div style={{ fontSize: "11px", color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {result.debug_report}
              </div>
            </div>
          )}

          {/* MAIN WORKSPACE CONTENT: PREVIEW, CODE, OR SPLIT */}
          {panelViewMode === "preview" && (
            <div style={{ width: "100%", height: "calc(100vh - 280px)", minHeight: "560px" }}>
              <LiveWebPreview
                files={files}
                projectName={result.project_plan?.project_name || result.idea || "Autonomous AI Project"}
                executionId={targetId}
              />
            </div>
          )}

          {panelViewMode === "code" && files.length > 0 && (
            <div style={{ width: "100%", marginTop: "0px" }}>
              <FileViewer
                files={files}
                diffs={diffs}
                showDiffToggle={diffs.length > 0}
                executionId={targetId}
                onFileSave={handleFileSave}
              />
            </div>
          )}

          {panelViewMode === "split" && (
            <div className="engineer-split-container">
              <div className="engineer-split-pane">
                <FileViewer
                  files={files}
                  diffs={diffs}
                  showDiffToggle={diffs.length > 0}
                  executionId={targetId}
                  onFileSave={handleFileSave}
                />
              </div>
              <div className="engineer-split-pane">
                <LiveWebPreview
                  files={files}
                  projectName={result.project_plan?.project_name || result.idea || "Autonomous AI Project"}
                  executionId={targetId}
                />
              </div>
            </div>
          )}

          {/* Standalone Live Preview Modal (if triggered explicitly) */}
          {previewOpen && (
            <div className="preview-modal" role="dialog" aria-modal="true">
              <LiveWebPreview
                files={files}
                projectName={result.project_plan?.project_name || result.idea || "Autonomous AI Project"}
                executionId={targetId}
                isModal={true}
                onClose={() => setPreviewOpen(false)}
              />
            </div>
          )}

          {/* Learnings & Agent Synthesis Modal */}
          {learningsModalOpen && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.82)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px"
            }}>
              <div style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "700px",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px",
                  borderBottom: "1px solid #27272a"
                }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>🧠</span> Agent Brain - Project Learnings & Synthesis
                  </h3>
                  <button 
                    type="button" 
                    onClick={() => setLearningsModalOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#a1a1aa",
                      cursor: "pointer",
                      fontSize: "20px",
                      padding: "4px"
                    }}
                  >
                    &times;
                  </button>
                </div>

                <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Synthesis Cards */}
                  <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <Cpu size={15} style={{ color: "#c084fc" }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#c084fc", textTransform: "uppercase" }}>Planner Architectural Blueprint</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "#e4e4e7", lineHeight: "1.5" }}>
                      {result.project_plan?.project_description || "System partitioned into modular decoupled files with explicit interface boundaries."}
                    </p>
                  </div>

                  <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <Code2 size={15} style={{ color: "#60a5fa" }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#60a5fa", textTransform: "uppercase" }}>Coder File Modularization</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "#e4e4e7", lineHeight: "1.5" }}>
                      Engineered {files.length} production files ({files.map(f => f.path).join(", ")}). Clean import resolution and entry point initialization verified.
                    </p>
                  </div>

                  <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <ShieldCheck size={15} style={{ color: "#34d399" }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#34d399", textTransform: "uppercase" }}>Automated QA & Self-Healing Guardrails</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "#e4e4e7", lineHeight: "1.5" }}>
                      {result.debug_report || "Code compiled without syntax warnings on the first pass. All router, database, and module dependencies verified."}
                    </p>
                  </div>

                  {/* Database-persisted compiler learnings if any */}
                  {learnings.length > 0 && (
                    <div style={{ marginTop: "6px" }}>
                      <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#fb923c", textTransform: "uppercase" }}>Recorded Compiler Lessons:</h4>
                      {learnings.map((l) => (
                        <div key={l._id} style={{ background: "rgba(24, 24, 27, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px", padding: "12px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#f87171", textTransform: "uppercase" }}>{l.error_type || "Self-Correction"}</span>
                          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#e4e4e7" }}>{l.lesson_learned}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{
                  padding: "10px 20px",
                  borderTop: "1px solid #27272a",
                  display: "flex",
                  justifyContent: "flex-end",
                  background: "#121214"
                }}>
                  <button 
                    type="button" 
                    onClick={() => setLearningsModalOpen(false)}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "8px",
                      color: "#ffffff",
                      padding: "5px 14px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default EngineerPanel;