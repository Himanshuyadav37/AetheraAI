import os
from config import settings
from services.github_service import push_project_to_github
from auth.otp_service import _send_smtp

# MCP Tools Registry Schema
MCP_TOOLS = [
    {
        "name": "send_email",
        "description": "Send an email notification or report via SMTP/Resend",
        "inputSchema": {
            "type": "object",
            "properties": {
                "to": {"type": "string", "description": "Recipient email address"},
                "subject": {"type": "string", "description": "Email subject line"},
                "body": {"type": "string", "description": "HTML content or plain text message of the email"},
                "from_email": {"type": "string", "description": "Optional sender email address if requesting to send from a specific user email"}
            },
            "required": ["to", "subject", "body"]
        }
    },
    {
        "name": "push_to_github",
        "description": "Initialize Git and push generated code files to a new GitHub repository",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "Unique identifier of the project to push"},
                "repo_name": {"type": "string", "description": "Name of the new GitHub repository"},
                "description": {"type": "string", "description": "Description of the repository"},
                "private": {"type": "boolean", "default": True, "description": "Whether the repository should be private"},
                "token": {"type": "string", "description": "Personal Access Token for GitHub authentication"}
            },
            "required": ["project_id", "repo_name"]
        }
    }
]

def list_mcp_tools():
    """Return all registered MCP tools."""
    return MCP_TOOLS

def execute_mcp_tool(name: str, arguments: dict) -> dict:
    """Execute a registered MCP tool by name."""
    if name == "send_email":
        recipient = arguments.get("to")
        subject = arguments.get("subject")
        body = arguments.get("body")
        from_email = arguments.get("from_email")
        
        if not recipient or not subject or not body:
            raise Exception("Missing required arguments for send_email tool.")
            
        # Dispatch SMTP/Resend email in background/inline
        import threading
        thread = threading.Thread(
            target=_send_smtp,
            args=(recipient, subject, body, from_email),
            daemon=True
        )
        thread.start()
        return {"status": "success", "message": f"Email queued for delivery to {recipient}"}
        
    elif name == "push_to_github":
        project_id = arguments.get("project_id")
        repo_name = arguments.get("repo_name")
        desc = arguments.get("description", "")
        private = arguments.get("private", True)
        token = arguments.get("token")
        
        if not project_id or not repo_name:
            raise Exception("Missing required arguments for push_to_github tool.")
            
        repo_url = push_project_to_github(
            project_id=project_id,
            repo_name=repo_name,
            description=desc,
            private=private,
            custom_token=token
        )
        return {"status": "success", "repo_url": repo_url, "message": f"Successfully pushed project to {repo_url}"}
        
    else:
        raise Exception(f"Tool {name} is not registered in the MCP workspace.")
