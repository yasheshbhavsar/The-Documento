from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Immigration API"
    environment: str = "development"
    debug: bool = False

    # Persistence
    database_url: str = "postgresql+psycopg://ai_immigration:local_dev_only@localhost:5432/ai_immigration"
    redis_url: str = "redis://localhost:6379/0"

    # Private Storage
    object_storage_endpoint: str = "http://localhost:9000"
    object_storage_bucket: str = "ai-immigration"
    object_storage_access_key: str = "minioadmin"
    object_storage_secret_key: str = "minioadmin"
    object_storage_region: str = "us-east-1"
    use_local_storage: bool = True
    document_storage_dir: str = "./storage_data"

    # AI & Multimodal LLM Intelligence
    ai_provider: str = "gemini"  # gemini, anthropic, mock_fallback
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-20241022"

    # Security & Tokens
    jwt_secret_key: str = "local_development_secret_key_change_in_production_min_32_chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    password_reset_token_expire_hours: int = 24
    invitation_token_expire_days: int = 7
    session_cookie_name: str = "ai_immigration_session"

    # OIDC Provider (optional external boundary)
    auth_issuer_url: str = ""
    auth_audience: str = "ai-immigration-api"
    auth_required: bool = False

    # CORS & Security
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    rate_limit_per_minute: int = 120

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        env_lower = self.environment.lower()
        if env_lower in ("production", "prod", "staging", "uat"):
            if "local_dev" in self.jwt_secret_key or len(self.jwt_secret_key) < 32:
                raise ValueError("Insecure JWT secret key in production/staging environment! Must be >= 32 characters.")
            if "local_dev_only" in self.database_url:
                raise ValueError("Insecure default database password detected in production/staging environment!")
            if not self.auth_required:
                object.__setattr__(self, "auth_required", True)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
