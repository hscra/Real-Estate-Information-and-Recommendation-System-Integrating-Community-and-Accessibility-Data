from fastapi import FastAPI, Depends, Query
from typing import Optional, Annotated
from .db import get_db
from sqlalchemy.orm import Session
from .crud import search_listings,fetch_price_histories
from .schemas import ListingsResponse, ListingOut


app = FastAPI(title="Property Search API")


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
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort: Optional[str] = Query("recent", pattern="^(price_asc|price_desc|m2_asc|m2_desc|recent)$"),
    include_history: bool = Query(False),
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
    )

    items = [ListingOut.model_validate(r).model_dump() for r in rows]

    # Attach price history for the items returned on this page
    ids = [it["listing_id"] for it in items]
    hmap = fetch_price_histories(db, ids)
    for it in items:
        it["price_history"] = hmap.get(it["listing_id"], [])

    return {"items": items, "page": page, "page_size": page_size, "total": total}



# @app.get("/listings", response_model=ListingsResponse)
# def list_listings(
#     city: Optional[str] = None,
#     type: str | None=None,
#     min_m2: Optional[float] = None,
#     max_m2: Optional[float] = None,
#     min_price: Optional[float] = None,
#     max_price: Optional[float] = None,
#     rooms: Optional[int] = None,
#     amenities: Optional[str] = Query(None, description="comma-separated: parking,balcony,elevator,security,storage"),
#     page: int = Query(1, ge=1),
#     page_size: int = Query(24, ge=1, le=100),
#     sort: Optional[str] = Query("recent", pattern="^(price_asc|price_desc|m2_asc|m2_desc|recent)$"),
#     # db: Session = Depends(get_db),
#     db : Annotated[Session, Depends(get_db)] = None,
# ):
#     a_list = [a.strip() for a in amenities.split(",")] if amenities else []

#     rows, total = search_listings(
#         db=db,
#         city=city,
#         type_=type,
#         min_m2=min_m2,
#         max_m2=max_m2,
#         min_price=min_price,
#         max_price=max_price,
#         rooms=rooms,
#         amenities=a_list,
#         page=page,
#         page_size=page_size,
#         sort=sort,
#     )
#     return {
#         "items": [ListingOut.model_validate(r).model_dump() for r in rows],
#         "page": page,
#         "page_size": page_size,
#         "total": total,
#     }
