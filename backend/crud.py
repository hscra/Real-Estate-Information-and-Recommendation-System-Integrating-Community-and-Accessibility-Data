from sqlalchemy import select, and_, or_, func, MetaData, Table
from sqlalchemy.orm import Session
from typing import Sequence, Tuple
from .models import Listing


AMENITY_MAP = {
    "parking": Listing.has_parking_space,
    "balcony": Listing.has_balcony,
    "elevator": Listing.has_elevator,
    "security": Listing.has_security,
    "storage": Listing.has_storage_room,
}


SORT_MAP = {
    "price_asc": Listing.price.asc(),
    "price_desc": Listing.price.desc(),
    "m2_asc": Listing.square_m.asc(),
    "m2_desc": Listing.square_m.desc(),
    "recent": func.coalesce(Listing.snapshot_date, "1970-01-01").desc(),
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
    return and_(*conds) if conds else None


def search_listings(
    db: Session,
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
) -> Tuple[Sequence[Listing], int]:
    filters = build_filters(city, type_, min_m2, max_m2, min_price, max_price, rooms, amenities)


    base = select(Listing)
    if filters is not None:
        base = base.where(filters)


    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()


    order_clause = SORT_MAP.get(sort or "", DEFAULT_SORT)


    rows = db.execute(
        base.order_by(order_clause)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()


    return rows, total


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