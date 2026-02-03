import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

ENV = os.getenv("ENV", "local")
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    if ENV == "prod":
        raise RuntimeError("DATABASE_URL no configurada en producción")
    DATABASE_URL = "sqlite:///./database/natillera.db"
    connect_args = {"check_same_thread": False}
else:
    # Render/Heroku a veces dan postgres://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    connect_args = {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
