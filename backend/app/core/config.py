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
    llm_base_url: str = ""
    admin_email: str = "admin@leadpro.com"
    admin_password: str = "admin123"
    admin_name: str = "System Admin"
    frontend_url: str = "http://localhost:3000"

    # Google Calendar OAuth (leave blank to disable the integration)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/calendar/callback"


settings = Settings()
