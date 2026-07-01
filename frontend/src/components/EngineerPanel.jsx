import { useEffect, useMemo, useState } from "react";
import FileViewer from "./FileViewer";
import api from "../services/api";
import { useWorkspace } from "../contexts/WorkspaceContext";

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

  result

}) {

  const { setResult } = useWorkspace();
  const [diffs, setDiffs] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);

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

  if (!result) {
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

      {(downloadUrl || previewDocument) && (

        <div className="engineer-actions">

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

    </div>

  );

}

export { formatProjectOutput };
export default EngineerPanel;