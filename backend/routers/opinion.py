from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import delete
from sqlalchemy.sql import text as sa_text
import pandas as pd

from backend.db import get_db
from backend.opinion_schemas.opinion import OpinionsResponse, Opinion
from backend.opinion_crud.opinion import get_opinions_by_listing, upsert_many
from backend.services.opinion_generator import synthesize_opinions
from backend.opinion_models.opinion import SyntheticOpinion

from uuid import uuid4
from backend.opinion_schemas.opinion import OpinionsResponse, Opinion, OpinionCreate
from backend.opinion_crud.opinion import create_user_opinion, get_user_opinions_by_listing
from backend.opinion_models.opinion import SyntheticOpinion

router = APIRouter(prefix="/listings", tags=["opinions"])

# helper to load one listing row into a DataFrame
def _load_listing_df(db: Session, listing_id: str) -> pd.DataFrame:
    engine = db.get_bind()  # Session -> Engine
    sql = sa_text("""
        SELECT listing_id, city, type, square_m, rooms, floor, floor_count, build_year,
               centre_distance, poi_count, has_parking_space, has_elevator, has_security
        FROM realestate.v_latest_listings
        WHERE listing_id = :listing_id
        LIMIT 1
    """)
    return pd.read_sql(sql, engine, params={"listing_id": listing_id})

@router.get("/{listing_id}/opinions", response_model=OpinionsResponse)
# existing synthetic fetch
def get_or_create_opinions(
     listing_id: str,
        db: Session = Depends(get_db),
        n: int = Query(3, ge=1, le=10),
        seed: int = 42,
):
    
    synth = get_opinions_by_listing(db, listing_id)
    users = get_user_opinions_by_listing(db, listing_id)

    if not synth and not users:
        existing = get_opinions_by_listing(db, listing_id)
        if existing:
            return {
                "listing_id": listing_id,
                "opinions": [Opinion.model_validate(o, from_attributes=True) for o in existing],
            }


        df = _load_listing_df(db, listing_id)
        if df.empty:

            return {"listing_id": listing_id, "opinions": []}

        gen = synthesize_opinions(df, n_per_listing=n, seed=seed)  
        upsert_many(db, gen.to_dict(orient="records"))
        saved = get_opinions_by_listing(db, listing_id)

        return {
            "listing_id": listing_id,
            "opinions": [Opinion.model_validate(o, from_attributes=True) for o in saved],
        }

    def to_p(op):
        return Opinion.model_validate(op, from_attributes=True)

    combined = [to_p(u) for u in users] + [to_p(s) for s in synth]
    combined.sort(key=lambda o: getattr(getattr(o, "created_at", None), "timestamp", lambda: 0)(), reverse=True)

    return {"listing_id": listing_id, "opinions": combined[:n]}


@router.post("/{listing_id}/opinions", response_model=OpinionsResponse)
def create_opinion(listing_id: str, req: OpinionCreate, db: Session = Depends(get_db), n: int = Query(3, ge=1, le=10)):
    oid = f"{listing_id}-u-{uuid4().hex[:8]}"
    create_user_opinion(db, {
    "opinion_id": oid,
    "listing_id": listing_id,
    "user_name": req.user_name,
    "cleanliness": req.cleanliness,
    "safety": req.safety,
    "parking": req.parking,
    "noise": req.noise,
    "transit_access": req.transit_access,
    "sunlight": req.sunlight,
    "overall": req.overall,
    "review_text": req.review_text,
    "source": "user",
    })
    # return fresh top-n after insert
    return get_or_create_opinions(listing_id, db, n)

