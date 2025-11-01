from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from .settings import settings

"""
SessionLocal: This is the SQLAlchemy session that manages database transactions.
Base: All our models will inherit from this.
"""
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()