from pydantic import BaseModel
from typing import Optional


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


    class Config:
        from_attributes = True

class ListingsResponse(BaseModel):
    items: list[ListingOut]
    page: int
    page_size: int
    total: int

