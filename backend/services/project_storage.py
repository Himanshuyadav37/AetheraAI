from pathlib import Path
import platform
import re

# Detect OS to handle Windows vs Linux paths dynamically
if platform.system() == "Windows":
    BASE_DIR = Path(r"D:\NexusAIProjects")
else:
    BASE_DIR = Path("/tmp/NexusAIProjects")

# Ensure the directory exists
BASE_DIR.mkdir(parents=True, exist_ok=True)


def get_project_dir(project_id: str) -> Path:
    if not isinstance(project_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", project_id):
        raise ValueError("Invalid project identifier")
    path = (BASE_DIR / project_id).resolve()
    if path.parent != BASE_DIR.resolve():
        raise ValueError("Project path escapes storage root")
    return path


def get_zip_path(project_id: str) -> Path:
    get_project_dir(project_id)
    return (BASE_DIR / f"{project_id}.zip").resolve()


def resolve_project_file(project_id: str, relative_path: str) -> Path:
    project_dir = get_project_dir(project_id).resolve()
    requested = Path(relative_path)
    if requested.is_absolute() or ".." in requested.parts:
        raise ValueError("Path must remain inside the project workspace")
    resolved = (project_dir / requested).resolve()
    if resolved != project_dir and project_dir not in resolved.parents:
        raise ValueError("Path escapes the project workspace")
    return resolved