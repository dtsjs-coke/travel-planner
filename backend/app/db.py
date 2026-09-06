from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings


def _normalize_database_url(url: str) -> str:
    # Neon/Render/Heroku-style URLs come as "postgresql://" or "postgres://",
    # which SQLAlchemy resolves to the psycopg2 driver by default. We install
    # psycopg (v3) instead, so force that dialect explicitly.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


database_url = _normalize_database_url(settings.database_url)
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, connect_args=connect_args)

if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_db():
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
