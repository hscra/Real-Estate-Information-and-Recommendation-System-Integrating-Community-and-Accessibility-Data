from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices

class Settings(BaseSettings):
    DATABASE_URL: str
    DEBUG: bool = False
    USE_POSTGIS: bool = True 
    SCHEMA: str = Field(
        default="realestate",
        validation_alias=AliasChoices("DB_SCHEMA", "SCHEMA"),
    )

    # Accept VIEW_OR_TABLE or TABLE or VIEW; default to "fact_listings"
    VIEW_OR_TABLE: str = Field(
        default="fact_listings",
        validation_alias=AliasChoices("VIEW_OR_TABLE", "TABLE", "VIEW"),
    )

    # load from .env automatically
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",   
    )


settings = Settings()