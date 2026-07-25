"""
Mission-Engine.

Zwei Quellen für Missionen:
1. Story-Missionen: fest definiert in `STORY_MISSION_TEMPLATES`, referenziert über
   die mission_chain des aktuellen Story-Kapitels (siehe story_engine).
2. Freie Missionen: aus `FREE_MISSION_TEMPLATES` zufällig generiert, aber gewichtet
   nach dem aktuellen CityState (z.B. mehr Taxi-Aufträge bei Regen, mehr
   Sanierungsmissionen bei hohem Leerstand) - das ist die Stelle, an der später der
   "Mission Agent" (LLM) die Freitext-Beschreibungen dynamisch statt aus der Vorlage
   generieren kann, ohne die restliche Architektur zu ändern.
"""
import random
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import Player, CityState, MissionInstance
from . import story_engine

# Reale Koordinaten zentraler Hannover-Orte (Ziel-Anker für Missionen)
LANDMARKS = {
    "Hauptbahnhof": (52.3769, 9.7410),
    "Kroepcke": (52.3745, 9.7389),
    "Neues Rathaus": (52.3673, 9.7370),
    "Maschsee": (52.3608, 9.7355),
    "Eilenriede": (52.3811, 9.7601),
    "Lister Meile": (52.3838, 9.7477),
    "Steintor": (52.3755, 9.7320),
    "Aegidientorplatz": (52.3695, 9.7425),
}

STORY_MISSION_TEMPLATES = {
    "m01_hauptbahnhof_ankunft": dict(
        title="Ankunft am Hauptbahnhof",
        description="Fahre zum Hauptbahnhof Hannover und hole das Kuvert deiner Großtante ab.",
        category="story", landmark="Hauptbahnhof", reward_cash=50, reward_xp=40,
    ),
    "m01_kroepcke_erkunden": dict(
        title="Der Kröpcke",
        description="Erkunde den Kröpcke - das Herz der Stadt - und finde den Weg zur List.",
        category="story", landmark="Kroepcke", reward_cash=30, reward_xp=30,
    ),
    "m01_haus_besichtigen": dict(
        title="Das geerbte Haus",
        description="Fahre in die List und besichtige das Haus deiner Großtante zum ersten Mal.",
        category="story", landmark="Lister Meile", reward_cash=0, reward_xp=80,
    ),
    "m02_voss_treffen": dict(
        title="Herr Voss",
        description="Triff den Makler Herrn Voss am Kröpcke und höre dir sein Angebot an.",
        category="story", landmark="Kroepcke", reward_cash=0, reward_xp=60,
    ),
    "m02_ilkin_befragen": dict(
        title="Frau Ilkin",
        description="Sprich mit deiner Nachbarin Frau Ilkin über die Geschichte des Hauses.",
        category="story", landmark="Lister Meile", reward_cash=0, reward_xp=60,
    ),
    "m02_keller_durchsuchen": dict(
        title="Der Keller",
        description="Durchsuche den Keller des geerbten Hauses nach alten Bauunterlagen.",
        category="story", landmark="Lister Meile", reward_cash=0, reward_xp=100,
    ),
    "m03_erste_sanierung": dict(
        title="Erste Sanierung",
        description="Beauftrage einen Handwerker für die erste Sanierung im Haus.",
        category="property", landmark="Lister Meile", reward_cash=-200, reward_xp=90,
    ),
    "m03_taxi_auftraege": dict(
        title="Kapital beschaffen",
        description="Nimm drei Taxi-Aufträge in der Innenstadt an, um Kapital zu sammeln.",
        category="taxi", landmark="Aegidientorplatz", reward_cash=180, reward_xp=70,
    ),
    "m03_zugemauerte_tuer": dict(
        title="Die zugemauerte Tür",
        description="Öffne die zugemauerte Tür im Erdgeschoss und untersuche, was dahinter liegt.",
        category="story", landmark="Lister Meile", reward_cash=0, reward_xp=120,
    ),
    "m04_grosstante_akten": dict(
        title="Akten der Großtante",
        description="Suche im Stadtarchiv nahe dem Neuen Rathaus nach den alten Streit-Akten von 'M.'",
        category="story", landmark="Neues Rathaus", reward_cash=0, reward_xp=110,
    ),
    "m04_viertel_befragen": dict(
        title="Das Viertel befragen",
        description="Sprich mit weiteren Eigentümern entlang der markierten Grundstücke.",
        category="story", landmark="Steintor", reward_cash=0, reward_xp=110,
    ),
    "m04_voss_angebot": dict(
        title="Voss' zweites Angebot",
        description="Triff Herrn Voss erneut - diesmal mit einem Jobangebot statt einem Kaufangebot.",
        category="story", landmark="Kroepcke", reward_cash=0, reward_xp=130,
    ),
    "m05_nachbarschaft_organisieren": dict(
        title="Die Nachbarschaft organisieren",
        description="Bringe die verbliebenen Eigentümer an einen Tisch und plant gemeinsam vor.",
        category="story", landmark="Lister Meile", reward_cash=0, reward_xp=200,
    ),
    "m05_investoren_gegenangebot": dict(
        title="Das Gegenangebot",
        description="Verhandle mit der Investorengruppe über die Zukunft der sieben Grundstücke.",
        category="story", landmark="Neues Rathaus", reward_cash=0, reward_xp=200,
    ),
}

FREE_MISSION_TEMPLATES = [
    dict(id="f_delivery_paket", title="Paket ausliefern",
         description="Liefere ein Paket zum {landmark}.", category="delivery",
         reward_cash=(40, 90), reward_xp=(15, 30)),
    dict(id="f_coffee_run", title="Kaffee holen",
         description="Hole Kaffee für einen NPC am {landmark}.", category="delivery",
         reward_cash=(20, 40), reward_xp=(10, 20)),
    dict(id="f_taxi_ride", title="Taxifahrt",
         description="Bring einen Fahrgast zum {landmark}.", category="taxi",
         reward_cash=(30, 70), reward_xp=(10, 25)),
    dict(id="f_photo", title="Fotomission",
         description="Mache ein Foto vom {landmark} für einen Stadtführer.", category="photo",
         reward_cash=(15, 35), reward_xp=(10, 20)),
    dict(id="f_property_scout", title="Immobilien sichten",
         description="Besichtige ein leerstehendes Gebäude nahe {landmark}.", category="property",
         reward_cash=(0, 0), reward_xp=(20, 40)),
    dict(id="f_shopping", title="Einkäufe erledigen",
         description="Erledige Einkäufe für einen Anwohner nahe {landmark}.", category="shopping",
         reward_cash=(20, 50), reward_xp=(10, 20)),
]


def _weighted_free_templates(city_state: CityState) -> list[dict]:
    """Gewichtet freie Missionstypen nach City-State (mehr Taxi bei Regen,
    mehr Immobilien-Scouting bei hohem Leerstand, etc.)."""
    weighted = []
    for tpl in FREE_MISSION_TEMPLATES:
        weight = 1.0
        if tpl["category"] == "taxi" and city_state.weather == "regen":
            weight *= 2.5
        if tpl["category"] == "property" and city_state.vacancy_rate > 12:
            weight *= 2.0
        if tpl["category"] == "delivery" and city_state.traffic_load > 60:
            weight *= 0.6  # weniger attraktiv wenn Verkehr chaotisch ist
        weighted.extend([tpl] * max(1, round(weight * 2)))
    return weighted


def generate_story_mission(player: Player, template_id: str, chapter_id: str, db: Session) -> MissionInstance:
    tpl = STORY_MISSION_TEMPLATES[template_id]
    lat, lon = LANDMARKS[tpl["landmark"]]
    mission = MissionInstance(
        player_id=player.id,
        template_id=template_id,
        title=tpl["title"],
        description=tpl["description"],
        category=tpl["category"],
        target_lat=lat,
        target_lon=lon,
        target_label=tpl["landmark"],
        reward_cash=tpl["reward_cash"],
        reward_xp=tpl["reward_xp"],
        story_chapter_id=chapter_id,
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)
    return mission


def generate_free_mission(player: Player, city_state: CityState, db: Session) -> MissionInstance:
    tpl = random.choice(_weighted_free_templates(city_state))
    landmark_name, (lat, lon) = random.choice(list(LANDMARKS.items()))
    mission = MissionInstance(
        player_id=player.id,
        template_id=tpl["id"],
        title=tpl["title"],
        description=tpl["description"].format(landmark=landmark_name),
        category=tpl["category"],
        target_lat=lat,
        target_lon=lon,
        target_label=landmark_name,
        reward_cash=random.randint(*tpl["reward_cash"]),
        reward_xp=random.randint(*tpl["reward_xp"]),
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)
    return mission


def ensure_active_missions(player: Player, city_state: CityState, db: Session, target_count: int = 4) -> list[MissionInstance]:
    """Stellt sicher, dass der Spieler genug aktive Missionen hat: zuerst die nächste
    unerledigte Story-Mission der aktuellen Kette, dann freie Missionen zum Auffüllen."""
    active = db.query(MissionInstance).filter(
        MissionInstance.player_id == player.id, MissionInstance.status == "active"
    ).all()

    if not any(m.category == "story" for m in active):
        chain = story_engine.get_mission_chain_for_current_chapter(player, db)
        done_ids = {m.template_id for m in db.query(MissionInstance).filter(
            MissionInstance.player_id == player.id, MissionInstance.status == "completed"
        ).all()}
        next_template = next((t for t in chain if t not in done_ids), None)
        if next_template:
            progress = story_engine.get_or_create_progress(player, db)
            new_mission = generate_story_mission(player, next_template, progress.current_chapter_id, db)
            active.append(new_mission)

    while len(active) < target_count:
        active.append(generate_free_mission(player, city_state, db))

    return active


def complete_mission(player: Player, mission: MissionInstance, db: Session) -> Player:
    if mission.status != "active":
        return player
    mission.status = "completed"
    mission.completed_at = datetime.now(timezone.utc)

    player.cash += mission.reward_cash
    player.xp += mission.reward_xp
    player.reputation += 1 if mission.category == "story" else 0

    # Einfache Level-Kurve: 200 XP pro Level
    new_level = 1 + player.xp // 200
    player.level = max(player.level, new_level)

    db.commit()
    db.refresh(player)
    return player
