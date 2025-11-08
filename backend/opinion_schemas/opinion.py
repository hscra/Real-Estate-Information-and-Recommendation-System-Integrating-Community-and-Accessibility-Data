from pydantic import BaseModel, Field

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

class OpinionCreate(BaseModel):
    user_name: str | None = None
    cleanliness: int = Field(..., ge=1, le=5)
    safety: int = Field(..., ge=1, le=5)
    parking: int = Field(..., ge=1, le=5)
    noise: int = Field(..., ge=1, le=5)
    transit_access: int = Field(..., ge=1, le=5)
    sunlight: int = Field(..., ge=1, le=5)
    overall: int = Field(..., ge=1, le=5)
    review_text: str