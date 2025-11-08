from sqlalchemy import Column, String, SmallInteger, Text as SAText, TIMESTAMP
from sqlalchemy.sql import text as sa_text
from backend.models import Base

class UserOpinion(Base):
    __tablename__ = "user_opinions"
    __table_args__ = {"schema": "realestate"}

    opinion_id      = Column(String, primary_key=True)
    listing_id      = Column(String, nullable=False)
    user_name       = Column(String, nullable=True)
    cleanliness     = Column(SmallInteger, nullable=False)
    safety          = Column(SmallInteger, nullable=False)
    parking         = Column(SmallInteger, nullable=False)
    noise           = Column(SmallInteger, nullable=False)
    transit_access  = Column(SmallInteger, nullable=False)
    sunlight        = Column(SmallInteger, nullable=False)
    overall         = Column(SmallInteger, nullable=False)
    review_text     = Column(SAText, nullable=False)
    source          = Column(String, nullable=False, server_default=sa_text("'user'"))
    created_at      = Column(TIMESTAMP(timezone=True), nullable=False, server_default=sa_text("NOW()"))