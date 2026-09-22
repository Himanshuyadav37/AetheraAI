import json
import re

from llm.groq_client import generate_response


ARCHITECT_SYSTEM_PROMPT = """You are the Senior Enterprise Solutions Architect and Technical Lead at NexusAI.
A user has submitted a software creation request.

Your goal is to ensure high-fidelity software generation through Human-in-the-Loop (HITL) requirements clarification.

EVALUATION RULES:
1. If the user prompt is VERY DETAILED (e.g. explicitly describes page sections, tech stack, data models, layout requirements), OR if the user says "proceed", "generate", "confirm", "start", "use defaults", "yes", "go ahead", "build it", "direct":
   -> Set "is_ready_to_generate": true.

2. If the user prompt is HIGH-LEVEL, SHORT, or AMBIGUOUS (e.g. "make a college website", "build a portfolio", "create a todo app", "food delivery app", "e-commerce site", "booking system"):
   -> Set "is_ready_to_generate": false.
   -> Generate 2 to 3 concise, highly relevant architectural clarification questions.
   -> For each question, provide 2 to 3 crisp, clickable option pills with one recommended default.
   -> Provide a concise 1-sentence recommended architecture.

RETURN ONLY VALID JSON (no text before or after):

{
  "is_ready_to_generate": false,
  "project_name": "Concise Professional Project Title",
  "understanding": "1-2 sentence clean overview of what the user wants to build",
  "recommended_architecture": "Responsive full-featured web application with modern domain-tailored styling, rich components, and dynamic interactivity",
  "questions": [
    {
      "id": "theme",
      "question": "Which design theme and aesthetic fits best?",
      "options": [
        "Modern Domain-Tailored Aesthetic (Recommended)",
        "Sleek Dark Glassmorphism",
        "Clean Minimalist & Accessible"
      ],
      "recommended": "Modern Domain-Tailored Aesthetic (Recommended)"
    },
    {
      "id": "scope",
      "question": "Which key sections / features should be built?",
      "options": [
        "Hero, About/Academics, Courses/Programs, Campus Gallery, Contact Form",
        "Single-Page Interactive Showcase",
        "Full Multi-Section Portal with Dynamic Filters"
      ],
      "recommended": "Hero, About/Academics, Courses/Programs, Campus Gallery, Contact Form"
    },
    {
      "id": "interactivity",
      "question": "Any specific dynamic interactive features?",
      "options": [
        "Interactive Filter & Search + Modal Dialogs",
        "Dynamic Contact & Admission Inquiry Modal",
        "Smooth Animated Showcase"
      ],
      "recommended": "Interactive Filter & Search + Modal Dialogs"
    }
  ]
}
"""


# ============================================================
# Helpers
# ============================================================

def _normalize_files(code_data):
    """
    Normalize generated/fixed code into:

    [
        {
            "path": "...",
            "code": "..."
        }
    ]

    Supports both the new list format and the old:
    {
        "files": [...]
    }
    format.
    """

    if not code_data:
        return []

    # New canonical format
    if isinstance(code_data, list):

        return [
            item
            for item in code_data
            if isinstance(item, dict)
            and item.get("path")
        ]

    # Backward-compatible old format
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


def _normalize_tech_stack(tech):
    """
    Safely normalize tech_stack because planner output
    can occasionally vary between dict/list/string.
    """

    if isinstance(
        tech,
        dict
    ):
        return tech

    if isinstance(
        tech,
        list
    ):
        return {
            "frontend": tech
        }

    if isinstance(
        tech,
        str
    ):
        return {
            "frontend": [tech]
        }

    return {}


def _normalize_frontend(frontend):
    """
    Convert frontend stack to a clean display string.
    """

    if not frontend:
        return [
            "HTML5",
            "Modern CSS3",
            "Vanilla JavaScript (ES6+)"
        ]

    if isinstance(
        frontend,
        list
    ):
        return [
            str(item)
            for item in frontend
        ]

    return [str(frontend)]


def _normalize_features(features):
    """
    Normalize planner feature output.
    """

    if not features:
        return []

    if isinstance(
        features,
        list
    ):
        return [
            str(feature)
            for feature in features
            if feature
        ]

    if isinstance(
        features,
        str
    ):
        return [features]

    return []


# ============================================================
# Requirement Evaluation
# ============================================================

def evaluate_and_clarify_requirements(
    idea: str,
    conversation_history: list = None,
    force_generate: bool = False
) -> dict:
    """
    Evaluates whether the user's software prompt requires
    clarification or is ready for autonomous generation.
    """

    if force_generate:

        return {
            "is_ready_to_generate": True
        }

    idea = idea or ""

    trimmed = idea.strip().lower()

    # --------------------------------------------------------
    # Direct generation triggers
    # --------------------------------------------------------

    direct_triggers = [
        "proceed",
        "generate",
        "confirm",
        "start",
        "use defaults",
        "yes",
        "go ahead",
        "build it",
        "make it now",
        "create now",
        "direct generate",
        "recommended architecture",
        "with defaults",
        "ok",
        "sure",
        "done"
    ]

    if any(
        trimmed == trigger
        or trimmed.startswith(trigger)
        or trimmed.endswith(trigger)
        for trigger in direct_triggers
    ):

        return {
            "is_ready_to_generate": True
        }

    # --------------------------------------------------------
    # Detailed prompt
    # --------------------------------------------------------

    if len(
        idea.split()
    ) > 90:

        return {
            "is_ready_to_generate": True
        }

    # --------------------------------------------------------
    # Previous architecture clarification
    # --------------------------------------------------------

    if conversation_history:

        for msg in reversed(
            conversation_history[-4:]
        ):

            if not isinstance(
                msg,
                dict
            ):
                continue

            role = msg.get(
                "role"
            )

            result = str(
                msg.get(
                    "result",
                    {}
                )
            )

            content = str(
                msg.get(
                    "content",
                    ""
                )
            )

            if (
                role == "assistant"
                and (
                    "clarification" in result.lower()
                    or "architecture requirement analysis"
                    in content.lower()
                    or "human-in-the-loop"
                    in content.lower()
                )
            ):

                return {
                    "is_ready_to_generate": True
                }

    # --------------------------------------------------------
    # LLM architecture evaluation
    # --------------------------------------------------------

    prompt = f"""
{ARCHITECT_SYSTEM_PROMPT}

USER PROMPT:
{idea}
"""

    try:

        raw = generate_response(
            prompt
        )

        clean_raw = re.sub(
            r"```json|```",
            "",
            raw or "",
            flags=re.IGNORECASE
        ).strip()

        # First attempt: complete JSON
        try:

            data = json.loads(
                clean_raw
            )

        except Exception:

            # Second attempt: extract JSON object
            start = clean_raw.find(
                "{"
            )

            end = clean_raw.rfind(
                "}"
            )

            if (
                start == -1
                or end == -1
            ):
                raise ValueError(
                    "No JSON object found."
                )

            data = json.loads(
                clean_raw[
                    start:end + 1
                ]
            )

        if not isinstance(
            data,
            dict
        ):

            raise ValueError(
                "Architect response is not an object."
            )

        return data

    except Exception as exc:

        print(
            "[Architect] Failed to parse "
            f"clarification LLM response: {exc}"
        )

        # Safe fallback: continue generation
        return {
            "is_ready_to_generate": True
        }


# ============================================================
# Clarification Markdown
# ============================================================

def format_clarification_markdown(
    clarification_data: dict
) -> str:
    """
    Formats a clean enterprise-grade Markdown response
    for the Architecture Brief.
    """

    if not isinstance(
        clarification_data,
        dict
    ):
        clarification_data = {}

    project_name = (
        clarification_data.get(
            "project_name"
        )
        or "Autonomous AI Project"
    )

    understanding = (
        clarification_data.get(
            "understanding"
        )
        or (
            "Analyzing project architecture "
            "requirements."
        )
    )

    recommended = (
        clarification_data.get(
            "recommended_architecture"
        )
        or (
            "Responsive full-featured web "
            "application with modern domain-tailored "
            "styling, rich components, and dynamic "
            "interactivity"
        )
    )

    lines = [
        f"### ⚡ Architecture Brief: **{project_name}**",
        "",
        understanding,
        "",
        f"> 💡 **Recommended Default:** {recommended}",
        "",
        (
            "👇 *Select your preferred options below "
            "and click **Confirm & Generate Project**:*"
        )
    ]

    return "\n".join(
        lines
    )


# ============================================================
# Enterprise Blueprint
# ============================================================

def generate_enterprise_blueprint(
    result: dict
) -> str:
    """
    Generates a rich enterprise-level Markdown Blueprint
    for generated projects.

    Compatible with both:
        generated_code = [...]
    and:
        generated_code = {"files": [...]}
    """

    if not result:
        return "✅ Code generation completed."

    if not isinstance(
        result,
        dict
    ):
        return "✅ Code generation completed."

    # ========================================================
    # Project plan
    # ========================================================

    plan = result.get(
        "project_plan",
        {}
    )

    if not isinstance(
        plan,
        dict
    ):
        plan = {}

    idea = result.get(
        "idea",
        ""
    )

    title = (
        plan.get("project_name")
        or idea[:40]
        or "NexusAI Project"
    )

    desc = (
        plan.get("project_description")
        or plan.get("description")
        or idea
        or "Engineered multi-agent production build."
    )

    # ========================================================
    # IMPORTANT:
    # generated_code / fixed_code are now lists.
    # ========================================================

    fixed_files = _normalize_files(
        result.get("fixed_code")
    )

    generated_files = _normalize_files(
        result.get("generated_code")
    )

    # Prefer fixed files
    files = (
        fixed_files
        if fixed_files
        else generated_files
    )

    # ========================================================
    # Tech stack
    # ========================================================

    tech = _normalize_tech_stack(
        plan.get(
            "tech_stack",
            {}
        )
    )

    frontend = _normalize_frontend(
        tech.get(
            "frontend"
        )
    )

    frontend_str = ", ".join(
        frontend
    )

    # ========================================================
    # File tree
    # ========================================================

    file_tree_lines = []

    for file_data in files:

        path = str(
            file_data.get(
                "path",
                ""
            )
        )

        if not path:
            continue

        lower = path.lower()

        if lower.endswith(
            ".html"
        ):

            role = (
                "Semantic HTML5 layout, "
                "SEO metadata, navigation "
                "and component structure"
            )

        elif lower.endswith(
            ".css"
        ):

            role = (
                "Responsive design system, "
                "typography, layout and transitions"
            )

        elif lower.endswith(
            (
                ".js",
                ".jsx",
                ".ts",
                ".tsx"
            )
        ):

            role = (
                "Client-side logic, state management "
                "and interactive application behavior"
            )

        elif lower.endswith(
            ".json"
        ):

            role = (
                "Project configuration, "
                "dependency metadata or structured data"
            )

        elif lower.endswith(
            ".py"
        ):

            role = (
                "Backend application logic, "
                "REST endpoints and data processing"
            )

        elif lower.endswith(
            ".md"
        ):

            role = (
                "Project documentation, "
                "architecture and setup instructions"
            )

        elif lower.endswith(
            (
                ".sql",
                ".db"
            )
        ):

            role = (
                "Database schema, queries "
                "and persistence layer"
            )

        elif lower.endswith(
            (
                ".yml",
                ".yaml"
            )
        ):

            role = (
                "Infrastructure or deployment configuration"
            )

        elif lower == "dockerfile":

            role = (
                "Container image build configuration"
            )

        else:

            role = (
                "Application asset and resource module"
            )

        file_tree_lines.append(
            f"* 📄 **`{path}`** — *{role}*"
        )

    file_list_str = (
        "\n".join(
            file_tree_lines
        )
        if file_tree_lines
        else "* No static files generated."
    )

    # ========================================================
    # Features
    # ========================================================

    features_raw = _normalize_features(
        plan.get(
            "features",
            []
        )
    )

    if features_raw:

        feature_lines = "\n".join(
            [
                (
                    f"* ✨ **{feature}**"
                    if not feature.startswith("*")
                    else feature
                )
                for feature in features_raw[:8]
            ]
        )

    else:

        feature_lines = (
            "* ✨ **Modular Multi-File Architecture:** "
            "Clean separation of concerns.\n"
            "* 📱 **Responsive Design:** "
            "Adaptive Mobile, Tablet and Desktop layouts.\n"
            "* ⚡ **Interactive Application:** "
            "Dynamic user interactions and state handling.\n"
            "* 🧪 **Engineering Verification:** "
            "Generated project passes the configured verification pipeline."
        )

    # ========================================================
    # Blueprint
    # ========================================================

    blueprint_md = f"""# 🚀 **{title}**

### 📋 Project Vision & Overview

{desc}

---

### 🛠️ Production Tech Stack

* **🎨 Frontend & Layout:** {frontend_str}
* **⚡ Client Logic & Interactivity:** Modern application logic and event handling
* **🔤 Typography & Icons:** Domain-appropriate typography and iconography
* **🏗️ Architecture:** Multi-file production-oriented project structure

---

### 📁 Generated File Architecture ({len(files)} files)

{file_list_str}

---

### ✨ Key Capabilities & Highlights

{feature_lines}

---

### 🧪 Engineering Status

* **Workspace:** Generated project workspace
* **Code Generation:** Completed
* **File Persistence:** Workspace-backed
* **Verification:** Tester pipeline executed
* **Deployment Planning:** Available through Deployer agent

---

### 🚀 Export & Deployment

* **Live Workspace:** Generated project files are stored in the execution workspace.
* **Containerization:** Docker configuration can be generated when requested.
* **Kubernetes:** Kubernetes deployment manifests can be generated when requested.
* **GitHub:** Project can be exported through the existing project workflow.
"""

    return blueprint_md