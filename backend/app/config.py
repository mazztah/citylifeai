"""Zentrale Konfiguration. Werte kommen aus Umgebungsvariablen / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"

    # Fällt auf lokales SQLite zurück, wenn keine DATABASE_URL gesetzt ist –
    # dadurch läuft "uvicorn app.main:app" ohne jede weitere Infrastruktur.
    DATABASE_URL: str = "sqlite:///./citylife.db"

    TELEGRAM_BOT_TOKEN: str = ""

    # Erlaubt es, die Telegram-initData-Prüfung im Dev-Modus zu überspringen,
    # damit man das Frontend auch außerhalb von Telegram im Browser testen kann.
    ALLOW_UNVERIFIED_AUTH_IN_DEV: bool = True

    # Weltzeit-Faktor: wie viele Spielminuten pro echter Sekunde vergehen (HUD-Uhr)
    GAME_TIME_SCALE_MINUTES_PER_REAL_SECOND: float = 2.0

    # Wie oft (in echten Stunden) sich der City-State mindestens neu bewertet,
    # wenn ein Spieler sich einloggt (siehe world_engine.tick)
    WORLD_TICK_MIN_INTERVAL_HOURS: float = 1.0


settings = Settings()
