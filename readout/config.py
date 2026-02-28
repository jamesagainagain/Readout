from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "readout:1.0"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    google_ai_api_key: str = ""

    frontend_origin: str = "http://localhost:8080"
    elevenlabs_api_key: str = ""

    # Dust.tt for Claude access
    dust_api_key: str = ""
    dust_workspace_id: str = ""
    dust_model: str = "claude-4.5-sonnet"

    class Config:
        env_file = ".env"


settings = Settings()
