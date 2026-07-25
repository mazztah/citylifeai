"""
World Engine - macht wahr, was im Konzept "Und das Besondere: jede Stadt der Welt
wäre spielbar [...] jede Stadt könnte sich für jeden Spieler über die Zeit
unterschiedlich entwickeln" gefordert wurde.

Prinzip: Der CityState eines Spielers wird NICHT laufend im Hintergrund simuliert
(das würde einen Dauer-Scheduler für potenziell Millionen Spieler brauchen), sondern
"lazy" beim nächsten Kontakt mit dem Spieler (Login, Missionsabschluss) um die
seit dem letzten Tick vergangene REALE Zeit weiterentwickelt ("catch-up tick").
Das ist server-seitig günstig und funktioniert unabhängig davon, wie oft der
Spieler tatsächlich einloggt.

Einflussfaktoren auf die Entwicklung:
- Wie viele Missionen der Spieler erledigt hat (Aktivität -> mehr development_level)
- Wie viele Immobilien er besitzt und in welchem Zustand (viele + gepflegt -> weniger
  vacancy_rate, mehr average_rent_index)
- Story-Entscheidungen (Flags aus story_progress, z.B. "hat_nachbarschaft_organisiert")
- Zufällige Wetter-/Saison-/Ereignis-Übergänge

Dadurch verläuft jede Stadt für jeden Spieler unterschiedlich, obwohl die
Karten-/Straßendatenbasis identisch ist.
"""
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Player, CityState, PropertyOwnership, StoryProgress, WorldEvent

WEATHER_STATES = ["klar", "bewoelkt", "regen", "nebel", "schnee"]
SEASONS = ["fruehling", "sommer", "herbst", "winter"]

EVENT_TEMPLATES = [
    dict(kind="baustelle", title="Neue Baustelle",
         description="Auf einer Hauptstraße beginnt eine Baustelle - der Verkehr staut sich."),
    dict(kind="marathon", title="Stadtlauf",
         description="Ein Stadtlauf sperrt mehrere Straßen im Zentrum."),
    dict(kind="messe", title="Messe in der Stadt",
         description="Eine Messe sorgt für mehr Besucher und mehr Taxiaufträge."),
    dict(kind="unfall", title="Verkehrsunfall",
         description="Ein kleinerer Unfall sorgt kurzzeitig für Verzögerungen."),
]


def get_or_create_city_state(player: Player, db: Session, city_id: str = "hannover") -> CityState:
    state = db.query(CityState).filter(
        CityState.player_id == player.id, CityState.city_id == city_id
    ).first()
    if state:
        return state
    state = CityState(player_id=player.id, city_id=city_id)
    db.add(state)
    try:
        db.commit()
        db.refresh(state)
    except IntegrityError:
        db.rollback()
        state = db.query(CityState).filter(
            CityState.player_id == player.id, CityState.city_id == city_id
        ).first()
        if not state:
            raise
    return state


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def tick(player: Player, db: Session, city_id: str = "hannover") -> CityState:
    """Führt einen "Catch-up"-Tick durch: entwickelt den CityState um die seit dem
    letzten Tick vergangene reale Zeit weiter. Wird sicher mehrfach aufgerufen -
    ändert nichts, wenn das Mindestintervall noch nicht erreicht ist."""
    state = get_or_create_city_state(player, db, city_id)

    now = datetime.now(timezone.utc)
    last_ticked = state.last_ticked_at
    if last_ticked and last_ticked.tzinfo is None:
        last_ticked = last_ticked.replace(tzinfo=timezone.utc)
    elapsed_hours = (now - last_ticked).total_seconds() / 3600 if last_ticked else 999

    if elapsed_hours < settings.WORLD_TICK_MIN_INTERVAL_HOURS:
        return state

    steps = min(int(elapsed_hours // settings.WORLD_TICK_MIN_INTERVAL_HOURS), 72)  # Deckel gegen riesige Sprünge
    if steps <= 0:
        return state

    properties = db.query(PropertyOwnership).filter(PropertyOwnership.player_id == player.id).all()
    story_progress = db.query(StoryProgress).filter(StoryProgress.player_id == player.id).first()
    flags = (story_progress.flags if story_progress else {}) or {}

    for _ in range(steps):
        _apply_single_step(state, player, properties, flags, db)

    state.last_ticked_at = now
    db.commit()
    db.refresh(state)
    return state


def _apply_single_step(state: CityState, player: Player, properties: list[PropertyOwnership],
                        flags: dict, db: Session) -> None:
    # 1) Aktivität des Spielers treibt allgemeine Entwicklung
    activity_bonus = 0.05 * min(player.reputation, 40)
    state.development_level = _clamp(state.development_level + 0.02 + activity_bonus * 0.01)

    # 2) Immobilienbesitz senkt Leerstand, hebt Mietindex - abhängig vom Zustand
    if properties:
        avg_condition = sum(p.condition for p in properties) / len(properties)
        state.vacancy_rate = _clamp(state.vacancy_rate - (avg_condition / 100) * 0.15, low=1.0)
        state.average_rent_index = _clamp(
            state.average_rent_index + (avg_condition / 100) * 0.2, low=50, high=250
        )
        # Immobilien verfallen langsam ohne Pflege (regt zu Sanierungsmissionen an)
        for p in properties:
            p.condition = _clamp(p.condition - 0.15, low=5)
    else:
        state.vacancy_rate = _clamp(state.vacancy_rate + 0.05, high=40)

    # 3) Story-Entscheidungen wirken sich sichtbar aus
    if flags.get("hat_nachbarschaft_organisiert"):
        state.citizen_mood = _clamp(state.citizen_mood + 0.3)
    if flags.get("ist_investorenseite_beigetreten"):
        state.average_rent_index = _clamp(state.average_rent_index + 0.4, high=250)
        state.citizen_mood = _clamp(state.citizen_mood - 0.3)

    # 4) Verkehr schwankt leicht zufällig, gedämpft durch development_level
    state.traffic_load = _clamp(
        state.traffic_load + random.uniform(-2, 2) + state.development_level * 0.01, high=95
    )

    # 5) Wetter/Saison Übergänge (einfache Markov-Kette)
    if random.random() < 0.2:
        state.weather = random.choice(WEATHER_STATES)
    if random.random() < 0.02:
        idx = SEASONS.index(state.season)
        state.season = SEASONS[(idx + 1) % len(SEASONS)]

    # 6) Event-Druck steigt langsam, kann ein WorldEvent auslösen
    state.event_pressure = _clamp(state.event_pressure + 0.5, high=100)
    if state.event_pressure > 60 and random.random() < 0.3:
        _spawn_event(player, state, db)
        state.event_pressure = 10


def _spawn_event(player: Player, state: CityState, db: Session) -> None:
    tpl = random.choice(EVENT_TEMPLATES)
    event = WorldEvent(
        player_id=player.id,
        city_id=state.city_id,
        kind=tpl["kind"],
        title=tpl["title"],
        description=tpl["description"],
    )
    db.add(event)
    if tpl["kind"] in ("marathon", "unfall", "baustelle"):
        state.traffic_load = _clamp(state.traffic_load + 15, high=95)
    if tpl["kind"] == "messe":
        state.citizen_mood = _clamp(state.citizen_mood + 5)
    db.commit()
