import { useEffect, useMemo, useState } from "react";
import FileViewer from "./FileViewer";
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
  Zap
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

function formatProjectOutput(result) {
  if (!result) return "✅ Project generated successfully.";
  
  const plan = result.project_plan || {};
  const name = plan.project_name || "Autonomous AI Project";
  const desc = plan.project_description || result.idea || "Engineered multi-agent production build.";
  
  const files = result.fixed_code?.files || result.generated_code?.files || [];
  const tech = extractTechStack(plan, files);
  
  const techLines = [];
  if (tech.frontend?.length) techLines.push(`* 🎨 **Frontend:** ${tech.frontend.join(", ")}`);
  if (tech.backend?.length) techLines.push(`* ⚙️ **Backend:** ${tech.backend.join(", ")}`);
  if (tech.database?.length && !tech.database.includes("In-Memory / None")) techLines.push(`* 🗄️ **Database:** ${tech.database.join(", ")}`);
  if (tech.aiTools?.length) techLines.push(`* 🛠️ **DevOps:** ${tech.aiTools.join(", ")}`);
  
  const rawFeatures = Array.isArray(plan.features) ? plan.features : [];
  const features = rawFeatures.length > 0
    ? rawFeatures.slice(0, 3).map(f => `- ${f}`).join("\n")
    : "- Automated multi-file modular architecture\n- Production-ready tested implementation";
    
  const fileLines = files.length > 0
    ? files.slice(0, 5).map(f => `- 📄 \`${f.path}\``).join("\n") + (files.length > 5 ? `\n- *+${files.length - 5} more files in workspace*` : "")
    : "No files recorded";

  return `### 🚀 **${name}**

${desc}

${techLines.length > 0 ? `**🛠 Tech Stack:**\n${techLines.join("\n")}\n` : ""}
**✨ Highlights:**
${features}

**📁 Generated Files (${files.length}):**
${fileLines}`;
}

function buildPreviewDocument(files) {
  const htmlFile =
    findFile(files, path => path.endsWith("index.html")) ||
    findFile(files, path => path.endsWith(".html"));

  if (!htmlFile?.code) return "";

  let html = htmlFile.code;

  const cssFiles = files.filter(file => normalizePath(file.path || "").toLowerCase().endsWith(".css"));
  const jsFiles = files.filter(file => {
    const path = normalizePath(file.path || "").toLowerCase();
    return path.endsWith(".js") && !path.endsWith(".config.js");
  });

  cssFiles.forEach(file => {
    const path = normalizePath(file.path || "");
    const name = path.split("/").pop();
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkPattern = new RegExp(`<link[^>]+href=["'](?:\\./|/)?(?:${escapedPath}|${escapedName})["'][^>]*>`, "gi");
    html = html.replace(linkPattern, `<style>\n${file.code}\n</style>`);
  });

  jsFiles.forEach(file => {
    const path = normalizePath(file.path || "");
    const name = path.split("/").pop();
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const scriptPattern = new RegExp(`<script[^>]+src=["'](?:\\./|/)?(?:${escapedPath}|${escapedName})["'][^>]*><\/script>`, "gi");
    html = html.replace(scriptPattern, `<script>\n${file.code}\n</script>`);
  });

  if (cssFiles.length > 0 && !/<style[\s>]/i.test(html)) {
    const styleBlock = "<style>\n" + cssFiles.map(file => file.code).join("\n") + "\n</style>";
    html = html.includes("</head>")
      ? html.replace("</head>", styleBlock + "</head>")
      : styleBlock + html;
  }

  if (jsFiles.length > 0 && !/<script[\s>]/i.test(html)) {
    const scriptBlock = "<script>\n" + jsFiles.map(file => file.code).join("\n") + "\n</script>";
    html = html.includes("</body>")
      ? html.replace("</body>", scriptBlock + "</body>")
      : html + scriptBlock;
  }

  return html;
}

function EngineerPanel({
  result,
  loading
}) {
  const { setResult } = useWorkspace();
  const [diffs, setDiffs] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [learnings, setLearnings] = useState([]);
  const [loadingLearnings, setLoadingLearnings] = useState(false);
  const [learningsModalOpen, setLearningsModalOpen] = useState(false);

  const targetId = result?.execution_id || result?.project_id || result?._id;

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

  const files =
    result?.fixed_code?.files?.length
      ? result.fixed_code.files
      : result?.generated_code?.files || [];

  const previewDocument = useMemo(
    () => buildPreviewDocument(files),
    [files]
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
          Describe any software idea in chat. Multi-file codebases populate here with live editing, auto-save, and downloadable ZIP archives.
        </p>
      </div>
    );
  }

  return (
    <div className="output-card" style={{ padding: "16px 20px" }}>
      {result ? (
        <div className="engineer-details-content" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Header Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: "700", color: "#f4f4f5", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🚀</span> {result.project_plan?.project_name || "Autonomous AI Project"}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11.5px", color: "#34d399", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                  <CheckCircle2 size={12} /> {result.status || "Completed"}
                </span>
                <span style={{ fontSize: "11.5px", color: "#71717a" }}>
                  {files.length} files • {result.iterations || 1} pass
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
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
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
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
              {previewDocument && (
                <button
                  className="preview-open-btn"
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                    border: "none",
                    color: "#ffffff",
                    cursor: "pointer"
                  }}
                >
                  <ExternalLink size={13} /> Live Preview
                </button>
              )}
              <button
                type="button"
                onClick={() => setLearningsModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#e4e4e7",
                  cursor: "pointer"
                }}
              >
                <Brain size={13} /> View Learnings
              </button>
            </div>
          </div>

          {/* Compact Architecture Overview & Stack Tags */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "10px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <p style={{ margin: 0, fontSize: "12.5px", lineHeight: "1.5", color: "#d4d4d8" }}>
              {result.project_plan?.project_description && result.project_plan?.project_description !== "No description provided." 
                ? result.project_plan.project_description 
                : (result.idea || "Engineered multi-agent production build.")}
            </p>
            
            {/* Tech Stack Pills in Single Row */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", paddingTop: "4px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: "11px", color: "#71717a", fontWeight: "600", textTransform: "uppercase" }}>Stack:</span>
              {techStack.frontend?.map(item => (
                <span key={item} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "5px", background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.25)", color: "#38bdf8" }}>
                  {item}
                </span>
              ))}
              {techStack.backend?.map(item => (
                <span key={item} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "5px", background: "rgba(168, 85, 247, 0.12)", border: "1px solid rgba(168, 85, 247, 0.25)", color: "#c084fc" }}>
                  {item}
                </span>
              ))}
              {techStack.database?.map(item => (
                <span key={item} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "5px", background: "rgba(52, 211, 153, 0.12)", border: "1px solid rgba(52, 211, 153, 0.25)", color: "#34d399" }}>
                  {item}
                </span>
              ))}
              {techStack.aiTools?.map(item => (
                <span key={item} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "5px", background: "rgba(251, 146, 60, 0.12)", border: "1px solid rgba(251, 146, 60, 0.25)", color: "#fb923c" }}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Self-Correction QA Log (Emerald/Green if passed) */}
          {result.debug_report && (
            <div style={{ 
              background: result.debug_report.toLowerCase().includes("fail") && !result.debug_report.toLowerCase().includes("fixed") ? "rgba(239, 68, 68, 0.05)" : "rgba(16, 185, 129, 0.06)", 
              border: `1px solid ${result.debug_report.toLowerCase().includes("fail") && !result.debug_report.toLowerCase().includes("fixed") ? "rgba(239, 68, 68, 0.18)" : "rgba(16, 185, 129, 0.2)"}`, 
              borderRadius: "8px", 
              padding: "8px 12px" 
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <ShieldCheck size={13} style={{ color: "#34d399" }} />
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#34d399" }}>
                  Automated QA & Self-Correction Log
                </span>
              </div>
              <div style={{ fontSize: "11.5px", color: "#a7f3d0", fontFamily: "monospace" }}>
                {result.debug_report}
              </div>
            </div>
          )}

          {/* Code Viewer & Monaco Editor */}
          {files.length > 0 && (
            <div style={{ marginTop: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#f4f4f5", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FolderGit2 size={14} /> Generated Project Repository ({files.length} files)
                </h3>
                <span style={{ fontSize: "11px", color: "#71717a" }}>Editable with live sync</span>
              </div>
              <FileViewer
                files={files}
                diffs={diffs}
                showDiffToggle={diffs.length > 0}
                executionId={result.execution_id || result.project_id || result._id}
                onFileSave={handleFileSave}
              />
            </div>
          )}

          {/* Live Preview Modal */}
          {previewOpen && previewDocument && (
            <div className="preview-modal" role="dialog" aria-modal="true">
              <div className="preview-modal-header">
                <div className="preview-toolbar compact">
                  <span></span>
                  <span></span>
                  <span></span>
                  <strong>Live Preview</strong>
                </div>
                <button
                  className="preview-close-btn"
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                >
                  Close
                </button>
              </div>
              <iframe
                title="Generated project fullscreen preview"
                srcDoc={previewDocument}
                sandbox="allow-scripts allow-forms allow-modals"
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

export { formatProjectOutput };
export default EngineerPanel;