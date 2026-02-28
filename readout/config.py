from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "readout:1.0"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    anthropic_api_key: str = ""
    google_ai_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
