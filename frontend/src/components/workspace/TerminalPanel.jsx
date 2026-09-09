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
    <div className="terminal-panel-container">
      {/* Preset bar */}
      <div className="terminal-presets-bar">
        <span className="terminal-presets-label">Presets:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setCommand(p.cmd);
              handleRunCommand(p.cmd);
            }}
            className="preset-cmd-btn"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="terminal-cmd-row">
        <div className="terminal-cmd-input-wrap">
          <Terminal size={16} className="terminal-cmd-icon" />
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !running) handleRunCommand();
            }}
            placeholder="Type command here (e.g. npm test)..."
            className="terminal-cmd-input"
          />
        </div>
        <button
          type="button"
          onClick={() => handleRunCommand()}
          disabled={running || !command}
          className="terminal-run-btn"
        >
          {running ? <RotateCw size={14} className="spin-animation" /> : <Play size={14} />}
          {running ? "Running..." : "Run"}
        </button>
      </div>

      {/* Terminal logs area */}
      <div className="terminal-console-container">
        {logs}
      </div>

      {/* exit code indicator */}
      {exitCode !== null && (
        <div className="terminal-exit-indicator">
          {exitCode === 0 ? (
            <CheckCircle2 size={16} style={{ color: "#22c55e" }} />
          ) : (
            <ShieldAlert size={16} style={{ color: "#ef4444" }} />
          )}
          <span className={exitCode === 0 ? "exit-success" : "exit-error"}>
            {exitCode === 0 ? "Success: Execution completed cleanly." : "Error: Execution failed."}
          </span>
        </div>
      )}

      {/* Auto-Fix Overlay */}
      {fixSuggestion && (
        <div className="terminal-autofix-card">
          <div className="autofix-header">
            <Sparkles size={18} className="autofix-icon" />
            <h4 className="autofix-title">
              NexusAI Smart Auto-Fix Suggestion
            </h4>
          </div>
          <p className="autofix-summary">
            {fixSuggestion.error_summary}
          </p>

          {fixSuggestion.fix_type === "command" && (
            <div className="terminal-autofix-cmd-box">
              Suggested command: <span className="autofix-cmd-text">{fixSuggestion.fix_command}</span>
            </div>
          )}

          {fixSuggestion.fix_type === "code" && fixSuggestion.files_to_fix && (
            <div className="autofix-code-info">
              Will modify <strong>{fixSuggestion.files_to_fix.length}</strong> file(s) to fix syntax/imports.
            </div>
          )}

          <div className="autofix-actions">
            <button
              type="button"
              onClick={handleApplyFix}
              disabled={applyingFix}
              className="autofix-apply-btn"
            >
              {applyingFix ? "Applying Suggestion..." : "Apply Auto-Fix"}
            </button>
            {fixStatus && (
              <span className="autofix-status-text">{fixStatus}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TerminalPanel;
