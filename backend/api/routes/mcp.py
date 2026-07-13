from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, model_validator
from services.mcp_service import list_mcp_tools, execute_mcp_tool, test_mcp_server_connection
from auth.optional_auth import get_optional_user
from db.mcp_server_service import (
    get_all_mcp_servers,
    add_mcp_server,
    update_mcp_server,
    delete_mcp_server,
    get_mcp_server
)

router = APIRouter()

# Input validation schemas
class McpExecutionRequest(BaseModel):
    name: str
    arguments: dict

class McpServerPayload(BaseModel):
    name: str
    type: str  # "stdio" or "sse"
    status: str = "active"  # "active" or "inactive"
    command: str | None = ""
    args: list | None = []
    env: dict | None = {}
    url: str | None = ""

    @model_validator(mode="after")
    def validate_transport(self):
        if self.type == "stdio" and not self.command:
            raise ValueError("command is required when transport type is stdio")
        if self.type == "sse" and not self.url:
            raise ValueError("url is required when transport type is sse")
        return self

@router.get("/tools")
def get_tools(user=Depends(get_optional_user)):
    """Get all registered base and dynamic MCP tools."""
    return list_mcp_tools()

@router.post("/execute")
def execute_tool(
    payload: McpExecutionRequest,
    user=Depends(get_optional_user)
):
    """Execute any dynamic or base MCP tool."""
    try:
        result = execute_mcp_tool(
            name=payload.name,
            arguments=payload.arguments
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/servers")
def get_servers(user=Depends(get_optional_user)):
    """Retrieve all registered MCP servers."""
    return get_all_mcp_servers()

@router.post("/servers")
def create_server(
    payload: McpServerPayload,
    user=Depends(get_optional_user)
):
    """Register a new MCP server."""
    try:
        server_id = add_mcp_server(payload.model_dump())
        return {"success": True, "server_id": server_id, "message": "Server registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/servers/{server_id}")
def edit_server(
    server_id: str,
    payload: McpServerPayload,
    user=Depends(get_optional_user)
):
    """Update an existing MCP server registration."""
    try:
        success = update_mcp_server(server_id, payload.model_dump())
        return {"success": success, "message": "Server configuration updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/servers/{server_id}")
def remove_server(
    server_id: str,
    user=Depends(get_optional_user)
):
    """Delete an MCP server registration."""
    try:
        success = delete_mcp_server(server_id)
        return {"success": success, "message": "Server registration deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/servers/test")
def test_connection(
    payload: McpServerPayload,
    user=Depends(get_optional_user)
):
    """Validate connection settings and list tools for a raw configuration."""
    try:
        tools = test_mcp_server_connection(payload.model_dump())
        return {
            "success": True,
            "message": f"Successfully connected. Discovered {len(tools)} tool(s).",
            "tools": tools
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
