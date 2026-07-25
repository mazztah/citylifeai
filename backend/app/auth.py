"""
Verifiziert die von Telegram Mini Apps übergebenen `initData` gemäß dem offiziellen
HMAC-Verfahren (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).

Im Dev-Modus (ALLOW_UNVERIFIED_AUTH_IN_DEV=True) kann das Frontend stattdessen eine
dev_telegram_id mitschicken, damit man ohne echten Telegram-Client entwickeln kann.
"""
import hashlib
import hmac
from urllib.parse import parse_qsl

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Player
from .schemas import LoginRequest


def verify_telegram_init_data(init_data: str, bot_token: str) -> dict:
    """Gibt die geparsten Felder zurück, wenn die Signatur gültig ist, sonst raise."""
    parsed = dict(parse_qsl(init_data, strict_parsing=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise ValueError("kein hash-Feld in initData")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise ValueError("initData Signatur ungültig")

    return parsed


def resolve_or_create_player(login: LoginRequest, db: Session) -> Player:
    telegram_id: int
    username: str | None = None

    if login.init_data and settings.TELEGRAM_BOT_TOKEN:
        try:
            parsed = verify_telegram_init_data(login.init_data, settings.TELEGRAM_BOT_TOKEN)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
        import json
        user_obj = json.loads(parsed.get("user", "{}"))
        telegram_id = user_obj.get("id")
        username = user_obj.get("username")
    elif settings.ALLOW_UNVERIFIED_AUTH_IN_DEV and login.dev_telegram_id:
        telegram_id = login.dev_telegram_id
        username = login.dev_username or f"dev_{telegram_id}"
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Keine gültige Telegram-Authentifizierung und kein Dev-Fallback verfügbar.",
        )

    player = db.query(Player).filter(Player.telegram_id == telegram_id).first()
    if not player:
        player = Player(telegram_id=telegram_id, username=username, display_name=username or "Neuling")
        db.add(player)
        db.commit()
        db.refresh(player)
    return player
