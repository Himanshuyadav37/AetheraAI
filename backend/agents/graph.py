from langgraph.graph import StateGraph, END

from agents.router import route_after_testing
from agents.state import AgentState

from agents.planner import planner_agent
from agents.coder import coder_agent
from agents.tester import tester_agent
from agents.debugger import debugger_agent
from agents.deployer import (
    deployer_agent
)

workflow = StateGraph(AgentState)

# Nodes
workflow.add_node(
    "planner",
    planner_agent
)

workflow.add_node(
    "coder",
    coder_agent
)

workflow.add_node(
    "tester",
    tester_agent
)

workflow.add_node(
    "debugger",
    debugger_agent
)
workflow.add_node(
    "deployer",
    deployer_agent
)
# Entry
workflow.set_entry_point(
    "planner"
)

# Flow
workflow.add_edge(
    "planner",
    "coder"
)

workflow.add_edge(
    "coder",
    "tester"
)

# Tester decides next step
workflow.add_conditional_edges(
    "tester",
    route_after_testing,
    {
        "debugger": "debugger",
        "end": "deployer"
    }
)

# After fixing, test again
workflow.add_edge(
    "debugger",
    "tester"
)
workflow.add_edge(
    "deployer",
    END
)
graph = workflow.compile()