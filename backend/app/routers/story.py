from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Player
from ..schemas import StoryStateOut
from ..engines import story_engine

router = APIRouter(prefix="/story", tags=["story"])


@router.get("/{player_id}/current", response_model=StoryStateOut)
def get_story_state(player_id: int, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(404, "Spieler nicht gefunden")
    return story_engine.build_story_state(player, db)
