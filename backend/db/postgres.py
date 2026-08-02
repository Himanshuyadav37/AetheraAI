from datetime import datetime
import asyncio
from typing import Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, DateTime, Text, Integer, select, update
from config import settings

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    project_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="running")
    agent_assigned: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    project = relationship("Project", back_populates="tasks")
    agent_runs = relationship("AgentRun", back_populates="task", cascade="all, delete-orphan")

class AgentRun(Base):
    __tablename__ = "agent_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(String(50), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    input_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    output_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    task = relationship("Task", back_populates="agent_runs")

# Connection setup
postgres_url = getattr(settings, "POSTGRES_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/nexusai")
engine = create_async_engine(postgres_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db_session():
    async with AsyncSessionLocal() as session:
        yield session

def run_async(coro):
    try:
        # Check if we can run it using asyncio.run() directly (safe when there's no running loop in this thread)
        return asyncio.run(coro)
    except RuntimeError:
        # If there's already an active event loop in this thread, we fall back to running it in a spawned thread
        import threading
        res_list = []
        err_list = []
        
        def target():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                res = loop.run_until_complete(coro)
                res_list.append(res)
            except Exception as e:
                err_list.append(e)
            finally:
                loop.close()
                
        t = threading.Thread(target=target)
        t.start()
        t.join()
        
        if err_list:
            raise err_list[0]
        return res_list[0] if res_list else None

# Synchronous wrappers for agent logging
async def _save_user(user_id: str, email: str, hashed_password: str = None):
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.id == user_id)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()
        if not existing:
            new_user = User(id=user_id, email=email, hashed_password=hashed_password)
            session.add(new_user)
            await session.commit()

def save_user_pg_sync(user_id: str, email: str, hashed_password: str = None):
    return run_async(_save_user(user_id, email, hashed_password))

async def _save_project(project_id: str, user_id: str, name: str):
    async with AsyncSessionLocal() as session:
        stmt = select(Project).where(Project.id == project_id)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()
        if not existing:
            user_stmt = select(User).where(User.id == user_id)
            user_res = await session.execute(user_stmt)
            if not user_res.scalar_one_or_none():
                session.add(User(id=user_id, email=f"{user_id}@example.com"))
                await session.flush()
                
            new_project = Project(id=project_id, user_id=user_id, name=name)
            session.add(new_project)
            await session.commit()

def save_project_pg_sync(project_id: str, user_id: str, name: str):
    return run_async(_save_project(project_id, user_id, name))

async def _save_task(task_id: str, project_id: str = None, status: str = "running", agent_assigned: str = "multi-agent"):
    async with AsyncSessionLocal() as session:
        stmt = select(Task).where(Task.id == task_id)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()
        if not existing:
            if project_id:
                proj_stmt = select(Project).where(Project.id == project_id)
                proj_res = await session.execute(proj_stmt)
                if not proj_res.scalar_one_or_none():
                    project_id = None
            
            new_task = Task(id=task_id, project_id=project_id, status=status, agent_assigned=agent_assigned)
            session.add(new_task)
            await session.commit()

def save_task_pg_sync(task_id: str, project_id: str = None, status: str = "running", agent_assigned: str = "multi-agent"):
    return run_async(_save_task(task_id, project_id, status, agent_assigned))

async def _update_task(task_id: str, project_id: str = None, status: str = None, completed_at: datetime = None):
    async with AsyncSessionLocal() as session:
        stmt = select(Task).where(Task.id == task_id)
        result = await session.execute(stmt)
        task = result.scalar_one_or_none()
        if task:
            if project_id:
                proj_stmt = select(Project).where(Project.id == project_id)
                proj_res = await session.execute(proj_stmt)
                if not proj_res.scalar_one_or_none():
                    user_id = task.project.user_id if task.project else "system"
                    user_stmt = select(User).where(User.id == user_id)
                    user_res = await session.execute(user_stmt)
                    if not user_res.scalar_one_or_none():
                        session.add(User(id=user_id, email=f"{user_id}@example.com"))
                        await session.flush()
                    session.add(Project(id=project_id, user_id=user_id, name="Project"))
                    await session.flush()
                task.project_id = project_id
            if status:
                task.status = status
            if completed_at:
                task.completed_at = completed_at
            await session.commit()

def update_task_pg_sync(task_id: str, project_id: str = None, status: str = None, completed_at: datetime = None):
    return run_async(_update_task(task_id, project_id, status, completed_at))

async def _create_agent_run(task_id: str, agent_name: str, input_summary: str, status: str = "running"):
    async with AsyncSessionLocal() as session:
        task_stmt = select(Task).where(Task.id == task_id)
        task_res = await session.execute(task_stmt)
        if not task_res.scalar_one_or_none():
            session.add(Task(id=task_id, status="running"))
            await session.flush()
            
        ar = AgentRun(task_id=task_id, agent_name=agent_name, input_summary=input_summary, status=status)
        session.add(ar)
        await session.commit()
        return ar.id

def create_agent_run_pg_sync(task_id: str, agent_name: str, input_summary: str, status: str = "running") -> int:
    return run_async(_create_agent_run(task_id, agent_name, input_summary, status))

async def _update_agent_run(run_id: int, output_summary: str, status: str, duration_ms: int):
    async with AsyncSessionLocal() as session:
        stmt = select(AgentRun).where(AgentRun.id == run_id)
        result = await session.execute(stmt)
        ar = result.scalar_one_or_none()
        if ar:
            ar.output_summary = output_summary
            ar.status = status
            ar.duration_ms = duration_ms
            await session.commit()

def update_agent_run_pg_sync(run_id: int, output_summary: str, status: str, duration_ms: int):
    return run_async(_update_agent_run(run_id, output_summary, status, duration_ms))
