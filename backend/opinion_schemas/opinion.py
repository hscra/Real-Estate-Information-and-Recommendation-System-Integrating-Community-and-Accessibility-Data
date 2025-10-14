from pydantic import BaseModel

class Opinion(BaseModel):
    opinion_id: str
    listing_id: str
    cleanliness: int
    safety: int
    parking: int
    noise: int
    transit_access: int
    sunlight: int
    overall: int
    review_text: str
    source: str

class OpinionsResponse(BaseModel):
    listing_id: str
    opinions: list[Opinion]
