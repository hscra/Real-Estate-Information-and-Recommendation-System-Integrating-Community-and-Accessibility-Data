from pydantic import BaseModel, ConfigDict 
from typing import Optional, List

class PricePoint(BaseModel):
    date: str
    price: float

class ListingOut(BaseModel):
    listing_id: str
    city: Optional[str] = None
    type: Optional[str] = None
    square_m: Optional[float] = None
    rooms: Optional[int] = None
    floor: Optional[int] = None
    floor_count: Optional[int] = None
    build_year: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    price: Optional[float] = None
    # Optional model predictions
    predicted_svm: Optional[float] = None
    predicted_hgbr: Optional[float] = None
    predicted_nn: Optional[float] = None
    has_parking_space: Optional[bool] = None
    has_balcony: Optional[bool] = None
    has_elevator: Optional[bool] = None
    has_security: Optional[bool] = None
    has_storage_room: Optional[bool] = None
    price_history: Optional[List[PricePoint]] = None 
    school_distance: float | None = None
    clinic_distance: float | None = None
    post_office_distance: float | None = None
    kindergarten_distance: float | None = None
    restaurant_distance: float | None = None
    college_distance: float | None = None
    pharmacy_distance: float | None = None
    model_config = ConfigDict(from_attributes=True)

    # class Config:
    #     from_attributes = True

class ListingsResponse(BaseModel):
    items: list[ListingOut]
    page: int
    page_size: int
    total: int
