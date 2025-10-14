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
def get_or_create_opinions(
    listing_id: str,
    db: Session = Depends(get_db),
    n: int = Query(3, ge=1, le=10),
    seed: int = 42,
):

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

@router.post("/{listing_id}/opinions:regenerate", response_model=OpinionsResponse)
def regenerate(
    listing_id: str,
    db: Session = Depends(get_db),
    n: int = Query(3, ge=1, le=10),
    seed: int = 42,
):
    df = _load_listing_df(db, listing_id)
    if df.empty:
        return {"listing_id": listing_id, "opinions": []}

    gen = synthesize_opinions(df, n_per_listing=n, seed=seed)


    db.execute(delete(SyntheticOpinion).where(SyntheticOpinion.listing_id == listing_id))
    db.commit()

    upsert_many(db, gen.to_dict(orient="records"))
    saved = get_opinions_by_listing(db, listing_id)
    return {
        "listing_id": listing_id,
        "opinions": [Opinion.model_validate(o, from_attributes=True) for o in saved],
    }
