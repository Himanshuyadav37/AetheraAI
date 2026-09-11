import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Lock,
  Copy,
  Check,
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  Terminal,
  Trash2,
  AlertTriangle
} from "lucide-react";
import "./LiveWebPreview.css";

function normalizePath(path = "") {
  return path.replace(/^\.\//, "").replace(/^\//, "");
}

function findFile(files = [], matcher) {
  return files.find(file => matcher(normalizePath(file.path || file.name || "").toLowerCase()));
}

/**
 * Builds an executable, standalone HTML document from project files.
 * Handles Vanilla HTML/CSS/JS, React/JSX, and Backend API explorer visualization.
 */
export function compileProjectForPreview(files = [], projectName = "NexusAI Project") {
  if (!files || files.length === 0) {
    return "";
  }

  // 1. Identify and categorize files
  const htmlFile =
    findFile(files, p => p.endsWith("index.html")) ||
    findFile(files, p => p.endsWith(".html"));

  const cssFiles = files.filter(file => {
    const p = normalizePath(file.path || file.name || "").toLowerCase();
    return p.endsWith(".css");
  });

  const jsFiles = files.filter(file => {
    const p = normalizePath(file.path || file.name || "").toLowerCase();
    return (
      (p.endsWith(".js") || p.endsWith(".jsx") || p.endsWith(".ts") || p.endsWith(".tsx")) &&
      !p.endsWith(".config.js") &&
      !p.endsWith(".d.ts")
    );
  });

  const pyFiles = files.filter(file => {
    const p = normalizePath(file.path || file.name || "").toLowerCase();
    return p.endsWith(".py");
  });

  // Check if project is explicitly React (has JSX files or React imports without a standalone HTML document)
  const isExplicitReact = !htmlFile && files.some(f => {
    const p = normalizePath(f.path || f.name || "").toLowerCase();
    const code = f.code || "";
    return (
      p.endsWith(".jsx") ||
      p.endsWith(".tsx") ||
      code.includes("import React") ||
      code.includes("from 'react'") ||
      code.includes("from \"react\"")
    );
  });

  // Safe Console Interceptor & Storage Polyfill to run inside sandboxed iframe
  const runtimePreamble = `
    <script>
      (function() {
        // Safe localStorage / sessionStorage memory fallback
        var memoryStorage = {};
        try {
          var testKey = '__nexus_test__';
          window.localStorage.setItem(testKey, testKey);
          window.localStorage.removeItem(testKey);
        } catch (e) {
          window.localStorage = {
            getItem: function(k) { return memoryStorage[k] || null; },
            setItem: function(k, v) { memoryStorage[k] = String(v); },
            removeItem: function(k) { delete memoryStorage[k]; },
            clear: function() { memoryStorage = {}; },
            get length() { return Object.keys(memoryStorage).length; }
          };
          window.sessionStorage = window.localStorage;
        }

        // Bridge Console Logs to Parent Live Preview DevTools
        var originalConsole = {
          log: console.log,
          info: console.info,
          warn: console.warn,
          error: console.error
        };

        function sendToParent(type, args) {
          try {
            var serialized = Array.from(args).map(function(item) {
              if (item === null) return 'null';
              if (item === undefined) return 'undefined';
              if (typeof item === 'object') {
                try { return JSON.stringify(item, null, 2); } catch(err) { return String(item); }
              }
              return String(item);
            }).join(' ');

            window.parent.postMessage({
              type: 'NEXUS_PREVIEW_LOG',
              payload: {
                type: type,
                message: serialized,
                timestamp: new Date().toLocaleTimeString()
              }
            }, '*');
          } catch(e) {}
        }

        console.log = function() { originalConsole.log.apply(console, arguments); sendToParent('log', arguments); };
        console.info = function() { originalConsole.info.apply(console, arguments); sendToParent('info', arguments); };
        console.warn = function() { originalConsole.warn.apply(console, arguments); sendToParent('warn', arguments); };
        console.error = function() { originalConsole.error.apply(console, arguments); sendToParent('error', arguments); };

        // Catch Unhandled Runtime Errors without freezing the app
        window.onerror = function(msg, url, lineNo, columnNo, error) {
          var formattedMsg = msg + ' (Line ' + (lineNo || '?') + ')';
          sendToParent('error', [formattedMsg]);
          return false;
        };

        window.addEventListener('unhandledrejection', function(event) {
          sendToParent('warn', ['Unhandled Promise: ' + (event.reason ? (event.reason.message || event.reason) : 'Rejected')]);
        });

        // Built-in Smart Mock API Gateway for fetch calls (/api/* or localhost)
        var origFetch = window.fetch;
        window.fetch = async function(url, options) {
          var urlStr = String(url || '');
          var isApiCall = urlStr.startsWith('/api') || urlStr.startsWith('api/') || urlStr.includes(':8000') || urlStr.includes(':5000') || urlStr.includes(':3000');

          if (isApiCall) {
            var method = (options && options.method ? options.method.toUpperCase() : 'GET');
            var body = null;
            if (options && options.body) {
              try { body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; } catch(e) { body = options.body; }
            }

            console.info('[Mock API] ' + method + ' ' + urlStr, body || '');

            // Mock Data Store in localStorage
            var storeKey = '__nexus_mock_db__';
            var mockDb = {};
            try { mockDb = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch(e) { mockDb = {}; }
            if (!mockDb.tasks) {
              mockDb.tasks = [
                { id: '1', title: 'Complete AI Project Setup', status: 'Completed', priority: 'High', completed: true, created_at: new Date().toISOString() },
                { id: '2', title: 'Design Responsive Dashboard UI', status: 'In Progress', priority: 'Medium', completed: false, created_at: new Date().toISOString() },
                { id: '3', title: 'Connect Live Web Preview', status: 'Pending', priority: 'High', completed: false, created_at: new Date().toISOString() }
              ];
            }

            var responseData = { success: true };
            var normalizedUrl = urlStr.toLowerCase();

            // 1. Auth routes
            if (normalizedUrl.includes('login') || normalizedUrl.includes('register') || normalizedUrl.includes('signup') || normalizedUrl.includes('token')) {
              var email = (body && (body.email || body.username)) || 'user@nexusai.live';
              var name = (body && body.name) || email.split('@')[0];
              var userObj = { id: 'u_' + Date.now(), name: name, email: email };
              responseData = {
                success: true,
                message: 'Authentication successful',
                access_token: 'mock_jwt_token_' + Date.now(),
                token: 'mock_jwt_token_' + Date.now(),
                user: userObj
              };
              localStorage.setItem('user', JSON.stringify(userObj));
              localStorage.setItem('token', responseData.access_token);
            }
            // 2. Tasks / Todos routes
            else if (normalizedUrl.includes('task') || normalizedUrl.includes('todo')) {
              if (method === 'GET') {
                responseData = mockDb.tasks;
              } else if (method === 'POST') {
                var newTask = Object.assign({
                  id: String(Date.now()),
                  title: (body && (body.title || body.name)) || 'New Task',
                  completed: false,
                  status: 'Pending',
                  created_at: new Date().toISOString()
                }, body || {});
                mockDb.tasks.unshift(newTask);
                localStorage.setItem(storeKey, JSON.stringify(mockDb));
                responseData = newTask;
              } else if (method === 'PUT' || method === 'PATCH') {
                var parts = urlStr.split('/');
                var targetId = parts[parts.length - 1];
                mockDb.tasks = mockDb.tasks.map(function(t) {
                  if (t.id === targetId || String(t.id) === String(targetId)) {
                    return Object.assign({}, t, body || {});
                  }
                  return t;
                });
                localStorage.setItem(storeKey, JSON.stringify(mockDb));
                responseData = { success: true, message: 'Updated task' };
              } else if (method === 'DELETE') {
                var parts = urlStr.split('/');
                var targetId = parts[parts.length - 1];
                mockDb.tasks = mockDb.tasks.filter(function(t) { return t.id !== targetId && String(t.id) !== String(targetId); });
                localStorage.setItem(storeKey, JSON.stringify(mockDb));
                responseData = { success: true, message: 'Deleted task' };
              }
            }
            // 3. Profile / User routes
            else if (normalizedUrl.includes('profile') || normalizedUrl.includes('user') || normalizedUrl.includes('me')) {
              responseData = {
                id: 'u1',
                name: 'Himanshu Rao',
                email: 'user@nexusai.live',
                role: 'Administrator',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
              };
            }
            // 4. Fallback for any other API endpoint
            else {
              responseData = {
                success: true,
                message: 'Mock API endpoint executed successfully',
                data: body || {},
                timestamp: new Date().toISOString()
              };
            }

            return new Response(JSON.stringify(responseData), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          try {
            return await origFetch.apply(window, arguments);
          } catch(err) {
            console.warn('[Fetch Warning] Request to ' + urlStr + ' failed, returning mock OK response');
            return new Response(JSON.stringify({ success: true, status: 'ok' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        };
      })();
    </script>
  `;

  // Standard CSS stylesheets combined
  const combinedCss = cssFiles.map(f => f.code || "").join("\n");
  const styleBlock = `<style id="nexus-inlined-styles">\n${combinedCss}\n</style>`;

  // Common CDN Libraries (Tailwind CSS, Google Fonts, Lucide Icons, FontAwesome 6, Chart.js)
  const commonCdnTags = `
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      try {
        tailwind.config = {
          darkMode: 'class',
          theme: {
            extend: {
              colors: {
                brand: {
                  50: '#f5f3ff',
                  100: '#ede9fe',
                  500: '#8b5cf6',
                  600: '#7c3aed',
                  700: '#6d28d9',
                }
              }
            }
          }
        };
      } catch(e) {}
    </script>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- Lucide Icons & FontAwesome -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <!-- Chart.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  `;

  // -------------------------------------------------------------
  // MODE A: React 18 Standalone Execution (JSX without HTML file)
  // -------------------------------------------------------------
  if (isExplicitReact) {
    const appFile =
      findFile(files, p => p.endsWith("app.jsx") || p.endsWith("app.js") || p.endsWith("app.tsx")) ||
      findFile(files, p => p.endsWith("main.jsx") || p.endsWith("index.jsx") || p.endsWith("index.js")) ||
      jsFiles[0];

    const otherJsFiles = jsFiles.filter(f => f !== appFile);

    const cleanReactCode = (rawCode = "") => {
      return rawCode
        .replace(/import\s+React\s*,\s*\{([^}]+)\}\s+from\s+['"]react['"];?/g, "const { $1 } = React;")
        .replace(/import\s+\{([^}]+)\}\s+from\s+['"]react['"];?/g, "const { $1 } = React;")
        .replace(/import\s+React\s+from\s+['"]react['"];?/g, "")
        .replace(/import\s+ReactDOM\s+from\s+['"]react-dom(?:\/client)?['"];?/g, "")
        .replace(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/g, "// Lucide icons")
        .replace(/import\s+.*?from\s+['"][^'"]+['"];?/g, "// $&")
        .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, "function $1")
        .replace(/export\s+default\s+([A-Za-z0-9_]+);?/g, "window.App = $1;")
        .replace(/export\s+\{([^}]+)\};?/g, "")
        .replace(/export\s+(const|function|let|var|class)/g, "$1");
    };

    const helperScripts = otherJsFiles
      .map(f => cleanReactCode(f.code || ""))
      .join("\n\n");

    const rootAppCode = cleanReactCode(appFile?.code || "");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
  ${commonCdnTags}
  <!-- React 18 & Babel Standalone -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  ${runtimePreamble}
  ${styleBlock}
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; min-height: 100vh; background: #0f172a; color: #f8fafc; }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    ${helperScripts}

    ${rootAppCode}

    try {
      const TargetComponent = window.App || (typeof App !== 'undefined' ? App : null) || (typeof Main !== 'undefined' ? Main : null);
      if (TargetComponent) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<TargetComponent />);
      } else {
        document.getElementById('root').innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif;"><h2>🚀 React Application Loaded</h2><p>Application mounted.</p></div>';
      }
    } catch(err) {
      console.error('React Mount Error:', err);
    }
  </script>
  <script>
    if (window.lucide) {
      setTimeout(function() { try { window.lucide.createIcons(); } catch(e) {} }, 300);
    }
  </script>
</body>
</html>`;
  }

  // -------------------------------------------------------------
  // MODE B: Primary Vanilla HTML / CSS / JavaScript Project
  // -------------------------------------------------------------
  if (htmlFile && htmlFile.code) {
    let finalHtml = htmlFile.code;

    // 1. Inlining CSS references
    cssFiles.forEach(file => {
      const path = normalizePath(file.path || file.name || "");
      const name = path.split("/").pop();
      const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const linkPattern = new RegExp(`<link[^>]+(?:href=["'](?:\\./|/)?(?:${escapedPath}|${escapedName})["'][^>]*|rel=["']stylesheet["'][^>]*href=["'](?:\\./|/)?(?:${escapedPath}|${escapedName})["'])[^>]*>`, "gi");
      finalHtml = finalHtml.replace(linkPattern, `<style>\n/* ${path} */\n${file.code || ""}\n</style>`);
    });

    // 2. Clean ES module export/import syntax for Vanilla browser scripts
    const cleanVanillaJs = (code = "") => {
      return code
        .replace(/^\s*export\s+default\s+/gm, "// export default ")
        .replace(/^\s*export\s+\{([^}]+)\};?/gm, "// export { $1 }")
        .replace(/^\s*export\s+(const|function|let|var|class)/gm, "$1")
        .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"];?/gm, "// $&");
    };

    // 3. Inlining JS script references
    jsFiles.forEach(file => {
      const path = normalizePath(file.path || file.name || "");
      const name = path.split("/").pop();
      const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const scriptPattern = new RegExp(`<script[^>]+src=["'](?:\\./|/)?(?:${escapedPath}|${escapedName})["'][^>]*><\/script>`, "gi");
      const safeJsCode = cleanVanillaJs(file.code || "");
      finalHtml = finalHtml.replace(scriptPattern, `<script>\n/* ${path} */\n${safeJsCode}\n</script>`);
    });

    // 4. Append any styles not yet inlined
    if (cssFiles.length > 0 && !finalHtml.includes("nexus-inlined-styles")) {
      finalHtml = finalHtml.includes("</head>")
        ? finalHtml.replace("</head>", `${styleBlock}\n</head>`)
        : `${styleBlock}\n${finalHtml}`;
    }

    // 5. Append any JS files not yet referenced
    const unreferencedJs = jsFiles.filter(f => !finalHtml.includes(f.code || ""));
    if (unreferencedJs.length > 0) {
      const jsBlock = "<script>\n" + unreferencedJs.map(f => `/* ${f.path || f.name} */\n${cleanVanillaJs(f.code || "")}`).join("\n\n") + "\n</script>";
      finalHtml = finalHtml.includes("</body>")
        ? finalHtml.replace("</body>", `${jsBlock}\n</body>`)
        : `${finalHtml}\n${jsBlock}`;
    }

    // 6. Inject CDN & Runtime Preamble
    if (finalHtml.includes("<head>")) {
      finalHtml = finalHtml.replace("<head>", `<head>\n${commonCdnTags}\n${runtimePreamble}`);
    } else {
      finalHtml = `${commonCdnTags}\n${runtimePreamble}\n${finalHtml}`;
    }

    // 7. Initialize icons at the bottom of the page
    const iconInit = `
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          if (window.lucide) {
            try { window.lucide.createIcons(); } catch(e) {}
          }
        });
        if (window.lucide) {
          setTimeout(function() { try { window.lucide.createIcons(); } catch(e) {} }, 400);
        }
      </script>
    `;
    finalHtml = finalHtml.includes("</body>")
      ? finalHtml.replace("</body>", `${iconInit}\n</body>`)
      : `${finalHtml}\n${iconInit}`;

    return finalHtml;
  }

  // -------------------------------------------------------------
  // MODE C: Backend API Explorer View (when project has Python/FastAPI)
  // -------------------------------------------------------------
  const pyCode = pyFiles.map(f => f.code || "").join("\n\n");
  const extractedRoutes = [];
  const routeRegex = /@(app|router)\.(get|post|put|delete|patch)\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = routeRegex.exec(pyCode)) !== null) {
    extractedRoutes.push({
      method: match[2].toUpperCase(),
      path: match[3]
    });
  }

  const jsBlock = jsFiles.length > 0 ? "<script>\n" + jsFiles.map(f => f.code || "").join("\n\n") + "\n</script>" : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Live Preview</title>
  ${commonCdnTags}
  ${runtimePreamble}
  ${styleBlock}
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 24px; min-height: 100vh; background: #09090b; color: #f4f4f5; }
    .api-card { background: #18181b; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .method-badge { padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
    .get { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
    .post { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .delete { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
  </style>
</head>
<body>
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between pb-6 border-b border-zinc-800 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-white flex items-center gap-3">
          <span class="p-2 bg-purple-600/20 text-purple-400 rounded-lg border border-purple-500/30">⚡</span>
          ${projectName}
        </h1>
        <p class="text-sm text-zinc-400 mt-1">Full-Stack Application & Interactive API Gateway</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">FastAPI Server Active</span>
      </div>
    </div>

    ${
      extractedRoutes.length > 0
        ? `
      <h2 class="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">Detected Endpoints (${extractedRoutes.length})</h2>
      <div class="space-y-3">
        ${extractedRoutes
          .map(
            r => `
          <div class="api-card flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="method-badge ${r.method.toLowerCase()}">${r.method}</span>
              <code class="text-purple-300 font-mono text-sm">${r.path}</code>
            </div>
            <button onclick="testRoute('${r.method}', '${r.path}')" class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white rounded-md border border-zinc-700 transition">
              Test Endpoint
            </button>
          </div>
        `
          )
          .join("")}
      </div>
      `
        : `
      <div class="api-card text-center py-12">
        <p class="text-zinc-400 text-sm">Project compiled with ${files.length} files (${files.map(f => f.path || f.name).join(", ")}).</p>
      </div>
      `
    }

    <div id="test-output" class="hidden mt-6 api-card">
      <h3 class="text-xs font-bold uppercase text-zinc-400 mb-2">Live Response:</h3>
      <pre id="test-json" class="text-xs font-mono text-emerald-400 bg-black/60 p-4 rounded-lg overflow-x-auto"></pre>
    </div>
  </div>

  ${jsBlock}

  <script>
    async function testRoute(method, path) {
      const output = document.getElementById('test-output');
      const jsonPre = document.getElementById('test-json');
      output.classList.remove('hidden');
      jsonPre.innerText = 'Sending request to ' + path + '...';

      try {
        const res = await fetch(path, { method: method });
        const data = await res.json();
        jsonPre.innerText = JSON.stringify(data, null, 2);
      } catch (err) {
        jsonPre.innerText = JSON.stringify({ status: 200, message: "Endpoint active", path: path, result: "OK" }, null, 2);
      }
    }
  </script>
</body>
</html>`;
}

export default function LiveWebPreview({
  files = [],
  projectName = "Autonomous AI Project",
  executionId = null,
  onClose = null,
  isModal = false
}) {
  const [viewportMode, setViewportMode] = useState("desktop"); // desktop, laptop, tablet, mobile
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [iframeKey, setIframeKey] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState("all"); // all, error, warn, log

  const iframeRef = useRef(null);

  // Generate compiled document
  const compiledDoc = useMemo(() => {
    return compileProjectForPreview(files, projectName);
  }, [files, projectName]);

  // Project URL slug
  const virtualDomain = useMemo(() => {
    const slug = (projectName || "app")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 24);
    return `${slug || "app"}.nexusai.live`;
  }, [projectName]);

  // Listen for iframe logs via postMessage
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === "NEXUS_PREVIEW_LOG") {
        setLogs(prev => [
          ...prev.slice(-150), // keep last 150 logs
          {
            id: crypto.randomUUID(),
            ...event.data.payload
          }
        ]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Reload iframe
  const handleReload = () => {
    setIsReloading(true);
    setIframeKey(k => k + 1);
    setTimeout(() => setIsReloading(false), 500);
  };

  // Copy virtual URL
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`https://${virtualDomain}`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Standalone Popout / Open in Real New Browser Tab
  const handleOpenInNewTab = () => {
    if (!compiledDoc) return;
    const blob = new Blob([compiledDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const newTab = window.open(url, "_blank");
    if (newTab) {
      newTab.focus();
    }
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    return logs.filter(l => l.type === logFilter);
  }, [logs, logFilter]);

  const errorCount = logs.filter(l => l.type === "error").length;

  return (
    <div className={`live-web-preview-container ${isFullscreen ? "fullscreen-mode" : ""}`}>
      {/* 1. TOP BROWSER CHROME */}
      <div className="browser-chrome-header">
        {/* Left: Window Dots & Navigation */}
        <div className="browser-left-controls">
          <div className="browser-traffic-lights">
            <span
              className="traffic-light-dot red"
              title={isModal ? "Close Preview" : "Reset"}
              onClick={() => {
                if (isModal && onClose) onClose();
              }}
            />
            <span className="traffic-light-dot yellow" title="Minimize" />
            <span
              className="traffic-light-dot green"
              title="Toggle Fullscreen"
              onClick={() => setIsFullscreen(!isFullscreen)}
            />
          </div>

          <div className="browser-nav-buttons">
            <button className="browser-nav-btn" title="Back" disabled>
              <ArrowLeft size={13} />
            </button>
            <button className="browser-nav-btn" title="Forward" disabled>
              <ArrowRight size={13} />
            </button>
            <button
              className={`browser-nav-btn ${isReloading ? "spinning" : ""}`}
              onClick={handleReload}
              title="Reload Website"
            >
              <RotateCw size={13} />
            </button>
          </div>
        </div>

        {/* Middle: Realistic Address Bar */}
        <div className="browser-address-bar-container">
          <span className="address-ssl-icon" title="SSL Encrypted Live Sandbox">
            <Lock size={12} />
          </span>
          <div className="address-url-text">
            <span className="protocol">https://</span>
            <span className="domain">{virtualDomain}</span>
            <span className="path">/preview</span>
          </div>
          <button
            className="address-copy-btn"
            onClick={handleCopyUrl}
            title={copiedUrl ? "Copied!" : "Copy Live Link"}
          >
            {copiedUrl ? <Check size={12} style={{ color: "#22c55e" }} /> : <Copy size={12} />}
          </button>
          <span className="address-live-badge">
            <span className="live-pulse-dot"></span> Live
          </span>
        </div>

        {/* Right: Viewport Selectors & Popout Actions */}
        <div className="browser-right-actions">
          {/* Device Responsive Viewport Group */}
          <div className="device-viewport-group">
            <button
              className={`viewport-btn ${viewportMode === "desktop" ? "active" : ""}`}
              onClick={() => setViewportMode("desktop")}
              title="Desktop (100% Full Width)"
            >
              <Monitor size={13} />
            </button>
            <button
              className={`viewport-btn ${viewportMode === "laptop" ? "active" : ""}`}
              onClick={() => setViewportMode("laptop")}
              title="Laptop (1024px)"
            >
              <Laptop size={13} />
            </button>
            <button
              className={`viewport-btn ${viewportMode === "tablet" ? "active" : ""}`}
              onClick={() => setViewportMode("tablet")}
              title="Tablet (768px)"
            >
              <Tablet size={13} />
            </button>
            <button
              className={`viewport-btn ${viewportMode === "mobile" ? "active" : ""}`}
              onClick={() => setViewportMode("mobile")}
              title="Mobile (375px)"
            >
              <Smartphone size={13} />
            </button>
          </div>

          {/* DevTools Console Toggle */}
          <button
            className={`browser-action-btn ${consoleOpen ? "primary" : ""}`}
            onClick={() => setConsoleOpen(!consoleOpen)}
            title="Toggle Developer Console"
          >
            <Terminal size={13} />
            <span>Console</span>
            {errorCount > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", padding: "1px 5px", borderRadius: "10px", fontSize: "9px" }}>
                {errorCount}
              </span>
            )}
          </button>

          {/* Popout in New Real Browser Tab */}
          <button
            className="browser-action-btn primary"
            onClick={handleOpenInNewTab}
            title="Open in Real Browser Tab"
          >
            <ExternalLink size={13} />
            <span>New Tab</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            className="browser-action-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {isModal && onClose && (
            <button
              className="browser-action-btn"
              onClick={onClose}
              style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)" }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* 2. VIEWPORT STAGE */}
      <div className="preview-viewport-stage">
        <div className={`preview-device-frame ${viewportMode}`}>
          {compiledDoc ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              className="preview-iframe"
              title={`${projectName} Live Preview`}
              srcDoc={compiledDoc}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#71717a", textAlign: "center", padding: "20px" }}>
              <AlertTriangle size={32} style={{ color: "#eab308", marginBottom: "10px" }} />
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#f4f4f5" }}>No previewable frontend files</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>Generate HTML/CSS/JS or React code in the engineer model to view live website.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. DEVTOOLS CONTOOLS DRAWER */}
      {consoleOpen && (
        <div className="preview-console-drawer">
          <div className="console-drawer-header">
            <div className="console-drawer-title">
              <Terminal size={12} style={{ color: "#8b5cf6" }} />
              <span>DevTools Console</span>
              <span className="console-log-count">{filteredLogs.length} logs</span>
            </div>

            <div className="console-drawer-actions">
              <button
                className={`console-action-btn ${logFilter === "all" ? "active" : ""}`}
                onClick={() => setLogFilter("all")}
              >
                All
              </button>
              <button
                className={`console-action-btn ${logFilter === "error" ? "active" : ""}`}
                onClick={() => setLogFilter("error")}
                style={{ color: errorCount > 0 ? "#f87171" : undefined }}
              >
                Errors ({errorCount})
              </button>
              <button
                className="console-action-btn"
                onClick={() => setLogs([])}
                title="Clear console logs"
              >
                <Trash2 size={11} /> Clear
              </button>
            </div>
          </div>

          <div className="console-logs-list">
            {filteredLogs.length === 0 ? (
              <div className="console-empty-state">Console output is clean. No errors recorded.</div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className={`console-log-entry ${log.type}`}>
                  <span className="console-log-time">[{log.timestamp}]</span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
