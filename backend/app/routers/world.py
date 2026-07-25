from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Player, WorldEvent
from ..schemas import CityStateOut
from ..engines import world_engine

router = APIRouter(prefix="/world", tags=["world"])


@router.get("/{player_id}/state", response_model=CityStateOut)
def get_city_state(player_id: int, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(404, "Spieler nicht gefunden")
    state = world_engine.tick(player, db, player.current_city_id)
    return state


@router.get("/{player_id}/events")
def get_active_events(player_id: int, db: Session = Depends(get_db)):
    events = db.query(WorldEvent).filter(
        WorldEvent.player_id == player_id, WorldEvent.active == True  # noqa: E712
    ).order_by(WorldEvent.created_at.desc()).limit(10).all()
    return [
        {
            "id": e.id, "kind": e.kind, "title": e.title,
            "description": e.description, "created_at": e.created_at,
        }
        for e in events
    ]
