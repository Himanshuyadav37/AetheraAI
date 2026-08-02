from datetime import datetime

from memory.project_memory import (
    save_memory
)
from services.execution_stream import append_execution_step


def deployer_agent(state):

    # Add step: Starting deployer
    append_execution_step(state, {
        "agent": "deployer",
        "step": "generating_deployment_plan",
        "status": "in_progress",
        "message": "Generating docker configurations and Kubernetes manifests dynamically",
    })

    # Retrieve existing generated files list
    fixed_code = state.get("fixed_code") or {}
    gen_code = state.get("generated_code") or {}
    
    files = fixed_code.get("files", []) or gen_code.get("files", []) or []

    # Detect language/environment
    is_node = False
    is_python = False
    is_html_only = True

    for f in files:
        path = f.get("path", "").lower()
        if "package.json" in path or path.endswith((".js", ".jsx", ".ts", ".tsx")):
            is_node = True
            is_html_only = False
        elif "requirements.txt" in path or path.endswith((".py", ".pip")):
            is_python = True
            is_html_only = False

    # Define dynamic deployment manifests
    if is_python:
        port = 8000
        dockerfile_content = """FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
"""
        compose_content = """version: '3.8'
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - ENV=production
"""
    elif is_node:
        port = 3000
        dockerfile_content = """FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
"""
        compose_content = """version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
"""
    else:
        port = 80
        dockerfile_content = """FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
"""
        compose_content = """version: '3.8'
services:
  web:
    build: .
    ports:
      - "8080:80"
"""

    k8s_deployment_content = f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
  labels:
    app: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app-container
        image: my-app-image:latest
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
  name: app-service
spec:
  selector:
    app: my-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: {port}
  type: LoadBalancer
"""

    # Inject these new configuration files into the project files
    deployment_files = [
        {"path": "Dockerfile", "code": dockerfile_content},
        {"path": "docker-compose.yml", "code": compose_content},
        {"path": "k8s-deployment.yaml", "code": k8s_deployment_content}
    ]

    # Append to state
    if "files" not in gen_code:
        gen_code["files"] = []
    
    # Avoid duplicate addition
    existing_paths = {f.get("path") for f in gen_code.get("files", [])}
    for df in deployment_files:
        if df["path"] not in existing_paths:
            gen_code["files"].append(df)

    if fixed_code:
        if "files" not in fixed_code:
            fixed_code["files"] = []
        existing_fixed_paths = {f.get("path") for f in fixed_code.get("files", [])}
        for df in deployment_files:
            if df["path"] not in existing_fixed_paths:
                fixed_code["files"].append(df)

    state["generated_code"] = gen_code
    state["fixed_code"] = fixed_code

    deployment_plan = {
        "deployment_type": "containerized-k8s",
        "docker": {
            "enabled": True,
            "dockerfile": True,
            "compose": True
        },
        "kubernetes": {
            "enabled": True,
            "manifest": "k8s-deployment.yaml",
            "target_port": port
        },
        "cloud": {
            "provider": "Kubernetes",
            "service": "Deployment / LoadBalancer"
        },
        "steps": [
            "Build Docker Image locally",
            "Test container execution",
            "Tag and Push image to Registry",
            "Apply K8s Deployment Manifest",
            "Perform K8s Service Rollout Health Check"
        ]
    }

    state["deployment_plan"] = (
        deployment_plan
    )

    state["agent_notes"].append(
        "Deployer generated dynamic Dockerfile, docker-compose.yml, and k8s-deployment.yaml"
    )

    # Add step: Deployment plan generated
    append_execution_step(state, {
        "agent": "deployer",
        "step": "generating_deployment_plan",
        "status": "completed",
        "message": "Successfully generated deployment plan and deployment configs",
        "details": {
            "deployment_type": deployment_plan["deployment_type"],
            "cloud_provider": deployment_plan["cloud"]["provider"],
            "steps_count": len(deployment_plan["steps"]),
            "files_added": ["Dockerfile", "docker-compose.yml", "k8s-deployment.yaml"]
        },
    })

    save_memory(
        {
            "project_id":
                state["project_id"],

            "agent":
                "deployer",

            "note":
                "Generated containerized deployment specs and Kubernetes manifests"
        }
    )

    return state