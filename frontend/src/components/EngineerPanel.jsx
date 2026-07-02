import { useEffect, useMemo, useState } from "react";
import FileViewer from "./FileViewer";
import api from "../services/api";
import { useWorkspace } from "../contexts/WorkspaceContext";
import AgentTracingCanvas from "./workspace/AgentTracingCanvas";

function normalizePath(path = "") {
  return path.replace(/^\.\//, "").replace(/^\//, "");
}

function findFile(files, matcher) {
  return files.find(file => matcher(normalizePath(file.path || "").toLowerCase()));
}

function formatProjectOutput(result) {
  if (!result) return "Project generated successfully.";
  
  const plan = result.project_plan || {};
  const name = plan.project_name || "Untitled Project";
  const desc = plan.project_description || "No description provided.";
  
  const tech = plan.tech_stack || {};
  const frontend = tech.frontend?.join(", ") || "None";
  const backend = tech.backend?.join(", ") || "None";
  const database = tech.database?.join(", ") || "None";
  
  const features = plan.features?.map(f => `- ${f}`).join("\n") || "No features specified.";
  
  const files = result.fixed_code?.files || result.generated_code?.files || [];
  const fileNames = files.map(f => `- \`${f.path}\``).join("\n") || "No files generated.";
  
  return `### 🚀 Project Generated: **${name}**

**Description:**
${desc}

**🛠 Tech Stack:**
* **Frontend:** ${frontend}
* **Backend:** ${backend}
* **Database:** ${database}

**✨ Key Features:**
${features}

**📁 Generated Files:**
${fileNames}

**📊 Execution Summary:**
* **Iterations:** ${result.iterations || 0}
* **Status:** ${result.status || "completed"}
* **Path:** \`${result.project_path || "N/A"}\``;
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
  const [activeTab, setActiveTab] = useState(() => result ? "files" : "canvas");
  const [learnings, setLearnings] = useState([]);
  const [loadingLearnings, setLoadingLearnings] = useState(false);
  const [learningsModalOpen, setLearningsModalOpen] = useState(false);

  useEffect(() => {
    if (learningsModalOpen && result?.execution_id) {
      const fetchExecutionLearnings = async () => {
        try {
          setLoadingLearnings(true);
          const res = await api.get("/ai/learnings");
          const filtered = (res.data || []).filter(
            l => l.execution_id === result?.execution_id || l.project_id === result?.project_id
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
  }, [learningsModalOpen, result?.execution_id, result?.project_id]);

  useEffect(() => {
    if (loading) {
      setActiveTab("canvas");
    } else if (result && result.status === "completed") {
      setActiveTab("files");
    }
  }, [loading, result]);

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

  const downloadUrl = result?.zip_url
    ? `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}${result.zip_url}`
    : result?.project_id
      ? `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/projects/${result.project_id}/download`
      : "";

  if (!result && !loading) {
    return (
      <div className="output-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 120px)", color: "#a3a3a3", textAlign: "center", padding: "40px" }}>
        <div style={{ fontSize: "56px", marginBottom: "20px" }}>💻</div>
        <h2 style={{ color: "#ffffff", fontSize: "22px", fontWeight: "600", marginBottom: "12px", borderBottom: "none" }}>Workspace Files</h2>
        <p style={{ fontSize: "14px", maxWidth: "340px", lineHeight: "1.6", color: "#8e8e8f" }}>
          Describe your software idea in the chat and run the agent to see your project files populate here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="output-card">
      <div className="engineer-panel-tabs" style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid #2a2a2a", paddingBottom: "12px" }}>
        {result && (
          <button
            className={`tab-btn ${activeTab === "files" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab("files")}
            style={{
              background: activeTab === "files" ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "1px solid",
              borderColor: activeTab === "files" ? "rgba(255, 255, 255, 0.15)" : "transparent",
              color: activeTab === "files" ? "#ffffff" : "#a1a1aa",
              padding: "6px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            📁 Generated Files
          </button>
        )}
        <button
          className={`tab-btn ${activeTab === "canvas" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("canvas")}
          style={{
            background: activeTab === "canvas" ? "rgba(255, 255, 255, 0.08)" : "transparent",
            border: "1px solid",
            borderColor: activeTab === "canvas" ? "rgba(255, 255, 255, 0.15)" : "transparent",
            color: activeTab === "canvas" ? "#ffffff" : "#a1a1aa",
            padding: "6px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          📊 Execution Canvas
        </button>
      </div>

      {activeTab === "canvas" ? (
        <AgentTracingCanvas steps={result?.execution_steps || []} />
      ) : result ? (
        <>
          <h2>
            Project Generated
          </h2>

      <div className="result-grid">

        <div className="result-box">

          <span>

            Project ID

          </span>

          <h3>

            {result.project_id}

          </h3>

        </div>

        <div className="result-box">

          <span>

            Status

          </span>

          <h3>

            {result.status}

          </h3>

        </div>

        <div className="result-box">

          <span>

            Iterations

          </span>

          <h3>

            {result.iterations}

          </h3>

        </div>

      </div>

      {(downloadUrl || previewDocument || result) && (

        <div className="engineer-actions" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>

          {downloadUrl && (

            <a

              href={downloadUrl}

              target="_blank"

              rel="noreferrer"

              className="download-btn"

            >

              Download Project ZIP

            </a>

          )}

          {previewDocument && (

            <button

              className="preview-open-btn"

              type="button"

              onClick={() => setPreviewOpen(true)}

            >

              Preview Fullscreen

            </button>

          )}

          {result && (

            <button

              className="preview-open-btn"

              type="button"

              onClick={() => setLearningsModalOpen(true)}

              style={{

                display: "flex",

                alignItems: "center",

                gap: "6px",

                background: "rgba(255, 255, 255, 0.05)",

                border: "1px solid rgba(255, 255, 255, 0.1)",

                color: "#ffffff"

              }}

            >

              🧠 View Learnings

            </button>

          )}

        </div>

      )}

      <div className="section">

        <h3>

          Project Overview

        </h3>

        <p>

          {

            result.project_plan?.project_description

          }

        </p>

      </div>

      <div className="section">

        <h3>

          Tech Stack

        </h3>

        <div className="chips">

          {

            result.project_plan?.tech_stack?.frontend?.map(

              item => (

                <span

                  key={item}

                  className="chip"

                >

                  {item}

                </span>

              )

            )

          }

          {

            result.project_plan?.tech_stack?.backend?.map(

              item => (

                <span

                  key={item}

                  className="chip"

                >

                  {item}

                </span>

              )

            )

          }

          {

            result.project_plan?.tech_stack?.database?.map(

              item => (

                <span

                  key={item}

                  className="chip"

                >

                  {item}

                </span>

              )

            )

          }

        </div>

      </div>

      <div className="section">

        <h3>

          Execution Timeline

        </h3>

        <div className="execution-timeline">

          {

            result.execution_steps?.length > 0

              ? result.execution_steps.map(

                  (

                    step,

                    index

                  ) => (

                    <div

                      key={index}

                      className="timeline-item"

                    >

                      <div className="timeline-time">

                        {

                          new Date(

                            step.timestamp

                          ).toLocaleTimeString()

                        }

                      </div>

                      <div className="timeline-content">

                        <div className="timeline-header">

                          <span

                            className={`badge ${step.status}`}

                          >

                            {step.agent}

                          </span>

                          <span className="timeline-message">

                            {step.message}

                          </span>

                        </div>

                        {

                          step.details && (

                            <div className="timeline-details">

                              {

                                Object.entries(

                                  step.details

                                ).map(

                                  ([key, value]) => (

                                    <span

                                      key={key}

                                      style={{

                                        marginRight: "16px"

                                      }}

                                    >

                                      {

                                        key

                                      }

                                      : {

                                        Array.isArray(value)

                                          ? value.join(", ")

                                          : typeof value === "object"

                                          ? JSON.stringify(value)

                                          : String(value)

                                      }

                                    </span>

                                  )

                                )

                              }

                            </div>

                          )

                        }

                      </div>

                    </div>

                  )

                )

              : (

                <p className="timeline-empty">

                  No execution steps recorded

                </p>

              )

          }

        </div>

      </div>

      <div className="section">

        <h3>

          Features

        </h3>

        <ul>

          {

            result.project_plan?.features?.map(

              (

                feature,

                index

              ) => (

                <li key={index}>

                  {feature}

                </li>

              )

            )

          }

        </ul>

      </div>


      {

        files.length > 0 && (

          <div className="section">

            <h3>

              Generated Files

            </h3>

            <FileViewer

              files={files}

              diffs={diffs}

              showDiffToggle={diffs.length > 0}

              executionId={result.execution_id || result._id}

              onFileSave={handleFileSave}

            />

          </div>

        )

      }

      {

        result.debug_report && (

          <div className="section">

            <h3>

              Debug Report

            </h3>

            <div className="debug-box">

              {

                result.debug_report

              }

            </div>

          </div>

        )

      }


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

      {/* Agent Brain Learnings Modal */}
      {learningsModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(4px)",
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
            maxWidth: "680px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)"
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid #27272a"
            }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🧠</span> Agent Brain - Project Learnings
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

            {/* Modal Content */}
            <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
              {loadingLearnings ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px", color: "#a1a1aa" }}>
                  <span>Retrieving lessons from execution memory...</span>
                </div>
              ) : learnings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#71717a" }}>
                  <p style={{ fontSize: "14px", margin: "0 0 8px 0", color: "#e4e4e7" }}>No corrections were required for this run.</p>
                  <p style={{ fontSize: "12px", margin: 0 }}>The project was generated successfully on the first attempt without compiler errors!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {learnings.map((l) => {
                    const badgeClass = l.error_type?.toLowerCase().includes("syntax") ? "badge-syntax" 
                      : l.error_type?.toLowerCase().includes("import") ? "badge-import"
                      : l.error_type?.toLowerCase().includes("db") ? "badge-db" : "badge-logic";

                    // Parse code block diffs helper inside modal
                    const parseCodeDiff = (failedCodeText) => {
                      if (!failedCodeText) return { failed: "", fixed: "" };
                      const failedMatch = failedCodeText.match(/--- FAILED CODE ---\n([\s\S]*?)(?=\n--- FIXED CODE ---|$)/);
                      const fixedMatch = failedCodeText.match(/--- FIXED CODE ---\n([\s\S]*?)$/);
                      return {
                        failed: failedMatch ? failedMatch[1].trim() : "",
                        fixed: fixedMatch ? fixedMatch[1].trim() : ""
                      };
                    };
                    const diff = parseCodeDiff(l.failed_code);

                    return (
                      <div key={l._id} style={{
                        background: "rgba(24, 24, 27, 0.55)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "12px",
                        padding: "16px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                          <span className={`error-badge ${badgeClass}`} style={{ fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase" }}>
                            {l.error_type || "LogicError"}
                          </span>
                          <span style={{ fontSize: "11px", color: "#71717a" }}>
                            {new Date(l.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Lesson box */}
                        <div style={{ 
                          background: "rgba(255, 255, 255, 0.02)", 
                          border: "1px solid rgba(255, 255, 255, 0.08)", 
                          borderRadius: "8px", 
                          padding: "12px",
                          marginBottom: "12px"
                        }}>
                          <strong style={{ display: "block", fontSize: "11px", color: "#ffffff", textTransform: "uppercase", marginBottom: "4px" }}>Lesson Learned</strong>
                          <p style={{ margin: 0, fontSize: "13px", color: "#e4e4e7", lineHeight: "1.4" }}>{l.lesson_learned}</p>
                        </div>

                        {/* Expandable Diffs */}
                        {diff.failed && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                              <div style={{ background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.12)", borderBottom: "none", borderTopLeftRadius: "6px", borderTopRightRadius: "6px", padding: "4px 8px", fontSize: "10px", fontWeight: "700", color: "#f87171" }}>
                                ORIGINAL FAILED CODE
                              </div>
                              <pre style={{ margin: 0, background: "rgba(20, 20, 20, 0.5)", border: "1px solid rgba(239, 68, 68, 0.12)", borderBottomLeftRadius: "6px", borderBottomRightRadius: "6px", padding: "8px", overflowX: "auto", fontSize: "11px", fontFamily: "monospace", color: "#fca5a5", maxHeight: "150px" }}>
                                <code>{diff.failed}</code>
                              </pre>
                            </div>
                            <div>
                              <div style={{ background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.12)", borderBottom: "none", borderTopLeftRadius: "6px", borderTopRightRadius: "6px", padding: "4px 8px", fontSize: "10px", fontWeight: "700", color: "#4ade80" }}>
                                FIXED CORRECTED CODE
                              </div>
                              <pre style={{ margin: 0, background: "rgba(20, 20, 20, 0.5)", border: "1px solid rgba(34, 197, 94, 0.12)", borderBottomLeftRadius: "6px", borderBottomRightRadius: "6px", padding: "8px", overflowX: "auto", fontSize: "11px", fontFamily: "monospace", color: "#86efac", maxHeight: "150px" }}>
                                <code>{diff.fixed}</code>
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Modal Footer */}
            <div style={{
              padding: "12px 20px",
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
                  padding: "6px 14px",
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
      </>
      ) : null}
    </div>

  );

 }

export { formatProjectOutput };
export default EngineerPanel;