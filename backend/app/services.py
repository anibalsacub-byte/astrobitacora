"""Lógica de la bitácora: creación, recálculo trazable, ajustes y estadísticas descriptivas."""
from __future__ import annotations

import statistics
from collections import Counter, defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from .astro.engine import compute_snapshot
from .astro.timeutil import resolve_local_time, timezone_at
from .astro.zodiac import MOON_PHASES, SIGNS
from .db import Entry, EntryRevision, Setting, utcnow
from .schemas import AstroConfig, Moment, Personal, SettingsModel

PERSONAL_FIELDS = list(Personal.model_fields)


# --- Momento + cálculo --------------------------------------------------------------

def resolve_moment(m: Moment) -> tuple[dict, str]:
    tz = m.timezone
    if m.utc_offset_minutes is None and not tz:
        tz = timezone_at(m.latitude, m.longitude) or "UTC"
    info = resolve_local_time(m.local_datetime, tz, m.utc_offset_minutes, m.fold)
    return info, tz or info["timezone"]


def astro_payload(m: Moment, config: AstroConfig) -> dict:
    info, _ = resolve_moment(m)
    snap = compute_snapshot(info["utc"], m.latitude, m.longitude, config.model_dump())
    return {"time": info, "snapshot": snap}


# --- Serialización ------------------------------------------------------------------

def entry_to_dict(e: Entry, include_snapshot: bool = True) -> dict:
    d = {
        "id": e.id,
        "created_at": e.created_at,
        "updated_at": e.updated_at,
        "local_datetime": e.local_datetime,
        "timezone": e.timezone,
        "utc_offset": e.utc_offset,
        "utc_datetime": e.utc_datetime,
        "time_info": e.time_info,
        "location_name": e.location_name,
        "latitude": e.latitude,
        "longitude": e.longitude,
        "astro_config": e.astro_config,
        "is_demo": e.is_demo,
        "revision_count": len(e.revisions),
        "personal": {f: getattr(e, f) for f in PERSONAL_FIELDS},
        "summary": {
            z: {
                "sun": e.astro_snapshot[z]["summary"]["surya"],
                "moon": e.astro_snapshot[z]["summary"]["chandra"],
                "asc": e.astro_snapshot[z]["summary"]["lagna"],
            }
            for z in ("tropical", "sidereal")
        },
        "moon_phase": e.astro_snapshot["tropical"]["moon_phase"]["name"],
    }
    if include_snapshot:
        d["astro_snapshot"] = e.astro_snapshot
    return d


def _apply_moment(e: Entry, m: Moment, config: AstroConfig) -> None:
    payload = astro_payload(m, config)
    info = payload["time"]
    e.local_datetime = info["local"]
    e.timezone = info["timezone"]
    e.utc_offset = info["utc_offset"]
    e.utc_datetime = info["utc"]
    e.time_info = info
    e.location_name = m.location_name or f"{m.latitude:.4f}, {m.longitude:.4f}"
    e.latitude = m.latitude
    e.longitude = m.longitude
    e.astro_config = config.model_dump()
    e.astro_snapshot = payload["snapshot"]


def create_entry(db: Session, m: Moment, config: AstroConfig, personal: Personal, is_demo: bool = False) -> Entry:
    e = Entry(is_demo=is_demo)
    _apply_moment(e, m, config)
    for f in PERSONAL_FIELDS:
        setattr(e, f, getattr(personal, f))
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


def update_personal(db: Session, e: Entry, personal: Personal) -> Entry:
    for f in PERSONAL_FIELDS:
        setattr(e, f, getattr(personal, f))
    e.updated_at = utcnow()
    db.commit()
    return e


def recalculate_entry(db: Session, e: Entry, m: Moment, config: AstroConfig | None, reason: str) -> Entry:
    previous = {
        "local_datetime": e.local_datetime,
        "timezone": e.timezone,
        "utc_offset": e.utc_offset,
        "utc_datetime": e.utc_datetime,
        "time_info": e.time_info,
        "location_name": e.location_name,
        "latitude": e.latitude,
        "longitude": e.longitude,
        "astro_config": e.astro_config,
        "astro_snapshot": e.astro_snapshot,
    }
    cfg = config or AstroConfig(**e.astro_config)
    _apply_moment(e, m, cfg)
    changes = {
        k: {"antes": previous[k], "después": getattr(e, k)}
        for k in ("local_datetime", "timezone", "utc_datetime", "location_name", "latitude", "longitude", "astro_config")
        if previous[k] != getattr(e, k)
    }
    e.revisions.append(EntryRevision(reason=reason, previous=previous, changes=changes))
    e.updated_at = utcnow()
    db.commit()
    db.refresh(e)
    return e


# --- Ajustes ------------------------------------------------------------------------

def get_settings(db: Session) -> SettingsModel:
    row = db.get(Setting, "app")
    return SettingsModel(**(row.value if row else {}))


def save_settings(db: Session, s: SettingsModel) -> SettingsModel:
    row = db.get(Setting, "app")
    if row:
        row.value = s.model_dump()
    else:
        db.add(Setting(key="app", value=s.model_dump()))
    db.commit()
    return s


# --- Búsqueda -----------------------------------------------------------------------

def search_entries(db: Session, date_from=None, date_to=None, tag=None, q=None, mood=None) -> list[Entry]:
    stmt = select(Entry).order_by(Entry.local_datetime.desc())
    if date_from:
        stmt = stmt.where(Entry.local_datetime >= date_from)
    if date_to:
        upper = date_to + "T23:59:59" if len(date_to) == 10 else date_to
        stmt = stmt.where(Entry.local_datetime <= upper)
    if mood:
        stmt = stmt.where(Entry.mood == mood)
    rows = list(db.scalars(stmt))
    if tag:
        tag = tag.strip().lower()
        rows = [e for e in rows if tag in (e.tags or [])]
    if q:
        ql = q.lower()
        rows = [
            e for e in rows
            if ql in " ".join([e.what_happened, e.how_felt, e.special, e.notes, e.location_name,
                               " ".join(e.tags or []), " ".join(e.emotions or [])]).lower()
        ]
    return rows


# --- Estadística descriptiva --------------------------------------------------------

SIGN_NAMES = {s[0]: s[1] for s in SIGNS}
MIN_N = 5          # por debajo: no se muestran promedios
SMALL_N = 20       # por debajo: resultados solo orientativos


def reliability(n: int) -> str:
    if n < MIN_N:
        return "insuficiente"
    if n < SMALL_N:
        return "orientativa"
    return "descriptiva"


def _summary(entries: list[Entry]) -> dict:
    n = len(entries)
    moods = [e.mood for e in entries]
    intens = [e.intensity for e in entries if e.intensity is not None]
    rel = reliability(n)
    show = rel != "insuficiente"
    return {
        "n": n,
        "reliability": rel,
        "mood_mean": round(statistics.mean(moods), 2) if show else None,
        "mood_sd": round(statistics.stdev(moods), 2) if show and n > 1 else None,
        "intensity_mean": round(statistics.mean(intens), 2) if show and len(intens) >= MIN_N else None,
    }


def _body(e: Entry, zodiac: str, key: str) -> dict | None:
    for b in e.astro_snapshot[zodiac]["bodies"]:
        if b["key"] == key:
            return b
    if key in e.astro_snapshot[zodiac]["angles"]:
        return e.astro_snapshot[zodiac]["angles"][key]
    return None


def _group_key(e: Entry, zodiac: str, group: str) -> tuple[str, str] | None:
    kind, _, planet = group.partition(":")
    if kind == "sign":
        b = _body(e, zodiac, planet or "moon")
        if not b:
            return None
        label = f"{b['rashi']} ({SIGN_NAMES[b['sign']]})" if zodiac == "sidereal" else SIGN_NAMES[b["sign"]]
        return (b["sign"], label)
    if kind == "phase":
        p = e.astro_snapshot["tropical"]["moon_phase"]
        return (str(p["index"]), p["name"])
    if kind == "retro":
        b = _body(e, zodiac, planet or "mercury")
        if not b:
            return None
        return ("retro", "Retrógrado aparente") if b.get("retrograde") else ("directo", "Directo")
    raise ValueError(f"Agrupación desconocida: {group}")


def _order(group: str, key: str) -> int:
    if group.startswith("sign"):
        return [s[0] for s in SIGNS].index(key)
    if group.startswith("phase"):
        return int(key)
    return 0 if key == "directo" else 1


def analyze(
    entries: list[Entry],
    zodiac: str = "sidereal",
    filters: list[tuple[str, str]] | None = None,
    group: str = "sign:moon",
    period_a: tuple[str, str] | None = None,
    period_b: tuple[str, str] | None = None,
) -> dict:
    for planet, sign in filters or []:
        entries = [e for e in entries if (b := _body(e, zodiac, planet)) and b["sign"] == sign]
    entries = sorted(entries, key=lambda e: e.local_datetime)

    series = [
        {"id": e.id, "local_datetime": e.local_datetime, "mood": e.mood, "intensity": e.intensity,
         "valence": e.special_valence, "is_demo": e.is_demo}
        for e in entries
    ]
    daily: dict[str, list[int]] = defaultdict(list)
    for e in entries:
        daily[e.local_datetime[:10]].append(e.mood)
    daily_avg = [{"date": d, "mood": round(statistics.mean(v), 2), "n": len(v)} for d, v in sorted(daily.items())]

    emo = Counter(x for e in entries for x in (e.emotions or []))
    tags = Counter(x for e in entries for x in (e.tags or []))
    n = len(entries)
    valence = Counter(e.special_valence or "sin_marcar" for e in entries)

    groups: dict[str, list[Entry]] = defaultdict(list)
    labels: dict[str, str] = {}
    for e in entries:
        gk = _group_key(e, zodiac, group)
        if gk:
            groups[gk[0]].append(e)
            labels[gk[0]] = gk[1]
    group_rows = sorted(
        ({"key": k, "label": labels[k], **_summary(v)} for k, v in groups.items()),
        key=lambda r: _order(group, r["key"]),
    )

    periods = None
    if period_a and period_b:
        def in_range(e, r):
            return r[0] <= e.local_datetime[:10] <= r[1]
        a = _summary([e for e in entries if in_range(e, period_a)])
        b = _summary([e for e in entries if in_range(e, period_b)])
        diff = None
        if a["mood_mean"] is not None and b["mood_mean"] is not None:
            diff = round(b["mood_mean"] - a["mood_mean"], 2)
        periods = {"a": {"range": period_a, **a}, "b": {"range": period_b, **b}, "mood_diff": diff}

    warnings = []
    if n < MIN_N:
        warnings.append(f"Solo hay {n} registro(s) con estos filtros: no se calculan promedios.")
    elif n < SMALL_N:
        warnings.append(f"Con {n} registros, cualquier diferencia entre grupos puede deberse al azar.")

    return {
        "n": n,
        "zodiac": zodiac,
        "group": group,
        "overall": _summary(entries),
        "series": series,
        "daily": daily_avg,
        "emotions": [{"emotion": k, "count": c, "pct": round(100 * c / n, 1)} for k, c in emo.most_common()],
        "tags": [{"tag": k, "count": c} for k, c in tags.most_common()],
        "valence": {k: valence.get(k, 0) for k in ("positivo", "negativo", "mixto", "sin_marcar")},
        "groups": group_rows,
        "periods": periods,
        "thresholds": {"min_n": MIN_N, "small_n": SMALL_N},
        "warnings": warnings,
        "disclaimer": (
            "Estas cifras describen asociaciones en tus propios registros. Una coincidencia entre posiciones "
            "planetarias y estados de ánimo no demuestra que los astros los causen."
        ),
        "moon_phases": MOON_PHASES,
    }
