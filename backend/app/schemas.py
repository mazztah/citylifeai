from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, ConfigDict


class PlayerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int
    username: Optional[str]
    display_name: str
    level: int
    xp: int
    cash: int
    reputation: int
    current_city_id: str


class LoginRequest(BaseModel):
    init_data: str = ""  # Telegram WebApp.initData (roher String); leer erlaubt im Dev-Modus
    dev_telegram_id: Optional[int] = None  # nur genutzt wenn ALLOW_UNVERIFIED_AUTH_IN_DEV
    dev_username: Optional[str] = None


class CityStateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    city_id: str
    development_level: float
    average_rent_index: float
    vacancy_rate: float
    citizen_mood: float
    traffic_load: float
    event_pressure: float
    weather: str
    season: str
    last_ticked_at: datetime


class MissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: str
    title: str
    description: str
    category: str
    target_lat: Optional[float]
    target_lon: Optional[float]
    target_label: Optional[str]
    reward_cash: int
    reward_xp: int
    status: str
    story_chapter_id: Optional[str]


class MissionCompleteRequest(BaseModel):
    mission_id: int


class StoryChapterOut(BaseModel):
    id: str
    order: int
    title: str
    intro: str
    cliffhanger: str
    unlocked: bool
    is_current: bool


class StoryStateOut(BaseModel):
    current_chapter: StoryChapterOut
    all_chapters: list[StoryChapterOut]
    flags: dict[str, Any]


class LeaderboardEntryOut(BaseModel):
    display_name: str
    level: int
    xp: int
    reputation: int
    city_id: str
