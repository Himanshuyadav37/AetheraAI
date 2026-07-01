from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.mcp_service import list_mcp_tools, execute_mcp_tool
from auth.optional_auth import get_optional_user

router = APIRouter()

class McpExecutionRequest(BaseModel):
    name: str
    arguments: dict

@router.get("/tools")
def get_tools(user=Depends(get_optional_user)):
    return list_mcp_tools()

@router.post("/execute")
def execute_tool(
    payload: McpExecutionRequest,
    user=Depends(get_optional_user)
):
    try:
        result = execute_mcp_tool(
            name=payload.name,
            arguments=payload.arguments
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
