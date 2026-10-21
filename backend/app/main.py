"""AstroBitácora — API local (FastAPI)."""
from __future__ import annotations

import csv
import io
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import Body, Depends, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import services as S
from .astro.engine import AstroError, compute_chart, julian_day_ut, parse_utc
from .astro.planet_info import NODES_NOTE, PLANETS, SOURCE
from .astro.timeutil import TimeError, resolve_local_time, timezone_at
from .astro.transits import compare_charts
from .astro.zodiac import AYANAMSAS, BODY_KEYS, HOUSE_SYSTEMS, SIGNS, ZODIACS
from .db import Entry, EntryRevision, SessionLocal, init_db, utcnow
from .demo import seed_demo
from .insights import experience_insights, feature_history, period_sky
from .schemas import (
    EMOTIONS, MOODS, AstroConfig, ChartRequest, EntryCreate, NowRequest, Personal, QuickEntry, Recalculate, SettingsModel,
)

APP_VERSION = "0.1.0"
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with SessionLocal() as db:
        seed_demo(db)
    yield


app = FastAPI(title="AstroBitácora", version=APP_VERSION, lifespan=lifespan)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.exception_handler(TimeError)
@app.exception_handler(AstroError)
async def _value_errors(_, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


def _entry_or_404(db: Session, entry_id: int) -> Entry:
    e = db.get(Entry, entry_id)
    if not e:
        raise HTTPException(404, "Entrada no encontrada")
    return e


# --- Metadatos ----------------------------------------------------------------------

@app.get("/api/meta")
def meta():
    import swisseph as swe
    return {
        "version": APP_VERSION,
        "engine": f"Swiss Ephemeris {swe.version}",
        "signs": [{"key": k, "name": n, "symbol": s, "rashi": r} for k, n, s, r in SIGNS],
        "bodies": BODY_KEYS,
        "zodiacs": ZODIACS,
        "ayanamsas": {k: v[1] for k, v in AYANAMSAS.items()},
        "house_systems": HOUSE_SYSTEMS,
        "emotions": EMOTIONS,
        "moods": MOODS,
    }


@app.get("/api/planets/info")
def planets_info():
    return {"source": SOURCE, "planets": PLANETS, "nodes_note": NODES_NOTE}


# --- Cálculo astronómico ------------------------------------------------------------

def _chart_for(info: dict, lat: float, lon: float, cfg: AstroConfig) -> dict:
    jd = julian_day_ut(parse_utc(info["utc"]))
    return compute_chart(jd, lat, lon, cfg.zodiac, cfg.ayanamsa, cfg.house_system, cfg.node_type)


def _with_alt(info: dict, location_name: str, lat: float, lon: float, cfg: AstroConfig) -> dict:
    """Carta en el zodiaco elegido y, aparte, en el otro (la ficha muestra ambos valores)."""
    other = AstroConfig(**{**cfg.model_dump(), "zodiac": "tropical" if cfg.zodiac == "sidereal" else "sidereal"})
    return {"time": info, "location_name": location_name,
            "chart": _chart_for(info, lat, lon, cfg), "alt_chart": _chart_for(info, lat, lon, other)}


@app.post("/api/astro/chart")
def astro_chart(req: ChartRequest):
    info, _ = S.resolve_moment(req)
    return _with_alt(info, req.location_name, req.latitude, req.longitude, req.config)


def _now_info(tz: str) -> dict:
    now_utc = datetime.now(timezone.utc).replace(microsecond=0)
    from zoneinfo import ZoneInfo
    local = now_utc.astimezone(ZoneInfo(tz)).replace(tzinfo=None).isoformat(timespec="seconds")
    return resolve_local_time(local, tz)


@app.post("/api/astro/now")
def astro_now(req: NowRequest):
    """Siempre recalcula con el instante actual del reloj del sistema."""
    tz = req.timezone or timezone_at(req.latitude, req.longitude) or "UTC"
    info = _now_info(tz)
    return _with_alt(info, req.location_name, req.latitude, req.longitude, req.config)


@app.post("/api/astro/compare-now")
def astro_compare_now(natal: ChartRequest, now: NowRequest | None = Body(None)):
    info, _ = S.resolve_moment(natal)
    natal_chart = _chart_for(info, natal.latitude, natal.longitude, natal.config)
    loc = now or NowRequest(latitude=natal.latitude, longitude=natal.longitude, timezone=info["timezone"] if natal.utc_offset_minutes is None else None, config=natal.config)
    tz = loc.timezone or timezone_at(loc.latitude, loc.longitude) or "UTC"
    now_info = _now_info(tz)
    cur = _chart_for(now_info, loc.latitude, loc.longitude, natal.config)
    return {"then": {"time": info, "chart": natal_chart}, "now": {"time": now_info, "chart": cur}, "comparison": compare_charts(natal_chart, cur)}


@app.get("/api/astro/timezone")
def astro_timezone(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return {"timezone": timezone_at(lat, lon)}


# --- Geocodificación (solo envía el texto de búsqueda a OpenStreetMap) --------------

NOMINATIM = "https://nominatim.openstreetmap.org"
UA = {"User-Agent": f"AstroBitacora/{APP_VERSION} (aplicacion local de un solo usuario)"}


@app.get("/api/geo/search")
def geo_search(q: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    if not S.get_settings(db).online_geocoding:
        raise HTTPException(403, "La geocodificación en línea está desactivada en Configuración.")
    try:
        r = httpx.get(f"{NOMINATIM}/search", params={"q": q, "format": "jsonv2", "limit": 6, "accept-language": "es", "addressdetails": 1},
                      headers=UA, timeout=10)
        r.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"No se pudo consultar el servicio de geocodificación: {exc}") from exc
    out = []
    for it in r.json():
        lat, lon = float(it["lat"]), float(it["lon"])
        out.append({"name": it.get("display_name", q), "latitude": lat, "longitude": lon, "timezone": timezone_at(lat, lon)})
    return out


@app.get("/api/geo/reverse")
def geo_reverse(lat: float, lon: float, db: Session = Depends(get_db)):
    tz = timezone_at(lat, lon)
    name = f"{lat:.4f}, {lon:.4f}"
    if S.get_settings(db).online_geocoding:
        try:
            r = httpx.get(f"{NOMINATIM}/reverse", params={"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10, "accept-language": "es"},
                          headers=UA, timeout=10)
            if r.status_code == 200 and r.json().get("display_name"):
                name = r.json()["display_name"]
        except httpx.HTTPError:
            pass
    return {"name": name, "latitude": lat, "longitude": lon, "timezone": tz}


# --- Bitácora -----------------------------------------------------------------------

@app.post("/api/entries", status_code=201)
def create_entry(req: EntryCreate, db: Session = Depends(get_db)):
    e = S.create_entry(db, req, req.config, req.personal)
    return S.entry_to_dict(e)


@app.get("/api/entries")
def list_entries(
    date_from: str | None = None, date_to: str | None = None, tag: str | None = None,
    q: str | None = None, mood: int | None = None, db: Session = Depends(get_db),
):
    return [S.entry_to_dict(e, include_snapshot=False) for e in S.search_entries(db, date_from, date_to, tag, q, mood)]


@app.get("/api/entries/{entry_id}")
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    return S.entry_to_dict(_entry_or_404(db, entry_id))


@app.put("/api/entries/{entry_id}/personal")
def update_personal(entry_id: int, personal: Personal, db: Session = Depends(get_db)):
    """Edita solo la parte personal; los datos astronómicos no se tocan."""
    return S.entry_to_dict(S.update_personal(db, _entry_or_404(db, entry_id), personal))


@app.post("/api/entries/{entry_id}/recalculate")
def recalc(entry_id: int, req: Recalculate, db: Session = Depends(get_db)):
    return S.entry_to_dict(S.recalculate_entry(db, _entry_or_404(db, entry_id), req, req.config, req.reason))


@app.get("/api/entries/{entry_id}/revisions")
def revisions(entry_id: int, db: Session = Depends(get_db)):
    e = _entry_or_404(db, entry_id)
    return [{"id": r.id, "changed_at": r.changed_at, "reason": r.reason, "changes": r.changes} for r in e.revisions]


@app.delete("/api/entries/{entry_id}")
def delete_entry(entry_id: int, confirm: bool = False, db: Session = Depends(get_db)):
    if not confirm:
        raise HTTPException(400, "La eliminación definitiva requiere confirm=true.")
    db.delete(_entry_or_404(db, entry_id))
    db.commit()
    return {"deleted": entry_id}


@app.post("/api/entries/delete-all")
def delete_all(payload: dict = Body(...), db: Session = Depends(get_db)):
    if payload.get("confirm") != "BORRAR TODO":
        raise HTTPException(400, 'Escribe exactamente "BORRAR TODO" para confirmar.')
    db.execute(delete(EntryRevision))
    n = db.execute(delete(Entry)).rowcount
    db.commit()
    return {"deleted": n}


@app.post("/api/entries/{entry_id}/compare-now")
def entry_compare_now(entry_id: int, now: NowRequest | None = Body(None), zodiac: str | None = None, db: Session = Depends(get_db)):
    e = _entry_or_404(db, entry_id)
    z = zodiac or e.astro_config.get("zodiac", "sidereal")
    natal = e.astro_snapshot[z]
    cfg = AstroConfig(**{**e.astro_config, "zodiac": z})
    loc = now or NowRequest(latitude=e.latitude, longitude=e.longitude, timezone=e.timezone if e.timezone != "Desfase manual" else None)
    tz = loc.timezone or timezone_at(loc.latitude, loc.longitude) or "UTC"
    info = _now_info(tz)
    cur = _chart_for(info, loc.latitude, loc.longitude, cfg)
    return {"now": {"time": info, "location_name": loc.location_name or e.location_name, "chart": cur}, "comparison": compare_charts(natal, cur)}


@app.get("/api/calendar")
def calendar(year: int, month: int, db: Session = Depends(get_db)):
    start = f"{year:04d}-{month:02d}-01"
    end = f"{year + (month == 12):04d}-{month % 12 + 1:02d}-01"
    rows = db.scalars(select(Entry).where(Entry.local_datetime >= start, Entry.local_datetime < end).order_by(Entry.local_datetime))
    days: dict[str, dict] = {}
    for e in rows:
        d = days.setdefault(e.local_datetime[:10], {"date": e.local_datetime[:10], "entries": []})
        d["entries"].append({"id": e.id, "time": e.local_datetime[11:16], "mood": e.mood, "is_demo": e.is_demo})
    for d in days.values():
        moods = [x["mood"] for x in d["entries"]]
        d["mood_avg"] = round(sum(moods) / len(moods), 2)
    return list(days.values())


# --- Análisis -----------------------------------------------------------------------

@app.get("/api/stats")
def stats(
    zodiac: str = "sidereal", group: str = "sign:moon",
    date_from: str | None = None, date_to: str | None = None, tag: str | None = None,
    filters: list[str] = Query(default=[]),
    a_from: str | None = None, a_to: str | None = None, b_from: str | None = None, b_to: str | None = None,
    include_demo: bool = True, db: Session = Depends(get_db),
):
    if zodiac not in ZODIACS:
        raise HTTPException(422, "Zodiaco no válido")
    entries = S.search_entries(db, date_from, date_to, tag)
    if not include_demo:
        entries = [e for e in entries if not e.is_demo]
    flt = [tuple(f.split(":", 1)) for f in filters if ":" in f]
    pa = (a_from, a_to) if a_from and a_to else None
    pb = (b_from, b_to) if b_from and b_to else None
    try:
        return S.analyze(entries, zodiac, flt, group, pa, pb)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


# --- Registro rápido y exploración de experiencias ----------------------------------

@app.post("/api/entries/quick", status_code=201)
def quick_entry(req: QuickEntry, db: Session = Depends(get_db)):
    """Registro del momento actual: usa la ubicación indicada o la predeterminada."""
    settings = S.get_settings(db)
    loc = req.place or settings.default_location
    if not loc:
        raise HTTPException(422, "Falta la ubicación: elige una ciudad o define una ubicación predeterminada.")
    lat, lon = float(loc["latitude"]), float(loc["longitude"])
    tz = loc.get("timezone") or timezone_at(lat, lon) or "UTC"
    info = _now_info(tz)
    from .schemas import Moment
    m = Moment(local_datetime=info["local"], timezone=tz, location_name=loc.get("name", ""), latitude=lat, longitude=lon)
    e = S.create_entry(db, m, settings.config, req.personal)
    return S.entry_to_dict(e)


def _filtered(db: Session, include_demo: bool, **kw) -> list[Entry]:
    rows = S.search_entries(db, kw.get("date_from"), kw.get("date_to"), kw.get("tag"), kw.get("q"))
    return rows if include_demo else [e for e in rows if not e.is_demo]


@app.get("/api/insights/experience")
def insights_experience(
    emotion: list[str] = Query(default=[]), tag: str | None = None, valence: str | None = None,
    mood_max: int | None = None, mood_min: int | None = None, q: str | None = None,
    date_from: str | None = None, date_to: str | None = None,
    zodiac: str = "sidereal", include_demo: bool = False, db: Session = Depends(get_db),
):
    if zodiac not in ZODIACS:
        raise HTTPException(422, "Zodiaco no válido")
    all_entries = _filtered(db, include_demo)
    matched = _filtered(db, include_demo, date_from=date_from, date_to=date_to, tag=tag, q=q)
    if emotion:
        matched = [e for e in matched if all(x in (e.emotions or []) for x in emotion)]
    if valence:
        matched = [e for e in matched if e.special_valence == valence]
    if mood_max:
        matched = [e for e in matched if e.mood <= mood_max]
    if mood_min:
        matched = [e for e in matched if e.mood >= mood_min]
    return {
        **experience_insights(matched, all_entries, zodiac),
        "entries": [S.entry_to_dict(e, include_snapshot=False) for e in matched],
    }


@app.get("/api/insights/period")
def insights_period(date_from: str, date_to: str, zodiac: str = "sidereal", include_demo: bool = False, db: Session = Depends(get_db)):
    from datetime import date as _date
    try:
        d0, d1 = _date.fromisoformat(date_from), _date.fromisoformat(date_to)
    except ValueError as exc:
        raise HTTPException(422, "Fechas no válidas") from exc
    if d1 < d0 or (d1 - d0).days > 92:
        raise HTTPException(422, "El periodo debe tener entre 1 y 93 días.")
    if zodiac not in ZODIACS:
        raise HTTPException(422, "Zodiaco no válido")
    settings = S.get_settings(db)
    tz = (settings.default_location or {}).get("timezone") or "UTC"
    entries = sorted(_filtered(db, include_demo, date_from=date_from, date_to=date_to), key=lambda e: e.local_datetime)
    all_entries = _filtered(db, include_demo)
    in_period = {e.id for e in entries}
    others = [e for e in all_entries if e.id not in in_period]
    sky = period_sky(d0, d1, tz, zodiac, settings.config.ayanamsa, settings.config.node_type)

    from collections import Counter
    days: dict[str, list[int]] = {}
    for e in entries:
        days.setdefault(e.local_datetime[:10], []).append(e.mood)
    emo = Counter(x for e in entries for x in (e.emotions or []))
    tags = Counter(x for e in entries for x in (e.tags or []))
    return {
        "date_from": date_from, "date_to": date_to, "zodiac": zodiac, "timezone": tz,
        "n": len(entries),
        "mood_mean": round(sum(e.mood for e in entries) / len(entries), 2) if entries else None,
        "days": [{"date": d, "moods": v, "mood_avg": round(sum(v) / len(v), 2)} for d, v in sorted(days.items())],
        "emotions": [{"emotion": k, "count": c} for k, c in emo.most_common()],
        "tags": [{"tag": k, "count": c} for k, c in tags.most_common()],
        "events": [
            {"id": e.id, "local_datetime": e.local_datetime, "text": e.special or e.what_happened, "valence": e.special_valence}
            for e in entries if e.special or e.what_happened
        ],
        "entries": [S.entry_to_dict(e, include_snapshot=False) for e in entries],
        "sky": sky,
        "history": feature_history(sky["features"], all_entries, zodiac, in_period),
        "overall_mood_mean": round(sum(e.mood for e in others) / len(others), 2) if others else None,
        "note": ("«En otros registros» resume cómo te sentiste las demás veces que el cielo tuvo ese rasgo. "
                 "Los promedios aparecen a partir de 5 registros y describen tus datos; no implican causalidad."),
    }


# --- Ajustes, exportación y copias de seguridad -------------------------------------

@app.get("/api/settings")
def read_settings(db: Session = Depends(get_db)):
    return S.get_settings(db)


@app.put("/api/settings")
def write_settings(s: SettingsModel, db: Session = Depends(get_db)):
    return S.save_settings(db, s)


def _all_entries(db: Session) -> list[Entry]:
    return list(db.scalars(select(Entry).order_by(Entry.local_datetime)))


@app.get("/api/export/json")
def export_json(db: Session = Depends(get_db)):
    data = {
        "format": "astrobitacora-backup",
        "version": 1,
        "exported_at": utcnow(),
        "settings": S.get_settings(db).model_dump(),
        "entries": [
            {**S.entry_to_dict(e), "revisions": [
                {"changed_at": r.changed_at, "reason": r.reason, "previous": r.previous, "changes": r.changes} for r in e.revisions
            ]}
            for e in _all_entries(db)
        ],
    }
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    return Response(json.dumps(data, ensure_ascii=False, indent=1), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="astrobitacora-{stamp}.json"'})


@app.get("/api/export/csv")
def export_csv(db: Session = Depends(get_db)):
    buf = io.StringIO()
    w = csv.writer(buf)
    pos_cols = [f"{z}_{k}" for z in ("tropical", "sidereal") for k in BODY_KEYS + ["asc", "mc"]]
    w.writerow(["id", "fecha_local", "zona", "utc", "lugar", "latitud", "longitud", "sistema", "casas", "ayanamsa",
                "animo", "intensidad", "emociones", "etiquetas", "que_paso", "como_me_senti", "algo_especial", "valencia",
                "sueno_h", "energia", "estres", "observaciones", "demo"] + pos_cols)
    for e in _all_entries(db):
        pos = []
        for z in ("tropical", "sidereal"):
            ch = e.astro_snapshot[z]
            bmap = {b["key"]: b["longitude"] for b in ch["bodies"]}
            pos += [f"{bmap[k]:.6f}" if k in bmap else "" for k in BODY_KEYS]
            pos += [f"{ch['angles']['asc']['longitude']:.6f}", f"{ch['angles']['mc']['longitude']:.6f}"]
        c = e.astro_config
        w.writerow([e.id, e.local_datetime, e.timezone, e.utc_datetime, e.location_name, e.latitude, e.longitude,
                    c.get("zodiac"), c.get("house_system"), c.get("ayanamsa"), e.mood, e.intensity or "",
                    "|".join(e.emotions or []), "|".join(e.tags or []), e.what_happened, e.how_felt, e.special,
                    e.special_valence, e.sleep_hours if e.sleep_hours is not None else "", e.energy or "", e.stress or "",
                    e.notes, int(e.is_demo)] + pos)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="astrobitacora-{stamp}.csv"'})


@app.post("/api/import/json")
def import_json(payload: dict = Body(...), mode: str = "merge", db: Session = Depends(get_db)):
    """Restaura una copia. Las instantáneas astronómicas se conservan tal como se guardaron."""
    if payload.get("format") != "astrobitacora-backup":
        raise HTTPException(422, "El archivo no es una copia de seguridad de AstroBitácora.")
    if mode not in ("merge", "replace"):
        raise HTTPException(422, "Modo no válido")
    if mode == "replace":
        db.execute(delete(EntryRevision))
        db.execute(delete(Entry))
    count = 0
    for it in payload.get("entries", []):
        try:
            personal = Personal(**it["personal"])
            e = Entry(
                created_at=it.get("created_at") or utcnow(), updated_at=it.get("updated_at") or utcnow(),
                local_datetime=it["local_datetime"], timezone=it["timezone"], utc_offset=it["utc_offset"],
                utc_datetime=it["utc_datetime"], time_info=it["time_info"], location_name=it["location_name"],
                latitude=float(it["latitude"]), longitude=float(it["longitude"]), astro_config=it["astro_config"],
                astro_snapshot=it["astro_snapshot"], is_demo=bool(it.get("is_demo")),
                **personal.model_dump(),
            )
            for r in it.get("revisions", []):
                e.revisions.append(EntryRevision(changed_at=r.get("changed_at") or utcnow(), reason=r.get("reason", ""),
                                                 previous=r["previous"], changes=r.get("changes", {})))
        except (KeyError, TypeError, ValueError) as exc:
            db.rollback()
            raise HTTPException(422, f"Entrada no válida en la copia: {exc}") from exc
        db.add(e)
        count += 1
    if payload.get("settings") and mode == "replace":
        S.save_settings(db, SettingsModel(**payload["settings"]))
    db.commit()
    return {"imported": count, "mode": mode}


# --- Frontend compilado -------------------------------------------------------------

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = DIST / path
        if path and f.is_file() and DIST in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
