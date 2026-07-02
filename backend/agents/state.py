from typing import TypedDict, Dict, List

class AgentState(TypedDict):
    idea: str

    project_id: str

    project_plan: Dict

    generated_code: Dict

    initial_generated_code: Dict

    fixed_code: Dict

    project_path: str

    test_results: str

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