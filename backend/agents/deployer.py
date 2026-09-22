from services.usage_tracker import UsageTracker
from memory.project_memory import save_memory
from services.execution_stream import append_execution_step


def _normalize_files(code_data):
    """
    Normalize generated/fixed code into:

    [
        {
            "path": "...",
            "code": "..."
        }
    ]
    """

    if not code_data:
        return []

    if isinstance(code_data, list):
        return [
            item
            for item in code_data
            if isinstance(item, dict)
            and item.get("path")
        ]

    if isinstance(code_data, dict):

        files = code_data.get(
            "files",
            []
        )

        if isinstance(files, list):
            return [
                item
                for item in files
                if isinstance(item, dict)
                and item.get("path")
            ]

    return []


def _file_exists(files, filename):
    filename = filename.lower()

    return any(
        str(file.get("path", "")).lower()
        == filename
        for file in files
    )


def _add_file(files, path, code):
    """
    Add deployment file only if it doesn't already exist.
    """

    if _file_exists(
        files,
        path
    ):
        return

    files.append(
        {
            "path": path,
            "code": code
        }
    )


def deployer_agent(state):
    # Bind LLM usage telemetry to this Engineer execution.
    UsageTracker.set_context(
        user_id=state.get("user_id"),
        module="engineer",
        operation="deployer_agent",
        agent="deployer",
        project_id=state.get("project_id"),
        execution_id=state.get("execution_id"),
    )


    # =========================================================
    # 1. Starting deployer
    # =========================================================

    append_execution_step(
        state,
        {
            "agent": "deployer",
            "step": "generating_deployment_plan",
            "status": "in_progress",
            "message": (
                "Generating deployment configuration "
                "and Kubernetes manifests"
            )
        }
    )

    # =========================================================
    # 2. Retrieve generated/fixed files
    # =========================================================

    fixed_files = _normalize_files(
        state.get("fixed_code")
    )

    generated_files = _normalize_files(
        state.get("generated_code")
    )

    # Prefer fixed files when available
    files = (
        fixed_files
        if fixed_files
        else generated_files
    )

    # Make a copy so we don't accidentally mutate
    # the original list object.
    files = list(files)

    print(
        f"[Deployer] Files available: {len(files)}"
    )

    # =========================================================
    # 3. Detect project environment
    # =========================================================

    is_node = False
    is_python = False
    is_html_only = True

    for file_data in files:

        path = str(
            file_data.get(
                "path",
                ""
            )
        ).lower()

        # Node / JavaScript / TypeScript
        if (
            path == "package.json"
            or path.endswith(
                (
                    ".js",
                    ".jsx",
                    ".ts",
                    ".tsx"
                )
            )
        ):
            is_node = True
            is_html_only = False

        # Python
        elif (
            path == "requirements.txt"
            or path == "pyproject.toml"
            or path.endswith(
                (
                    ".py",
                    ".pip"
                )
            )
        ):
            is_python = True
            is_html_only = False

    print(
        f"[Deployer] Node: {is_node}"
    )

    print(
        f"[Deployer] Python: {is_python}"
    )

    # =========================================================
    # 4. Deployment configuration
    # =========================================================

    if is_python:

        port = 8000

        dockerfile_content = """FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "main.py"]
"""

        compose_content = """services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      ENV: production
"""

    elif is_node:

        port = 3000

        dockerfile_content = """FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
"""

        compose_content = """services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
"""

    else:

        port = 80

        dockerfile_content = """FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
"""

        compose_content = """services:
  web:
    build: .
    ports:
      - "8080:80"
"""

    # =========================================================
    # 5. Kubernetes manifest
    # =========================================================

    k8s_deployment_content = f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: aethera-app
  labels:
    app: aethera-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: aethera-app
  template:
    metadata:
      labels:
        app: aethera-app
    spec:
      containers:
        - name: aethera-app
          image: aethera-app:latest
          ports:
            - containerPort: {port}
          resources:
            limits:
              memory: "512Mi"
              cpu: "500m"
            requests:
              memory: "256Mi"
              cpu: "250m"
---
apiVersion: v1
kind: Service
metadata:
  name: aethera-app-service
spec:
  selector:
    app: aethera-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: {port}
  type: LoadBalancer
"""

    # =========================================================
    # 6. Deployment files
    # =========================================================

    deployment_files = [
        {
            "path": "Dockerfile",
            "code": dockerfile_content
        },
        {
            "path": "docker-compose.yml",
            "code": compose_content
        },
        {
            "path": "k8s-deployment.yaml",
            "code": k8s_deployment_content
        }
    ]

    # =========================================================
    # 7. Check whether user requested deployment files
    # =========================================================

    user_idea = str(
        state.get(
            "idea",
            ""
        )
    ).lower()

    user_wants_deployment_files = any(
        keyword in user_idea
        for keyword in [
            "docker",
            "dockerfile",
            "compose",
            "k8s",
            "kubernetes",
            "container"
        ]
    )

    # =========================================================
    # 8. Add deployment files only when requested
    # =========================================================

    if user_wants_deployment_files:

        for deployment_file in deployment_files:

            _add_file(
                files,
                deployment_file["path"],
                deployment_file["code"]
            )

        print(
            "[Deployer] Deployment files added."
        )

    else:

        print(
            "[Deployer] Deployment files were not "
            "explicitly requested."
        )

    # =========================================================
    # 9. Keep state compatible with new list structure
    # =========================================================

    state["generated_code"] = files

    state["fixed_code"] = files

    # =========================================================
    # 10. Deployment plan
    # =========================================================

    deployment_plan = {
        "deployment_type": "containerized-k8s",

        "docker": {
            "enabled": True,
            "dockerfile": (
                user_wants_deployment_files
            ),
            "compose": (
                user_wants_deployment_files
            )
        },

        "kubernetes": {
            "enabled": True,
            "manifest": "k8s-deployment.yaml",
            "target_port": port
        },

        "cloud": {
            "provider": "Kubernetes",
            "service": (
                "Deployment / LoadBalancer"
            )
        },

        "steps": [
            "Build Docker image locally",
            "Test container execution",
            "Tag and push image to registry",
            "Apply Kubernetes deployment manifest",
            "Perform Kubernetes service rollout health check"
        ]
    }

    state["deployment_plan"] = (
        deployment_plan
    )

    # =========================================================
    # 11. Agent notes
    # =========================================================

    if "agent_notes" not in state:
        state["agent_notes"] = []

    state["agent_notes"].append(
        (
            "Deployer generated deployment "
            "configuration compatible with the "
            "current list-based code structure."
        )
    )

    # =========================================================
    # 12. Execution stream
    # =========================================================

    append_execution_step(
        state,
        {
            "agent": "deployer",
            "step": "generating_deployment_plan",
            "status": "completed",
            "message": (
                "Successfully generated deployment "
                "plan and deployment configuration"
            ),
            "details": {
                "deployment_type": (
                    deployment_plan[
                        "deployment_type"
                    ]
                ),
                "cloud_provider": (
                    deployment_plan[
                        "cloud"
                    ]["provider"]
                ),
                "steps_count": len(
                    deployment_plan[
                        "steps"
                    ]
                ),
                "files_count": len(files),
                "deployment_files_added": (
                    user_wants_deployment_files
                )
            }
        }
    )

    # =========================================================
    # 13. Save memory
    # =========================================================

    try:

        save_memory(
            {
                "project_id": state.get(
                    "project_id"
                ),
                "agent": "deployer",
                "note": (
                    "Generated containerized "
                    "deployment specifications "
                    "and Kubernetes manifests."
                )
            }
        )

    except Exception as exc:

        print(
            f"[Deployer] Memory save failed: {exc}"
        )

    print(
        "[Deployer] Deployment planning complete."
    )

    return state
