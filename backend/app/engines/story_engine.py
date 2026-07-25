import json
from functools import lru_cache
from pathlib import Path

from sqlalchemy.orm import Session

from ..models import Player, StoryProgress

CHAPTERS_PATH = Path(__file__).resolve().parent.parent / "data" / "story_chapters.json"


@lru_cache
def _load_chapters() -> list[dict]:
    with open(CHAPTERS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return sorted(data["chapters"], key=lambda c: c["order"])


def get_or_create_progress(player: Player, db: Session) -> StoryProgress:
    progress = player.story_progress
    if not progress:
        chapters = _load_chapters()
        first_id = chapters[0]["id"]
        progress = StoryProgress(
            player_id=player.id,
            current_chapter_id=first_id,
            unlocked_chapter_ids=[first_id],
            flags={},
        )
        db.add(progress)
        db.commit()
        db.refresh(progress)
    return progress


def sync_unlocks(player: Player, db: Session) -> StoryProgress:
    """Prüft anhand der aktuellen XP, ob neue Kapitel freigeschaltet werden sollten."""
    progress = get_or_create_progress(player, db)
    chapters = _load_chapters()

    unlocked = set(progress.unlocked_chapter_ids or [])
    changed = False
    for chapter in chapters:
        if player.xp >= chapter["unlock_xp"] and chapter["id"] not in unlocked:
            unlocked.add(chapter["id"])
            progress.current_chapter_id = chapter["id"]  # neuestes Kapitel wird "aktuell"
            changed = True

    if changed:
        progress.unlocked_chapter_ids = sorted(
            unlocked, key=lambda cid: next(c["order"] for c in chapters if c["id"] == cid)
        )
        db.commit()
        db.refresh(progress)
    return progress


def build_story_state(player: Player, db: Session) -> dict:
    progress = sync_unlocks(player, db)
    chapters = _load_chapters()
    unlocked_ids = set(progress.unlocked_chapter_ids or [])

    chapter_outs = []
    current = None
    for chapter in chapters:
        out = {
            "id": chapter["id"],
            "order": chapter["order"],
            "title": chapter["title"],
            "intro": chapter["intro"],
            "cliffhanger": chapter["cliffhanger"],
            "unlocked": chapter["id"] in unlocked_ids,
            "is_current": chapter["id"] == progress.current_chapter_id,
        }
        chapter_outs.append(out)
        if out["is_current"]:
            current = out

    return {
        "current_chapter": current or chapter_outs[0],
        "all_chapters": chapter_outs,
        "flags": progress.flags or {},
    }


def get_mission_chain_for_current_chapter(player: Player, db: Session) -> list[str]:
    progress = sync_unlocks(player, db)
    chapters = _load_chapters()
    chapter = next(c for c in chapters if c["id"] == progress.current_chapter_id)
    return chapter.get("mission_chain", [])
