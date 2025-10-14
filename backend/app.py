from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Annotated
from .db import get_db
from sqlalchemy.orm import Session
from .crud import search_listings,fetch_price_histories
from .schemas import ListingsResponse, ListingOut
from backend.routers.opinion import router as opinions_router



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
    bbox_south: float | None = None,
    bbox_west: float | None = None,
    bbox_north: float | None = None,
    bbox_east: float | None = None,
     # proximity filter (center + radius in meters)
    lat: float | None = None,
    lng: float | None = None,
    radius_m: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort: Optional[str] = Query("recent", pattern="^(price_asc|price_desc|m2_asc|m2_desc|recent)$"),
    include_history: bool = Query(False),
    db: Session = Depends(get_db),
    max_school: float | None = None,
    max_clinic: float | None = None,
    max_post_office: float | None = None,
    max_restaurant: float | None = None,
    max_college: float | None = None,
    max_pharmacy: float | None = None,
    max_kindergarten: float | None = None,
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
        bbox_south=bbox_south, bbox_west=bbox_west,
        bbox_north=bbox_north, bbox_east=bbox_east,
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

    # Attach price history for the items returned on this page
    ids = [it["listing_id"] for it in items]
    hmap = fetch_price_histories(db, ids)
    for it in items:
        it["price_history"] = hmap.get(it["listing_id"], [])

    return {"items": items, "page": page, "page_size": page_size, "total": total}
