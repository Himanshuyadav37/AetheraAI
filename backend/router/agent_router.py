"""
NexusAI AI Agent Router

Routes incoming requests to the
appropriate AI module.
"""


VALID_AGENT_TYPES = {
    "engineer",
    "conversational",
    "research",
    "education",
    "automation",
}


def route_agent(
    agent_type: str,
) -> str:

    agent_type = agent_type.lower().strip()

    routes = {
        "engineer": "engineer",
        "conversational": "conversational",
        "conversation": "conversational",
        "research": "research",
        "education": "education",
        "automation": "automation",
    }

    if agent_type not in routes:

        raise ValueError(
            f"Invalid agent type: {agent_type}"
        )

    return routes[agent_type]
