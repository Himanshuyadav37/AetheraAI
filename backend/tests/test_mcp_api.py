import pytest

def test_get_servers_list(test_client):
    """
    Test GET /mcp/servers returns list of registered servers.
    """
    response = test_client.get("/mcp/servers")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_register_server_validation_missing_type(test_client):
    """
    Test POST /mcp/servers validation failure when type is missing.
    """
    payload = {
        "name": "Invalid Server",
        "command": "node"
    }
    response = test_client.post("/mcp/servers", json=payload)
    assert response.status_code == 422  # validation error

def test_register_server_validation_missing_command(test_client):
    """
    Test POST /mcp/servers stdio validation failure when command is missing.
    """
    payload = {
        "name": "Invalid Stdio Server",
        "type": "stdio"
    }
    response = test_client.post("/mcp/servers", json=payload)
    assert response.status_code == 422  # validation error

def test_register_server_validation_missing_url(test_client):
    """
    Test POST /mcp/servers sse validation failure when url is missing.
    """
    payload = {
        "name": "Invalid SSE Server",
        "type": "sse"
    }
    response = test_client.post("/mcp/servers", json=payload)
    assert response.status_code == 422  # validation error

def test_test_connection_invalid_sse(test_client):
    """
    Test POST /mcp/servers/test responds with 400 Bad Request / 500 when server is unreachable.
    """
    payload = {
        "name": "Unreachable SSE",
        "type": "sse",
        "url": "http://127.0.0.1:9999/sse" # Unreachable port
    }
    response = test_client.post("/mcp/servers/test", json=payload)
    assert response.status_code in [400, 500, 422]
