from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Annotated
from .db import get_db
from sqlalchemy.orm import Session
from .crud import search_listings,fetch_price_histories
from .schemas import ListingsResponse, ListingOut
from backend.routers.opinion import router as opinions_router
from .settings import settings


app = FastAPI(title="Property Search API")
origins =[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


print("CONFIG → SCHEMA:", settings.SCHEMA, "| VIEW_OR_TABLE:", settings.VIEW_OR_TABLE)


app.include_router(opinions_router)

@app.get("/health")
def health():
    return {"ok": True}


@app.get("/listings", response_model=ListingsResponse)
def list_listings(
    city: Optional[str] = None,
    type: Optional[str] = None,
    min_m2: Optional[float] = None,
    max_m2: Optional[float] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    rooms: Optional[int] = None,
    amenities: Optional[str] = Query(None, description="comma-separated: parking,balcony,elevator,security,storage"),
    
    # viewport bbox (map bounds)
    south: float = Query(...),
    west:  float = Query(...),
    north: float = Query(...),
    east:  float = Query(...),
    
     # proximity filter (center + radius in meters)
    lat: float | None = None,
    lng: float | None = None,
    radius_m: int | None = None,
    
    include_history: bool = Query(False),
   
    # max_school: float | None = None,
    # max_clinic: float | None = None,
    # max_post_office: float | None = None,
    # max_restaurant: float | None = None,
    # max_college: float | None = None,
    # max_pharmacy: float | None = None,
    # max_kindergarten: float | None = None,
    max_school: Optional[int] = Query(None, ge=1),
    max_clinic: Optional[int] = Query(None, ge=1),
    max_post_office: Optional[int] = Query(None, ge=1),
    max_restaurant: Optional[int] = Query(None, ge=1),
    max_college: Optional[int] = Query(None, ge=1),
    max_pharmacy: Optional[int] = Query(None, ge=1),
    max_kindergarten: Optional[int] = Query(None,ge=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=1000),
    sort: Optional[str] = Query("recent", pattern="^(price_asc|price_desc|m2_asc|m2_desc|recent)$"),

    db: Session = Depends(get_db),
):
    a_list = [a.strip() for a in amenities.split(",")] if amenities else []

    rows, total = search_listings(
        db=db,
        city=city,
        type_=type,
        min_m2=min_m2,
        max_m2=max_m2,
        min_price=min_price,
        max_price=max_price,
        rooms=rooms,
        amenities=a_list,
        page=page,
        page_size=page_size,
        sort=sort,
        # pass through geo params
        south=south, west=west,
        north=north, east=east,
        lat=lat, lng=lng, radius_m=radius_m,
        
        # pass the distance filters through:
        max_school=max_school,
        max_clinic=max_clinic,
        max_post_office=max_post_office,
        max_restaurant=max_restaurant,
        max_college=max_college,
        max_pharmacy=max_pharmacy,
        max_kindergarten=max_kindergarten,
    )

    items = [ListingOut.model_validate(r).model_dump() for r in rows]

    # Attach price history only when requested to reduce payload and speed
    if include_history:
        ids = [it["listing_id"] for it in items]
        hmap = fetch_price_histories(db, ids)
        for it in items:
            it["price_history"] = hmap.get(it["listing_id"], [])

    return {"items": items, "page": page, "page_size": page_size, "total": total}


@app.get("/listings/{listing_id}/history")
def get_price_history(listing_id: str, db: Session = Depends(get_db)):
    """Return price history points for a single listing.
    Shape: { listing_id, history: [{date, price}, ...] }
    """
    hmap = fetch_price_histories(db, [listing_id])
    return {"listing_id": listing_id, "history": hmap.get(listing_id, [])}
