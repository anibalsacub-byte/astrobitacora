from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

EMOTIONS = [
    "Alegría", "Tristeza", "Ansiedad", "Tranquilidad", "Enojo",
    "Entusiasmo", "Cansancio", "Motivación", "Nostalgia", "Gratitud",
]
MOODS = {1: "Muy mal", 2: "Mal", 3: "Neutral", 4: "Bien", 5: "Muy bien"}


class AstroConfig(BaseModel):
    zodiac: Literal["tropical", "sidereal"] = "sidereal"
    ayanamsa: Literal["lahiri", "raman", "krishnamurti", "fagan_bradley"] = "lahiri"
    house_system: Literal["P", "W", "K", "E", "O", "R", "C"] = "W"
    node_type: Literal["mean", "true"] = "true"


class Moment(BaseModel):
    local_datetime: str = Field(..., description="YYYY-MM-DDTHH:MM[:SS] en hora local")
    timezone: str | None = None
    utc_offset_minutes: int | None = None
    fold: Literal[0, 1] = 0
    location_name: str = ""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class ChartRequest(Moment):
    config: AstroConfig = AstroConfig()


class NowRequest(BaseModel):
    timezone: str | None = None
    location_name: str = ""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    config: AstroConfig = AstroConfig()


class Personal(BaseModel):
    mood: int = Field(..., ge=1, le=5)
    emotions: list[str] = []
    intensity: int | None = Field(None, ge=1, le=10)
    what_happened: str = ""
    how_felt: str = ""
    special: str = ""
    special_valence: Literal["", "positivo", "negativo", "mixto"] = ""
    tags: list[str] = []
    sleep_hours: float | None = Field(None, ge=0, le=24)
    energy: int | None = Field(None, ge=1, le=10)
    stress: int | None = Field(None, ge=1, le=10)
    notes: str = ""

    @field_validator("tags")
    @classmethod
    def _clean_tags(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for t in v:
            t = t.strip().lower()
            if t and t not in out:
                out.append(t[:40])
        return out

    @field_validator("emotions")
    @classmethod
    def _clean_emotions(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for e in v:
            e = e.strip()
            if e and e not in out:
                out.append(e[:40])
        return out


class EntryCreate(Moment):
    config: AstroConfig = AstroConfig()
    personal: Personal


class QuickEntry(BaseModel):
    personal: Personal
    place: dict | None = None  # {name, latitude, longitude, timezone}; si falta, la predeterminada


class Recalculate(Moment):
    config: AstroConfig | None = None
    reason: str = ""


class SettingsModel(BaseModel):
    config: AstroConfig = AstroConfig()
    chart_style: Literal["north", "south", "wheel"] = "south"
    show_nodes: bool = True
    default_location: dict | None = None  # {name, latitude, longitude, timezone}
    online_geocoding: bool = True
    custom_tags: list[str] = ["trabajo", "familia", "relaciones", "salud", "viajes", "estudios", "proyectos"]
    custom_emotions: list[str] = []
