import pytest
import asyncio
from unittest.mock import MagicMock, patch
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from db.postgres import Base, User, Project, Task, AgentRun
from db.postgres import (
    save_user_pg_sync,
    save_project_pg_sync,
    save_task_pg_sync,
    update_task_pg_sync,
    create_agent_run_pg_sync,
    update_agent_run_pg_sync,
)
from rag.vector_store import get_vector_store, ChromaVectorStore, PineconeVectorStore
from agents.graph import graph

@pytest.mark.asyncio
async def test_postgres_orm_integrity():
    # Setup in-memory SQLite database for ORM integrity testing
    # Using sqlite+aiosqlite as an async engine
    test_db_url = "sqlite+aiosqlite:///:memory:"
    engine = create_async_engine(test_db_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        # 1. Create a user
        user = User(id="user_test_123", email="test@example.com")
        session.add(user)
        await session.commit()
        
        # 2. Create a project linked to user
        project = Project(id="project_test_123", user_id="user_test_123", name="My Relational Project")
        session.add(project)
        await session.commit()
        
        # 3. Create a task linked to project
        task = Task(id="task_test_123", project_id="project_test_123", status="running", agent_assigned="planner")
        session.add(task)
        await session.commit()
        
        # 4. Log agent runs under task
        agent_run = AgentRun(task_id="task_test_123", agent_name="planner", input_summary="idea", output_summary="plan", status="completed", duration_ms=120)
        session.add(agent_run)
        await session.commit()
        
    # Query back and verify relational integrity and FK cascades
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        # Query task and confirm relationship resolves correctly
        stmt = select(Task).where(Task.id == "task_test_123")
        res = await session.execute(stmt)
        task = res.scalar_one()
        assert task.status == "running"
        
        # Verify user relationship via project
        proj_stmt = select(Project).where(Project.id == "project_test_123").options(selectinload(Project.user))
        proj_res = await session.execute(proj_stmt)
        proj = proj_res.scalar_one()
        assert proj.user.email == "test@example.com"
        
        # Verify agent run relationship
        ar_stmt = select(AgentRun).where(AgentRun.task_id == "task_test_123").options(selectinload(AgentRun.task))
        ar_res = await session.execute(ar_stmt)
        ar = ar_res.scalar_one()
        assert ar.duration_ms == 120
        assert ar.task.id == "task_test_123"

def test_vector_store_factory_switching():
    # Test factory switching based on config settings
    with patch("config.settings.VECTOR_STORE", "chroma"):
        from rag.vector_store import _vector_store
        # Reset singleton cache
        import rag.vector_store
        rag.vector_store._vector_store = None
        store = get_vector_store()
        assert isinstance(store, ChromaVectorStore)

    with patch("config.settings.VECTOR_STORE", "pinecone"):
        import rag.vector_store
        rag.vector_store._vector_store = None
        store = get_vector_store()
        assert isinstance(store, PineconeVectorStore)

@patch("pinecone.Pinecone")
def test_pinecone_vector_store_crud(mock_pinecone):
    # Mock Pinecone SDK
    mock_index = MagicMock()
    mock_pinecone_instance = MagicMock()
    mock_pinecone_instance.Index.return_value = mock_index
    mock_pinecone.return_value = mock_pinecone_instance
    
    # Set settings variables
    with patch("config.settings.PINECONE_API_KEY", "mock-key"), \
         patch("config.settings.PINECONE_INDEX_NAME", "mock-index"):
         
        store = PineconeVectorStore()
        
        # Test add document
        store.add(
            collection_name="project_123",
            ids=["doc_1"],
            documents=["Hello Pinecone"],
            embeddings=[[0.1] * 384],
            metadatas=[{"source": "test"}]
        )
        
        mock_index.upsert.assert_called_once()
        args, kwargs = mock_index.upsert.call_args
        assert kwargs["namespace"] == "project_123"
        assert kwargs["vectors"][0][0] == "doc_1"
        assert kwargs["vectors"][0][2]["text"] == "Hello Pinecone"
        
        # Test query
        mock_index.query.return_value = MagicMock(matches=[
            MagicMock(id="doc_1", score=0.9, metadata={"text": "Hello Pinecone", "source": "test"})
        ])
        
        query_res = store.query(
            collection_name="project_123",
            query_embeddings=[[0.1] * 384],
            n_results=1,
            where={"source": "test"}
        )
        
        assert query_res["ids"][0] == ["doc_1"]
        assert query_res["documents"][0] == ["Hello Pinecone"]
        assert query_res["metadatas"][0] == [{"text": "Hello Pinecone", "source": "test"}]
        
        # Test delete
        store.delete(collection_name="project_123", ids=["doc_1"])
        mock_index.delete.assert_called_with(ids=["doc_1"], namespace="project_123")
        
        # Test delete collection / namespace
        store.delete_collection(collection_name="project_123")
        mock_index.delete.assert_called_with(delete_all=True, namespace="project_123")

def test_agent_graph_compiles():
    # Verify the compiled LangGraph object compiles correctly and contains all nodes
    assert graph is not None
    node_names = graph.nodes.keys()
    assert "planner" in node_names
    assert "coder" in node_names
    assert "tester" in node_names
    assert "debugger" in node_names
    assert "deployer" in node_names
