from pydantic import BaseModel
from typing import Optional, List

class PricePoint(BaseModel):
    date: str
    price: float

class ListingOut(BaseModel):
    listing_id: str
    city: Optional[str]
    type: Optional[str]
    square_m: Optional[float]
    rooms: Optional[int]
    floor: Optional[int]
    floor_count: Optional[int]
    build_year: Optional[int]
    latitude: Optional[float]
    longitude: Optional[float]
    price: Optional[float]
    has_parking_space: Optional[bool]
    has_balcony: Optional[bool]
    has_elevator: Optional[bool]
    has_security: Optional[bool]
    has_storage_room: Optional[bool]
    price_history: Optional[List[PricePoint]] = None 
    school_distance: float | None = None
    clinic_distance: float | None = None
    post_office_distance: float | None = None
    kindergarten_distance: float | None = None
    restaurant_distance: float | None = None
    college_distance: float | None = None
    pharmacy_distance: float | None = None

    class Config:
        from_attributes = True

class ListingsResponse(BaseModel):
    items: list[ListingOut]
    page: int
    page_size: int
    total: int
