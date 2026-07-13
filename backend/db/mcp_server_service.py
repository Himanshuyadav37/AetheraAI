from datetime import datetime
from bson import ObjectId
from db.mongo_client import db

mcp_servers_collection = db["mcp_servers"]

def get_active_mcp_servers():
    """Retrieve all enabled MCP servers from the database."""
    try:
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
