import ast
import json
import re
from typing import Any, Dict, List


# ============================================================
# NORMALIZATION
# ============================================================

def _normalize_content(content: Any) -> str:
    """
    Ensure every file's code is stored as a string.
    """
    if content is None:
        return ""

    if isinstance(content, str):
        return content

    if isinstance(content, (dict, list)):
        return json.dumps(
            content,
            ensure_ascii=False,
            indent=2,
        )

    return str(content)


def _normalize_files(data: Any) -> List[Dict[str, str]]:
    """
    Convert any supported parser output into canonical format:

    [
        {
            "path": "package.json",
            "code": "..."
        }
    ]

    Supported inputs:
    - [{"path": "...", "code": "..."}]
    - {"files": [{"path": "...", "code": "..."}]}
    - single {"path": "...", "code": "..."}
    """

    if not data:
        return []

    # Canonical list
    if isinstance(data, list):
        result = []

        for item in data:
            if not isinstance(item, dict):
                continue

            path = item.get("path")
            code = item.get("code", item.get("content"))

            if not path or code is None:
                continue

            result.append(
                {
                    "path": str(path).strip(),
                    "code": _normalize_content(code),
                }
            )

        return _deduplicate_files(result)

    # Legacy wrapper
    if isinstance(data, dict):

        if isinstance(data.get("files"), list):
            return _normalize_files(data["files"])

        # Single file object
        if data.get("path") and (
            data.get("code") is not None
            or data.get("content") is not None
        ):
            return _normalize_files([data])

    return []


def _deduplicate_files(
    files: List[Dict[str, str]]
) -> List[Dict[str, str]]:
    """
    Deduplicate by path.
    Latest occurrence wins.
    """
    by_path: Dict[str, Dict[str, str]] = {}

    for file_data in files:
        path = file_data.get("path")

        if not path:
            continue

        by_path[path] = file_data

    return list(by_path.values())


# ============================================================
# JSON EXTRACTION
# ============================================================

def _extract_json_objects(text: str) -> List[Any]:
    """
    Extract balanced JSON objects/arrays from text.

    This is more reliable than:
        text.find("{")
        text.rfind("}")

    because LLM output may contain multiple JSON/code sections.
    """

    candidates = []

    for opening, closing in [
        ("{", "}"),
        ("[", "]"),
    ]:
        start_positions = [
            match.start()
            for match in re.finditer(
                re.escape(opening),
                text,
            )
        ]

        for start in start_positions:

            depth = 0
            in_string = False
            escape = False

            for index in range(start, len(text)):

                char = text[index]

                if in_string:

                    if escape:
                        escape = False
                        continue

                    if char == "\\":
                        escape = True
                        continue

                    if char == '"':
                        in_string = False

                    continue

                if char == '"':
                    in_string = True
                    continue

                if char == opening:
                    depth += 1

                elif char == closing:
                    depth -= 1

                    if depth == 0:
                        candidates.append(
                            text[start:index + 1]
                        )
                        break

    # Prefer larger candidates first.
    candidates.sort(
        key=len,
        reverse=True,
    )

    return candidates


def _parse_json_candidate(
    candidate: str,
) -> List[Dict[str, str]]:

    # Standard JSON
    try:
        data = json.loads(
            candidate,
            strict=False,
        )

        files = _normalize_files(data)

        if files:
            return files

    except Exception:
        pass

    # Python literal fallback
    try:
        data = ast.literal_eval(candidate)

        files = _normalize_files(data)

        if files:
            return files

    except Exception:
        pass

    return []


# ============================================================
# REGEX FILE OBJECT EXTRACTION
# ============================================================

def _extract_path_code_pairs(
    text: str,
) -> List[Dict[str, str]]:
    """
    Recover file objects from partially broken JSON.

    Handles examples like:

    {"path":"src/App.jsx","code":"..."}
    {"path": "package.json", "code": "..."}
    """

    files = []

    pattern = re.compile(
        r'"path"\s*:\s*"(?P<path>(?:\\.|[^"\\])*)"\s*,'
        r'\s*"code"\s*:\s*"(?P<code>(?:\\.|[^"\\])*)"',
        re.DOTALL,
    )

    for match in pattern.finditer(text):

        raw_path = match.group("path")
        raw_code = match.group("code")

        try:
            path = json.loads(
                f'"{raw_path}"'
            )
        except Exception:
            path = raw_path

        try:
            code = json.loads(
                f'"{raw_code}"'
            )
        except Exception:
            code = raw_code

        if path and code is not None:

            files.append(
                {
                    "path": str(path).strip(),
                    "code": _normalize_content(code),
                }
            )

    return _deduplicate_files(files)


# ============================================================
# MARKDOWN FILE EXTRACTION
# ============================================================

def _extract_markdown_files(
    text: str,
) -> List[Dict[str, str]]:

    files = []

    patterns = [
        # ### filename
        re.compile(
            r"###\s*[`\"]?([A-Za-z0-9_.\-/\\]+)[`\"]?"
            r"\s*\n+"
            r"```[A-Za-z0-9_.-]*\s*\n"
            r"(.*?)"
            r"\n```",
            re.DOTALL,
        ),

        # **File: filename**
        re.compile(
            r"\*\*File:\s*[`\"]?([A-Za-z0-9_.\-/\\]+)[`\"]?\*\*"
            r"\s*\n+"
            r"```[A-Za-z0-9_.-]*\s*\n"
            r"(.*?)"
            r"\n```",
            re.DOTALL,
        ),

        # // filepath: filename
        re.compile(
            r"//\s*filepath:\s*([A-Za-z0-9_.\-/\\]+)"
            r"\s*\n+"
            r"```[A-Za-z0-9_.-]*\s*\n"
            r"(.*?)"
            r"\n```",
            re.DOTALL,
        ),

        # # file: filename
        re.compile(
            r"#\s*file:\s*([A-Za-z0-9_.\-/\\]+)"
            r"\s*\n+"
            r"```[A-Za-z0-9_.-]*\s*\n"
            r"(.*?)"
            r"\n```",
            re.DOTALL,
        ),
    ]

    for pattern in patterns:

        for match in pattern.finditer(text):

            path = match.group(1).strip()
            code = match.group(2)

            if path and code is not None:

                files.append(
                    {
                        "path": path,
                        "code": code.strip(),
                    }
                )

    return _deduplicate_files(files)


# ============================================================
# GENERIC CODE BLOCK EXTRACTION
# ============================================================

def _infer_filename(
    language: str,
    code: str,
    index: int,
) -> str:

    lang = language.lower().strip()
    lower_code = code.lower()

    if lang == "html" or "<!doctype" in lower_code:
        return "index.html"

    if lang == "css":
        return "style.css"

    if lang in ("jsx", "tsx"):
        return "App.jsx" if lang == "jsx" else "App.tsx"

    if "import react" in lower_code or "usestate" in lower_code:
        return "App.jsx"

    if lang in ("javascript", "js", "node"):

        if (
            "express" in lower_code
            or "app.listen" in lower_code
        ):
            return "server.js"

        return "app.js"

    if lang in ("python", "py"):

        if (
            "fastapi" in lower_code
            or "flask" in lower_code
            or "app = " in lower_code
        ):
            return "main.py"

        return "main.py"

    if lang == "json":
        return "package.json"

    if lang in ("yaml", "yml"):
        return "config.yaml"

    return f"code_{index}.txt"


def _extract_generic_code_blocks(
    text: str,
) -> List[Dict[str, str]]:

    files = []

    pattern = re.compile(
        r"```([A-Za-z0-9_.+-]*)\s*\n"
        r"(.*?)"
        r"\n```",
        re.DOTALL,
    )

    for match in pattern.finditer(text):

        language = match.group(1).strip()
        code = match.group(2)

        if not code.strip():
            continue

        # JSON blocks are handled by the JSON parser first.
        if language.lower() == "json":
            continue

        path = _infer_filename(
            language,
            code,
            len(files) + 1,
        )

        files.append(
            {
                "path": path,
                "code": code.strip(),
            }
        )

    # Avoid collisions
    result = []
    used_paths = set()

    for index, file_data in enumerate(files, start=1):

        path = file_data["path"]

        if path in used_paths:

            base, ext = os_path_split_extension(path)

            path = (
                f"{base}_{index}"
                f"{ext}"
            )

        used_paths.add(path)

        result.append(
            {
                "path": path,
                "code": file_data["code"],
            }
        )

    return result


def os_path_split_extension(
    path: str,
):
    """
    Small local helper so this parser doesn't need
    platform-specific path behavior.
    """
    if "." not in path:
        return path, ""

    base, extension = path.rsplit(
        ".",
        1,
    )

    return base, "." + extension


# ============================================================
# MAIN EXTRACTOR
# ============================================================

def extract_files_from_response(
    response: str,
) -> List[Dict[str, str]]:
    """
    Extract generated project files from an LLM response.

    IMPORTANT:
    This function now returns the canonical format directly:

    [
        {
            "path": "package.json",
            "code": "..."
        }
    ]

    It does NOT return:
        {"files": [...]}

    This prevents the old "files" pseudo-file bug.
    """

    if not response or not isinstance(
        response,
        str,
    ):
        return []

    cleaned = response.strip()

    # --------------------------------------------------------
    # Strategy 1: Balanced JSON extraction
    # --------------------------------------------------------

    json_candidates = _extract_json_objects(
        cleaned
    )

    for candidate in json_candidates:

        files = _parse_json_candidate(
            candidate
        )

        if files:
            return files

    # --------------------------------------------------------
    # Strategy 2: Broken JSON path/code recovery
    # --------------------------------------------------------

    files = _extract_path_code_pairs(
        cleaned
    )

    if files:
        return files

    # --------------------------------------------------------
    # Strategy 3: Markdown file sections
    # --------------------------------------------------------

    files = _extract_markdown_files(
        cleaned
    )

    if files:
        return files

    # --------------------------------------------------------
    # Strategy 4: Generic fenced code blocks
    # --------------------------------------------------------

    files = _extract_generic_code_blocks(
        cleaned
    )

    if files:
        return files

    # --------------------------------------------------------
    # Strategy 5: Single-file fallback
    # --------------------------------------------------------

    clean_code = re.sub(
        r"```[A-Za-z0-9_.+-]*",
        "",
        cleaned,
    )

    clean_code = clean_code.replace(
        "```",
        "",
    ).strip()

    if not clean_code:
        return []

    lower_code = clean_code.lower()

    if (
        "<!doctype" in lower_code
        or "<html" in lower_code
    ):
        return [
            {
                "path": "index.html",
                "code": clean_code,
            }
        ]

    if (
        "import react" in lower_code
        or "usestate" in lower_code
        or "from 'react'" in lower_code
        or 'from "react"' in lower_code
    ):
        return [
            {
                "path": "App.jsx",
                "code": clean_code,
            }
        ]

    if (
        "def " in lower_code
        or "from fastapi" in lower_code
        or "import fastapi" in lower_code
    ):
        return [
            {
                "path": "main.py",
                "code": clean_code,
            }
        ]

    return [
        {
            "path": "app.js",
            "code": clean_code,
        }
    ]


# ============================================================
# MERGE
# ============================================================

def merge_code_files(
    existing_code: Any,
    updated_code: Any,
) -> List[Dict[str, str]]:
    """
    Merge existing and updated project files.

    Canonical output:

    [
        {
            "path": "...",
            "code": "..."
        }
    ]

    Updated files override existing files
    with the same path.
    """

    existing_files = _normalize_files(
        existing_code
    )

    updated_files = _normalize_files(
        updated_code
    )

    merged_by_path: Dict[
        str,
        Dict[str, str]
    ] = {}

    for file_data in existing_files:

        path = file_data.get("path")

        if path:
            merged_by_path[path] = file_data

    for file_data in updated_files:

        path = file_data.get("path")

        if path:
            merged_by_path[path] = file_data

    return list(
        merged_by_path.values()
    )