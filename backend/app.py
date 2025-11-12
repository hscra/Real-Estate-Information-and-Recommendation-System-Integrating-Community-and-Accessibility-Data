from fastapi import FastAPI, Depends, Query, Response
import math
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Annotated
from .db import get_db
from sqlalchemy.orm import Session
from .crud import search_listings,fetch_price_histories, reflect_fact_table
from .schemas import ListingsResponse, ListingOut, PriceImpactRequest, PriceImpactResponse
from .services.prediction import get_predictions
from backend.routers.opinion import router as opinions_router
from .settings import settings
from backend.tiles import tile_bounds, draw_points_tile, meters_per_pixel
from .models import Listing
from sqlalchemy import select, and_, func
from math import radians, cos, sin, asin, sqrt
import geoalchemy2

app = FastAPI(title="Property Search API")
origins =[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    # allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    # allow_methods=[""],
    # allow_headers=[""],
    # allow_credentials=True,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


print("CONFIG → SCHEMA:", settings.SCHEMA, "| VIEW_OR_TABLE:", settings.VIEW_OR_TABLE)


app.include_router(opinions_router) # opinions_router registered on the main app, which enables GET /listings/{listing_id}/opinions or POST

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

    items = [ListingOut.model_validate(r).model_dump(exclude_none=True) for r in rows]

    # Attach price history only when requested to reduce payload and speed
    if include_history:
        ids = [it["listing_id"] for it in items]
        hmap = fetch_price_histories(db, ids)
        for it in items:
            it["price_history"] = hmap.get(it["listing_id"], [])

    # Attach predictions if available in main/
    try:
        ids = [it["listing_id"] for it in items]
        pmap = get_predictions(ids)
        if pmap:
            for it in items:
                preds = pmap.get(it["listing_id"]) or {}
                def _finite(v):
                    try:
                        f = float(v)
                        return math.isfinite(f)
                    except Exception:
                        return False
                if _finite(preds.get("svm")):
                    it["predicted_svm"] = float(preds["svm"])  # type: ignore
                if _finite(preds.get("hgbr")):
                    it["predicted_hgbr"] = float(preds["hgbr"])  # type: ignore
                if _finite(preds.get("nn")):
                    it["predicted_nn"] = float(preds["nn"])  # type: ignore
    except Exception:
        # Non-fatal: skip predictions if anything goes wrong
        pass

    return {"items": items, "page": page, "page_size": page_size, "total": total}


@app.get("/listings/{listing_id}/history")
def get_price_history(listing_id: str, db: Session = Depends(get_db)):
    """Return price history points for a single listing.
    Shape: { listing_id, history: [{date, price}, ...] }
    """
    hmap = fetch_price_histories(db, [listing_id])
    return {"listing_id": listing_id, "history": hmap.get(listing_id, [])}

#add PNG tile endpoints
@app.get("/tiles/points/{z}/{x}/{y}.png")
def points_tile(z: int, x: int, y: int, db: Session = Depends(get_db)) -> Response:
    south, west, north, east = tile_bounds(z, x, y)
    rows = db.execute(
        select(Listing.latitude, Listing.longitude).where(
            and_(
                Listing.latitude.between(south, north),
                Listing.longitude.between(west, east),
                Listing.price >= 10000.0,  # keep your global MIN_PRICE_FLOOR if needed
            )
        )
    ).all()
    pts = [(lat, lon) for (lat, lon) in rows if lat is not None and lon is not None]
    png = draw_points_tile(pts, z, x, y)
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
        },
    )


def _deg_bbox_from_radius(lat: float, lng: float, radius_m: float):
    # approx degrees per meter
    dlat = radius_m / 111_320.0
    dlng = radius_m / (111_320.0 * cos(radians(lat)) or 1e-9)
    return (lat - dlat, lng - dlng, lat + dlat, lng + dlng)

def _haversine_m(a_lat, a_lng, b_lat, b_lng):
    R = 6371000.0
    dlat = radians(b_lat - a_lat)
    dlng = radians(b_lng - a_lng)
    sa = sin(dlat / 2.0)
    sb = sin(dlng / 2.0)
    h = sa*sa + cos(radians(a_lat))*cos(radians(b_lat))*sb*sb
    return 2 * R * asin(min(1.0, sqrt(h)))

@app.get("/nearest")
def nearest(lat: float, lng: float, zoom: int, max_px: int = 12, db: Session = Depends(get_db)):
    tol_m = meters_per_pixel(lat, zoom) * max_px

    if settings.USE_POSTGIS:
        try:
            fact = reflect_fact_table(db)  # realestate.fact_listings with geography POINT geom
            user_pt = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)
            dist = func.ST_Distance(func.Geography(fact.c.geom), func.Geography(user_pt)).label("d")

            row = db.execute(
                select(Listing, dist)
                .join(fact, fact.c.listing_id == Listing.listing_id)
                .where(func.ST_DWithin(func.Geography(fact.c.geom), func.Geography(user_pt), tol_m))
                .order_by(dist.asc())
                .limit(1)
            ).first()

            if row:
                listing, dist_m = row
                return {
                    "found": True,
                    "listing_id": listing.listing_id,
                    "latitude": listing.latitude,
                    "longitude": listing.longitude,
                    "distance_m": float(dist_m),
                }
        except Exception:
            # IMPORTANT: clear the failed transaction before fallback
            db.rollback()

    # Fallback: bbox + haversine on Listing latitude/longitude
    south, west, north, east = _deg_bbox_from_radius(lat, lng, tol_m)
    candidates = db.execute(
        select(Listing.listing_id, Listing.latitude, Listing.longitude).where(
            and_(Listing.latitude.between(south, north),
                 Listing.longitude.between(west, east))
        )
    ).all()

    best = None
    best_d = 1e12
    for lid, la, lo in candidates:
        if la is None or lo is None:
            continue
        d = _haversine_m(lat, lng, la, lo)
        if d < best_d:
            best_d, best = d, (lid, la, lo)

    if not best:
        return {"found": False}

    lid, la, lo = best
    return {"found": True, "listing_id": lid, "latitude": la, "longitude": lo, "distance_m": float(best_d)}


# Scenario-based price impact endpoint
@app.post("/listings/{listing_id}/price-impact", response_model=PriceImpactResponse)
def price_impact(
    listing_id: str,
    req: PriceImpactRequest,
    db: Session = Depends(get_db),
):
    """Estimate price change if neighborhood accessibility/infrastructure changes.

    Chooses base price from predictions when available, otherwise the current listing price.
    Applies a transparent elasticity model and returns an adjusted price with breakdown.
    """
    # Load base listing
    row = db.query(Listing).filter(Listing.listing_id == listing_id).first()
    base_price = float(getattr(row, "price", 0.0) or 0.0)

    # Prefer prediction if available
    used_prediction = False
    try:
        pmap = get_predictions([listing_id])
        preds = pmap.get(listing_id) or {}
        # choose an available model in a deterministic order
        for k in ("hgbr", "svm", "nn"):
            v = preds.get(k)
            try:
                if v is not None:
                    base_price = float(v)
                    used_prediction = True
                    break
            except Exception:
                continue
    except Exception:
        pass

    # Build scenario and estimate
    from backend.services.price_scenarios import Scenario, estimate_price_impact

    scenario = Scenario(
        centre_distance_km_change=float(req.centre_distance_km_change or 0.0),
        transit_upgrade=bool(req.transit_upgrade or False),
        transit_access_delta=(float(req.transit_access_delta) if req.transit_access_delta is not None else None),
        new_poi_delta=int(req.new_poi_delta or 0),
        amenity_distance_changes=req.amenity_distance_changes or None,
    )
    result = estimate_price_impact(base_price, scenario)

    return PriceImpactResponse(
        listing_id=listing_id,
        base_price=base_price,
        adjusted_price=result["adjusted_price"],
        delta_amount=result["delta_amount"],
        delta_pct=result["delta_pct"],
        used_prediction=used_prediction,
        breakdown=result["breakdown"],
    )
