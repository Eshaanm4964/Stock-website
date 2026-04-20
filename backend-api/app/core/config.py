from functools import lru_cache

from pydantic import AliasChoices, Field, computed_field
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AssetYantra"
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
    xai_api_key: str = Field(default="", alias="XAI_API_KEY")
    xai_model: str = Field(default="grok-4.20-reasoning", alias="XAI_MODEL")
    xai_base_url: str = Field(default="https://api.x.ai/v1", alias="XAI_BASE_URL")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    groq_base_url: str = Field(default="https://api.groq.com/openai/v1", alias="GROQ_BASE_URL")
    news_api_key: str = Field(default="", alias="NEWS_API_KEY")
    alpha_vantage_api_key: str = Field(default="", alias="ALPHA_VANTAGE_API_KEY")
    frontend_url: str = Field(default="http://localhost:5500", alias="FRONTEND_URL")
    allowed_origins_raw: str = Field(
        default="http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000",
        alias="ALLOWED_ORIGINS",
    )
    cache_ttl_seconds: int = 10
    alert_poll_interval_seconds: int = 60
    otp_expire_minutes: int = 5
    otp_debug_mode: bool = Field(default=True, alias="OTP_DEBUG_MODE")
    sms_provider: str = Field(default="", alias="SMS_PROVIDER")
    sms_api_key: str = Field(default="", alias="SMS_API_KEY")
    sms_sender_id: str = Field(default="ASTYNT", alias="SMS_SENDER_ID")
    sms_timeout_seconds: float = Field(default=10.0, alias="SMS_TIMEOUT_SECONDS")
    auth_rate_limit_window_minutes: int = Field(default=15, alias="AUTH_RATE_LIMIT_WINDOW_MINUTES")
    auth_max_failed_attempts: int = Field(default=5, alias="AUTH_MAX_FAILED_ATTEMPTS")
    admin_username: str = Field(default="admin_dev", alias="ADMIN_USERNAME")
    admin_email: str = Field(default="admin@assetyantra.local", alias="ADMIN_EMAIL")
    admin_full_name: str = Field(default="AssetYantra Admin", alias="ADMIN_FULL_NAME")
    admin_phone_number: str = Field(default="9392970534", alias="ADMIN_PHONE_NUMBER")
    admin_password: str = Field(default="Admin@123", alias="ADMIN_PASSWORD")

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
