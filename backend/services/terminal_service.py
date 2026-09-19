import subprocess
import os
import json
import re
import shlex
from pathlib import Path
from services.project_storage import get_project_dir
from llm.groq_client import generate_response

ALLOWED_COMMANDS = {"python", "python3", "pytest", "node", "npm", "npx", "pip", "pip3"}
BLOCKED_ARGUMENTS = {"-c", "-e", "--eval", "--exec", "&&", "||", ";", "|", ">", "<"}


def _parse_safe_command(command: str) -> list[str]:
    if not isinstance(command, str) or not command.strip() or len(command) > 500:
        raise ValueError("Command is empty or too long")
    if any(token in command for token in ("&&", "||", ";", "|", ">", "<", "`", "$(")):  # Correct syntax
        raise ValueError("Shell operators are not allowed")
    args = shlex.split(command, posix=os.name != "nt")
    if not args:
        raise ValueError("Command is empty")
    executable = os.path.basename(args[0]).lower()
    if executable.endswith(".exe"):
        executable = executable[:-4]
    if executable not in ALLOWED_COMMANDS:
        raise ValueError("Command is not allowlisted")
    if any(arg in BLOCKED_ARGUMENTS for arg in args[1:]):
        raise ValueError("Command argument is not allowed")
    return args


def _safe_environment() -> dict:
    allowed = {"PATH", "PATHEXT", "SYSTEMROOT", "TEMP", "TMP", "HOME", "USERPROFILE"}
    return {key: value for key, value in os.environ.items() if key in allowed}

TERMINAL_PARSER_PROMPT = """
You are an expert systems reliability engineer and compiler debugger.
Analyze the following terminal command execution stdout/stderr logs and identify the root cause of the error.

Command run: {command}

Terminal stdout:
{stdout}

Terminal stderr:
{stderr}

Determine if this output represents a compilation, syntax, runtime, command-not-found, or dependency error.
Then generate a one-click auto-fix recommendation.
The recommendation can be either:
1. A command to run (e.g. `npm install package-name` or `pip install package-name`).
2. A code modification (e.g. fixing syntax, imports, or files).

Output must be a valid JSON object matching the following structure:
{{
  "has_error": true,
  "error_summary": "Short explanation of what failed",
  "fix_type": "command", 
  "fix_command": "Command to run to fix this (if fix_type is 'command')",
  "files_to_fix": [
    {{
      "path": "Relative path of the file to fix (if fix_type is 'code')",
      "code": "The complete modified content of the file"
    }}
  ]
}}

If there is no error in the log, set "has_error" to false.
Ensure that the response is raw JSON only. Do not include markdown code block markers or extra explanation.
"""

def execute_workspace_command(project_id: str, command: str) -> dict:
    """Executes a command inside the project directory and returns output and analysis."""
    project_path = get_project_dir(project_id)
    if not project_path.exists():
        return {
            "exit_code": 1,
            "stdout": "",
            "stderr": f"Project directory for {project_id} does not exist.",
            "fix_suggestion": None
        }

    try:
        args = _parse_safe_command(command)
        proc = subprocess.Popen(
            args,
            shell=False,
            cwd=str(project_path),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=_safe_environment(),
            start_new_session=True,
        )
        stdout, stderr = proc.communicate(timeout=30)
        exit_code = proc.returncode
    except ValueError as e:
        return {"exit_code": 126, "stdout": "", "stderr": str(e), "fix_suggestion": None}
    except subprocess.TimeoutExpired as e:
        proc.kill()
        stdout, stderr = proc.communicate()
        return {
            "exit_code": -1,
            "stdout": stdout,
            "stderr": "Command execution timed out after 30 seconds.",
            "fix_suggestion": None
        }
    except Exception as e:
        return {
            "exit_code": 1,
            "stdout": "",
            "stderr": f"Failed to execute command: {str(e)}",
            "fix_suggestion": None
        }

    fix_suggestion = None
    # Analyze if the command failed (exit code != 0) or output contains generic error keywords
    if exit_code != 0 or any(kw in stderr.lower() or kw in stdout.lower() for kw in ["error", "failed", "crash", "not found"]):
        fix_suggestion = analyze_terminal_output(command, stdout, stderr)

    return {
        "exit_code": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "fix_suggestion": fix_suggestion
    }

def analyze_terminal_output(command: str, stdout: str, stderr: str) -> dict | None:
    """Uses LLM to parse stderr/stdout and create a structured fix suggestion."""
    prompt = TERMINAL_PARSER_PROMPT.format(
        command=command,
        stdout=stdout[:2000],
        stderr=stderr[:2000]
    )
    
    try:
        response = generate_response(prompt)
        response = re.sub(r"```json|```", "", response).strip()
        match = re.search(r"\{.*\}", response, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
            if parsed.get("has_error"):
                return parsed
    except Exception as e:
        print(f"Error analyzing terminal output: {e}")
    return None
