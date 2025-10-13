from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from db import get_db
from backend.opinion_schemas.opinion import OpinionsResponse, Opinion
from backend.opinion_crud.opinion import get_opinions_by_listing, upsert_many
from services.opinion_generator import synthesize_opinions
import pandas as pd

router = APIRouter(prefix="/listings", tags=["opinions"])

@router.get("/{listing_id}/opinions", response_model=OpinionsResponse)
def get_or_create_opinions(listing_id: str, db: Session = Depends(get_db), n: int = 3, seed: int = 42):
    # 1) read from DB
    existing = get_opinions_by_listing(db, listing_id)
    if existing:
        return {
            "listing_id": listing_id,
            "opinions": [Opinion.model_validate(o.__dict__) for o in existing]
        }

    # 2) lazy-generate from v_latest_listings restricted to listing_id
    sql = """
        SELECT listing_id, city, type, square_m, rooms, floor, floor_count, build_year,
               centre_distance, poi_count, has_parking_space, has_elevator, has_security
        FROM realestate.v_latest_listings
        WHERE listing_id = :listing_id
        LIMIT 1
    """
    df = pd.read_sql_query(sql, db.bind, params={"listing_id": listing_id})
    if df.empty:
        raise HTTPException(status_code=404, detail="Listing not found.")

    gen = synthesize_opinions(df, n_per_listing=n, seed=seed)
    upsert_many(db, gen.to_dict(orient="records"))
    saved = get_opinions_by_listing(db, listing_id)

    return {"listing_id": listing_id,
            "opinions": [Opinion.model_validate(o.__dict__) for o in saved]}

@router.post("/{listing_id}/opinions:regenerate", response_model=OpinionsResponse)
def regenerate(listing_id: str,
               db: Session = Depends(get_db),
               n: int = Query(3, ge=1, le=10),
               seed: int = 42):
    sql = """
        SELECT listing_id, city, type, square_m, rooms, floor, floor_count, build_year,
               centre_distance, poi_count, has_parking_space, has_elevator, has_security
        FROM realestate.v_latest_listings
        WHERE listing_id = :listing_id
        LIMIT 1
    """
    df = pd.read_sql_query(sql, db.bind, params={"listing_id": listing_id})
    if df.empty:
        raise HTTPException(status_code=404, detail="Listing not found.")

    gen = synthesize_opinions(df, n_per_listing=n, seed=seed)

    # Clear old -> optional: keep history by using unique opinion_ids (listing_id-1,..)
    from sqlalchemy import delete
    from models.opinion import SyntheticOpinion
    db.execute(delete(SyntheticOpinion).where(SyntheticOpinion.listing_id == listing_id))
    db.commit()

    upsert_many(db, gen.to_dict(orient="records"))
    saved = get_opinions_by_listing(db, listing_id)
    return {"listing_id": listing_id,
            "opinions": [Opinion.model_validate(o.__dict__) for o in saved]}
