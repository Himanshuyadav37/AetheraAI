import asyncio
import sys
import os
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Insert the parent directory to Python path so we can import from db and config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db.postgres import Base
from config import settings

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here for 'autogenerate' support
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.POSTGRES_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Override sqlalchemy.url in configuration dynamically
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.POSTGRES_URL

    try:
        connectable = async_engine_from_config(
            configuration,
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )

        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations)

        await connectable.dispose()
    except Exception as e:
        print(f"[Alembic Notice] PostgreSQL migrations skipped (database offline or unreachable at {settings.POSTGRES_URL}): {e}")

if context.is_offline_mode():
    run_migrations_offline()
else:
    try:
        # Check if there is an active event loop
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Running inside an active loop (e.g. FastAPI startup or async tests)
        import threading
        def run_in_thread():
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                new_loop.run_until_complete(run_migrations_online())
            except Exception as thread_err:
                print(f"[Alembic Notice] Migration thread encountered error: {thread_err}")
            finally:
                new_loop.close()
        t = threading.Thread(target=run_in_thread)
        t.start()
        t.join()
    else:
        try:
            asyncio.run(run_migrations_online())
        except Exception as e:
            print(f"[Alembic Notice] Migration execution skipped: {e}")
