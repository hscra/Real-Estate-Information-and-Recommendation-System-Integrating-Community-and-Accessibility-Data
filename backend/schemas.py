from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Literal

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


class PriceImpactRequest(BaseModel):
    centre_distance_km_change: float | None = 0.0
    transit_upgrade: bool | None = False
    transit_access_delta: float | None = None
    new_poi_delta: int | None = 0
    # map of amenity key -> distance change in meters (negative = closer)
    amenity_distance_changes: dict[str, float] | None = None


class PriceImpactResponse(BaseModel):
    listing_id: str
    base_price: float
    adjusted_price: float
    delta_amount: float
    delta_pct: float
    used_prediction: bool
    unit: Literal["pln_per_m2", "pln_total"] = "pln_per_m2"
    breakdown: dict[str, float]
