from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://leadpro:leadpro@localhost:5432/leadpro"
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


settings = Settings()
