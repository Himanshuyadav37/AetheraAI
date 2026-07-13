import os
import json
import subprocess
import platform
import requests
from config import settings
from services.github_service import push_project_to_github
from auth.otp_service import _send_smtp

# Base Hardcoded MCP Tools
BASE_MCP_TOOLS = [
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

# Stdio JSON-RPC Helper
def run_stdio_mcp_request(command: str, args: list, env: dict, method: str, params: dict, timeout=10):
    full_env = os.environ.copy()
    if env:
        full_env.update({k: str(v) for k, v in env.items()})

    use_shell = (platform.system() == "Windows")
    cmd_args = [command] + [str(a) for a in args]
    
    if use_shell:
        # Format properly for Windows shell
        cmd_str = " ".join([f'"{c}"' if " " in c or "@" in c else c for c in cmd_args])
    else:
        cmd_str = cmd_args

    proc = subprocess.Popen(
        cmd_str,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=full_env,
        shell=use_shell,
        text=True,
        bufsize=1
    )

    try:
        # 1. Initialize
        init_req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "NexusAI", "version": "1.0.0"}
            }
        }
        proc.stdin.write(json.dumps(init_req) + "\n")
        proc.stdin.flush()

        # Read initialization response
        init_resp = proc.stdout.readline()
        while init_resp:
            try:
                data = json.loads(init_resp)
                if "jsonrpc" in data:
                    break
            except Exception:
                pass
            init_resp = proc.stdout.readline()

        # 2. Initialized Notification
        initialized_notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        proc.stdin.write(json.dumps(initialized_notification) + "\n")
        proc.stdin.flush()

        # 3. Actual request
        req = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": method,
            "params": params
        }
        proc.stdin.write(json.dumps(req) + "\n")
        proc.stdin.flush()

        # Read actual response
        resp = proc.stdout.readline()
        result_data = None
        while resp:
            try:
                data = json.loads(resp)
                if data.get("id") == 2:
                    result_data = data
                    break
            except Exception:
                pass
            resp = proc.stdout.readline()

        if not result_data:
            raise Exception("Failed to receive a valid response from the MCP server.")

        if "error" in result_data:
            raise Exception(result_data["error"].get("message", "Unknown MCP server error"))

        return result_data.get("result", {})

    finally:
        try:
            proc.stdin.close()
        except Exception:
            pass
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

# SSE JSON-RPC Helper
def run_sse_mcp_request(server_url: str, method: str, params: dict, timeout=10):
    session = requests.Session()
    response = session.get(server_url, stream=True, timeout=5)
    if response.status_code != 200:
        raise Exception(f"Failed to connect to SSE endpoint {server_url}: HTTP {response.status_code}")

    endpoint_url = None
    current_event = None
    for line in response.iter_lines(decode_unicode=True):
        if not line:
            continue
        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:") and current_event == "endpoint":
            endpoint_data = line[len("data:"):].strip()
            if endpoint_data.startswith("http://") or endpoint_data.startswith("https://"):
                endpoint_url = endpoint_data
            else:
                from urllib.parse import urljoin
                endpoint_url = urljoin(server_url, endpoint_data)
            break

    if not endpoint_url:
        raise Exception("Could not find message endpoint URL in SSE stream events.")

    # 1. Initialize
    init_req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "NexusAI", "version": "1.0.0"}
        }
    }
    r = session.post(endpoint_url, json=init_req, timeout=timeout)
    
    # 2. Initialized Notification
    initialized_notification = {
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    }
    session.post(endpoint_url, json=initialized_notification, timeout=timeout)

    # 3. Actual Request
    req = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": method,
        "params": params
    }
    r = session.post(endpoint_url, json=req, timeout=timeout)
    if r.status_code != 200 and r.status_code != 202:
        raise Exception(f"Failed to send JSON-RPC request {method}: HTTP {r.status_code}")

    # Read SSE stream for matching response ID
    for line in response.iter_lines(decode_unicode=True):
        if not line:
            continue
        if line.startswith("data:"):
            data_str = line[len("data:"):].strip()
            try:
                data = json.loads(data_str)
                if data.get("id") == 2:
                    if "error" in data:
                        raise Exception(data["error"].get("message", "Unknown SSE MCP server error"))
                    return data.get("result", {})
            except json.JSONDecodeError:
                pass

    raise Exception("SSE stream closed before receiving response for the request.")

# Test connection method
def test_mcp_server_connection(config: dict) -> list:
    """Connects to server config and returns list of discovered tools."""
    server_type = config.get("type", "stdio")
    if server_type == "stdio":
        cmd = config.get("command")
        args = config.get("args", [])
        env = config.get("env", {})
        if not cmd:
            raise Exception("No executable command configured for stdio server.")
        result = run_stdio_mcp_request(cmd, args, env, "tools/list", {}, timeout=5)
        return result.get("tools", [])
    elif server_type == "sse":
        url = config.get("url")
        if not url:
            raise Exception("No URL configured for SSE server.")
        result = run_sse_mcp_request(url, "tools/list", {}, timeout=5)
        return result.get("tools", [])
    else:
        raise Exception(f"Unsupported MCP server type: {server_type}")

# Main list resolution
def list_mcp_tools():
    """Return all registered base and dynamic MCP tools."""
    all_tools = list(BASE_MCP_TOOLS)
    try:
        from db.mcp_server_service import get_active_mcp_servers
        active_servers = get_active_mcp_servers()
        for server in active_servers:
            try:
                tools = test_mcp_server_connection(server)
                for tool in tools:
                    # Enrich tool schema with origin server info
                    tool["origin_server_id"] = server["_id"]
                    all_tools.append(tool)
            except Exception as e:
                print(f"[MCP Service Warning] Failed to fetch tools from active server '{server.get('name')}': {e}")
    except Exception as db_err:
        print(f"[MCP Service Error] Failed to fetch dynamic active servers: {db_err}")
        
    return all_tools

# Main tool executor
def execute_mcp_tool(name: str, arguments: dict) -> dict:
    """Execute a registered base or dynamic MCP tool."""
    # Base send_email tool
    if name == "send_email":
        recipient = arguments.get("to")
        subject = arguments.get("subject")
        body = arguments.get("body")
        from_email = arguments.get("from_email")
        
        if not recipient or not subject or not body:
            raise Exception("Missing required arguments for send_email tool.")
            
        import threading
        thread = threading.Thread(
            target=_send_smtp,
            args=(recipient, subject, body, from_email),
            daemon=True
        )
        thread.start()
        return {"status": "success", "message": f"Email queued for delivery to {recipient}"}
        
    # Base push_to_github tool
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
        
    # Dynamic MCP tools lookup
    else:
        from db.mcp_server_service import get_active_mcp_servers
        active_servers = get_active_mcp_servers()
        for server in active_servers:
            try:
                # Retrieve tools to check if this server exposes the requested tool name
                tools = test_mcp_server_connection(server)
                tool_names = [t.get("name") for t in tools]
                if name in tool_names:
                    # Execute on this server!
                    server_type = server.get("type", "stdio")
                    if server_type == "stdio":
                        result = run_stdio_mcp_request(
                            server.get("command"),
                            server.get("args", []),
                            server.get("env", {}),
                            "tools/call",
                            {"name": name, "arguments": arguments}
                        )
                        return result
                    elif server_type == "sse":
                        result = run_sse_mcp_request(
                            server.get("url"),
                            "tools/call",
                            {"name": name, "arguments": arguments}
                        )
                        return result
            except Exception as e:
                print(f"[MCP Service Warning] Failed to check/execute tool '{name}' on server '{server.get('name')}': {e}")
                
        raise Exception(f"Tool {name} is not registered or currently accessible in the MCP workspace.")
