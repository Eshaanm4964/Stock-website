from functools import lru_cache

from pydantic import AliasChoices, Field, computed_field
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Quantavia"
    app_env: str = Field(default="development", alias="APP_ENV")
    demo_mode: bool = Field(default=True, alias="DEMO_MODE")
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field(default="change-me-in-production", alias="SECRET_KEY")
    access_token_expire_minutes: int = 60 * 24
    algorithm: str = "HS256"
    database_url: str = Field(
        default="sqlite+aiosqlite:///./stock_trader.db",
        validation_alias=AliasChoices("DATABASE_URL", "POSTGRES_DSN"),
    )
    redis_url: str | None = Field(default=None, alias="REDIS_URL")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4.1-mini", alias="OPENAI_MODEL")
    news_api_key: str = Field(default="", alias="NEWS_API_KEY")
    frontend_url: str = Field(default="http://localhost:5500", alias="FRONTEND_URL")
    allowed_origins_raw: str = Field(
        default="http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000",
        alias="ALLOWED_ORIGINS",
    )
    cache_ttl_seconds: int = 30
    alert_poll_interval_seconds: int = 60
    otp_expire_minutes: int = 5
    otp_debug_mode: bool = Field(default=True, alias="OTP_DEBUG_MODE")
    auth_rate_limit_window_minutes: int = Field(default=15, alias="AUTH_RATE_LIMIT_WINDOW_MINUTES")
    auth_max_failed_attempts: int = Field(default=5, alias="AUTH_MAX_FAILED_ATTEMPTS")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @computed_field
    @property
    def allowed_origins(self) -> list[str]:
        return [entry.strip() for entry in self.allowed_origins_raw.split(",") if entry.strip()]

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.app_env.lower() == "production":
            if self.secret_key == "change-me-in-production":
                raise ValueError("SECRET_KEY must be set to a strong non-default value in production")
            if self.otp_debug_mode:
                raise ValueError("OTP_DEBUG_MODE must be false in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
