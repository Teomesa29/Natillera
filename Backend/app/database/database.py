import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# -------------------------
# Config
# -------------------------
ENV = os.getenv("ENV", "local")
DATABASE_URL = os.getenv("DATABASE_URL")

# En Render/Neon debe venir DATABASE_URL sí o sí
if DATABASE_URL:
    # Neon/Render a veces dan postgres://, SQLAlchemy requiere postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

    # (Recomendado con Python 3.13) usa psycopg v3 si lo instalas: psycopg[binary]
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

    connect_args = {}
else:
    if ENV == "prod":
        raise RuntimeError("DATABASE_URL no configurada en producción")
    # SQLite solo para local
    DATABASE_URL = "sqlite:///./database/natillera.db"
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
