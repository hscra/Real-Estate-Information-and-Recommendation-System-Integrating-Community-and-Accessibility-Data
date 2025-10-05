from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from .settings import settings


# engine = create_engine(settings.DATABASE_URL, pool_size=10, max_overflow=20, pool_pre_ping=True)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency
# from contextlib import contextmanager
# @contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()