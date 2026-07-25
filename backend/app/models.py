"""
Datenmodell von CityLife AI.

Kernidee: Jeder Player hat pro Stadt (city_id, z.B. "hannover") genau einen
CityState. Dieser CityState ist der Träger der "Stadt entwickelt sich individuell
über die Zeit"-Mechanik (siehe engines/world_engine.py).
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, BigInteger, String, Float, DateTime, ForeignKey, Text, Boolean, JSON
)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String(64), nullable=True)
    display_name = Column(String(128), nullable=False, default="Neuling")

    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    cash = Column(Integer, default=1500)  # Startkapital in Spielwährung ("Talern")
    reputation = Column(Integer, default=0)

    current_city_id = Column(String(64), default="hannover")

    created_at = Column(DateTime, default=utcnow)
    last_login_at = Column(DateTime, default=utcnow)

    story_progress = relationship("StoryProgress", back_populates="player", uselist=False)
    missions = relationship("MissionInstance", back_populates="player")
    properties = relationship("PropertyOwnership", back_populates="player")


class CityState(Base):
    """
    Persistenter, PRO SPIELER individueller Zustand einer Stadt.
    Das ist der Kern des Langzeit-Wachstumsversprechens: gleiche Stadt (gleiche
    Straßen/POIs aus der Karten-Datenbasis), aber jeder Spieler erlebt eine
    unterschiedliche wirtschaftliche/atmosphärische Entwicklung.
    """
    __tablename__ = "city_states"

    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    city_id = Column(String(64), nullable=False, default="hannover")

    # Wirtschaftliche Kennzahlen, 0-100 Skala sofern nicht anders angegeben
    development_level = Column(Float, default=10.0)   # allgemeiner Ausbaugrad
    average_rent_index = Column(Float, default=100.0)  # 100 = Basiswert
    vacancy_rate = Column(Float, default=8.0)           # % Leerstand
    citizen_mood = Column(Float, default=60.0)           # NPC-Stimmung
    traffic_load = Column(Float, default=30.0)           # Verkehrsaufkommen
    event_pressure = Column(Float, default=10.0)         # Wahrscheinlichkeit für Sonderereignisse

    weather = Column(String(32), default="klar")
    season = Column(String(16), default="fruehling")

    last_ticked_at = Column(DateTime, default=utcnow)

    player = relationship("Player")


class StoryProgress(Base):
    __tablename__ = "story_progress"

    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), unique=True, nullable=False)

    current_chapter_id = Column(String(64), default="chapter_01")
    unlocked_chapter_ids = Column(JSON, default=list)
    flags = Column(JSON, default=dict)  # Story-Entscheidungen ("hat_handwerker_gerettet": True, ...)
    updated_at = Column(DateTime, default=utcnow)

    player = relationship("Player", back_populates="story_progress")


class MissionInstance(Base):
    __tablename__ = "mission_instances"

    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)

    template_id = Column(String(64), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(32), nullable=False)  # delivery, taxi, property, story, ...

    target_lat = Column(Float, nullable=True)
    target_lon = Column(Float, nullable=True)
    target_label = Column(String(128), nullable=True)

    reward_cash = Column(Integer, default=0)
    reward_xp = Column(Integer, default=0)

    status = Column(String(16), default="active")  # active, completed, failed, expired
    story_chapter_id = Column(String(64), nullable=True)  # falls Story-relevant

    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    player = relationship("Player", back_populates="missions")


class PropertyOwnership(Base):
    __tablename__ = "property_ownership"

    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)

    building_ref = Column(String(64), nullable=False)  # ID aus der Karten-Datenbasis
    label = Column(String(128), nullable=False)
    purchase_price = Column(Integer, nullable=False)
    monthly_rent_income = Column(Integer, default=0)
    condition = Column(Float, default=100.0)  # Zustand 0-100, sinkt über Zeit
    energy_class = Column(String(4), default="D")

    purchased_at = Column(DateTime, default=utcnow)

    player = relationship("Player", back_populates="properties")


class WorldEvent(Base):
    """Von der Event/Traffic-Agent-Logik erzeugte Vorkommnisse, sichtbar im Frontend."""
    __tablename__ = "world_events"

    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    city_id = Column(String(64), default="hannover")

    kind = Column(String(32), nullable=False)  # marathon, baustelle, unfall, messe, ...
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)

    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
