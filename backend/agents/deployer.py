from datetime import datetime

from memory.project_memory import (
    save_memory
)


def deployer_agent(state):

    # Add step: Starting deployer
    state["execution_steps"].append({
        "agent": "deployer",
        "step": "generating_deployment_plan",
        "status": "in_progress",
        "message": "Generating deployment configuration and plan",
        "timestamp": datetime.utcnow().isoformat()
    })

    deployment_plan = {

        "deployment_type":
            "containerized",

        "docker": {
            "enabled": True,
            "dockerfile": True
        },

        "cloud": {
            "provider": "AWS",
            "service": "ECS"
        },

        "steps": [
            "Build Docker Image",
            "Push Image to Registry",
            "Deploy to AWS ECS",
            "Configure Environment Variables",
            "Health Check Deployment"
        ]
    }

    state["deployment_plan"] = (
        deployment_plan
    )

    state["agent_notes"].append(
        "Deployer generated deployment plan"
    )

    # Add step: Deployment plan generated
    state["execution_steps"].append({
        "agent": "deployer",
        "step": "generating_deployment_plan",
        "status": "completed",
        "message": "Successfully generated deployment plan",
        "details": {
            "deployment_type": deployment_plan["deployment_type"],
            "cloud_provider": deployment_plan["cloud"]["provider"],
            "steps_count": len(deployment_plan["steps"])
        },
        "timestamp": datetime.utcnow().isoformat()
    })

    save_memory(
        {
            "project_id":
                state["project_id"],

            "agent":
                "deployer",

            "note":
                "Generated deployment plan"
        }
    )

    return state