from sqlalchemy import Column, Integer, Float, String, Boolean, text
from sqlalchemy.orm import declarative_base
from .settings import settings

Base = declarative_base()

class Listing(Base):
    __tablename__ = settings.VIEW_OR_TABLE
    __table_args__ = {"schema": settings.SCHEMA}

    listing_id = Column(String, primary_key=True)
    city = Column(String)
    type = Column(String) 
    square_m = Column(Float)
    rooms = Column(Integer)
    floor = Column(Integer)
    floor_count = Column(Integer)
    build_year = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)
    centre_distance = Column(Float)
    price = Column(Float)
    has_parking_space = Column(Boolean)
    has_balcony = Column(Boolean)
    has_elevator = Column(Boolean)
    has_security = Column(Boolean)
    has_storage_room = Column(Boolean)
    snapshot_date = Column(String)