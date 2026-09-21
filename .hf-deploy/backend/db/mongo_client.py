import os
import logging
from datetime import datetime
from urllib.parse import urlsplit, urlunsplit
from bson import ObjectId, json_util
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError, ConnectionFailure
from config import settings

logger = logging.getLogger("nexusai.db")


def _redact_mongo_url(uri: str) -> str:
    """Keep credentials out of database connection logs."""
    try:
        parsed = urlsplit(uri)
        if not parsed.username:
            return uri

        host = parsed.hostname or "<unknown-host>"
        if ":" in host and not host.startswith("["):
            host = f"[{host}]"
        port = f":{parsed.port}" if parsed.port else ""
        return urlunsplit((parsed.scheme, f"***:***@{host}{port}", parsed.path, parsed.query, parsed.fragment))
    except ValueError:
        return "<redacted MongoDB URI>"

# Persistent disk storage fallback when MongoDB server is offline/unreachable
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
STORE_FILE = os.path.join(DATA_DIR, "neuroforge_store.json")
_MEMORY_STORES = {}


def _load_memory_store():
    global _MEMORY_STORES
    if os.path.exists(STORE_FILE):
        try:
            with open(STORE_FILE, "r", encoding="utf-8") as f:
                content = f.read()
                if content.strip():
                    data = json_util.loads(content)
                    if isinstance(data, dict):
                        _MEMORY_STORES = data
                        logger.info(f"Loaded persistent fallback store from '{STORE_FILE}' with collections: {list(_MEMORY_STORES.keys())}")
                        return
        except Exception as e:
            logger.warning(f"Failed to load persistent fallback store '{STORE_FILE}': {e}")
    _MEMORY_STORES = {}


def _flush_memory_store_to_disk():
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        temp_file = STORE_FILE + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(json_util.dumps(_MEMORY_STORES, indent=2))
        try:
            os.replace(temp_file, STORE_FILE)
        except Exception:
            if os.path.exists(STORE_FILE):
                os.remove(STORE_FILE)
            os.rename(temp_file, STORE_FILE)
    except Exception as e:
        logger.warning(f"Error persisting memory store to '{STORE_FILE}': {e}")


# Pre-load store
_load_memory_store()


class InsertOneResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class InsertManyResult:
    def __init__(self, inserted_ids):
        self.inserted_ids = inserted_ids


class UpdateResult:
    def __init__(self, matched_count=1, modified_count=1):
        self.matched_count = matched_count
        self.modified_count = modified_count


class DeleteResult:
    def __init__(self, deleted_count=1):
        self.deleted_count = deleted_count


class MemoryCursor:
    def __init__(self, items):
        self._items = items

    def sort(self, key_or_list, direction=None):
        try:
            if isinstance(key_or_list, list):
                key, direction = key_or_list[0]
            else:
                key = key_or_list
            reverse = (direction == -1 or direction == "desc")
            self._items.sort(key=lambda x: str(x.get(key, "") or ""), reverse=reverse)
        except Exception:
            pass
        return self

    def limit(self, count):
        self._items = self._items[:count]
        return self

    def skip(self, count):
        self._items = self._items[count:]
        return self

    def __iter__(self):
        return iter(self._items)

    def __list__(self):
        return self._items


class SafeCursor:
    """Wrapper that catches cursor execution/auth errors during iteration and falls back to memory."""
    def __init__(self, raw_cursor, mem_items, collection_name=""):
        self._raw_cursor = raw_cursor
        self._mem_items = mem_items
        self._collection_name = collection_name

    def sort(self, *args, **kwargs):
        if self._raw_cursor is not None:
            try:
                self._raw_cursor = self._raw_cursor.sort(*args, **kwargs)
            except Exception:
                self._raw_cursor = None
        try:
            if args:
                key_or_list = args[0]
                direction = args[1] if len(args) > 1 else None
                if isinstance(key_or_list, list):
                    key, direction = key_or_list[0]
                else:
                    key = key_or_list
                reverse = (direction == -1 or direction == "desc")
                self._mem_items.sort(key=lambda x: str(x.get(key, "") or ""), reverse=reverse)
        except Exception:
            pass
        return self

    def limit(self, count):
        if self._raw_cursor is not None:
            try:
                self._raw_cursor = self._raw_cursor.limit(count)
            except Exception:
                self._raw_cursor = None
        self._mem_items = self._mem_items[:count]
        return self

    def skip(self, count):
        if self._raw_cursor is not None:
            try:
                self._raw_cursor = self._raw_cursor.skip(count)
            except Exception:
                self._raw_cursor = None
        self._mem_items = self._mem_items[count:]
        return self

    def __iter__(self):
        if self._raw_cursor is not None:
            try:
                for item in self._raw_cursor:
                    yield item
                return
            except Exception as e:
                logger.warning(f"[SafeCursor] Error iterating '{self._collection_name}': {e}, falling back to memory store")
        for item in self._mem_items:
            yield item

    def __list__(self):
        return list(self)


def _match_query(doc: dict, query: dict) -> bool:
    if not query:
        return True
    for k, v in query.items():
        if k == "$or" and isinstance(v, list):
            if not any(_match_query(doc, cond) for cond in v):
                return False
            continue
        if k == "$and" and isinstance(v, list):
            if not all(_match_query(doc, cond) for cond in v):
                return False
            continue
        value = doc
        for part in k.split("."):
            if not isinstance(value, dict) or part not in value:
                value = None
                break
            value = value[part]
        if value is None and k not in doc and "." not in k:
            return False
        doc_val = value
        if isinstance(v, dict):
            # Operators like $in, $gt, $gte, $lt, $lte, $ne
            if "$in" in v and doc_val not in v["$in"]:
                return False
            if "$ne" in v and doc_val == v["$ne"]:
                return False
            if "$gt" in v and not (doc_val > v["$gt"]):
                return False
            if "$gte" in v and not (doc_val >= v["$gte"]):
                return False
            if "$lt" in v and not (doc_val < v["$lt"]):
                return False
            if "$lte" in v and not (doc_val <= v["$lte"]):
                return False
        else:
            if str(doc_val) != str(v) and doc_val != v:
                return False
    return True


class SafeCollection:
    def __init__(self, raw_col, name: str):
        self._raw = raw_col
        self._name = name
        if name not in _MEMORY_STORES:
            _MEMORY_STORES[name] = []

    def _get_mem_store(self):
        return _MEMORY_STORES[self._name]

    def insert_one(self, doc: dict):
        doc_copy = dict(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = ObjectId()
        try:
            if self._raw is not None:
                return self._raw.insert_one(doc)
        except (PyMongoError, ServerSelectionTimeoutError, ConnectionFailure, Exception) as e:
            logger.warning(f"[Mongo SafeCollection] insert_one to '{self._name}' using memory store: {e}")
        
        self._get_mem_store().append(doc_copy)
        _flush_memory_store_to_disk()
        return InsertOneResult(doc_copy["_id"])

    def insert_many(self, docs: list):
        inserted_ids = []
        for d in docs:
            res = self.insert_one(d)
            inserted_ids.append(res.inserted_id)
        return InsertManyResult(inserted_ids)

    def find_one(self, query=None, *args, **kwargs):
        query = query or {}
        try:
            if self._raw is not None:
                return self._raw.find_one(query, *args, **kwargs)
        except (PyMongoError, ServerSelectionTimeoutError, ConnectionFailure, Exception) as e:
            logger.warning(f"[Mongo SafeCollection] find_one in '{self._name}' using memory store: {e}")

        for item in reversed(self._get_mem_store()):
            if _match_query(item, query):
                return dict(item)
        return None

    def find(self, query=None, *args, **kwargs):
        query = query or {}
        raw_cursor = None
        try:
            if self._raw is not None:
                raw_cursor = self._raw.find(query, *args, **kwargs)
        except (PyMongoError, ServerSelectionTimeoutError, ConnectionFailure, Exception) as e:
            logger.warning(f"[Mongo SafeCollection] find in '{self._name}' using memory store: {e}")

        matched = [dict(item) for item in self._get_mem_store() if _match_query(item, query)]
        return SafeCursor(raw_cursor, matched, self._name)

    def update_one(self, query: dict, update: dict, upsert: bool = False, *args, **kwargs):
        try:
            if self._raw is not None:
                return self._raw.update_one(query, update, upsert=upsert, *args, **kwargs)
        except (PyMongoError, ServerSelectionTimeoutError, ConnectionFailure, Exception) as e:
            logger.warning(f"[Mongo SafeCollection] update_one in '{self._name}' using memory store: {e}")

        store = self._get_mem_store()
        for idx, item in enumerate(store):
            if _match_query(item, query):
                if "$set" in update:
                    item.update(update["$set"])
                if "$inc" in update:
                    for inc_k, inc_v in update["$inc"].items():
                        item[inc_k] = item.get(inc_k, 0) + inc_v
                store[idx] = item
                _flush_memory_store_to_disk()
                return UpdateResult(1, 1)

        if upsert:
            new_doc = dict(query)
            if "$set" in update:
                new_doc.update(update["$set"])
            return self.insert_one(new_doc)
        return UpdateResult(0, 0)

    def update_many(self, query: dict, update: dict, *args, **kwargs):
        try:
            if self._raw is not None:
                return self._raw.update_many(query, update, *args, **kwargs)
        except (PyMongoError, ServerSelectionTimeoutError, ConnectionFailure, Exception) as e:
            logger.warning(f"[Mongo SafeCollection] update_many in '{self._name}' using memory store: {e}")

        count = 0
        store = self._get_mem_store()
        for idx, item in enumerate(store):
            if _match_query(item, query):
                if "$set" in update:
                    item.update(update["$set"])
                store[idx] = item
                count += 1
        if count > 0:
            _flush_memory_store_to_disk()
        return UpdateResult(count, count)

    def delete_one(self, query: dict, *args, **kwargs):
        try:
            if self._raw is not None:
                return self._raw.delete_one(query, *args, **kwargs)
        except (PyMongoError, ServerSelectionTimeoutError, ConnectionFailure, Exception) as e:
            logger.warning(f"[Mongo SafeCollection] delete_one in '{self._name}' using memory store: {e}")

        store = self._get_mem_store()
        for idx, item in enumerate(store):
            if _match_query(item, query):
                store.pop(idx)
                _flush_memory_store_to_disk()
                return DeleteResult(1)
        return DeleteResult(0)

    def delete_many(self, query: dict, *args, **kwargs):
        try:
            if self._raw is not None:
                return self._raw.delete_many(query, *args, **kwargs)
        except (PyMongoError, ServerSelectionTimeoutError, ConnectionFailure, Exception) as e:
            logger.warning(f"[Mongo SafeCollection] delete_many in '{self._name}' using memory store: {e}")

        store = self._get_mem_store()
        orig_len = len(store)
        _MEMORY_STORES[self._name] = [item for item in store if not _match_query(item, query)]
        deleted = orig_len - len(_MEMORY_STORES[self._name])
        if deleted > 0:
            _flush_memory_store_to_disk()
        return DeleteResult(deleted)

    def count_documents(self, query=None, *args, **kwargs):
        query = query or {}
        try:
            if self._raw is not None:
                return self._raw.count_documents(query, *args, **kwargs)
        except (PyMongoError, ServerSelectionTimeoutError, ConnectionFailure, Exception) as e:
            logger.warning(f"[Mongo SafeCollection] count_documents in '{self._name}' using memory store: {e}")

        return sum(1 for item in self._get_mem_store() if _match_query(item, query))

    def create_index(self, *args, **kwargs):
        try:
            if self._raw is not None:
                return self._raw.create_index(*args, **kwargs)
        except Exception:
            pass
        return "index_created"


class SafeDatabase:
    def __init__(self, raw_db):
        self._raw_db = raw_db
        self._collections = {}

    def command(self, cmd, *args, **kwargs):
        if self._raw_db is not None:
            try:
                return self._raw_db.command(cmd, *args, **kwargs)
            except Exception as e:
                logger.warning(f"[SafeDatabase] command '{cmd}' error: {e}")
        return {"ok": 1}

    def list_collection_names(self, *args, **kwargs):
        if self._raw_db is not None:
            try:
                return self._raw_db.list_collection_names(*args, **kwargs)
            except Exception:
                pass
        return list(_MEMORY_STORES.keys())

    def __getitem__(self, name: str) -> SafeCollection:
        if name not in self._collections:
            raw_col = None
            if self._raw_db is not None:
                try:
                    raw_col = self._raw_db[name]
                except Exception:
                    raw_col = None
            self._collections[name] = SafeCollection(raw_col, name)
        return self._collections[name]

    def __getattr__(self, name: str) -> SafeCollection:
        return self[name]



# Initialize MongoClient with resilient timeout, ping validation, and local fallback
_raw_client = None
_raw_db = None
target_db_name = settings.DB_NAME.strip() if getattr(settings, "DB_NAME", None) else "neuroforge"

for candidate_url in [settings.MONGO_URL, "mongodb://localhost:27017"]:
    if not candidate_url:
        continue
    try:
        candidate_client = MongoClient(
            candidate_url,
            serverSelectionTimeoutMS=1500,
            connectTimeoutMS=1500,
            socketTimeoutMS=2000
        )
        candidate_client.admin.command('ping')
        _raw_client = candidate_client
        _raw_db = _raw_client[target_db_name]
        logger.info(
            "MongoDB connected & authenticated successfully at '%s' for database '%s'",
            _redact_mongo_url(candidate_url),
            target_db_name,
        )
        break
    except Exception as ping_err:
        logger.warning(
            "MongoDB candidate '%s' failed ping/auth: %s",
            _redact_mongo_url(candidate_url),
            ping_err,
        )

if _raw_client is None:
    configured_mongo_url = (settings.MONGO_URL or "").lower()
    is_local_fallback_allowed = (
        not configured_mongo_url or
        "localhost" in configured_mongo_url or
        "127.0.0.1" in configured_mongo_url
    ) and settings.ENV.lower() not in ("production", "prod")

    if not is_local_fallback_allowed:
        raise RuntimeError(
            "MongoDB is unavailable for a configured external database; "
            "refusing to use local fallback storage"
        )

    logger.warning("All MongoDB connections failed. Running with resilient in-memory SafeDatabase fallback.")

db = SafeDatabase(_raw_db)

# Standard collections
users_collection = db["users"]
projects_collection = db["projects"]
history_collection = db["history"]
executions_collection = db["executions"]
settings_collection = db["settings"]
conversations_collection = db["conversations"]
research_sessions_collection = db["research_sessions"]
otp_collection = db["otp_tokens"]
llm_usage_collection = db["llm_usage_logs"]
department_budgets_collection = db["department_budgets"]
feedbacks_collection = db["feedbacks"]
computer_sessions_collection = db["computer_sessions"]


def get_user_limit(user_id: str) -> int:
    """Helper to query a user's dynamic limit, defaulting to 10000."""
    if not user_id or user_id in ("system", "anonymous"):
        return 10000
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if user and "limit" in user and user["limit"] is not None:
            # If explicit limit is set and >= 10000 or admin, allow generous
            user_limit = int(user["limit"])
            return max(user_limit, 10000)
    except Exception:
        pass
    return 10000
