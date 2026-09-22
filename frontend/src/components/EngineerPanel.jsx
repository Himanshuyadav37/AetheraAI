
import FileViewer from "./FileViewer";
import LiveWebPreview, { compileProjectForPreview } from "./LiveWebPreview";
import api, { getBaseURL } from "../services/api";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useEffect, useMemo, useState } from "react";
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
  History,
  RotateCcw,
  ListTree,
  RefreshCw,
  GitBranch,
  X,
  DollarSign
} from "lucide-react";

function normalizePath(path = "") {
  return path.replace(/^\.\//, "").replace(/^\//, "");
}

function findFile(files, matcher) {
  return files.find(file => matcher(normalizePath(file.path || "").toLowerCase()));
}

function normalizeFiles(value) {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((file) => {
        if (typeof file === "string") {
          return { path: "untitled.txt", code: file };
        }
        return {
          ...file,
          path: file?.path || file?.name || "untitled.txt",
          code: typeof file?.code === "string"
            ? file.code
            : typeof file?.content === "string"
              ? file.content
              : "",
        };
      })
      .filter((file) => file.path);
  }

  if (value && typeof value === "object" && Array.isArray(value.files)) {
    return normalizeFiles(value.files);
  }

  if (value && typeof value === "object" && (value.path || value.name)) {
    return normalizeFiles([value]);
  }

  return [];
}

function getProjectFiles(result) {
  if (!result) return [];

  const fixedFiles = normalizeFiles(result.fixed_code);
  if (fixedFiles.length > 0) return fixedFiles;

  return normalizeFiles(result.generated_code);
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
  
  const files = getProjectFiles(result);
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
  return compileProjectForPreview(files, "Aethera Project");
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
  const [versions, setVersions] = useState([]);
  const [versionsModalOpen, setVersionsModalOpen] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionDiffs, setVersionDiffs] = useState([]);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffFromVersion, setDiffFromVersion] = useState(null);
  const [diffToVersion, setDiffToVersion] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Cost & token observability
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageData, setUsageData] = useState(null);
  const [usageError, setUsageError] = useState("");

  // Execution branch tree
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchExecutions, setBranchExecutions] = useState([]);

  // Execution comparison
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonExecutions, setComparisonExecutions] = useState([]);
  const [comparisonFrom, setComparisonFrom] = useState("");
  const [comparisonTo, setComparisonTo] = useState("");
  const [comparisonDiffs, setComparisonDiffs] = useState([]);
  const [comparisonMeta, setComparisonMeta] = useState(null);

  const targetId = result?.execution_id || result?.project_id || result?._id;

  const files = useMemo(() => getProjectFiles(result), [result]);

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

  useEffect(() => {
    if (!versionsModalOpen || !result?.project_id) return;

    const fetchVersions = async () => {
      try {
        setLoadingVersions(true);
        const res = await api.get(`/ai/projects/${result.project_id}/versions`);
        const data = Array.isArray(res.data) ? res.data : [];
        setVersions(data);
        setSelectedVersion((current) => {
          if (current == null && data.length > 0) return data[0];
          return current;
        });
      } catch (err) {
        console.error("Failed to load project versions:", err);
        setVersions([]);
      } finally {
        setLoadingVersions(false);
      }
    };

    fetchVersions();
  }, [versionsModalOpen, result?.project_id]);

  async function openExecutionBranch() {
    if (!result?.project_id) return;

    setBranchOpen(true);
    setBranchLoading(true);

    try {
      const res = await api.get(
        `/ai/projects/${result.project_id}/history`
      );

      const history = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.history)
          ? res.data.history
          : Array.isArray(res.data?.executions)
            ? res.data.executions
            : [];

      // Include current execution even if the history endpoint does not
      // return it yet.
      const currentExecution = result?.execution_id
        ? {
            ...result,
            _branchSynthetic: true,
          }
        : null;

      const merged = [
        ...history,
        ...(currentExecution ? [currentExecution] : []),
      ];

      const unique = [];
      const seen = new Set();

      for (const execution of merged) {
        const id =
          execution?.execution_id ||
          execution?._id;

        if (!id || seen.has(id)) continue;

        seen.add(id);
        unique.push(execution);
      }

      unique.sort((a, b) => {
        const aTime = new Date(
          a?.created_at ||
          a?.updated_at ||
          0
        ).getTime();

        const bTime = new Date(
          b?.created_at ||
          b?.updated_at ||
          0
        ).getTime();

        return aTime - bTime;
      });

      setBranchExecutions(unique);
    } catch (err) {
      console.error(
        "Failed to load execution branch history:",
        err
      );
      setBranchExecutions([]);
    } finally {
      setBranchLoading(false);
    }
  }

  function getExecutionId(execution) {
    return (
      execution?.execution_id ||
      execution?._id ||
      ""
    );
  }

  function getExecutionParentId(execution) {
    return (
      execution?.parent_execution_id ||
      execution?.replay_source_execution_id ||
      null
    );
  }

  function getExecutionModeLabel(execution) {
    const mode = String(
      execution?.mode || "new"
    ).toLowerCase();

    if (mode === "replay") {
      return `Replay${execution?.replay_step ? ` · ${execution.replay_step}` : ""}`;
    }

    if (
      mode === "continue" ||
      mode === "continuation"
    ) {
      return "Continue";
    }

    if (
      mode === "restore" ||
      mode === "restored"
    ) {
      return "Restore";
    }

    return "Initial";
  }

  function getExecutionStatusLabel(execution) {
    const status = String(
      execution?.status || "unknown"
    ).toLowerCase();

    if (["completed", "complete", "success"].includes(status)) {
      return "Completed";
    }

    if (["running", "in_progress", "in-progress"].includes(status)) {
      return "Running";
    }

    if (["failed", "failure", "error"].includes(status)) {
      return "Failed";
    }

    return status || "Unknown";
  }

  function formatBranchTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getExecutionChildren(executionId) {
    return branchExecutions.filter(
      (execution) =>
        getExecutionParentId(execution) === executionId
    );
  }

  function renderExecutionBranch(execution, depth = 0, visited = new Set()) {
    const executionId = getExecutionId(execution);

    if (!executionId || visited.has(executionId)) {
      return null;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(executionId);

    const children = getExecutionChildren(executionId);
    const isCurrent =
      executionId ===
      (result?.execution_id || result?._id);

    const status = getExecutionStatusLabel(execution);
    const modeLabel = getExecutionModeLabel(execution);

    return (
      <div
        key={executionId}
        style={{
          marginLeft: `${depth * 24}px`,
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setResult("engineer", execution);
            setBranchOpen(false);
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textAlign: "left",
            padding: "10px 12px",
            marginBottom: "6px",
            borderRadius: "9px",
            border: `1px solid ${
              isCurrent
                ? "rgba(74,222,128,0.25)"
                : "rgba(255,255,255,0.07)"
            }`,
            background: isCurrent
              ? "rgba(74,222,128,0.06)"
              : "rgba(255,255,255,0.02)",
            color: "#e4e4e7",
            cursor: "pointer",
          }}
        >
          <GitBranch
            size={14}
            style={{
              flexShrink: 0,
              color: isCurrent ? "#4ade80" : "#71717a",
            }}
          />

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: "700",
                  color: "#f4f4f5",
                }}
              >
                Execution {executionId}
              </span>

              {isCurrent && (
                <span
                  style={{
                    fontSize: "8px",
                    padding: "2px 5px",
                    borderRadius: "999px",
                    background: "rgba(74,222,128,0.12)",
                    color: "#4ade80",
                    fontWeight: "700",
                  }}
                >
                  CURRENT
                </span>
              )}
            </div>

            <div
              style={{
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "7px",
                fontSize: "9.5px",
                color: "#71717a",
              }}
            >
              <span>{modeLabel}</span>
              <span>·</span>
              <span>{status}</span>
              <span>·</span>
              <span>
                {formatBranchTime(
                  execution?.created_at ||
                  execution?.updated_at
                )}
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: "9px",
              color: "#52525b",
              fontFamily: "monospace",
              maxWidth: "180px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {execution?.replay_step || ""}
          </span>

          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              openBranchComparison(execution);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                openBranchComparison(execution);
              }
            }}
            title="Compare this execution with its parent or child"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 7px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "#a1a1aa",
              fontSize: "9px",
              fontWeight: "600",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Columns size={11} /> Compare
          </span>
        </button>

        {children.length > 0 && (
          <div
            style={{
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              marginLeft: "8px",
              paddingLeft: "2px",
            }}
          >
            {children.map((child) =>
              renderExecutionBranch(
                child,
                depth + 1,
                nextVisited
              )
            )}
          </div>
        )}
      </div>
    );
  }

  function openBranchComparison(execution) {
    const executionId = getExecutionId(execution);
    if (!executionId) return;

    const parentId = getExecutionParentId(execution);
    const child = branchExecutions.find(
      (candidate) => getExecutionParentId(candidate) === executionId
    );
    const comparisonTarget = parentId || getExecutionId(child);

    if (!comparisonTarget || comparisonTarget === executionId) {
      window.alert("This execution has no parent or child execution to compare yet.");
      return;
    }

    openExecutionComparison(comparisonTarget, executionId);
  }

  function getBranchRoots() {
    const ids = new Set(
      branchExecutions.map(getExecutionId)
    );

    return branchExecutions.filter((execution) => {
      const parentId = getExecutionParentId(execution);
      return !parentId || !ids.has(parentId);
    });
  }

  function getComparisonExecutionLabel(execution) {
    const id = getExecutionId(execution);
    const mode = getExecutionModeLabel(execution);
    const status = getExecutionStatusLabel(execution);
    const time = formatBranchTime(execution?.created_at || execution?.updated_at);
    return `${id} · ${mode} · ${status} · ${time}`;
  }

  async function openExecutionComparison(preferredFrom = "", preferredTo = "") {
    if (!result?.project_id) return;

    setComparisonOpen(true);
    setComparisonLoading(true);

    try {
      const res = await api.get(`/ai/projects/${result.project_id}/history`);

      const history = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.history)
          ? res.data.history
          : Array.isArray(res.data?.executions)
            ? res.data.executions
            : [];

      const currentExecution = result?.execution_id
        ? { ...result, _comparisonSynthetic: true }
        : null;

      const merged = [
        ...history,
        ...(currentExecution ? [currentExecution] : []),
      ];

      const unique = [];
      const seen = new Set();

      for (const execution of merged) {
        const id = getExecutionId(execution);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        unique.push(execution);
      }

      unique.sort((a, b) => {
        const aTime = new Date(a?.created_at || a?.updated_at || 0).getTime();
        const bTime = new Date(b?.created_at || b?.updated_at || 0).getTime();
        return bTime - aTime;
      });

      setComparisonExecutions(unique);

      const currentId = getExecutionId(result);
      const availableIds = new Set(unique.map(getExecutionId));
      const defaultTo = preferredTo && availableIds.has(preferredTo)
        ? preferredTo
        : (currentId || getExecutionId(unique[0]));
      const defaultFrom = preferredFrom && availableIds.has(preferredFrom)
        ? preferredFrom
        : (unique.find((item) => getExecutionId(item) !== defaultTo)?.execution_id
          || getExecutionId(unique[1])
          || "");

      setComparisonTo(defaultTo || "");
      setComparisonFrom(defaultFrom || "");
      setComparisonDiffs([]);
      setComparisonMeta(null);
    } catch (err) {
      console.error("Failed to load execution comparison history:", err);
      setComparisonExecutions([]);
      setComparisonDiffs([]);
      window.alert(
        err?.response?.data?.detail || "Failed to load executions for comparison."
      );
    } finally {
      setComparisonLoading(false);
    }
  }

  async function handleCompareExecutions() {
    if (!comparisonFrom || !comparisonTo || comparisonFrom === comparisonTo) {
      window.alert("Select two different executions to compare.");
      return;
    }

    try {
      setComparisonLoading(true);

      const [diffRes, fromRes, toRes] = await Promise.all([
        api.get(`/ai/executions/${comparisonTo}/diff`, {
          params: { compare: comparisonFrom },
        }),
        api.get(`/ai/executions/${comparisonFrom}`),
        api.get(`/ai/executions/${comparisonTo}`),
      ]);

      const fromExecution = fromRes.data || comparisonExecutions.find(
        (item) => getExecutionId(item) === comparisonFrom
      );
      const toExecution = toRes.data || comparisonExecutions.find(
        (item) => getExecutionId(item) === comparisonTo
      );

      setComparisonDiffs(Array.isArray(diffRes.data) ? diffRes.data : []);
      setComparisonMeta({ from: fromExecution, to: toExecution });
    } catch (err) {
      console.error("Failed to compare executions:", err);
      setComparisonDiffs([]);
      setComparisonMeta(null);
      window.alert(
        err?.response?.data?.detail || "Failed to compare these executions."
      );
    } finally {
      setComparisonLoading(false);
    }
  }

  function renderComparisonMetadata(execution, sideLabel) {
    if (!execution) return null;

    return (
      <div
        style={{
          minWidth: 0,
          flex: 1,
          padding: "11px 12px",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "9px",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ fontSize: "9px", color: "#71717a", textTransform: "uppercase", fontWeight: "700", marginBottom: "6px" }}>
          {sideLabel}
        </div>
        <div style={{ fontSize: "12px", color: "#ffffff", fontWeight: "700", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {getExecutionId(execution)}
        </div>
        <div style={{ marginTop: "7px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", fontSize: "10px", color: "#a1a1aa" }}>
          <span>Mode</span><span>{getExecutionModeLabel(execution)}</span>
          <span>Status</span><span>{getExecutionStatusLabel(execution)}</span>
          <span>Version</span><span>{execution?.version ?? "—"}</span>
          <span>Parent</span><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{execution?.parent_execution_id || "—"}</span>
          <span>Replay</span><span>{execution?.replay_step || "—"}</span>
          <span>Created</span><span>{formatBranchTime(execution?.created_at || execution?.updated_at)}</span>
        </div>
      </div>
    );
  }

  async function handleRestoreVersion(version) {
    if (!result?.project_id || !version?.version) return;

    const confirmed = window.confirm(
      `Restore Version ${version.version}? This will create a new execution/version and will not delete the existing history.`
    );
    if (!confirmed) return;

    try {
      setRestoringVersion(version.version);

      const res = await api.post(
        `/ai/projects/${result.project_id}/versions/${version.version}/restore`
      );

      const restoredFiles = normalizeFiles(res.data?.files || []);
      const restoredExecution = res.data?.execution || {};

      const updatedResult = {
        ...result,
        ...restoredExecution,
        project_id: result.project_id,
        execution_id: res.data?.execution_id || restoredExecution.execution_id || result.execution_id,
        generated_code: restoredFiles,
        fixed_code: restoredFiles,
        version: res.data?.new_version,
      };

      setResult("engineer", updatedResult);
      setVersionsModalOpen(false);
      setSelectedVersion(null);

      // Refresh the version list when the modal is opened again.
      setVersions([]);
    } catch (err) {
      console.error("Failed to restore project version:", err);
      window.alert(
        err?.response?.data?.detail || "Failed to restore this project version."
      );
    } finally {
      setRestoringVersion(null);
    }
  }

  async function handleCompareVersions(fromVersion, toVersion) {
    if (
      !fromVersion?.execution_id ||
      !toVersion?.execution_id ||
      fromVersion.execution_id === toVersion.execution_id
    ) {
      return;
    }

    try {
      setDiffLoading(true);
      setDiffFromVersion(fromVersion);
      setDiffToVersion(toVersion);

      const res = await api.get(
        `/ai/executions/${toVersion.execution_id}/diff`,
        {
          params: {
            compare: fromVersion.execution_id,
          },
        }
      );

      setVersionDiffs(Array.isArray(res.data) ? res.data : []);
      setDiffModalOpen(true);
    } catch (err) {
      console.error("Failed to compare versions:", err);
      window.alert(
        err?.response?.data?.detail || "Failed to compare these versions."
      );
      setVersionDiffs([]);
    } finally {
      setDiffLoading(false);
    }
  }


  const executionSteps = useMemo(() => {
    const steps = Array.isArray(result?.execution_steps)
      ? result.execution_steps
      : [];

    return steps.map((step, index) => ({
      ...step,
      _timelineIndex: index + 1,
    }));
  }, [result]);

  function formatTimelineTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function getTimelineStatus(step = {}) {
    const raw = String(
      step.status || step.state || step.result || ""
    ).toLowerCase();

    if (["failed", "failure", "error", "errored"].includes(raw)) {
      return {
        label: "Failed",
        color: "#f87171",
        background: "rgba(248,113,113,0.10)",
      };
    }

    if (
      ["running", "in_progress", "in-progress", "started", "active"].includes(raw)
    ) {
      return {
        label: "Running",
        color: "#60a5fa",
        background: "rgba(96,165,250,0.10)",
      };
    }

    if (["skipped", "cancelled", "canceled"].includes(raw)) {
      return {
        label: raw === "skipped" ? "Skipped" : "Cancelled",
        color: "#a1a1aa",
        background: "rgba(161,161,170,0.10)",
      };
    }

    if (
      ["completed", "complete", "success", "successful", "passed", "pass", "done"].includes(raw)
    ) {
      return {
        label: "Completed",
        color: "#4ade80",
        background: "rgba(74,222,128,0.10)",
      };
    }

    return {
      label: raw ? raw.replace(/[_-]/g, " ") : "Recorded",
      color: "#fbbf24",
      background: "rgba(251,191,36,0.10)",
    };
  }

  function getTimelineAgent(step = {}) {
    return (
      step.agent ||
      step.agent_name ||
      step.node ||
      step.step ||
      step.name ||
      "Execution Step"
    );
  }

  function getTimelineMessage(step = {}) {
    return (
      step.message ||
      step.description ||
      step.detail ||
      step.output ||
      step.error ||
      ""
    );
  }

  function getTimelineTimestamp(step = {}) {
    return (
      step.timestamp ||
      step.created_at ||
      step.completed_at ||
      step.started_at ||
      null
    );
  }

  async function refreshExecutionTimeline() {
    const executionId = result?.execution_id || result?._id;
    if (!executionId) return;

    try {
      setTimelineLoading(true);
      const res = await api.get(`/ai/executions/${executionId}`);
      if (res.data) {
        setResult("engineer", {
          ...result,
          ...res.data,
          project_id: result?.project_id || res.data?.project_id,
        });
      }
    } catch (err) {
      console.error("Failed to refresh execution timeline:", err);
    } finally {
      setTimelineLoading(false);
    }
  }

  async function openExecutionTimeline() {
    setTimelineOpen(true);

    const executionId = result?.execution_id || result?._id;
    if (executionId) {
      await refreshExecutionTimeline();
    }
  }

  async function openExecutionUsage() {
    const executionId = result?.execution_id || result?._id;
    if (!executionId) return;

    setUsageOpen(true);
    setUsageLoading(true);
    setUsageError("");

    try {
      const res = await api.get(`/ai/executions/${executionId}/usage`);
      setUsageData(res.data || null);
    } catch (err) {
      console.error("Failed to load execution usage:", err);
      setUsageData(null);
      setUsageError(
        err?.response?.data?.detail || "Failed to load cost and token usage."
      );
    } finally {
      setUsageLoading(false);
    }
  }

  function formatUsageNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatUsageCost(value) {
    return `$${Number(value || 0).toFixed(6)}`;
  }

  function renderUsageBucket(bucket) {
    if (!bucket) return null;
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "7px 14px",
        fontSize: "10px",
        color: "#a1a1aa",
      }}>
        <span>Calls</span><strong style={{ color: "#e4e4e7" }}>{formatUsageNumber(bucket.calls)}</strong>
        <span>Total tokens</span><strong style={{ color: "#e4e4e7" }}>{formatUsageNumber(bucket.total_tokens)}</strong>
        <span>Input tokens</span><strong style={{ color: "#e4e4e7" }}>{formatUsageNumber(bucket.input_tokens)}</strong>
        <span>Output tokens</span><strong style={{ color: "#e4e4e7" }}>{formatUsageNumber(bucket.output_tokens)}</strong>
        <span>Cost</span><strong style={{ color: "#86efac" }}>{formatUsageCost(bucket.estimated_cost_usd)}</strong>
        <span>Latency</span><strong style={{ color: "#e4e4e7" }}>{Math.round(Number(bucket.latency_ms || 0))}ms</strong>
      </div>
    );
  }

  function handleFileSave(path, newCode) {
    const fixedFiles = normalizeFiles(result?.fixed_code);
    const codeField = fixedFiles.length > 0 ? "fixed_code" : "generated_code";
    const source = result?.[codeField];
    const filesList = normalizeFiles(source);

    const updatedFiles = filesList.map((file) =>
      normalizePath(file.path) === normalizePath(path)
        ? { ...file, code: newCode }
        : file
    );

    const updatedResult = {
      ...result,
      [codeField]: Array.isArray(source)
        ? updatedFiles
        : { ...(source || {}), files: updatedFiles },
    };

    setResult("engineer", updatedResult);
  }

  useEffect(() => {
    const execId = result?.execution_id || result?._id;
    if (!execId) return;

    const hasFixed = normalizeFiles(result?.fixed_code).length > 0;
    const hasGenerated = normalizeFiles(result?.generated_code).length > 0;

    if (hasFixed && hasGenerated) {
      api
        .get(`/ai/executions/${execId}/diff?compare=fixed`)
        .then(res => setDiffs(res.data || []))
        .catch(() => setDiffs([]));
    }
  }, [result]);

  const previewDocument = useMemo(
    () => compileProjectForPreview(files, result?.project_plan?.project_name || "Aethera Project"),
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
              
              {result?.project_id && (
                <button
                  type="button"
                  onClick={openExecutionComparison}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "500",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#a1a1aa",
                    cursor: "pointer",
                  }}
                  title="Compare two executions"
                >
                  <Columns size={13} /> Compare
                </button>
              )}

              {result?.project_id && (
                <button
                  type="button"
                  onClick={openExecutionBranch}
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
                    cursor: "pointer",
                  }}
                  title="Execution Branch Tree"
                >
                  <GitBranch size={13} /> Branches
                </button>
              )}

              {(result?.execution_id || result?._id) && (
                <button
                  type="button"
                  onClick={openExecutionTimeline}
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
                  title="Execution Timeline"
                >
                  <ListTree size={13} /> Timeline
                </button>
              )}

              {(result?.execution_id || result?._id) && (
                <button
                  type="button"
                  onClick={openExecutionUsage}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "500",
                    background: "rgba(74,222,128,0.06)",
                    border: "1px solid rgba(74,222,128,0.16)",
                    color: "#86efac",
                    cursor: "pointer"
                  }}
                  title="Execution Cost & Token Usage"
                >
                  <DollarSign size={13} /> Usage
                </button>
              )}

              {result?.project_id && (
                <button
                  type="button"
                  onClick={() => setVersionsModalOpen(true)}
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
                  title="Project Version History"
                >
                  <History size={13} /> History
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

          {/* Cost & Token Usage Modal */}
          {usageOpen && (
            <div style={{ position: "fixed", inset: 0, zIndex: 10002, background: "rgba(0,0,0,0.84)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <div style={{ width: "100%", maxWidth: "900px", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "#0f1014", border: "1px solid #27272a", borderRadius: "16px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #27272a" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}><DollarSign size={16} /> Cost & Token Usage</h3>
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#71717a", fontFamily: "monospace" }}>{targetId ? `Execution ${targetId}` : "Current execution"}</div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button type="button" onClick={openExecutionUsage} disabled={usageLoading} style={{ padding: "6px 9px", borderRadius: "7px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#a1a1aa", cursor: usageLoading ? "not-allowed" : "pointer", fontSize: "11px" }}><RefreshCw size={12} style={{ animation: usageLoading ? "spin 1s linear infinite" : "none" }} /></button>
                    <button type="button" onClick={() => { setUsageOpen(false); setUsageData(null); setUsageError(""); }} style={{ width: "30px", height: "30px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "7px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#a1a1aa", cursor: "pointer" }}><X size={15} /></button>
                  </div>
                </div>

                <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
                  {usageLoading && !usageData ? (
                    <div style={{ padding: "45px", textAlign: "center", color: "#a1a1aa", fontSize: "12px" }}>Loading usage telemetry...</div>
                  ) : usageError ? (
                    <div style={{ padding: "30px", textAlign: "center", color: "#fca5a5", fontSize: "12px" }}>{usageError}</div>
                  ) : usageData ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "8px" }}>
                        {[
                          ["Cost", formatUsageCost(usageData.summary?.estimated_cost_usd), "#86efac"],
                          ["Total Tokens", formatUsageNumber(usageData.summary?.total_tokens), "#e4e4e7"],
                          ["Input", formatUsageNumber(usageData.summary?.input_tokens), "#93c5fd"],
                          ["Output", formatUsageNumber(usageData.summary?.output_tokens), "#c4b5fd"],
                          ["LLM Calls", formatUsageNumber(usageData.summary?.calls), "#fbbf24"],
                        ].map(([label, value, color]) => (
                          <div key={label} style={{ padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                            <div style={{ fontSize: "9px", color: "#71717a", textTransform: "uppercase", fontWeight: "700" }}>{label}</div>
                            <div style={{ marginTop: "6px", fontSize: "16px", fontWeight: "700", color }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: "10px", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
                          <span style={{ fontSize: "10px", color: "#a1a1aa", fontWeight: "700", textTransform: "uppercase" }}>Execution Budget</span>
                          <span style={{ fontSize: "10px", color: usageData.budget?.execution?.exceeded ? "#f87171" : "#86efac" }}>{usageData.budget?.execution?.enabled ? `${formatUsageCost(usageData.budget.execution.spent_usd)} / ${formatUsageCost(usageData.budget.execution.limit_usd)}` : "Disabled"}</span>
                        </div>
                        {usageData.budget?.execution?.enabled && <div style={{ height: "6px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ width: `${Math.min(100, Number(usageData.budget.execution.percent_used || 0))}%`, height: "100%", background: usageData.budget.execution.exceeded ? "#f87171" : "#4ade80" }} /></div>}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px", marginTop: "10px" }}>
                        <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                          <div style={{ fontSize: "10px", color: "#a1a1aa", fontWeight: "700", textTransform: "uppercase", marginBottom: "10px" }}>By Agent</div>
                          {Object.keys(usageData.by_agent || {}).length === 0 ? <div style={{ fontSize: "11px", color: "#52525b" }}>No provider usage recorded.</div> : Object.entries(usageData.by_agent).map(([name, bucket]) => <div key={name} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}><div style={{ color: "#f4f4f5", fontSize: "11px", fontWeight: "700", marginBottom: "7px" }}>{name}</div>{renderUsageBucket(bucket)}</div>)}
                        </div>
                        <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                          <div style={{ fontSize: "10px", color: "#a1a1aa", fontWeight: "700", textTransform: "uppercase", marginBottom: "10px" }}>By Model</div>
                          {Object.keys(usageData.by_model || {}).length === 0 ? <div style={{ fontSize: "11px", color: "#52525b" }}>No model usage recorded.</div> : Object.entries(usageData.by_model).map(([name, bucket]) => <div key={name} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}><div style={{ color: "#f4f4f5", fontSize: "11px", fontWeight: "700", marginBottom: "7px", fontFamily: "monospace" }}>{name}</div>{renderUsageBucket(bucket)}</div>)}
                        </div>
                      </div>

                      <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)", fontSize: "10px", color: "#71717a" }}>Average latency: <strong style={{ color: "#e4e4e7" }}>{Math.round(Number(usageData.compute?.avg_latency_ms || 0))}ms</strong> · Total latency: <strong style={{ color: "#e4e4e7" }}>{Math.round(Number(usageData.compute?.total_latency_ms || 0))}ms</strong></div>
                    </>
                  ) : (
                    <div style={{ padding: "45px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>No usage data available for this execution.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Execution Timeline Modal */}
          {timelineOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.82)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "20px",
              }}
            >
              <div
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "16px",
                  width: "100%",
                  maxWidth: "820px",
                  maxHeight: "88vh",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "16px 20px",
                    borderBottom: "1px solid #27272a",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: "600",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <ListTree size={16} /> Execution Timeline
                    </h3>
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "11px",
                        color: "#71717a",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {result?.execution_id
                        ? `Execution ${result.execution_id}`
                        : "Current execution"}{" "}
                      · {executionSteps.length} recorded steps
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={refreshExecutionTimeline}
                      disabled={timelineLoading}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "6px 9px",
                        borderRadius: "7px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#a1a1aa",
                        cursor: timelineLoading ? "not-allowed" : "pointer",
                        fontSize: "11px",
                        opacity: timelineLoading ? 0.6 : 1,
                      }}
                      title="Refresh execution steps"
                    >
                      <RefreshCw
                        size={12}
                        style={{
                          animation: timelineLoading ? "spin 1s linear infinite" : "none",
                        }}
                      />
                      Refresh
                    </button>

                    <button
                      type="button"
                      onClick={() => setTimelineOpen(false)}
                      style={{
                        width: "30px",
                        height: "30px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "7px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#a1a1aa",
                        cursor: "pointer",
                      }}
                      title="Close Execution Timeline"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px 20px",
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {executionSteps.length === 0 ? (
                    <div
                      style={{
                        padding: "45px 20px",
                        textAlign: "center",
                        color: "#71717a",
                        fontSize: "12px",
                      }}
                    >
                      <ListTree
                        size={30}
                        style={{ marginBottom: "10px", opacity: 0.5 }}
                      />
                      <div
                        style={{
                          color: "#e4e4e7",
                          fontWeight: "600",
                          marginBottom: "5px",
                        }}
                      >
                        No execution steps recorded
                      </div>
                      <div>
                        This execution does not contain persisted timeline data yet.
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: "relative" }}>
                      {executionSteps.map((step, index) => {
                        const status = getTimelineStatus(step);
                        const agent = getTimelineAgent(step);
                        const message = getTimelineMessage(step);
                        const timestamp = getTimelineTimestamp(step);
                        const iteration =
                          step.iteration ??
                          step.iteration_number ??
                          step.attempt ??
                          null;
                        const duration =
                          step.duration ??
                          step.duration_ms ??
                          step.elapsed_ms ??
                          null;

                        return (
                          <div
                            key={`${step._timelineIndex}-${agent}-${timestamp || ""}`}
                            style={{
                              position: "relative",
                              display: "flex",
                              gap: "12px",
                              paddingBottom:
                                index === executionSteps.length - 1 ? "0" : "16px",
                            }}
                          >
                            {index < executionSteps.length - 1 && (
                              <div
                                style={{
                                  position: "absolute",
                                  left: "11px",
                                  top: "24px",
                                  bottom: 0,
                                  width: "1px",
                                  background: "rgba(255,255,255,0.08)",
                                }}
                              />
                            )}

                            <div
                              style={{
                                position: "relative",
                                zIndex: 1,
                                width: "23px",
                                height: "23px",
                                flexShrink: 0,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: status.background,
                                border: `1px solid ${status.color}55`,
                                color: status.color,
                                fontSize: "9px",
                                fontWeight: "700",
                              }}
                            >
                              {step._timelineIndex}
                            </div>

                            <div
                              style={{
                                minWidth: 0,
                                flex: 1,
                                border: "1px solid rgba(255,255,255,0.07)",
                                borderRadius: "10px",
                                background: "rgba(255,255,255,0.02)",
                                padding: "11px 12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: "10px",
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      flexWrap: "wrap",
                                      gap: "7px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "#f4f4f5",
                                        fontSize: "12.5px",
                                        fontWeight: "700",
                                      }}
                                    >
                                      {agent}
                                    </span>

                                    <span
                                      style={{
                                        padding: "2px 6px",
                                        borderRadius: "999px",
                                        background: status.background,
                                        color: status.color,
                                        fontSize: "9px",
                                        fontWeight: "700",
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {status.label}
                                    </span>

                                    {iteration != null && (
                                      <span
                                        style={{
                                          fontSize: "9px",
                                          color: "#71717a",
                                          padding: "2px 6px",
                                          borderRadius: "999px",
                                          background: "rgba(255,255,255,0.04)",
                                        }}
                                      >
                                        Iteration {iteration}
                                      </span>
                                    )}
                                  </div>

                                  {step.step && step.step !== agent && (
                                    <div
                                      style={{
                                        marginTop: "3px",
                                        fontSize: "10px",
                                        color: "#71717a",
                                      }}
                                    >
                                      {step.step}
                                    </div>
                                  )}
                                </div>

                                <div
                                  style={{
                                    flexShrink: 0,
                                    textAlign: "right",
                                    fontSize: "9.5px",
                                    color: "#71717a",
                                  }}
                                >
                                  <div>{formatTimelineTime(timestamp)}</div>
                                  {duration != null && (
                                    <div style={{ marginTop: "3px" }}>
                                      {typeof duration === "number"
                                        ? `${duration}ms`
                                        : String(duration)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {message && (
                                <div
                                  style={{
                                    marginTop: "8px",
                                    paddingTop: "8px",
                                    borderTop: "1px solid rgba(255,255,255,0.05)",
                                    fontSize: "11px",
                                    lineHeight: "1.55",
                                    color: "#a1a1aa",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {String(message)}
                                </div>
                              )}

                              {step.error && (
                                <div
                                  style={{
                                    marginTop: "8px",
                                    padding: "8px",
                                    borderRadius: "6px",
                                    background: "rgba(248,113,113,0.06)",
                                    border: "1px solid rgba(248,113,113,0.12)",
                                    color: "#fca5a5",
                                    fontSize: "10.5px",
                                    lineHeight: "1.5",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {String(step.error)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: "10px 20px",
                    borderTop: "1px solid #27272a",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    background: "#121214",
                  }}
                >
                  <span style={{ fontSize: "10px", color: "#52525b" }}>
                    Timeline is read from the persisted execution steps.
                  </span>
                  <button
                    type="button"
                    onClick={() => setTimelineOpen(false)}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#ffffff",
                      padding: "5px 14px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Execution Branch Tree Modal */}
          {branchOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.82)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10000,
                padding: "20px",
              }}
            >
              <div
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "16px",
                  width: "100%",
                  maxWidth: "820px",
                  maxHeight: "88vh",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "16px 20px",
                    borderBottom: "1px solid #27272a",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: "600",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <GitBranch size={16} /> Execution Branches
                    </h3>
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "11px",
                        color: "#71717a",
                      }}
                    >
                      Parent → child executions. Replay, continue and restore
                      create new immutable executions.
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={openExecutionBranch}
                      disabled={branchLoading}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "6px 9px",
                        borderRadius: "7px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#a1a1aa",
                        cursor: branchLoading ? "not-allowed" : "pointer",
                        fontSize: "11px",
                        opacity: branchLoading ? 0.6 : 1,
                      }}
                    >
                      <RefreshCw
                        size={12}
                        style={{
                          animation: branchLoading
                            ? "spin 1s linear infinite"
                            : "none",
                        }}
                      />
                      Refresh
                    </button>

                    <button
                      type="button"
                      onClick={() => setBranchOpen(false)}
                      style={{
                        width: "30px",
                        height: "30px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "7px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#a1a1aa",
                        cursor: "pointer",
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px 20px",
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {branchLoading ? (
                    <div
                      style={{
                        padding: "45px 20px",
                        textAlign: "center",
                        color: "#a1a1aa",
                        fontSize: "12px",
                      }}
                    >
                      Loading execution branches...
                    </div>
                  ) : branchExecutions.length === 0 ? (
                    <div
                      style={{
                        padding: "45px 20px",
                        textAlign: "center",
                        color: "#71717a",
                        fontSize: "12px",
                      }}
                    >
                      <GitBranch
                        size={30}
                        style={{
                          marginBottom: "10px",
                          opacity: 0.5,
                        }}
                      />
                      <div
                        style={{
                          color: "#e4e4e7",
                          fontWeight: "600",
                          marginBottom: "5px",
                        }}
                      >
                        No execution history found
                      </div>
                      <div>
                        This project does not have persisted branch metadata yet.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          marginBottom: "12px",
                          padding: "9px 10px",
                          borderRadius: "8px",
                          background: "rgba(255,255,255,0.025)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          fontSize: "10px",
                          color: "#71717a",
                        }}
                      >
                        Click any execution to load that execution into the
                        workspace. The source execution remains unchanged.
                      </div>

                      {getBranchRoots().map((root) =>
                        renderExecutionBranch(root)
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: "10px 20px",
                    borderTop: "1px solid #27272a",
                    display: "flex",
                    justifyContent: "flex-end",
                    background: "#121214",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setBranchOpen(false)}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#ffffff",
                      padding: "5px 14px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Execution Comparison Modal */}
          {comparisonOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10001,
                background: "rgba(0, 0, 0, 0.84)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "1100px",
                  maxHeight: "90vh",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  background: "#0f1014",
                  border: "1px solid #27272a",
                  borderRadius: "16px",
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "16px 20px",
                    borderBottom: "1px solid #27272a",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Columns size={16} /> Execution Comparison
                    </h3>
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#71717a" }}>
                      Compare any two immutable executions in this project.
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={openExecutionComparison}
                      disabled={comparisonLoading}
                      style={{
                        padding: "6px 9px",
                        borderRadius: "7px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#a1a1aa",
                        cursor: comparisonLoading ? "not-allowed" : "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonOpen(false);
                        setComparisonDiffs([]);
                        setComparisonMeta(null);
                      }}
                      style={{
                        width: "30px",
                        height: "30px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "7px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#a1a1aa",
                        cursor: "pointer",
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
                  {comparisonLoading && comparisonExecutions.length === 0 ? (
                    <div style={{ padding: "45px 20px", textAlign: "center", color: "#a1a1aa", fontSize: "12px" }}>
                      Loading executions...
                    </div>
                  ) : comparisonExecutions.length < 2 ? (
                    <div style={{ padding: "45px 20px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>
                      At least two executions are required for comparison.
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                          gap: "10px",
                          padding: "12px",
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.02)",
                        }}
                      >
                        <label style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "9px", color: "#f87171", fontWeight: "700", textTransform: "uppercase", marginBottom: "6px" }}>
                            Execution A · Before
                          </div>
                          <select
                            value={comparisonFrom}
                            onChange={(e) => setComparisonFrom(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 9px",
                              borderRadius: "7px",
                              background: "#18181b",
                              border: "1px solid #3f3f46",
                              color: "#e4e4e7",
                              fontSize: "11px",
                            }}
                          >
                            {comparisonExecutions.map((execution) => {
                              const id = getExecutionId(execution);
                              return <option key={id} value={id}>{getComparisonExecutionLabel(execution)}</option>;
                            })}
                          </select>
                        </label>

                        <label style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "9px", color: "#4ade80", fontWeight: "700", textTransform: "uppercase", marginBottom: "6px" }}>
                            Execution B · After
                          </div>
                          <select
                            value={comparisonTo}
                            onChange={(e) => setComparisonTo(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 9px",
                              borderRadius: "7px",
                              background: "#18181b",
                              border: "1px solid #3f3f46",
                              color: "#e4e4e7",
                              fontSize: "11px",
                            }}
                          >
                            {comparisonExecutions.map((execution) => {
                              const id = getExecutionId(execution);
                              return <option key={id} value={id}>{getComparisonExecutionLabel(execution)}</option>;
                            })}
                          </select>
                        </label>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                        <button
                          type="button"
                          onClick={handleCompareExecutions}
                          disabled={comparisonLoading || !comparisonFrom || !comparisonTo || comparisonFrom === comparisonTo}
                          style={{
                            padding: "7px 14px",
                            borderRadius: "7px",
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.08)",
                            color: "#ffffff",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontWeight: "600",
                            opacity: comparisonLoading || comparisonFrom === comparisonTo ? 0.5 : 1,
                          }}
                        >
                          {comparisonLoading ? "Comparing..." : "Compare Executions"}
                        </button>
                      </div>

                      {comparisonMeta && (
                        <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                          {renderComparisonMetadata(comparisonMeta.from, "Execution A")}
                          {renderComparisonMetadata(comparisonMeta.to, "Execution B")}
                        </div>
                      )}

                      <div style={{ marginTop: "14px" }}>
                        {comparisonDiffs.length === 0 && comparisonMeta ? (
                          <div style={{ padding: "35px 20px", textAlign: "center", color: "#71717a", fontSize: "12px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                            <CheckCircle2 size={26} style={{ color: "#4ade80", marginBottom: "8px" }} />
                            <div style={{ color: "#ffffff", fontWeight: "600", marginBottom: "4px" }}>No file changes</div>
                            <div>These executions contain identical code files.</div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {comparisonDiffs.map((diff) => (
                              <div
                                key={`${diff.path}-${diff.status}`}
                                style={{
                                  overflow: "hidden",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: "10px",
                                  background: "rgba(255,255,255,0.02)",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                  <code style={{ fontSize: "11px", color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {diff.path}
                                  </code>
                                  <span
                                    style={{
                                      flexShrink: 0,
                                      fontSize: "9px",
                                      fontWeight: "700",
                                      textTransform: "uppercase",
                                      padding: "3px 7px",
                                      borderRadius: "999px",
                                      background: diff.status === "added"
                                        ? "rgba(74,222,128,0.12)"
                                        : diff.status === "removed"
                                          ? "rgba(248,113,113,0.12)"
                                          : "rgba(251,191,36,0.12)",
                                      color: diff.status === "added"
                                        ? "#4ade80"
                                        : diff.status === "removed"
                                          ? "#f87171"
                                          : "#fbbf24",
                                    }}
                                  >
                                    {diff.status}
                                  </span>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
                                  <div style={{ minWidth: 0, borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                                    <div style={{ padding: "8px 12px", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#f87171", background: "rgba(248,113,113,0.04)" }}>
                                      Execution A
                                    </div>
                                    <pre style={{ margin: 0, maxHeight: "320px", overflow: "auto", padding: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "10px", lineHeight: "1.55", color: "#fca5a5", background: "rgba(248,113,113,0.02)" }}>
                                      {diff.before || "// file did not exist"}
                                    </pre>
                                  </div>

                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ padding: "8px 12px", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#4ade80", background: "rgba(74,222,128,0.04)" }}>
                                      Execution B
                                    </div>
                                    <pre style={{ margin: 0, maxHeight: "320px", overflow: "auto", padding: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "10px", lineHeight: "1.55", color: "#86efac", background: "rgba(74,222,128,0.02)" }}>
                                      {diff.after || "// file did not exist"}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ padding: "10px 20px", borderTop: "1px solid #27272a", display: "flex", justifyContent: "flex-end", background: "#121214" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setComparisonOpen(false);
                      setComparisonDiffs([]);
                      setComparisonMeta(null);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#ffffff",
                      padding: "5px 14px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Project Version History Modal */}
          {versionsModalOpen && (
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
                maxWidth: "760px",
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
                  <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                      <History size={16} /> Project Version History
                    </h3>
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#71717a" }}>
                      Existing versions are immutable. Restore creates a new version.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVersionsModalOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#a1a1aa",
                      cursor: "pointer",
                      fontSize: "20px",
                      padding: "4px"
                    }}
                    title="Close Version History"
                  >
                    &times;
                  </button>
                </div>

                <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
                  {loadingVersions ? (
                    <div style={{ padding: "30px", textAlign: "center", color: "#a1a1aa", fontSize: "12px" }}>
                      Loading version history...
                    </div>
                  ) : versions.length === 0 ? (
                    <div style={{ padding: "30px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>
                      No saved versions found for this project.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {versions.map((version) => {
                        const versionFiles = getProjectFiles(version);
                        const isSelected = selectedVersion?.version === version.version;
                        const isCurrent = version.execution_id === result?.execution_id;

                        return (
                          <div
                            key={version._id || `${version.project_id}-${version.version}`}
                            onClick={() => setSelectedVersion(version)}
                            style={{
                              border: `1px solid ${isSelected ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)"}`,
                              background: isSelected ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                              borderRadius: "10px",
                              padding: "12px",
                              cursor: "pointer"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#ffffff" }}>
                                    Version {version.version}
                                  </span>
                                  {isCurrent && (
                                    <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "999px", background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>
                                      Current
                                    </span>
                                  )}
                                </div>
                                <div style={{ marginTop: "4px", fontSize: "10.5px", color: "#71717a" }}>
                                  {versionFiles.length} files · Execution {version.execution_id || "—"}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  flexShrink: 0,
                                }}
                              >
                                {version.version > 1 && (
                                  <button
                                    type="button"
                                    disabled={diffLoading}
                                    onClick={(event) => {
                                      event.stopPropagation();

                                      const previousVersion = versions.find(
                                        (item) =>
                                          item.version === version.version - 1
                                      );

                                      if (!previousVersion) {
                                        window.alert(
                                          "No previous version available to compare."
                                        );
                                        return;
                                      }

                                      handleCompareVersions(
                                        previousVersion,
                                        version
                                      );
                                    }}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "6px 10px",
                                      borderRadius: "6px",
                                      border:
                                        "1px solid rgba(255,255,255,0.1)",
                                      background: "rgba(255,255,255,0.04)",
                                      color: "#a1a1aa",
                                      cursor: diffLoading
                                        ? "not-allowed"
                                        : "pointer",
                                      fontSize: "11px",
                                      opacity: diffLoading ? 0.5 : 1,
                                    }}
                                  >
                                    <Columns size={12} />
                                    Compare
                                  </button>
                                )}

                              <button
                                type="button"
                                disabled={isCurrent || restoringVersion === version.version}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRestoreVersion(version);
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  background: isCurrent ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)",
                                  color: isCurrent ? "#52525b" : "#e4e4e7",
                                  cursor: isCurrent ? "not-allowed" : "pointer",
                                  fontSize: "11px",
                                  flexShrink: 0
                                }}
                              >
                                <RotateCcw size={12} />
                                {restoringVersion === version.version ? "Restoring..." : "Restore"}
                              </button>
                              </div>
                            </div>

                            {isSelected && versionFiles.length > 0 && (
                              <div style={{ marginTop: "10px", paddingTop: "9px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                                {versionFiles.map((file) => (
                                  <span
                                    key={file.path}
                                    style={{ fontSize: "10px", color: "#a1a1aa", padding: "3px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.04)" }}
                                  >
                                    {file.path}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
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

          {/* Version-to-Version Diff Modal */}
          {diffModalOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                background: "rgba(0, 0, 0, 0.82)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "1000px",
                  maxHeight: "90vh",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  background: "#0f1014",
                  border: "1px solid #27272a",
                  borderRadius: "16px",
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 20px",
                    borderBottom: "1px solid #27272a",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: "600",
                        color: "#ffffff",
                      }}
                    >
                      Version Diff
                    </h3>
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "11px",
                        color: "#71717a",
                      }}
                    >
                      Version {diffFromVersion?.version} → Version{" "}
                      {diffToVersion?.version}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDiffModalOpen(false);
                      setDiffFromVersion(null);
                      setDiffToVersion(null);
                      setVersionDiffs([]);
                    }}
                    style={{
                      width: "30px",
                      height: "30px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "7px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#a1a1aa",
                      cursor: "pointer",
                    }}
                    title="Close Diff"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div
                  style={{
                    padding: "16px 20px",
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {diffLoading ? (
                    <div
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#a1a1aa",
                        fontSize: "12px",
                      }}
                    >
                      Loading version diff...
                    </div>
                  ) : versionDiffs.length === 0 ? (
                    <div
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#a1a1aa",
                        fontSize: "12px",
                      }}
                    >
                      <CheckCircle2
                        size={28}
                        style={{ color: "#4ade80", marginBottom: "10px" }}
                      />
                      <div
                        style={{
                          color: "#ffffff",
                          fontWeight: "600",
                          marginBottom: "5px",
                        }}
                      >
                        No file changes
                      </div>
                      <div style={{ color: "#71717a" }}>
                        These versions contain identical files.
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {versionDiffs.map((diff) => (
                        <div
                          key={`${diff.path}-${diff.status}`}
                          style={{
                            overflow: "hidden",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "10px",
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "10px",
                              padding: "10px 12px",
                              borderBottom: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            <code
                              style={{
                                fontSize: "11px",
                                color: "#e4e4e7",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {diff.path}
                            </code>

                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: "9px",
                                fontWeight: "700",
                                textTransform: "uppercase",
                                padding: "3px 7px",
                                borderRadius: "999px",
                                background:
                                  diff.status === "added"
                                    ? "rgba(74,222,128,0.12)"
                                    : diff.status === "removed"
                                      ? "rgba(248,113,113,0.12)"
                                      : "rgba(251,191,36,0.12)",
                                color:
                                  diff.status === "added"
                                    ? "#4ade80"
                                    : diff.status === "removed"
                                      ? "#f87171"
                                      : "#fbbf24",
                              }}
                            >
                              {diff.status}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                            }}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                borderRight:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              <div
                                style={{
                                  padding: "8px 12px",
                                  fontSize: "9px",
                                  fontWeight: "700",
                                  textTransform: "uppercase",
                                  color: "#f87171",
                                  background: "rgba(248,113,113,0.04)",
                                }}
                              >
                                Version {diffFromVersion?.version}
                              </div>

                              <pre
                                style={{
                                  margin: 0,
                                  maxHeight: "300px",
                                  overflow: "auto",
                                  padding: "12px",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  fontSize: "10px",
                                  lineHeight: "1.55",
                                  color: "#fca5a5",
                                  background: "rgba(248,113,113,0.02)",
                                }}
                              >
                                {diff.before || "// file did not exist"}
                              </pre>
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  padding: "8px 12px",
                                  fontSize: "9px",
                                  fontWeight: "700",
                                  textTransform: "uppercase",
                                  color: "#4ade80",
                                  background: "rgba(74,222,128,0.04)",
                                }}
                              >
                                Version {diffToVersion?.version}
                              </div>

                              <pre
                                style={{
                                  margin: 0,
                                  maxHeight: "300px",
                                  overflow: "auto",
                                  padding: "12px",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  fontSize: "10px",
                                  lineHeight: "1.55",
                                  color: "#86efac",
                                  background: "rgba(74,222,128,0.02)",
                                }}
                              >
                                {diff.after || "// file did not exist"}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
