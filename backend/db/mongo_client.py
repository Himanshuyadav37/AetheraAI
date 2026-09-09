import logging
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError, ConnectionFailure
from config import settings

logger = logging.getLogger("nexusai.db")

# In-memory storage fallback when MongoDB server is offline/unreachable
_MEMORY_STORES = {}


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
            self._items.sort(key=lambda x: x.get(key, 0) or "", reverse=reverse)
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
        if k not in doc:
            return False
        doc_val = doc[k]
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
        try:
            if self._raw is not None:
                return self._raw.find(query, *args, **kwargs)
        except (PyMongoError, ServerSelectionTimeoutError, ConnectionFailure, Exception) as e:
            logger.warning(f"[Mongo SafeCollection] find in '{self._name}' using memory store: {e}")

        matched = [dict(item) for item in self._get_mem_store() if _match_query(item, query)]
        return MemoryCursor(matched)

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


# Initialize MongoClient with short 2-second timeout to avoid long blocking
try:
    _raw_client = MongoClient(
        settings.MONGO_URL,
        serverSelectionTimeoutMS=2000,
        connectTimeoutMS=2000,
        socketTimeoutMS=3000
    )
    _raw_db = _raw_client[settings.DB_NAME]
except Exception as init_err:
    logger.warning(f"Could not connect to MongoDB '{settings.MONGO_URL}': {init_err}")
    _raw_client = None
    _raw_db = None

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


def get_user_limit(user_id: str) -> int:
    """Helper to query a user's dynamic limit, defaulting to 1."""
    if not user_id or user_id in ("system", "anonymous"):
        return 1
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if user and "limit" in user:
            return int(user["limit"])
    except Exception:
        pass
    return 1
