import os
import json
import traceback
from groq import Groq
from config import settings
from services.mcp_service import execute_mcp_tool

# Global key index tracking (same as groq_client)
current_key_idx = 0

def get_groq_client():
    global current_key_idx
    keys = settings.GROQ_KEYS
    client = Groq(api_key=keys[current_key_idx])
    return client

def rotate_groq_key():
    global current_key_idx
    keys = settings.GROQ_KEYS
    current_key_idx = (current_key_idx + 1) % len(keys)
    print(f"[Groq Key Rotator] Switched to key index {current_key_idx}")

def get_tool_definitions(connectors: dict | None) -> list:
    """Return tool schemas compatible with the Groq Chat API."""
    gmail_enabled = connectors.get("gmail", {}).get("enabled", False) if connectors else False
    github_enabled = connectors.get("github", {}).get("enabled", False) if connectors else False

    tools = []

    # Gmail Send Email Tool
    tools.append({
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Sends an email notification or report to the configured recipient email. Use when the user asks to send an email or notify via Gmail.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "description": "Recipient email address. If none provided, defaults to the user's connected Gmail recipient email."
                    },
                    "subject": {
                        "type": "string",
                        "description": "Email subject line"
                    },
                    "body": {
                        "type": "string",
                        "description": "HTML or plain text message body of the email"
                    },
                    "from_email": {
                        "type": "string",
                        "description": "Optional sender email address if requesting to send from/by a specific user email (triggers direct SMTP bypass instead of Resend)"
                    }
                },
                "required": ["subject", "body"]
            }
        }
    })

    # GitHub Push Tool
    tools.append({
        "type": "function",
        "function": {
            "name": "push_to_github",
            "description": "Pushes code files from the local project workspace to a newly created GitHub repository. Use when the user asks to push or deploy to GitHub.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "string",
                        "description": "Unique identifier of the project to push."
                    },
                    "repo_name": {
                        "type": "string",
                        "description": "Name of the new GitHub repository."
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional description for the repository."
                    },
                    "private": {
                        "type": "boolean",
                        "description": "Whether the repository should be private. Defaults to true."
                    }
                },
                "required": ["project_id", "repo_name"]
            }
        }
    })

    # Dynamic MCP Tools
    try:
        from services.mcp_service import list_mcp_tools
        dynamic_mcp_tools = list_mcp_tools()
        for t in dynamic_mcp_tools:
            t_name = t.get("name")
            if t_name in ["send_email", "push_to_github"]:
                continue
            
            # Map inputSchema to parameters
            parameters = t.get("inputSchema", {
                "type": "object",
                "properties": {}
            })
            
            tools.append({
                "type": "function",
                "function": {
                    "name": t_name,
                    "description": t.get("description", ""),
                    "parameters": parameters
                }
            })
    except Exception as e:
        print(f"[Agent Tools Warning] Failed to fetch or map dynamic tools: {e}")

    return tools

def execute_agent_tool(name: str, arguments: dict, connectors: dict | None) -> str:
    """Run MCP tool execution, injecting token credentials from frontend payload."""
    try:
        if name == "send_email":
            # Override placeholder recipient or inject connected Gmail recipient
            recipient = arguments.get("to")
            connected_email = connectors.get("gmail", {}).get("recipient") if connectors else None

            if not recipient or "@" not in recipient or "." not in recipient or recipient.strip().lower() in ["example@example.com", "recipient@example.com", "user@example.com", "no recipient provided"]:
                recipient = connected_email
            
            if not recipient:
                return json.dumps({
                    "status": "error",
                    "message": "Gmail Alert connector is not configured. Please setup Gmail in your NexusAI Hub."
                })
            
            arguments["to"] = recipient
            
            # Automatically set from_email to the verified connected email if not explicitly provided
            if connected_email and not arguments.get("from_email"):
                arguments["from_email"] = connected_email

            res = execute_mcp_tool("send_email", arguments)
            return json.dumps(res)

        elif name == "push_to_github":
            # Inject connected GitHub PAT token
            token = connectors.get("github", {}).get("token") if connectors else None
            if not token:
                token = os.environ.get("github_token") or localStorage_fallback_token()
            
            if not token:
                return json.dumps({
                    "status": "error",
                    "message": "GitHub connection token is missing. Please setup and connect GitHub PAT in your NexusAI Hub."
                })
            
            arguments["token"] = token
            res = execute_mcp_tool("push_to_github", arguments)
            return json.dumps(res)
        
        else:
            # Route other tools to dynamic MCP servers
            res = execute_mcp_tool(name, arguments)
            return json.dumps(res)

    except Exception as e:
        traceback.print_exc()
        return json.dumps({"status": "error", "message": str(e)})

def localStorage_fallback_token():
    # Helper fallback for local environment settings GITHUB_TOKEN
    return settings.GITHUB_TOKEN or ""

def run_agent_with_tools(
    prompt: str,
    system_instruction: str,
    history_messages: list,
    connectors: dict | None = None
) -> str:
    """Execute LLM requests with function calling support and automatic key rotation."""
    tools = get_tool_definitions(connectors)

    # Draft safety check: Only allow send_email tool if the user is confirming a draft
    has_draft_in_history = False
    for msg in history_messages:
        content_lower = msg.get("content", "").lower()
        if msg.get("role") in ["assistant", "model"] and ("subject:" in content_lower or "subject :" in content_lower or "draft" in content_lower or "body:" in content_lower):
            has_draft_in_history = True
            break
            
    is_confirming = False
    confirm_words = ["yes", "send", "approve", "looks good", "1", "go ahead", "yep", "ok", "confirm"]
    prompt_lower = prompt.lower()
    if has_draft_in_history and any(w in prompt_lower for w in confirm_words):
        is_confirming = True
        
    # If the user is asking to send/write an email but NOT confirming an existing draft,
    # we hide the send_email tool so the LLM is forced to generate a text draft first!
    if any(w in prompt_lower for w in ["email", "mail", "gmail", "send"]) and not is_confirming:
        tools = [t for t in tools if t.get("function", {}).get("name") != "send_email"]

    # Convert history format to OpenAI/Groq compatible roles
    messages = [{"role": "system", "content": system_instruction}]
    for msg in history_messages:
        messages.append({
            "role": "user" if msg["role"] == "user" else "assistant",
            "content": msg["content"]
        })
    messages.append({"role": "user", "content": prompt})

    keys_to_try = len(settings.GROQ_KEYS)
    last_error = None

    for _ in range(keys_to_try):
        try:
            client = get_groq_client()
            
            # Step 1: Initial Completion Call
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=0.4
            )
            
            response_msg = completion.choices[0].message
            
            # Check if LLM requested a tool call
            if response_msg.tool_calls:
                # Add assistant message containing tool calls requests
                messages.append(response_msg)
                
                # Execute each requested tool call
                for tool_call in response_msg.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = json.loads(tool_call.function.arguments)
                    
                    print(f"[MCP Tool Caller] Invoking {tool_name} with args: {tool_args}")
                    tool_result = execute_agent_tool(tool_name, tool_args, connectors)
                    print(f"[MCP Tool Caller] Result: {tool_result}")
                    
                    # Add tool response message
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_name,
                        "content": tool_result
                    })
                
                # Step 2: Final Completion Call with tool results
                second_completion = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    temperature=0.4
                )
                return second_completion.choices[0].message.content
            
            else:
                return response_msg.content

        except Exception as e:
            last_error = e
            rotate_groq_key()
            print(f"[MCP Agent Warning] Groq execution failed. Rotating credentials. Error: {e}")

    raise last_error

def intercept_mcp_tool_call(
    prompt: str,
    agent_type: str,
    conversation_id: str | None = None,
    connectors: dict | None = None
) -> dict | None:
    """
    Checks if the prompt is an action command (like sending an email or pushing to GitHub).
    If it is, runs the tool call and returns the structured agent response.
    Otherwise, returns None so the default agent logic can run.
    """
    if agent_type == "automation":
        return None
    # Load conversation history messages
    history_msgs = []
    if conversation_id:
        try:
            from db.conversation_service import get_conversation_messages
            history_msgs = get_conversation_messages(conversation_id)
        except Exception:
            pass

    # Check if the last assistant message in history contains an email draft
    last_was_draft = False
    if history_msgs:
        last_assistant = None
        for msg in reversed(history_msgs):
            if msg.get("role") in ["assistant", "model"]:
                last_assistant = msg.get("content", "").lower()
                break
        if last_assistant and ("subject:" in last_assistant or "subject :" in last_assistant or "draft" in last_assistant or "body:" in last_assistant):
            last_was_draft = True

    # Load dynamic tool names to intercept prompts mentioning them
    dynamic_tool_names = []
    try:
        from services.mcp_service import list_mcp_tools
        dynamic_tool_names = [t.get("name") for t in list_mcp_tools() if t.get("name") not in ["send_email", "push_to_github"]]
    except Exception:
        pass

    # Check if prompt contains keywords or matches confirmation of a draft or mentions any dynamic tool name
    keywords = ["email", "mail", "gmail", "send", "push", "github", "git", "repo", "repository", "mcp", "tool", "run", "execute", "server", "files", "database", "query"]
    prompt_lower = prompt.lower()
    
    is_confirming_email = last_was_draft and any(w in prompt_lower for w in ["yes", "send", "approve", "1", "go ahead", "yep", "ok", "confirm"])
    has_keywords = any(kw in prompt_lower for kw in keywords) or any(t.lower() in prompt_lower for t in dynamic_tool_names)

    # If it is NOT an email/GitHub action/dynamic tool prompt, and NOT a draft confirmation, skip interception
    if not (has_keywords or is_confirming_email):
        return None

    tools = get_tool_definitions(connectors)
    
    # Simple tool router system prompt
    messages = [
        {"role": "system", "content": "You are a tool router. Check if the user prompt requests invoking any of the available tools. If it does, invoke the appropriate tool. If it does not require running a tool, simply output the word 'NO' and do not invoke any tools."}
    ]
    for msg in history_msgs:
        messages.append({
            "role": "user" if msg["role"] == "user" else "assistant",
            "content": msg["content"]
        })
    messages.append({"role": "user", "content": prompt})

    try:
        client = get_groq_client()
        # If we are NOT confirming (first turn), we filter out the send_email tool from the router completion as well!
        router_tools = tools
        if any(w in prompt_lower for w in ["email", "mail", "gmail", "send"]) and not is_confirming_email:
            router_tools = [t for t in tools if t.get("function", {}).get("name") != "send_email"]

        # Run completion with router tools
        completion = None
        if router_tools:
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                tools=router_tools,
                tool_choice="auto",
                temperature=0.0
            )

        response_msg = completion.choices[0].message if completion else None
        
        # If router triggered a tool OR if we have email keywords in the prompt (and want to draft first)
        if (response_msg and response_msg.tool_calls) or (any(w in prompt_lower for w in ["email", "mail", "gmail", "send"]) and not is_confirming_email) or is_confirming_email:
            # Validate or generate a valid 24-character MongoDB ObjectId
            from bson import ObjectId
            valid_conv_id = conversation_id
            if not valid_conv_id or not (len(valid_conv_id) == 24 and all(c in "0123456789abcdefABCDEF" for c in valid_conv_id)):
                valid_conv_id = str(ObjectId())

            assistant_content = run_agent_with_tools(
                prompt=prompt,
                system_instruction=(
                    f"You are the NexusAI {agent_type.capitalize()} AI agent. "
                    "When a user asks to send an email or write an email, you MUST FIRST generate a text draft containing the Subject and Body. "
                    "DO NOT call the send_email tool immediately. Instead, present the draft and ask the user to confirm/approve (e.g., '1. Send the email as is'). "
                    "You must ONLY call the send_email tool in the next turn once the user has explicitly approved the draft (e.g., replying 'Send it', 'Yes', 'Go ahead', or selecting the number '1')."
                ),
                history_messages=history_msgs,
                connectors=connectors
            )
            
            # Save messages in history if valid_conv_id is available
            try:
                from db.conversation_service import add_message
                add_message(valid_conv_id, "user", prompt)
                add_message(valid_conv_id, "assistant", assistant_content)
            except Exception:
                pass
            
            if agent_type == "engineer":
                return {
                    "agent": "engineer",
                    "conversation_id": valid_conv_id,
                    "project_id": "mcp-project",
                    "message": assistant_content,
                    "generated_code": {},
                    "fixed_code": {}
                }
            elif agent_type == "research":
                return {
                    "research_session_id": valid_conv_id,
                    "conversation_id": valid_conv_id,
                    "status": "completed",
                    "message": assistant_content,
                    "report": assistant_content,
                    "timeline": []
                }
            elif agent_type == "education":
                return {
                    "success": True,
                    "agent": "education",
                    "mode": "learn",
                    "title": "NexusAI Education AI",
                    "response": assistant_content,
                }
            elif agent_type == "automation":
                return {
                    "success": True,
                    "agent": "automation",
                    "title": "NexusAI Automation AI",
                    "description": "Executed automation task",
                    "platform": "n8n",
                    "message": assistant_content
                }
            else: # conversational
                return {
                    "agent": "conversational",
                    "conversation_id": valid_conv_id,
                    "message": assistant_content
                }
                
        return None
    except Exception as e:
        print(f"[MCP Interceptor Error] {e}")
        return None
