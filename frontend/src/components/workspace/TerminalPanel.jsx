import { useState } from "react";
import { Terminal, Play, ShieldAlert, Sparkles, CheckCircle2, RotateCw } from "lucide-react";
import api from "../../services/api";

function TerminalPanel({ result, onFileSave }) {
  const executionId = result?.execution_id || result?._id;
  const [command, setCommand] = useState("npm run build");
  const [logs, setLogs] = useState("Ready to run build/test commands on generated project workspace...");
  const [running, setRunning] = useState(false);
  const [exitCode, setExitCode] = useState(null);
  const [fixSuggestion, setFixSuggestion] = useState(null);
  const [applyingFix, setApplyingFix] = useState(false);
  const [fixStatus, setFixStatus] = useState(null);

  const presets = [
    { label: "Install Deps", cmd: "npm install" },
    { label: "Vite Build", cmd: "npm run build" },
    { label: "Run PyTest", cmd: "pytest" },
    { label: "Start App", cmd: "python main.py" },
  ];

  const handleRunCommand = async (cmdToRun = command) => {
    if (!executionId) return;
    setRunning(true);
    setExitCode(null);
    setFixSuggestion(null);
    setFixStatus(null);
    setLogs(`$ Running: ${cmdToRun}\nExecuting in project workspace...\n`);

    try {
      const res = await api.post(`/ai/executions/${executionId}/run-command`, {
        command: cmdToRun,
      });

      const { stdout, stderr, exit_code, fix_suggestion } = res.data;
      setExitCode(exit_code);

      let outputLogs = `$ Running: ${cmdToRun}\n`;
      if (stdout) outputLogs += `[STDOUT]\n${stdout}\n`;
      if (stderr) outputLogs += `[STDERR]\n${stderr}\n`;
      outputLogs += `\nCommand finished with Exit Code: ${exit_code}`;

      setLogs(outputLogs);

      if (fix_suggestion) {
        setFixSuggestion(fix_suggestion);
      }
    } catch (err) {
      setLogs((prev) => prev + `\nExecution failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleApplyFix = async () => {
    if (!executionId || !fixSuggestion) return;
    setApplyingFix(true);
    setFixStatus("Applying fixes to workspace...");

    try {
      const res = await api.post(`/ai/executions/${executionId}/apply-terminal-fix`, {
        fix_type: fixSuggestion.fix_type,
        fix_command: fixSuggestion.fix_command,
        files_to_fix: fixSuggestion.files_to_fix,
      });

      if (res.data.success) {
        setFixStatus("Fixes applied successfully! Re-running command...");
        setFixSuggestion(null);

        // If it was a code fix, update files in parent state if onFileSave is provided
        if (fixSuggestion.fix_type === "code" && fixSuggestion.files_to_fix) {
          fixSuggestion.files_to_fix.forEach((file) => {
            if (onFileSave) {
              onFileSave(file.path, file.code);
            }
          });
        }

        // Rerun the last command automatically to verify fix
        setTimeout(() => {
          handleRunCommand();
        }, 1500);
      } else {
        setFixStatus(`Failed to apply fix: ${res.data.message || "Unknown error"}`);
      }
    } catch (err) {
      setFixStatus(`Error applying fix: ${err.response?.data?.detail || err.message}`);
    } finally {
      setApplyingFix(false);
    }
  };

  return (
    <div className="terminal-panel-container" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
      {/* Preset bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: "600", marginRight: "4px" }}>Presets:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setCommand(p.cmd);
              handleRunCommand(p.cmd);
            }}
            className="preset-cmd-btn"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "8px",
              color: "#e4e4e7",
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: "10px" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: "10px",
            padding: "8px 12px",
            gap: "8px",
          }}
        >
          <Terminal size={16} style={{ color: "#a1a1aa" }} />
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !running) handleRunCommand();
            }}
            placeholder="Type command here (e.g. npm test)..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#ffffff",
              fontSize: "14px",
              fontFamily: "monospace",
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => handleRunCommand()}
          disabled={running || !command}
          style={{
            background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
            border: "none",
            borderRadius: "10px",
            color: "#ffffff",
            padding: "0 20px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.2)",
            opacity: running ? 0.7 : 1,
          }}
        >
          {running ? <RotateCw size={14} className="spin-animation" /> : <Play size={14} />}
          {running ? "Running..." : "Run"}
        </button>
      </div>

      {/* Terminal logs area */}
      <div
        className="terminal-console-container"
        style={{
          background: "#0c0c0e",
          border: "1px solid #1f1f23",
          borderRadius: "12px",
          padding: "16px",
          fontFamily: "monospace",
          fontSize: "13px",
          lineHeight: "1.6",
          color: "#e4e4e7",
          minHeight: "220px",
          maxHeight: "450px",
          overflowY: "auto",
          boxShadow: "inset 0 2px 10px rgba(0,0,0,0.8)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {logs}
      </div>

      {/* exit code indicator */}
      {exitCode !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
          {exitCode === 0 ? (
            <CheckCircle2 size={16} style={{ color: "#22c55e" }} />
          ) : (
            <ShieldAlert size={16} style={{ color: "#ef4444" }} />
          )}
          <span style={{ color: exitCode === 0 ? "#22c55e" : "#ef4444", fontWeight: "600" }}>
            {exitCode === 0 ? "Success: Execution completed cleanly." : "Error: Execution failed."}
          </span>
        </div>
      )}

      {/* Auto-Fix Overlay */}
      {fixSuggestion && (
        <div
          className="terminal-autofix-card"
          style={{
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.05))",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: "14px",
            padding: "20px",
            marginTop: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25)",
            animation: "ws-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={18} style={{ color: "#a78bfa" }} />
            <h4 style={{ margin: 0, color: "#ffffff", fontSize: "15px", fontWeight: "700" }}>
              NexusAI Smart Auto-Fix Suggestion
            </h4>
          </div>
          <p style={{ margin: 0, color: "#a1a1aa", fontSize: "13px", lineHeight: "1.5" }}>
            {fixSuggestion.error_summary}
          </p>

          {fixSuggestion.fix_type === "command" && (
            <div
              style={{
                background: "#09090b",
                border: "1px solid #1f1f23",
                borderRadius: "8px",
                padding: "10px 14px",
                fontFamily: "monospace",
                fontSize: "12px",
                color: "#a78bfa",
              }}
            >
              Suggested command: <span style={{ color: "#ffffff" }}>{fixSuggestion.fix_command}</span>
            </div>
          )}

          {fixSuggestion.fix_type === "code" && fixSuggestion.files_to_fix && (
            <div style={{ fontSize: "12px", color: "#a1a1aa" }}>
              Will modify <strong style={{ color: "#ffffff" }}>{fixSuggestion.files_to_fix.length}</strong> file(s) to fix syntax/imports.
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={handleApplyFix}
              disabled={applyingFix}
              style={{
                background: "linear-gradient(135deg, #a78bfa, #8b5cf6)",
                border: "none",
                borderRadius: "8px",
                color: "#ffffff",
                padding: "8px 18px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(139, 92, 246, 0.3)",
                opacity: applyingFix ? 0.7 : 1,
              }}
            >
              {applyingFix ? "Applying Suggestion..." : "Apply Auto-Fix"}
            </button>
            {fixStatus && (
              <span style={{ fontSize: "12px", color: "#cbd5e1", fontStyle: "italic" }}>{fixStatus}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TerminalPanel;
