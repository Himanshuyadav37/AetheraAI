import json
import re
from llm.groq_client import generate_response

ARCHITECT_SYSTEM_PROMPT = """You are the Senior Enterprise Solutions Architect and Technical Lead at NexusAI.
A user has submitted a software creation request.

Your goal is to ensure high-fidelity software generation through Human-in-the-Loop (HITL) requirements clarification.

EVALUATION RULES:
1. If the user prompt is VERY DETAILED (e.g. explicitly describes page sections, tech stack, data models, layout requirements), OR if the user says "proceed", "generate", "confirm", "start", "use defaults", "yes", "go ahead", "build it", "direct":
   -> Set "is_ready_to_generate": true.

2. If the user prompt is HIGH-LEVEL, SHORT, or AMBIGUOUS (e.g. "make a college website for JECRC", "build a portfolio", "create a todo app", "food delivery app", "e-commerce site", "booking system"):
   -> Set "is_ready_to_generate": false.
   -> Generate 2 to 3 concise, highly relevant architectural clarification questions.
   -> For each question, provide 2 to 3 crisp, clickable option pills with one recommended default.
   -> Provide a concise 1-sentence recommended architecture.

RETURN ONLY VALID JSON (no text before or after):
{
  "is_ready_to_generate": false,
  "project_name": "Concise Professional Project Title",
  "understanding": "1-2 sentence clean overview of what the user wants to build",
  "recommended_architecture": "Single-page responsive web application with dark monochromatic styling and dynamic client-side interactivity",
  "questions": [
    {
      "id": "theme",
      "question": "Which design theme and aesthetic fits best?",
      "options": [
        "Dark Monochromatic (Sleek Nexus Standard)",
        "Modern Clean Minimalist",
        "Classic Institution / Brand Themed"
      ],
      "recommended": "Dark Monochromatic (Sleek Nexus Standard)"
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

def evaluate_and_clarify_requirements(idea: str, conversation_history: list = None, force_generate: bool = False) -> dict:
    """
    Evaluates whether the user's software prompt requires clarification or is ready for autonomous generation.
    """
    if force_generate:
        return {"is_ready_to_generate": True}

    trimmed = idea.strip().lower()

    # Direct override phrases or affirmations
    direct_triggers = [
        "proceed", "generate", "confirm", "start", "use defaults", "yes",
        "go ahead", "build it", "make it now", "create now", "direct generate",
        "recommended architecture", "with defaults", "ok", "sure", "done"
    ]
    if any(trimmed == trigger or trimmed.startswith(trigger) or trimmed.endswith(trigger) for trigger in direct_triggers):
        return {"is_ready_to_generate": True}

    # If prompt is very long and detailed (> 90 words), user has already given extensive specs
    if len(idea.split()) > 90:
        return {"is_ready_to_generate": True}

    # If previous messages in conversation already contained an architect clarification, this is turn 2
    if conversation_history:
        for msg in reversed(conversation_history[-4:]):
            if msg.get("role") == "assistant" and (
                "clarification" in str(msg.get("result", {})) or
                "Architecture Requirement Analysis" in msg.get("content", "") or
                "Human-in-the-Loop" in msg.get("content", "")
            ):
                return {"is_ready_to_generate": True}

    prompt = f"""{ARCHITECT_SYSTEM_PROMPT}

USER PROMPT:
{idea}
"""
    try:
        raw = generate_response(prompt)
        clean_raw = re.sub(r"```json|```", "", raw).strip()
        data = json.loads(clean_raw)
        return data
    except Exception as e:
        print(f"[Architect] Failed to parse clarification LLM response: {e}")
        # Default fallback: If error or ambiguous, proceed to generate
        return {"is_ready_to_generate": True}


def format_clarification_markdown(clarification_data: dict) -> str:
    """
    Formats the clarification questions into an ultra-clean, enterprise-grade Markdown response.
    """
    project_name = clarification_data.get("project_name", "Autonomous AI Project")
    understanding = clarification_data.get("understanding", "Analyzing project architecture requirements.")
    recommended = clarification_data.get("recommended_architecture", "Dark Monochromatic responsive web application")
    questions = clarification_data.get("questions", [])

    lines = [
        f"### ⚡ Architecture Brief: **{project_name}**",
        "",
        understanding,
        "",
        "To ensure the generated codebase matches your exact vision, please select your preferences below (or confirm to proceed with recommendations):",
        ""
    ]

    for idx, q in enumerate(questions, 1):
        q_text = q.get("question", "")
        options = q.get("options", [])
        recommended_opt = q.get("recommended", "")
        lines.append(f"**{idx}. {q_text}**")
        for opt in options:
            is_rec = " *(Recommended)*" if opt == recommended_opt else ""
            lines.append(f"- `{opt}`{is_rec}")
        lines.append("")

    lines.append(f"> 💡 **Recommended Default:** {recommended}")
    lines.append("")
    lines.append("*Select options or click **Confirm & Generate** to build with the recommended architecture.*")

    return "\n".join(lines)


def generate_enterprise_blueprint(result: dict) -> str:
    """
    Generates a rich, comprehensive, enterprise-level Markdown Blueprint for generated projects.
    """
    if not result:
        return "✅ Code generation completed."

    plan = result.get("project_plan", {})
    title = plan.get("project_name") or result.get("idea", "Autonomous Project")[:40] or "NexusAI Project"
    desc = plan.get("project_description") or plan.get("description") or result.get("idea") or "Engineered multi-agent production build."
    
    files = result.get("fixed_code", {}).get("files") or result.get("generated_code", {}).get("files") or []
    
    # Tech stack extraction
    tech = plan.get("tech_stack", {})
    frontend = tech.get("frontend") or ["HTML5", "Modern CSS3", "Vanilla JavaScript (ES6+)"]
    if isinstance(frontend, list):
        frontend_str = ", ".join(frontend)
    else:
        frontend_str = str(frontend)

    # File descriptions based on extensions
    file_tree_lines = []
    for f in files:
        path = f.get("path", "")
        lower = path.lower()
        if lower.endswith(".html"):
            role = "Semantic HTML5 layout, SEO meta tags, navigation & component structure"
        elif lower.endswith(".css"):
            role = "Responsive design system, typography variables, glassmorphism & transitions"
        elif lower.endswith(".js") or lower.endswith(".jsx") or lower.endswith(".ts") or lower.endswith(".tsx"):
            role = "Client-side state management, interactive DOM handlers, filter & modal logic"
        elif lower.endswith(".json"):
            role = "Project metadata, package configuration & structured data models"
        elif lower.endswith(".py"):
            role = "Backend application logic, REST endpoints & data processing services"
        elif lower.endswith(".md"):
            role = "Project documentation, architecture breakdown & setup instructions"
        else:
            role = "Application asset and resource module"
        
        file_tree_lines.append(f"* 📄 **`{path}`** — *{role}*")

    features_raw = plan.get("features", [])
    if isinstance(features_raw, list) and len(features_raw) > 0:
        feature_lines = "\n".join([f"* ✨ **{f}**" if not f.startswith("*") else f for f in features_raw[:5]])
    else:
        feature_lines = (
            "* ✨ **Modular Multi-File Architecture:** Clean separation of concerns across structure, styling, and logic.\n"
            "* 📱 **Multi-Device Responsiveness:** Pixel-perfect adaptive layout for Mobile, Tablet, and Desktop screens.\n"
            "* 🖤 **Monochromatic Enterprise Aesthetic:** High-contrast palette (`#09090b` / `#ffffff`) with refined typography.\n"
            "* ⚡ **Zero-Latency Live Preview:** Instant in-browser DOM compilation and real-time execution."
        )

    file_list_str = "\n".join(file_tree_lines) if file_tree_lines else "* No static files generated."

    blueprint_md = f"""# 🚀 **{title}**

### 📋 Project Vision & Overview
{desc}

---

### 🛠️ Production Tech Stack
* **🎨 Frontend & Layout:** {frontend_str}
* **💎 Styling System:** Dark Monochromatic Design System (`#09090b` dark background, `#ffffff` accents, subtle glassmorphism borders)
* **⚡ Client Logic & Interactivity:** ES6+ Modules, dynamic DOM event bindings, search/filter handlers
* **🔤 Typography & Icons:** Google Fonts (Outfit, Inter), Lucide SVG vector iconography

---

### 📁 Generated File Architecture ({len(files)} files)
{file_list_str}

---

### ✨ Key Capabilities & Highlights
{feature_lines}

---

### 🚀 Instant Deployment & Export
* **Live Sandbox:** Tested and compiled in the **Live Website Preview** workspace.
* **Download Ready:** Full production archive available via **Download ZIP** or direct **Push to GitHub**.
"""
    return blueprint_md
