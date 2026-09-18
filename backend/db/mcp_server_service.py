from datetime import datetime
from bson import ObjectId
from db.mongo_client import db

mcp_servers_collection = db["mcp_servers"]

DEFAULT_PRESET_MCP_SERVERS = [
    {
        "name": "GitHub MCP Server",
        "type": "stdio",
        "status": "active",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": ""},
        "url": "",
        "description": "Official GitHub repo management, pull requests, commits & code search."
    },
    {
        "name": "PostgreSQL Database MCP",
        "type": "stdio",
        "status": "active",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/mydb"],
        "env": {"POSTGRES_URL": "postgresql://postgres:password@localhost:5432/mydb"},
        "url": "",
        "description": "Direct SQL queries, schema inspection & relational table analytics."
    },
    {
        "name": "Local Filesystem MCP",
        "type": "stdio",
        "status": "active",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"],
        "env": {},
        "url": "",
        "description": "Read, write, edit, and search files in allowed local directories."
    },
    {
        "name": "Brave Web Search MCP",
        "type": "stdio",
        "status": "active",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "env": {"BRAVE_API_KEY": ""},
        "url": "",
        "description": "Real-time internet queries, breaking news & verified source citations."
    },
    {
        "name": "Fetch & Web Scraper MCP",
        "type": "stdio",
        "status": "active",
        "command": "uvx",
        "args": ["mcp-server-fetch"],
        "env": {},
        "url": "",
        "description": "Fetch web pages and convert HTML to structured Markdown text."
    },
    {
        "name": "SQLite Database MCP",
        "type": "stdio",
        "status": "active",
        "command": "uvx",
        "args": ["mcp-server-sqlite", "--db-path", "./database.sqlite"],
        "env": {},
        "url": "",
        "description": "Query local SQLite .db files with automated schema extraction."
    },
    {
        "name": "Puppeteer Browser Automation MCP",
        "type": "stdio",
        "status": "active",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
        "env": {},
        "url": "",
        "description": "Headless Chrome navigation, screenshot capture & form interaction."
    },
    {
        "name": "Memory & Knowledge Graph MCP",
        "type": "stdio",
        "status": "active",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-memory"],
        "env": {},
        "url": "",
        "description": "Persistent graph-based memory and entity relationship tracking across conversations."
    }
]

def ensure_default_mcp_servers():
    """Seed default popular MCP servers if collection is empty."""
    try:
        count = mcp_servers_collection.count_documents({})
        if count == 0:
            now = datetime.utcnow()
            docs = []
            for s in DEFAULT_PRESET_MCP_SERVERS:
                doc = dict(s)
                doc["created_at"] = now
                doc["updated_at"] = now
                docs.append(doc)
            mcp_servers_collection.insert_many(docs)
            print(f"[DB MCP Service] Seeded {len(docs)} default MCP servers into MongoDB.")
    except Exception as e:
        print(f"[DB MCP Service Error] ensure_default_mcp_servers: {e}")

def get_active_mcp_servers():
    """Retrieve all enabled MCP servers from the database."""
    try:
        ensure_default_mcp_servers()
        cursor = mcp_servers_collection.find({"status": "active"})
        servers = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            servers.append(doc)
        return servers
    except Exception as e:
        print(f"[DB MCP Service Error] get_active_mcp_servers: {e}")
        return []

def get_all_mcp_servers():
    """Retrieve all registered MCP servers from the database."""
    try:
        ensure_default_mcp_servers()
        cursor = mcp_servers_collection.find({})
        servers = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            servers.append(doc)
        return servers
    except Exception as e:
        print(f"[DB MCP Service Error] get_all_mcp_servers: {e}")
        return []

def get_mcp_server(server_id: str):
    """Retrieve a single MCP server configuration by ID."""
    try:
        doc = mcp_servers_collection.find_one({"_id": ObjectId(server_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
            return doc
    except Exception as e:
        print(f"[DB MCP Service Error] get_mcp_server {server_id}: {e}")
    return None

def add_mcp_server(data: dict):
    """Register a new MCP server configuration."""
    try:
        doc = {
            "name": data.get("name", "Unnamed Server"),
            "type": data.get("type", "stdio"), # "stdio" or "sse"
            "status": data.get("status", "active"), # "active" or "inactive"
            "command": data.get("command", ""),
            "args": data.get("args", []),
            "env": data.get("env", {}),
            "url": data.get("url", ""),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        res = mcp_servers_collection.insert_one(doc)
        return str(res.inserted_id)
    except Exception as e:
        print(f"[DB MCP Service Error] add_mcp_server: {e}")
        raise e

def update_mcp_server(server_id: str, data: dict):
    """Update an existing MCP server configuration."""
    try:
        update_doc = {
            "name": data.get("name"),
            "type": data.get("type"),
            "status": data.get("status"),
            "command": data.get("command"),
            "args": data.get("args"),
            "env": data.get("env"),
            "url": data.get("url"),
            "updated_at": datetime.utcnow()
        }
        # Filter out None values
        update_doc = {k: v for k, v in update_doc.items() if v is not None}
        
        mcp_servers_collection.update_one(
            {"_id": ObjectId(server_id)},
            {"$set": update_doc}
        )
        return True
    except Exception as e:
        print(f"[DB MCP Service Error] update_mcp_server {server_id}: {e}")
        raise e

def delete_mcp_server(server_id: str):
    """Remove an MCP server configuration from registry."""
    try:
        mcp_servers_collection.delete_one({"_id": ObjectId(server_id)})
        return True
    except Exception as e:
        print(f"[DB MCP Service Error] delete_mcp_server {server_id}: {e}")
        raise e
