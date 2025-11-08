from sqlalchemy.orm import Session
from backend.opinion_models.opinion import SyntheticOpinion
from backend.opinion_models.user_opinion import UserOpinion
from typing import List

def get_opinions_by_listing(db: Session, listing_id: str) -> List[SyntheticOpinion]:
    return (db.query(SyntheticOpinion)
             .filter(SyntheticOpinion.listing_id == listing_id)
             .order_by(SyntheticOpinion.overall.desc(), SyntheticOpinion.created_at.desc())
             .all())

def upsert_many(db: Session, rows: list[dict]):
    objs = []
    for r in rows:
        obj = db.query(SyntheticOpinion).get(r['opinion_id'])
        if obj:
            for k, v in r.items():
                setattr(obj, k, v)
        else:
            obj = SyntheticOpinion(**r)
            db.add(obj)
        objs.append(obj)
    db.commit()
    return objs

def create_user_opinion(db: Session, data: dict) -> UserOpinion:
    obj = UserOpinion(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def get_user_opinions_by_listing(db: Session, listing_id: str):
    return (db.query(UserOpinion)
    .filter(UserOpinion.listing_id == listing_id)
    .order_by(UserOpinion.created_at.desc())
    .all())