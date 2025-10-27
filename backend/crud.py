from sqlalchemy import select, and_, or_, func, MetaData, Table, true
from sqlalchemy.orm import Session
from typing import Sequence, Tuple
from .models import Listing
from .settings import settings


AMENITY_MAP = {
    "parking": Listing.has_parking_space,
    "balcony": Listing.has_balcony,
    "elevator": Listing.has_elevator,
    "security": Listing.has_security,
    "storage": Listing.has_storage_room,
}


SORT_MAP = {
    "recent": Listing.snapshot_date.desc(),
    "price_asc": Listing.price.asc(),
    "price_desc": Listing.price.desc(),
    "m2_asc": Listing.square_m.asc(),
    "m2_desc": Listing.square_m.desc(),
}


DEFAULT_SORT = SORT_MAP["recent"]

def build_filters(
    city: str | None,
    type_: str | None,
    min_m2: float | None,
    max_m2: float | None,
    min_price: float | None,
    max_price: float | None,
    rooms: int | None,
    amenities: list[str] | None,
    max_school: float | None = None,
    max_clinic: float | None = None,
    max_post_office: float | None = None,
    max_restaurant: float | None = None,
    max_college: float | None = None,
    max_pharmacy: float | None = None,
    max_kindergarten: float | None = None,
    ):
    conds = []
    if city:
        conds.append(func.lower(Listing.city) == city.lower()) # exact; swap to ilike for partial
    if type_:
        conds.append(Listing.type == type_)
    if min_m2 is not None:
        conds.append(Listing.square_m >= min_m2)
    if max_m2 is not None:
        conds.append(Listing.square_m <= max_m2)
    if min_price is not None:
        conds.append(Listing.price >= min_price)
    if max_price is not None:
        conds.append(Listing.price <= max_price)
    if rooms is not None:
        conds.append(Listing.rooms == rooms)
    if amenities:
        for a in amenities:
            col = AMENITY_MAP.get(a)
            if col is not None:
                conds.append(col.is_(True))
    if max_school is not None:       conds.append(Listing.school_distance <= max_school)
    if max_clinic is not None:       conds.append(Listing.clinic_distance <= max_clinic)
    if max_post_office is not None:  conds.append(Listing.post_office_distance <= max_post_office)
    if max_restaurant is not None:   conds.append(Listing.restaurant_distance <= max_restaurant)
    if max_college is not None:      conds.append(Listing.college_distance <= max_college)
    if max_pharmacy is not None:     conds.append(Listing.pharmacy_distance <= max_pharmacy)
    if max_kindergarten is not None: conds.append(Listing.kindergarten_distance <= max_kindergarten)
    
    return and_(*conds) if conds else None

def fetch_price_histories(db, listing_ids: list[str]) -> dict[str, list[dict]]:
    """Fetch price histories for listing_ids and sort them by snapshot_date in Python."""
    if not listing_ids:
        return {}

    meta = MetaData(schema="realestate")
    fact = Table("fact_listings", meta, autoload_with=db.bind)

    q = (
        select(
            fact.c.listing_id,
            func.json_agg(
                func.json_build_object(
                    "date", fact.c.snapshot_date,
                    "price", fact.c.price
                )
            ).label("hist")
        )
        .where(fact.c.listing_id.in_(listing_ids))
        .group_by(fact.c.listing_id)
    )

    rows = db.execute(q).all()

    out: dict[str, list[dict]] = {}
    for lid, hist in rows:
        # hist is a Python list of dicts (date, price) or None
        seq = hist or []
        # Sort by "date" key ascending (YYYY-MM-DD strings sort correctly)
        seq.sort(key=lambda d: d.get("date"))
        out[lid] = seq
    return out

def reflect_fact_table(db: Session):
    meta = MetaData(schema=settings.SCHEMA)
    fact = Table("fact_listings", meta, autoload_with=db.bind)
    return fact

def apply_bbox_filter(q, fact, south, west, north, east):
    """Use PostGIS ST_Intersects against an envelope; falls back to lat/lon if geom missing."""
    if None in (south, west, north, east):
        return q
    envelope = func.ST_MakeEnvelope(west, south, east, north, 4326)
    return q.where(func.ST_Intersects(fact.c.geom, envelope))

def apply_radius_filter(q, fact, lat, lng, radius_m):
    """Filter within radius_m meters of (lat, lng). Returns (query, distance_expr or None)."""
    if None in (lat, lng, radius_m):
        return q, None
    user_pt = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)  # SRID 4326
    # geography distance in meters (geom is geography)
    dist = func.ST_Distance(fact.c.geom, user_pt)
    q = q.where(func.ST_DWithin(fact.c.geom, user_pt, radius_m))
    return q, dist

MIN_PRICE_FLOOR = 10_000.0

def search_listings(
    db: Session,
    *,
    south: float, west: float, north: float, east: float,
    city: str | None,
    type_: str | None,
    min_m2: float | None,
    max_m2: float | None,
    min_price: float | None,
    max_price: float | None,
    rooms: int | None,
    amenities: list[str] | None,
    page: int,
    page_size: int,
    sort: str | None,

    # NEW geo params
    bbox_south: float | None = None,
    bbox_west: float | None = None,
    bbox_north: float | None = None,
    bbox_east: float | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_m: int | None = None,

    max_school: float | None = None,
    max_clinic: float | None = None,
    max_post_office: float | None = None,
    max_restaurant: float | None = None,
    max_college: float | None = None,
    max_pharmacy: float | None = None,
    max_kindergarten: float | None = None,

    limit: int = 100, 
    offset: int = 0,
):
    page_size = max(1, min(page_size or 500, 1000))  
    conditions = []  

    # Base: select from v_latest_listings
    base = select(Listing)


    # Map bounds
    conditions = [
        Listing.latitude.between(south, north),
        Listing.longitude.between(west, east),
        Listing.price >= max(MIN_PRICE_FLOOR, float(min_price or 0.0)),
    ]
    effective_min_price = max(MIN_PRICE_FLOOR, float(min_price or 0.0))
    params: dict[str, object] = {}

    # Build attribute filters (UI passes meters; DB distances appear to be in kilometers)
    def m_to_km(v: float | None) -> float | None:
        return (float(v) / 1000.0) if v is not None else None

    filters = build_filters(
        city,
        type_,
        min_m2,
        max_m2,
        min_price=effective_min_price,
        max_price=max_price,
        rooms=rooms,
        amenities=amenities,
        max_school=m_to_km(max_school),
        max_clinic=m_to_km(max_clinic),
        max_post_office=m_to_km(max_post_office),
        max_restaurant=m_to_km(max_restaurant),
        max_college=m_to_km(max_college),
        max_pharmacy=m_to_km(max_pharmacy),
        max_kindergarten=m_to_km(max_kindergarten),
    )
    if filters is not None:
        conditions.append(filters)

    where_clause = and_(*conditions) if conditions else true()
    base = base.where(where_clause)


    # postGIS spatial filter
    distance_expr = None
    if settings.USE_POSTGIS and any(v is not None for v in (bbox_south, bbox_west, bbox_north, bbox_east, lat, lng, radius_m)):
        fact = reflect_fact_table(db)  # realestate.fact_listings
        base = base.join(
            fact,
            and_(fact.c.listing_id == Listing.listing_id),
        )
        if None not in (bbox_south, bbox_west, bbox_north, bbox_east):
            base = apply_bbox_filter(base, fact, bbox_south, bbox_west, bbox_north, bbox_east)
        if None not in (lat, lng, radius_m):
            base, distance_expr = apply_radius_filter(base, fact, lat, lng, radius_m)

    
    # Sorting
    if sort == "distance_asc" and distance_expr is not None:
        base = base.order_by(distance_expr.asc())
    else:
        order_clause = SORT_MAP.get(sort or "", SORT_MAP["recent"])
        base = base.order_by(order_clause)

    # Sorting
    if sort == "distance_asc" and distance_expr is not None:
        order_clause = distance_expr.asc()
    else:
        order_clause = SORT_MAP.get(sort or "", SORT_MAP["recent"])

    # Count over the filtered 'base'
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()

    # Page the same filtered/sorted 'base'
    # stmt = (
    #     base
    #     .order_by(order_clause)
    #     .limit(page_size)
    #     .offset((page - 1) * page_size)
    # )

    # rows = db.execute(stmt).all()
    rows = db.execute(
        base.order_by(order_clause).limit(page_size).offset((page - 1) * page_size)
    ).scalars().all()  # ← .scalars()



    return rows, total
