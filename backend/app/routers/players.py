from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import resolve_or_create_player
from ..schemas import PlayerOut, LoginRequest
from ..engines import world_engine
from datetime import datetime, timezone

router = APIRouter(prefix="/players", tags=["players"])


@router.post("/login", response_model=PlayerOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    player = resolve_or_create_player(payload, db)
    player.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(player)

    # Bei jedem Login wird die individuelle Stadtentwicklung nachgeholt (catch-up tick)
    world_engine.tick(player, db, player.current_city_id)

    return player


@router.get("/{player_id}", response_model=PlayerOut)
def get_player(player_id: int, db: Session = Depends(get_db)):
    from ..models import Player
    from fastapi import HTTPException
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(404, "Spieler nicht gefunden")
    return player
