from pathlib import Path
import platform
import re
import uuid

# Detect OS to handle Windows vs Linux paths dynamically
if platform.system() == "Windows":
    BASE_DIR = Path(r"D:\NexusAIProjects")
else:
    BASE_DIR = Path("/tmp/NexusAIProjects")

# Ensure the directory exists
BASE_DIR.mkdir(parents=True, exist_ok=True)


def get_project_dir(project_id: str | None) -> Path:
    if not project_id or not isinstance(project_id, str) or not str(project_id).strip():
        safe_id = f"proj_{uuid.uuid4().hex[:12]}"
    else:
        # Sanitize project_id to only valid alphanumeric, dash, and underscore characters
        clean = re.sub(r"[^A-Za-z0-9_-]", "_", str(project_id).strip())[:100]
        safe_id = clean if clean else f"proj_{uuid.uuid4().hex[:12]}"

    path = (BASE_DIR / safe_id).resolve()
    # Security check: ensure path stays within storage root
    if path.parent != BASE_DIR.resolve():
        path = (BASE_DIR / f"proj_{uuid.uuid4().hex[:12]}").resolve()
    
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_zip_path(project_id: str | None) -> Path:
    project_dir = get_project_dir(project_id)
    safe_name = project_dir.name
    return (BASE_DIR / f"{safe_name}.zip").resolve()


def resolve_project_file(project_id: str | None, relative_path: str) -> Path:
    project_dir = get_project_dir(project_id).resolve()
    clean_rel = str(relative_path).lstrip("/\\.").replace("../", "").replace("..\\", "")
    requested = Path(clean_rel)
    resolved = (project_dir / requested).resolve()
    if resolved != project_dir and project_dir not in resolved.parents:
        resolved = project_dir / requested.name
    return resolved