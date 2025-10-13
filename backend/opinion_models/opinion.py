from sqlalchemy import Column, Integer, String, SmallInteger, Text, TIMESTAMP
from sqlalchemy.schema import ForeignKey
from sqlalchemy.sql import text as sa_text
from backend.models import Base  # your Declarative Base

class SyntheticOpinion(Base):
    __tablename__ = "synthetic_opinions"
    __table_args__ = {"schema": "realestate"}

    opinion_id      = Column(String, primary_key=True)
    listing_id      = Column(String, nullable=False)  # FK optional if you have listings table
    cleanliness     = Column(SmallInteger, nullable=False)
    safety          = Column(SmallInteger, nullable=False)
    parking         = Column(SmallInteger, nullable=False)
    noise           = Column(SmallInteger, nullable=False)
    transit_access  = Column(SmallInteger, nullable=False)
    sunlight        = Column(SmallInteger, nullable=False)
    overall         = Column(SmallInteger, nullable=False)
    review_text            = Column(Text, nullable=False)
    source          = Column(String, nullable=False, server_default=sa_text("'synthetic_v1'"))
    created_at      = Column(TIMESTAMP(timezone=True), nullable=False, server_default=sa_text("NOW()"))
