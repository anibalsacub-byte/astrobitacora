"""Persistencia local con SQLAlchemy (SQLite por defecto; ASTRO_DB_URL permite PostgreSQL)."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_URL = os.environ.get("ASTRO_DB_URL", f"sqlite:///{DATA_DIR / 'astrobitacora.db'}")

engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})

if DB_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(conn, _):
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class Base(DeclarativeBase):
    pass


class Entry(Base):
    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utcnow)
    updated_at: Mapped[str] = mapped_column(String(32), default=utcnow)

    # Momento y lugar (datos astronómicos, solo cambian con un recálculo explícito)
    local_datetime: Mapped[str] = mapped_column(String(32), index=True)
    timezone: Mapped[str] = mapped_column(String(64))
    utc_offset: Mapped[str] = mapped_column(String(16))
    utc_datetime: Mapped[str] = mapped_column(String(32), index=True)
    time_info: Mapped[dict] = mapped_column(JSON)
    location_name: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    astro_config: Mapped[dict] = mapped_column(JSON)
    astro_snapshot: Mapped[dict] = mapped_column(JSON)

    # Parte personal (editable)
    mood: Mapped[int] = mapped_column(Integer)
    emotions: Mapped[list] = mapped_column(JSON, default=list)
    intensity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    what_happened: Mapped[str] = mapped_column(Text, default="")
    how_felt: Mapped[str] = mapped_column(Text, default="")
    special: Mapped[str] = mapped_column(Text, default="")
    special_valence: Mapped[str] = mapped_column(String(16), default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    sleep_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    energy: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    revisions: Mapped[list["EntryRevision"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan", order_by="EntryRevision.id"
    )


class EntryRevision(Base):
    """Trazabilidad de recálculos astronómicos: guarda los datos previos completos."""
    __tablename__ = "entry_revisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id", ondelete="CASCADE"), index=True)
    changed_at: Mapped[str] = mapped_column(String(32), default=utcnow)
    reason: Mapped[str] = mapped_column(Text, default="")
    previous: Mapped[dict] = mapped_column(JSON)
    changes: Mapped[dict] = mapped_column(JSON)

    entry: Mapped[Entry] = relationship(back_populates="revisions")


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON)


def init_db() -> None:
    Base.metadata.create_all(engine)
