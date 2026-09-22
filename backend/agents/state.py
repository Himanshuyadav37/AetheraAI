from typing import TypedDict, Dict, List, Any, Optional


class AgentState(TypedDict):
    idea: str

    project_id: str

    project_plan: Dict

    generated_code: Dict

    initial_generated_code: Dict

    fixed_code: Dict

    project_path: str

    test_results: Any

    debug_report: str

    deployment_plan: Dict

    messages: List[str]

    iterations: int

    user_id: str

    agent_notes: List[str]

    execution_steps: List[Dict]

    mode: str

    parent_execution_id: str

    execution_id: str

    generated_tests: List[Dict]

    static_analysis_results: Dict

    security_analysis_results: Dict

    quality_gate_report: Dict

    engineer_evaluation: Dict

    generated_ci_files: List[Dict]

    last_debugger_code_hash: Optional[str]

    learnings_applied: List[str]