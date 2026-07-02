import json
import re
from bson import ObjectId
from db.mongo_client import executions_collection
from db.learning_service import save_learning, get_learnings_by_user
from llm.groq_client import generate_response

def record_lessons_from_execution(execution_id: str, user_id: str):
    """
    Analyzes a completed execution, extracts failed and fixed files,
    calls the LLM to summarize the lesson learned, and saves it to MongoDB.
    """
    try:
        exec_doc = executions_collection.find_one({"_id": ObjectId(execution_id)})
        if not exec_doc:
            print(f"[Self-Learning] Execution {execution_id} not found in DB.")
            return

        # Fetch initial generated code (before debug edits) and final fixed code
        gen_data = exec_doc.get("initial_generated_code") or exec_doc.get("generated_code") or {}
        generated_files = {f["path"]: f["code"] for f in gen_data.get("files", [])}
        fixed_files = {f["path"]: f["code"] for f in exec_doc.get("fixed_code", {}).get("files", [])}

        if not generated_files or not fixed_files:
            print("[Self-Learning] Missing generated or fixed files in execution.")
            return

        # Identify files that changed
        changed_files = []
        for path, fixed_code in fixed_files.items():
            orig_code = generated_files.get(path)
            if orig_code and orig_code.strip() != fixed_code.strip():
                changed_files.append({
                    "path": path,
                    "failed_code": orig_code,
                    "fixed_code": fixed_code
                })

        if not changed_files:
            print("[Self-Learning] No code changes found to analyze.")
            return

        # Extract last failed error/test result message
        error_message = ""
        for step in reversed(exec_doc.get("execution_steps", [])):
            if step.get("agent") in ("tester", "debugger"):
                details = step.get("details", {})
                # Check for failed test status
                if details and (details.get("status") == "FAIL" or details.get("critical_count", 0) > 0):
                    error_message = step.get("message", "")
                    break
        if not error_message:
            error_message = "Test or syntax validation failed on initial generation."

        # Format diff block for prompt context
        diffs_str = ""
        for f in changed_files:
            diffs_str += f"File: {f['path']}\n"
            diffs_str += f"--- FAILED CODE ---\n{f['failed_code']}\n"
            diffs_str += f"--- FIXED CODE ---\n{f['fixed_code']}\n\n"

        # Ask the LLM to summarize the lesson
        prompt = f"""You are an advanced AI compiler auditor and self-learning analyzer.
Analyze this debugging session where initial generated code failed tests and was later corrected.
Generate a concise, actionable lesson (1-2 sentences) on what went wrong and how to prevent it.

Error Message:
{error_message}

Changed Files:
{diffs_str}

Respond ONLY with a JSON object matching this schema:
{{
  "error_type": "Brief error category (e.g. SyntaxError, KeyError, ImportMismatch, LogicError)",
  "error_message": "Summary of what caused the failure",
  "lesson_learned": "Actionable instructions to prevent generating this error again in the future"
}}
Return ONLY raw JSON. Do not include markdown blocks, code wrappers, or extra explanation.
"""
        response_text = generate_response(prompt)
        # Parse JSON output from model response
        clean_json = response_text.strip()
        # Strip backticks if present
        clean_json = re.sub(r"^```json\s*", "", clean_json)
        clean_json = re.sub(r"\s*```$", "", clean_json)
        
        parsed = json.loads(clean_json)

        # Save to database
        learning_id = save_learning({
            "user_id": str(user_id),
            "project_id": str(exec_doc.get("project_id", "")),
            "execution_id": str(execution_id),
            "idea": exec_doc.get("idea", ""),
            "error_type": parsed.get("error_type", "LogicError"),
            "error_message": parsed.get("error_message", error_message),
            "failed_code": diffs_str,
            "lesson_learned": parsed.get("lesson_learned", ""),
            "enabled": True
        })
        print(f"[Self-Learning] Successfully compiled and saved learning rule {learning_id}.")
        
    except Exception as e:
        print(f"[Self-Learning] Error recording lessons from execution {execution_id}: {e}")

def get_active_learnings(user_id: str) -> str:
    """
    Retrieves all enabled lessons learned by the user and structures
    them as a prompt context block.
    """
    try:
        learnings = get_learnings_by_user(user_id)
        active_learnings = [l for l in learnings if l.get("enabled", True)]
        
        if not active_learnings:
            return ""

        lines = []
        for idx, l in enumerate(active_learnings, 1):
            lines.append(f"{idx}. [{l.get('error_type', 'Error')}]: {l.get('lesson_learned')}")
            
        block = (
            "=== CRITICAL: LESSONS LEARNED FROM PAST DEBUGGING RUNS ===\n"
            "Review these past mistakes and ensure your generated code adheres to these guidelines:\n"
            + "\n".join(lines) + "\n"
            "==========================================================="
        )
        return block
    except Exception as e:
        print(f"[Self-Learning] Error building active learnings block: {e}")
        return ""
