import { useState, useEffect } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import api from "../services/api";
import "./FileViewer.css";

function formatHtml(code = "") {
  if (!code.trim()) return code;

  const lines = code
    .replace(/></g, ">\n<")
    .replace(/(<\/(?:html|head|body|div|section|main|header|footer|nav|ul|ol|li|p|h1|h2|h3|h4|button|a|form)>)/gi, "$1\n")
    .replace(/(<(?:html|head|body|div|section|main|header|footer|nav|ul|ol|li|p|h1|h2|h3|h4|button|a|form)(?:\s[^>]*)?>)/gi, "\n$1")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  let depth = 0;
  return lines.map(line => {
    if (/^<\//.test(line)) depth = Math.max(depth - 1, 0);
    const formatted = `${"  ".repeat(depth)}${line}`;
    if (/^<[^!/][^>]*[^/]>/i.test(line) && !/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/i.test(line) && !line.includes(`</`)) {
      depth += 1;
    }
    return formatted;
  }).join("\n");
}

function formatCss(code = "") {
  if (!code.trim()) return code;

  let depth = 0;
  return code
    .replace(/\{/g, " {\n")
    .replace(/;/g, ";\n")
    .replace(/\}/g, "\n}\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (line === "}") depth = Math.max(depth - 1, 0);
      const formatted = `${"  ".repeat(depth)}${line}`;
      if (line.endsWith("{") || line.endsWith(" {")) depth += 1;
      return formatted;
    })
    .join("\n");
}

function formatCodeForDisplay(path = "", code = "") {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".html")) return formatHtml(code);
  if (lowerPath.endsWith(".css")) return formatCss(code);
  if (lowerPath.endsWith(".json")) {
    try {
      return JSON.stringify(JSON.parse(code), null, 2);
    } catch {
      return code;
    }
  }

  return code;
}

function FileViewer({
  files = [],
  diffs = null,
  showDiffToggle = false,
  executionId = null,
  onFileSave = null,
}) {

  const [isFullscreen, setIsFullscreen] =
    useState(false);

  const [viewMode, setViewMode] = useState("code");

  const [localFiles, setLocalFiles] = useState(files);

  const [selectedFile, setSelectedFile] =
    useState(
      files.length > 0
        ? files[0]
        : null
    );

  const [selectedDiff, setSelectedDiff] = useState(
    diffs?.length > 0 ? diffs[0] : null
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalFiles(files);
      if (files.length > 0) {
        setSelectedFile(files[0]);
      } else {
        setSelectedFile(null);
      }
      setIsEditing(false);
      setEditedCode("");
    }, 0);
    return () => clearTimeout(timer);
  }, [files]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (diffs && diffs.length > 0) {
        setSelectedDiff(diffs[0]);
      } else {
        setSelectedDiff(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [diffs]);

  function handleStartEdit() {
    const currentFile = selectedFile || localFiles[0];
    const formatted = formatCodeForDisplay(currentFile?.path, currentFile?.code || "");
    setEditedCode(formatted);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setEditedCode("");
  }

  async function handleSave() {
    const currentFile = selectedFile || localFiles[0];
    if (!currentFile) return;

    if (!executionId) {
      alert("Execution ID not provided. Cannot save file.");
      return;
    }

    try {
      setSaving(true);
      const response = await api.post(`/ai/executions/${executionId}/save-file`, {
        path: currentFile.path,
        code: editedCode,
      });

      if (response.data?.success) {
        const updatedFiles = localFiles.map((f) =>
          f.path === currentFile.path ? { ...f, code: editedCode } : f
        );
        setLocalFiles(updatedFiles);
        setSelectedFile({ ...currentFile, code: editedCode });
        setIsEditing(false);
        setEditedCode("");

        if (onFileSave) {
          onFileSave(currentFile.path, editedCode);
        }
      } else {
        alert("Failed to save file: " + (response.data?.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Save file error:", error);
      alert("Error saving file: " + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  }

  function getLanguage(path) {

    if (!path)
      return "plaintext";

    if (path.endsWith(".py"))
      return "python";

    if (path.endsWith(".js"))
      return "javascript";

    if (path.endsWith(".jsx"))
      return "javascript";

    if (path.endsWith(".ts"))
      return "typescript";

    if (path.endsWith(".tsx"))
      return "typescript";

    if (path.endsWith(".json"))
      return "json";

    if (path.endsWith(".css"))
      return "css";

    if (path.endsWith(".html"))
      return "html";

    if (path.endsWith(".md"))
      return "markdown";

    return "plaintext";
  }

  if (!files || files.length === 0) {

    if (!diffs || diffs.length === 0) {

    return (

      <div
        style={{
          color: "white",
          padding: "20px"
        }}
      >

        No Files Available

      </div>

    );

    }

  }

  const activeFile =
    selectedFile || localFiles[0] || files[0];

  const activeDiff = selectedDiff || diffs?.[0];

  const handleEditorBeforeMount = (monaco) => {
    monaco.editor.defineTheme("nexusai-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#171717",
        "editor.lineHighlightBackground": "#212121",
        "editorGutter.background": "#171717",
      },
    });
  };

  const editorTheme = "nexusai-dark";


  return (

    <div
      className={
        isFullscreen
          ? "file-viewer fullscreen-viewer"
          : "file-viewer"
      }
    >

      <div className="file-sidebar">

        <div className="file-sidebar-header">

          <h3>
            {viewMode === "diff" ? "Code Changes" : "Generated Files"}
          </h3>

          <span>
            {viewMode === "diff"
              ? `${diffs?.length || 0} changes`
              : `${files.length} files`}
          </span>

        </div>

        {showDiffToggle && diffs?.length > 0 && (
          <div style={{ padding: "8px 12px", display: "flex", gap: "8px" }}>
            <button
              className={viewMode === "code" ? "action-btn active" : "action-btn"}
              onClick={() => setViewMode("code")}
            >
              Code
            </button>
            <button
              className={viewMode === "diff" ? "action-btn active" : "action-btn"}
              onClick={() => setViewMode("diff")}
            >
              Diff
            </button>
          </div>
        )}

        {viewMode === "diff" && diffs?.map((diff) => (
          <div
            key={diff.path}
            className={
              activeDiff?.path === diff.path
                ? "file-item active"
                : "file-item"
            }
            onClick={() => setSelectedDiff(diff)}
          >
            {diff.status === "added" ? "➕" : diff.status === "removed" ? "➖" : "📝"}{" "}
            {diff.path}
          </div>
        ))}

        {viewMode === "code" &&

          localFiles.map((file) => (

            <div

              key={file.path}

              className={
                activeFile?.path ===
                file.path
                  ? "file-item active"
                  : "file-item"
              }

              onClick={() => {
                if (isEditing) {
                  if (confirm("You have unsaved changes. Discard them?")) {
                    setIsEditing(false);
                    setSelectedFile(file);
                  }
                } else {
                  setSelectedFile(file);
                }
              }}

            >

              📄 {file.path}

            </div>

          ))

        }

      </div>

      <div className="code-panel">

        <div className="code-header">

          <span className="file-name">

            {viewMode === "diff"
              ? activeDiff?.path
              : activeFile?.path}

          </span>

          <div style={{ display: "flex", gap: "8px" }}>
            {viewMode === "code" && activeFile && (
              <>
                {isEditing ? (
                  <>
                    <button
                      className="action-btn save-btn"
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                        color: "white",
                        boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)"
                      }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="action-btn cancel-btn"
                      onClick={handleCancel}
                      disabled={saving}
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#cbd5e1"
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="action-btn edit-btn"
                    onClick={handleStartEdit}
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                      color: "white",
                      boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)"
                    }}
                  >
                    Edit
                  </button>
                )}
              </>
            )}

            <button

              className="action-btn"

              onClick={() =>
                setIsFullscreen(
                  !isFullscreen
                )
              }

              style={{
                background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                color: "white",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)"
              }}

            >

              {
                isFullscreen
                  ? "Exit Fullscreen"
                  : "Fullscreen"
              }

            </button>
          </div>

        </div>

        <div
          className="editor-container"
          style={{
            height: isFullscreen ? "calc(100vh - 64px)" : "700px"
          }}
        >

          {viewMode === "diff" && activeDiff ? (
            <DiffEditor
              key={activeDiff.path}
              height={isFullscreen ? "calc(100vh - 64px)" : "700px"}
              language={getLanguage(activeDiff.path)}
              theme={editorTheme}
              beforeMount={handleEditorBeforeMount}
              original={formatCodeForDisplay(activeDiff.path, activeDiff.before || "")}
              modified={formatCodeForDisplay(activeDiff.path, activeDiff.after || "")}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                automaticLayout: true,
                wordWrap: "on",
                renderSideBySide: true,
              }}
            />
          ) : (
          <Editor

            key={`${activeFile?.path}_${isEditing}`}

            height={isFullscreen ? "calc(100vh - 64px)" : "700px"}

            language={
              getLanguage(
                activeFile?.path
              )
            }

            theme={editorTheme}
            beforeMount={handleEditorBeforeMount}

            value={
              isEditing ? editedCode : formatCodeForDisplay(activeFile?.path, activeFile?.code || "")
            }

            onChange={(val) => {
              if (isEditing) {
                setEditedCode(val || "");
              }
            }}

            options={{

              readOnly: !isEditing,

              minimap: {
                enabled: false
              },

              automaticLayout: true,

              wordWrap: "on",

              scrollBeyondLastLine: false,

              fontSize: 14

            }}

          />
          )}

        </div>

      </div>

    </div>

  );

}

export default FileViewer;