import os
import subprocess
import urllib.request
import urllib.error
import json
from pathlib import Path
from config import settings
from services.project_storage import get_project_dir

def get_github_username(token: str) -> str:
    """Fetch GitHub username using the token."""
    req = urllib.request.Request(
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "NexusAI-App"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            return data.get("login")
    except Exception as e:
        raise Exception(f"Failed to verify GitHub token or retrieve username: {e}")

def create_github_repository(token: str, repo_name: str, description: str, private: bool = True) -> str:
    """Create a new repository on GitHub and return the clone URL."""
    url = "https://api.github.com/user/repos"
    payload = {
        "name": repo_name,
        "description": description,
        "private": private,
        "auto_init": False
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "NexusAI-App"
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            return data.get("html_url"), data.get("clone_url")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        try:
            err_json = json.loads(error_body)
            message = err_json.get("message", error_body)
            errors_list = err_json.get("errors")
            if errors_list and isinstance(errors_list, list):
                details = []
                for err in errors_list:
                    if isinstance(err, dict) and err.get("message"):
                        details.append(err["message"])
                if details:
                    message = f"{message} ({', '.join(details)})"
        except Exception:
            message = error_body
        raise Exception(f"GitHub API Error: {message}")
    except Exception as e:
        raise Exception(f"Failed to create GitHub repository: {e}")

def push_project_to_github(project_id: str, repo_name: str, description: str, private: bool = True, custom_token: str | None = None) -> str:
    """
    Creates a GitHub repository and pushes the local project files to it.
    Returns the HTML URL of the created repository.
    """
    token = custom_token or settings.GITHUB_TOKEN
    if not token:
        raise Exception("GitHub access token is required. Please provide one or configure GITHUB_TOKEN in your settings.")

    # 1. Get Username and Create Repo
    username = get_github_username(token)
    html_url, clone_url = create_github_repository(token, repo_name, description, private)

    # 2. Prepare Local Git Repo
    project_dir = get_project_dir(project_id)
    if not project_dir.exists():
        raise Exception(f"Project directory {project_dir} does not exist.")

    # helper to run git commands
    def run_git(args, cwd=project_dir):
        if os.name == 'nt':
            # Safely quote arguments that have spaces or double quotes
            quoted_args = []
            for arg in args:
                if ' ' in arg or '"' in arg:
                    # Escape existing quotes and wrap in quotes
                    escaped = arg.replace('"', '\\"')
                    quoted_args.append(f'"{escaped}"')
                else:
                    quoted_args.append(arg)
            cmd = "git " + " ".join(quoted_args)
        else:
            cmd = ["git"] + args

        result = subprocess.run(
            cmd,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=(os.name == 'nt')
        )
        if result.returncode != 0:
            combined_error = (result.stderr + "\n" + result.stdout).strip()
            raise Exception(f"Git command failed: git {' '.join(args)}\nError: {combined_error}")
        return result.stdout.strip()

    # Create a simple .gitignore if not present
    gitignore_path = project_dir / ".gitignore"
    if not gitignore_path.exists():
        with open(gitignore_path, "w", encoding="utf-8") as f:
            f.write(".env\n__pycache__/\n*.pyc\nvenv/\nnode_modules/\ndist/\n")

    # Git initialization and configuration
    if not (project_dir / ".git").exists():
        run_git(["init"])
    
    # Always ensure user config is set for this local repo to prevent author identity errors
    try:
        run_git(["config", "user.name", "NexusAI Agent"])
        run_git(["config", "user.email", "agent@nexusai.ai"])
    except Exception:
        pass

    # Configure Remote with Credentials embedded securely
    auth_clone_url = f"https://{username}:{token}@github.com/{username}/{repo_name}.git"

    # Reset remote if already exists
    try:
        run_git(["remote", "remove", "origin"])
    except Exception:
        pass

    run_git(["remote", "add", "origin", auth_clone_url])
    
    # Add files and commit
    run_git(["add", "."])
    try:
        run_git(["commit", "-m", "Initial commit from NexusAI AI Workspace"])
    except Exception as e:
        # If nothing to commit, we can proceed
        if "nothing to commit" not in str(e):
            raise e

    # Push to GitHub
    run_git(["branch", "-M", "main"])
    run_git(["push", "-u", "origin", "main", "--force"])

    return html_url
