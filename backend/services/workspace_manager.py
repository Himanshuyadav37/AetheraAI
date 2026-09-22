import json
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Any


class WorkspaceManager:
    """
    Manages an isolated filesystem workspace for
    one Aethera Engineer execution.
    """

    def __init__(self, base_dir: Optional[str] = None):

        self.base_dir = Path(
            base_dir
            or os.getenv(
                "AETHERA_WORKSPACE_DIR",
                os.path.join(
                    tempfile.gettempdir(),
                    "aethera_workspaces",
                ),
            )
        )

        self.base_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

    # =========================================================
    # Workspace
    # =========================================================

    def create_workspace(
        self,
        execution_id: str,
    ) -> str:

        if not execution_id:
            raise ValueError(
                "execution_id is required"
            )

        workspace = (
            self.base_dir
            / str(execution_id)
        )

        workspace.mkdir(
            parents=True,
            exist_ok=True,
        )

        return str(workspace)

    def cleanup_workspace(
        self,
        execution_id: str,
    ) -> None:

        if not execution_id:
            return

        workspace = (
            self.base_dir
            / str(execution_id)
        )

        if workspace.exists():

            shutil.rmtree(
                workspace,
                ignore_errors=True,
            )

    # =========================================================
    # Content normalization
    # =========================================================

    @staticmethod
    def _normalize_content(
        content: Any,
    ) -> str:
        """
        Convert generated LLM content into a string.

        LLM/parser output can occasionally contain:
        - str
        - list
        - dict
        - None

        Filesystem writes require str.
        """

        if content is None:
            return ""

        if isinstance(
            content,
            str,
        ):
            return content

        if isinstance(
            content,
            (dict, list),
        ):
            return json.dumps(
                content,
                indent=2,
                ensure_ascii=False,
            )

        return str(content)

    # =========================================================
    # File writing
    # =========================================================

    def write_file(
        self,
        workspace_path: str,
        relative_path: str,
        content: Any,
    ) -> str:

        if not relative_path:
            raise ValueError(
                "relative_path is required"
            )

        workspace = Path(
            workspace_path
        ).resolve()

        target = (
            workspace
            / str(relative_path)
        ).resolve()

        # Prevent path traversal
        if not self._is_inside_workspace(
            workspace,
            target,
        ):
            raise ValueError(
                "Invalid file path outside "
                f"workspace: {relative_path}"
            )

        target.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        normalized_content = (
            self._normalize_content(
                content
            )
        )

        target.write_text(
            normalized_content,
            encoding="utf-8",
        )

        return str(target)

    def write_files(
        self,
        workspace_path: str,
        files: List[Dict],
    ) -> List[str]:

        if not files:
            return []

        written_files = []

        for index, file_data in enumerate(
            files
        ):

            if not isinstance(
                file_data,
                dict,
            ):
                print(
                    "[Workspace] Skipping invalid "
                    f"file entry at index {index}"
                )
                continue

            relative_path = file_data.get(
                "path"
            )

            if not relative_path:
                print(
                    "[Workspace] Skipping file "
                    f"without path at index {index}"
                )
                continue

            # Support both:
            # {"path": "...", "code": "..."}
            # {"path": "...", "content": "..."}
            content = file_data.get(
                "code"
            )

            if content is None:

                content = file_data.get(
                    "content",
                    "",
                )

            try:

                written_path = (
                    self.write_file(
                        workspace_path=workspace_path,
                        relative_path=relative_path,
                        content=content,
                    )
                )

                written_files.append(
                    written_path
                )

            except Exception as exc:

                print(
                    "[Workspace] Failed to write "
                    f"{relative_path}: {exc}"
                )

                raise

        return written_files

    # =========================================================
    # File reading
    # =========================================================

    def read_file(
        self,
        workspace_path: str,
        relative_path: str,
    ) -> str:

        workspace = Path(
            workspace_path
        ).resolve()

        target = (
            workspace
            / str(relative_path)
        ).resolve()

        if not self._is_inside_workspace(
            workspace,
            target,
        ):
            raise ValueError(
                f"Invalid file path: "
                f"{relative_path}"
            )

        if not target.exists():

            raise FileNotFoundError(
                relative_path
            )

        return target.read_text(
            encoding="utf-8",
        )

    # =========================================================
    # List files
    # =========================================================

    def list_files(
        self,
        workspace_path: str,
    ) -> List[str]:

        workspace = Path(
            workspace_path
        ).resolve()

        if not workspace.exists():
            return []

        files = []

        for path in workspace.rglob("*"):

            if path.is_file():

                files.append(
                    str(
                        path.relative_to(
                            workspace
                        )
                    ).replace(
                        "\\",
                        "/",
                    )
                )

        return sorted(files)

    # =========================================================
    # Run command
    # =========================================================

    def run_command(
        self,
        workspace_path: str,
        command: str,
        timeout: int = 120,
        sandbox: Optional[bool] = None,
    ) -> Dict:
        """
        Execute a workspace command.

        Security policy:
        - sandbox=True uses Docker isolation and never executes generated
          commands directly on the Aethera host.
        - sandbox=False preserves the legacy local subprocess behavior and
          should only be used for trusted developer commands.
        - if sandbox is omitted, AETHERA_SANDBOX_ENABLED controls the mode.
        """

        if not command:
            raise ValueError("command is required")

        workspace = Path(workspace_path).resolve()

        if not workspace.exists():
            raise FileNotFoundError(
                f"Workspace does not exist: {workspace}"
            )

        if sandbox is None:
            sandbox = os.getenv(
                "AETHERA_SANDBOX_ENABLED",
                "true",
            ).strip().lower() in {
                "1",
                "true",
                "yes",
                "on",
            }

        if sandbox:
            return self.run_sandboxed_command(
                workspace_path=str(workspace),
                command=command,
                timeout=timeout,
            )

        return self._run_local_command(
            workspace=workspace,
            command=command,
            timeout=timeout,
        )

    def _run_local_command(
        self,
        workspace: Path,
        command: str,
        timeout: int,
    ) -> Dict:
        """
        Legacy host execution.

        This is intentionally kept separate from the sandbox path so callers
        can migrate incrementally. Do not use this path for untrusted
        generated code in production.
        """
        try:
            process = subprocess.run(
                command,
                cwd=str(workspace),
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            return {
                "command": command,
                "exit_code": process.returncode,
                "stdout": process.stdout,
                "stderr": process.stderr,
                "success": process.returncode == 0,
                "sandboxed": False,
            }

        except subprocess.TimeoutExpired as exc:
            stdout = exc.stdout or ""
            stderr = exc.stderr or ""

            if isinstance(stdout, bytes):
                stdout = stdout.decode("utf-8", errors="replace")

            if isinstance(stderr, bytes):
                stderr = stderr.decode("utf-8", errors="replace")

            return {
                "command": command,
                "exit_code": -1,
                "stdout": stdout,
                "stderr": (
                    stderr
                    or f"Command timed out after {timeout} seconds"
                ),
                "success": False,
                "timeout": True,
                "sandboxed": False,
            }

        except Exception as exc:
            return {
                "command": command,
                "exit_code": -1,
                "stdout": "",
                "stderr": str(exc),
                "success": False,
                "sandboxed": False,
            }

    def _docker_available(self) -> bool:
        """Return True only when the Docker CLI/daemon is usable."""
        try:
            probe = subprocess.run(
                ["docker", "version", "--format", "{{.Server.Version}}"],
                capture_output=True,
                text=True,
                timeout=8,
            )
            return probe.returncode == 0
        except Exception:
            return False

    def run_sandboxed_command(
        self,
        workspace_path: str,
        command: str,
        timeout: int = 120,
    ) -> Dict:
        """
        Execute generated project commands inside a disposable Docker
        container.

        Isolation controls:
        - no host shell execution
        - non-root user
        - all Linux capabilities dropped
        - no-new-privileges
        - CPU and memory limits
        - PID limit
        - workspace is the only persistent mount
        - network is disabled by default
        - container is removed after execution

        Dependency-install commands automatically receive temporary registry access.
        Normal build/test commands remain offline.

        Network can be globally configured with:
            AETHERA_SANDBOX_NETWORK=bridge

        That should be treated as a separate policy decision because generated
        code can then make outbound network requests.
        """
        if not command:
            raise ValueError("command is required")

        workspace = Path(workspace_path).resolve()

        if not workspace.exists():
            raise FileNotFoundError(
                f"Workspace does not exist: {workspace}"
            )

        if not self._docker_available():
            return {
                "command": command,
                "exit_code": -1,
                "stdout": "",
                "stderr": (
                    "Sandbox unavailable: Docker daemon/CLI is not ready. "
                    "Enable Docker before running untrusted generated code."
                ),
                "success": False,
                "sandboxed": True,
                "sandbox_error": "docker_unavailable",
            }

        # Select a minimal runtime image from the deterministic command.
        # An explicit environment override always wins.
        configured_image = os.getenv(
            "AETHERA_SANDBOX_IMAGE",
            "",
        ).strip()

        if configured_image:
            image = configured_image
        elif command.strip().startswith(("python ", "python3 ")):
            image = "python:3.12-slim"
        elif command.strip().startswith(("npm ", "node ")):
            image = "node:20-bookworm-slim"
        else:
            image = "node:20-bookworm-slim"

        memory = os.getenv(
            "AETHERA_SANDBOX_MEMORY",
            "512m",
        ).strip()

        cpus = os.getenv(
            "AETHERA_SANDBOX_CPUS",
            "1.0",
        ).strip()

        pids_limit = os.getenv(
            "AETHERA_SANDBOX_PIDS",
            "128",
        ).strip()

        configured_network = os.getenv(
            "AETHERA_SANDBOX_NETWORK",
            "none",
        ).strip().lower()

        # Dependency installation is the only default exception because
        # npm/pip need registry access. Build/test commands stay offline.
        if configured_network in {"none", "bridge"}:
            network_mode = configured_network
        else:
            network_mode = "none"

        stripped_command = command.strip()
        dependency_install = (
            stripped_command.startswith("npm install")
            or stripped_command.startswith("npm ci")
            or stripped_command.startswith("python -m pip install")
            or stripped_command.startswith("python3 -m pip install")
            or stripped_command.startswith("python -m venv")
            or stripped_command.startswith("python3 -m venv")
        )

        if configured_network == "none" and dependency_install:
            network_mode = "bridge"

        # Stable per-run container name makes cleanup deterministic.
        container_name = (
            f"aethera-sandbox-{uuid.uuid4().hex[:12]}"
        )

        docker_command = [
            "docker",
            "run",
            "--rm",
            "--name",
            container_name,
            "--cpus",
            cpus,
            "--memory",
            memory,
            "--pids-limit",
            pids_limit,
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--user",
            "1000:1000",
            "--network",
            network_mode,
            "--read-only",
            "--tmpfs",
            "/tmp:rw,nosuid,nodev,noexec,size=128m",
            "--mount",
            f"type=bind,source={workspace},target=/workspace",
            "--workdir",
            "/workspace",
            image,
            "sh",
            "-lc",
            command,
        ]

        try:
            process = subprocess.run(
                docker_command,
                cwd=str(workspace),
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            return {
                "command": command,
                "exit_code": process.returncode,
                "stdout": process.stdout,
                "stderr": process.stderr,
                "success": process.returncode == 0,
                "sandboxed": True,
                "sandbox": {
                    "runtime": "docker",
                    "image": image,
                    "network": network_mode,
                    "network_reason": (
                        "dependency_install"
                        if network_mode == "bridge"
                        else "offline_execution"
                    ),
                    "memory": memory,
                    "cpus": cpus,
                    "pids_limit": int(pids_limit),
                },
            }

        except subprocess.TimeoutExpired as exc:
            stdout = exc.stdout or ""
            stderr = exc.stderr or ""

            if isinstance(stdout, bytes):
                stdout = stdout.decode("utf-8", errors="replace")

            if isinstance(stderr, bytes):
                stderr = stderr.decode("utf-8", errors="replace")

            # Best-effort cleanup in case Docker did not remove the
            # container after a forced timeout.
            try:
                subprocess.run(
                    ["docker", "rm", "-f", container_name],
                    capture_output=True,
                    text=True,
                    timeout=8,
                )
            except Exception:
                pass

            return {
                "command": command,
                "exit_code": -1,
                "stdout": stdout,
                "stderr": (
                    stderr
                    or f"Sandbox command timed out after {timeout} seconds"
                ),
                "success": False,
                "timeout": True,
                "sandboxed": True,
                "sandbox_error": "timeout",
            }

        except Exception as exc:
            try:
                subprocess.run(
                    ["docker", "rm", "-f", container_name],
                    capture_output=True,
                    text=True,
                    timeout=8,
                )
            except Exception:
                pass

            return {
                "command": command,
                "exit_code": -1,
                "stdout": "",
                "stderr": str(exc),
                "success": False,
                "sandboxed": True,
                "sandbox_error": "execution_error",
            }

    # =========================================================
    # Security
    # =========================================================

    @staticmethod
    def _is_inside_workspace(
        workspace: Path,
        target: Path,
    ) -> bool:

        try:

            target.relative_to(
                workspace
            )

            return True

        except ValueError:

            return False


workspace_manager = WorkspaceManager()