from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra="ignore")

    database_url: str = "postgresql+asyncpg://leadpro:leadpro@localhost:5433/leadpro"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    from_email: str = "reports@yourcompany.com"
    llm_api_key: str = ""
    # OpenAI-compatible endpoint. Zhipu GLM default; override LLM_BASE_URL/LLM_MODEL as needed.
    llm_base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    llm_model: str = "glm-4.5"
    # AI Pipeline. Empty feed URL skips the daily load. Empty embedding model
    # still stores jobs; the page then sorts by newest instead of similarity.
    job_feed_url: str = ""
    # Public Greenhouse board tokens, fetched with the daily job feed.
    greenhouse_boards: str = "stripe,gitlab,airbnb,cloudflare,figma,discord,databricks,robinhood"
    pipeline_max_age_days: int = 60
    pipeline_close_after_misses: int = 2
    llm_embedding_model: str = ""
    llm_embedding_dim: int = 1536
    admin_email: str = "admin@leadpro.com"
    admin_password: str = "admin123"
    admin_name: str = "System Admin"
    frontend_url: str = "http://localhost:3000"
    # Comma-separated allowed origins for CORS (add your deployed frontend URL).
    cors_origins: str = "http://localhost:3000"
    # Optional regex to allow dynamic origins, e.g. Vercel previews: https://.*\.vercel\.app
    cors_origin_regex: str = ""

    # Google Calendar OAuth (leave blank to disable the integration)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/calendar/callback"


settings = Settings()
