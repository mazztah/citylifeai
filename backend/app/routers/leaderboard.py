from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Player
from ..schemas import LeaderboardEntryOut

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[LeaderboardEntryOut])
def get_leaderboard(city_id: str = "hannover", limit: int = 10, db: Session = Depends(get_db)):
    players = (
        db.query(Player)
        .filter(Player.current_city_id == city_id)
        .order_by(Player.xp.desc())
        .limit(limit)
        .all()
    )
    return [
        LeaderboardEntryOut(
            display_name=p.display_name, level=p.level, xp=p.xp,
            reputation=p.reputation, city_id=p.current_city_id,
        )
        for p in players
    ]
