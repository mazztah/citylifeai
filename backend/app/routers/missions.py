from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Player, MissionInstance
from ..schemas import MissionOut, MissionCompleteRequest, PlayerOut
from ..engines import mission_engine, world_engine

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("/{player_id}/active", response_model=list[MissionOut])
def get_active_missions(player_id: int, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(404, "Spieler nicht gefunden")
    city_state = world_engine.get_or_create_city_state(player, db, player.current_city_id)
    missions = mission_engine.ensure_active_missions(player, city_state, db)
    return missions


@router.post("/{player_id}/complete", response_model=PlayerOut)
def complete_mission(player_id: int, payload: MissionCompleteRequest, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(404, "Spieler nicht gefunden")

    mission = db.query(MissionInstance).filter(
        MissionInstance.id == payload.mission_id, MissionInstance.player_id == player_id
    ).first()
    if not mission:
        raise HTTPException(404, "Mission nicht gefunden")

    player = mission_engine.complete_mission(player, mission, db)
    return player
