import pytest
from services.mcp_service import run_stdio_mcp_request, run_sse_mcp_request

def test_run_stdio_mcp_request_unreachable():
    """
    Test running stdio MCP request with non-existent command throws error.
    """
    with pytest.raises(Exception):
        run_stdio_mcp_request(
            command="nonexistentcommand12345",
            args=[],
            env={},
            method="tools/list",
            params={}
        )

def test_run_sse_mcp_request_unreachable():
    """
    Test running SSE MCP request with unreachable endpoint throws error.
    """
    with pytest.raises(Exception):
        run_sse_mcp_request(
            server_url="http://127.0.0.1:9999/sse",
            method="tools/list",
            params={}
        )
