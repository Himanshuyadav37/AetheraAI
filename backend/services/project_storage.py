from pathlib import Path
import platform

# Detect OS to handle Windows vs Linux paths dynamically
if platform.system() == "Windows":
    BASE_DIR = Path(r"D:\NeuroForgeProjects")
else:
    BASE_DIR = Path("/tmp/NeuroForgeProjects")

# Ensure the directory exists
BASE_DIR.mkdir(parents=True, exist_ok=True)


def get_project_dir(project_id: str) -> Path:
    return BASE_DIR / project_id


def get_zip_path(project_id: str) -> Path:
    return BASE_DIR / f"{project_id}.zip"