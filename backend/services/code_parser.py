import json
import re
import ast

def extract_files_from_response(response: str) -> dict:
    """
    Robust multi-strategy code extractor that parses LLM responses into structured files list.
    Guarantees extraction even when JSON is unclosed, contains unescaped newlines/quotes,
    or is formatted in markdown blocks.
    """
    if not response or not isinstance(response, str):
        return {"files": []}

    cleaned = response.strip()
    
    # -------------------------------------------------------------
    # STRATEGY 1: Standard JSON / Loose JSON (strict=False)
    # -------------------------------------------------------------
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        json_candidate = cleaned[start:end + 1]
        try:
            data = json.loads(json_candidate, strict=False)
            if isinstance(data, dict) and "files" in data and isinstance(data["files"], list) and len(data["files"]) > 0:
                valid_files = [f for f in data["files"] if isinstance(f, dict) and f.get("path") and f.get("code") is not None]
                if valid_files:
                    return {"files": valid_files}
        except Exception:
            pass

        # Try Python literal eval after normalizing true/false/null
        try:
            py_text = re.sub(
                r'("[^"\\]*(?:\\.[^"\\]*)*"|\'[^\'\\]*(?:\\.[^\'\\]*)*\')|\b(true|false|null)\b',
                lambda match: match.group(1) if match.group(1) else {"true": "True", "false": "False", "null": "None"}[match.group(2)],
                json_candidate
            )
            data = ast.literal_eval(py_text)
            if isinstance(data, dict) and "files" in data and isinstance(data["files"], list) and len(data["files"]) > 0:
                valid_files = [f for f in data["files"] if isinstance(f, dict) and f.get("path") and f.get("code") is not None]
                if valid_files:
                    return {"files": valid_files}
        except Exception:
            pass

    # -------------------------------------------------------------
    # STRATEGY 2: Regex Object Pair Extractor for "path" and "code"
    # -------------------------------------------------------------
    files_found = []
    # Match patterns like {"path": "...", "code": "..."}
    pattern = r'{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"code"\s*:\s*"(.*?)(?="\s*[,}])'
    matches = re.finditer(pattern, cleaned, re.DOTALL)
    for m in matches:
        path = m.group(1)
        raw_code = m.group(2)
        # Unescape common JSON escaped characters
        unescaped_code = raw_code.replace('\\"', '"').replace('\\n', '\n').replace('\\t', '\t').replace('\\\\', '\\')
        files_found.append({"path": path, "code": unescaped_code})

    if files_found:
        return {"files": files_found}

    # -------------------------------------------------------------
    # STRATEGY 3: Markdown Code Block Section Parser
    # Examples:
    # ### index.html
    # ```html
    # ...
    # ```
    # or **File: App.jsx**
    # ```jsx
    # ...
    # ```
    # -------------------------------------------------------------
    md_pattern = r'(?:###\s*[`"]?([A-Za-z0-9_\-\.\/]+)[`"]?|\*\*File:\s*[`"]?([A-Za-z0-9_\-\.\/]+)[`"]?\*\*|//\s*filepath:\s*([A-Za-z0-9_\-\.\/]+)|#\s*file:\s*([A-Za-z0-9_\-\.\/]+))\s*\n+```[a-zA-Z0-9_\-]*\n(.*?)\n```'
    for match in re.finditer(md_pattern, cleaned, re.DOTALL):
        filename = match.group(1) or match.group(2) or match.group(3) or match.group(4)
        code = match.group(5)
        if filename and code is not None:
            files_found.append({"path": filename.strip(), "code": code})

    if files_found:
        return {"files": files_found}

    # -------------------------------------------------------------
    # STRATEGY 4: Generic Code Block Extractor by Language Heuristics
    # -------------------------------------------------------------
    code_blocks = re.findall(r'```([a-zA-Z0-9_\-]*)\n(.*?)\n```', cleaned, re.DOTALL)
    if code_blocks:
        assigned_names = set()
        for lang, block_code in code_blocks:
            lang = lang.lower().strip()
            if not lang or lang == "json":
                continue
            
            # Infer filename based on language and content
            if lang == "html" or "<!doctype" in block_code.lower() or "<html" in block_code.lower():
                name = "index.html"
            elif lang == "css" or ("{" in block_code and ":" in block_code and ";" in block_code and not "function" in block_code):
                name = "style.css"
            elif lang in ("jsx", "tsx") or "import react" in block_code.lower() or "usestate" in block_code.lower():
                name = "App.jsx"
            elif lang in ("javascript", "js", "node"):
                if "express" in block_code.lower() or "require(" in block_code or "app.listen" in block_code:
                    name = "server.js"
                elif "mongoose" in block_code.lower() or "schema" in block_code.lower():
                    name = "models.js"
                else:
                    name = "app.js"
            elif lang in ("python", "py"):
                if "fastapi" in block_code.lower() or "flask" in block_code.lower() or "app = " in block_code:
                    name = "main.py"
                elif "pydantic" in block_code.lower() or "class " in block_code and "baseModel" in block_code:
                    name = "models.py"
                else:
                    name = "main.py"
            else:
                name = f"code_{len(files_found) + 1}.{lang or 'txt'}"

            if name in assigned_names:
                name = f"{name.split('.')[0]}_{len(files_found) + 1}.{name.split('.')[-1]}"
            assigned_names.add(name)

            files_found.append({"path": name, "code": block_code})

    if files_found:
        return {"files": files_found}

    # -------------------------------------------------------------
    # STRATEGY 5: Fallback Single File Recovery
    # -------------------------------------------------------------
    clean_code = re.sub(r'```[a-zA-Z0-9_\-]*|```', '', cleaned).strip()
    if clean_code:
        if "<html" in clean_code.lower() or "<!doctype" in clean_code.lower():
            return {"files": [{"path": "index.html", "code": clean_code}]}
        elif "import " in clean_code or "def " in clean_code or "class " in clean_code:
            return {"files": [{"path": "main.py", "code": clean_code}]}
        else:
            return {"files": [{"path": "app.js", "code": clean_code}]}

    return {"files": []}
