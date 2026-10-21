"""«¿Dónde estaban mis astros?»: rasgos del cielo de cada registro, coincidencias y cielo de un periodo.

Todo es estadística descriptiva sobre los propios registros. Un «rasgo» es una condición astronómica
simple y comprobable en la instantánea guardada de la entrada:
  sign:<astro>:<signo>   el astro estaba en ese signo
  retro:<astro>          el astro estaba en movimiento retrógrado aparente
  phase:<0-7>            fase lunar (8 fases de 45°)
"""
from __future__ import annotations

import statistics
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .astro.engine import body_longitudes, julian_day_ut, norm360
from .astro.zodiac import BODIES, MOON_PHASES, SIGNS
from .db import Entry

BODY_NAMES = {b[0]: b[2] for b in BODIES} | {"rahu": "Nodo norte (Rahu)"}
SIGN_IDX = {s[0]: i for i, s in enumerate(SIGNS)}
RETRO_BODIES = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]
MIN_MATCH = 3      # por debajo no se buscan coincidencias
SMALL_MATCH = 10   # por debajo, resultados orientativos
MIN_FEATURE = 2    # una coincidencia debe repetirse al menos dos veces
MIN_DIFF = 5.0     # y superar en 5 puntos porcentuales su frecuencia en el resto de registros


def sign_label(sign: str, zodiac: str) -> str:
    s = SIGNS[SIGN_IDX[sign]]
    return f"{s[3]} ({s[1]})" if zodiac == "sidereal" else s[1]


def feature_label(f: str, zodiac: str) -> str:
    kind, _, rest = f.partition(":")
    if kind == "sign":
        body, sign = rest.split(":")
        return f"{BODY_NAMES[body]} en {sign_label(sign, zodiac)}"
    if kind == "retro":
        return f"{BODY_NAMES[rest]} retrógrado"
    if kind == "phase":
        return f"Fase lunar: {MOON_PHASES[int(rest)].lower()}"
    return f


def feature_meta(f: str) -> dict:
    kind, _, rest = f.partition(":")
    body = rest.split(":")[0] if kind in ("sign", "retro") else "moon"
    return {"kind": kind, "body": body}


def entry_features(e: Entry, zodiac: str) -> set[str]:
    chart = e.astro_snapshot[zodiac]
    feats = set()
    for b in chart["bodies"]:
        if b["key"] == "ketu":
            continue
        feats.add(f"sign:{b['key']}:{b['sign']}")
        if b["retrograde"] and not b["is_node"]:
            feats.add(f"retro:{b['key']}")
    feats.add(f"phase:{e.astro_snapshot['tropical']['moon_phase']['index']}")
    return feats


def reliability(n: int) -> str:
    if n < MIN_MATCH:
        return "insuficiente"
    if n < SMALL_MATCH:
        return "orientativa"
    return "descriptiva"


def _mood_stats(entries: list[Entry]) -> dict:
    n = len(entries)
    emo = Counter(x for e in entries for x in (e.emotions or []))
    return {
        "n": n,
        "mood_mean": round(statistics.mean(e.mood for e in entries), 2) if n >= 5 else None,
        "top_emotions": [k for k, _ in emo.most_common(3)],
    }


def experience_insights(matched: list[Entry], all_entries: list[Entry], zodiac: str) -> dict:
    """Compara los rasgos del cielo en los registros elegidos con los del resto de registros."""
    ids = {e.id for e in matched}
    rest = [e for e in all_entries if e.id not in ids]
    nm, nr = len(matched), len(rest)
    fm = Counter(f for e in matched for f in entry_features(e, zodiac))
    fr = Counter(f for e in rest for f in entry_features(e, zodiac))

    rows = []
    for f, c in fm.items():
        pm = c / nm
        pr = fr.get(f, 0) / nr if nr else None
        rows.append({
            "feature": f, **feature_meta(f), "label": feature_label(f, zodiac),
            "count": c, "pct": round(100 * pm, 1),
            "rest_count": fr.get(f, 0), "rest_pct": round(100 * pr, 1) if pr is not None else None,
            "diff": round(100 * (pm - pr), 1) if pr is not None else None,
        })
    # Las «coincidencias» son rasgos que se repiten y aparecen más que en el resto de registros.
    highlights = [r for r in rows if r["count"] >= MIN_FEATURE and (r["diff"] is None or r["diff"] >= MIN_DIFF)]
    highlights.sort(key=lambda r: (r["diff"] if r["diff"] is not None else r["pct"], r["count"]), reverse=True)

    # Distribución completa por astro, para ver «dónde estaban» aunque no destaque nada.
    by_body: dict[str, list] = {}
    for r in rows:
        if r["kind"] == "sign":
            by_body.setdefault(r["body"], []).append({"sign": r["feature"].split(":")[2], "count": r["count"], "pct": r["pct"]})
    for v in by_body.values():
        v.sort(key=lambda x: -x["count"])

    rel = reliability(nm)
    warnings = []
    if rel == "insuficiente":
        warnings.append(f"Solo {nm} registro(s) coinciden: hacen falta al menos {MIN_MATCH} para buscar coincidencias.")
        highlights = []
    elif rel == "orientativa":
        warnings.append(f"Con {nm} registros, las coincidencias pueden deberse al azar. Sigue registrando para ver si se mantienen.")
    if nr < 5:
        warnings.append("Hay pocos registros fuera de esta selección para comparar.")
    if highlights:
        warnings.append(
            "Se comparan muchas posiciones a la vez, así que algunas coincidencias aparecerán por puro azar. "
            "Las que se mantengan a medida que sumes registros son las que merecen atención."
        )

    return {
        "n": nm, "n_rest": nr, "zodiac": zodiac, "reliability": rel,
        "highlights": highlights[:12],
        "by_body": by_body,
        "matched_stats": _mood_stats(matched),
        "warnings": warnings,
        "note": ("Muestra en qué posiciones estaban los astros cuando registraste esta experiencia y con qué frecuencia "
                 "se dan en el resto de tus registros. Es una descripción de tus datos, no una relación de causa."),
    }


# --- Cielo de un periodo ------------------------------------------------------------

def _samples(start: date, end: date, tz: ZoneInfo, step_h: int = 6):
    t = datetime(start.year, start.month, start.day, tzinfo=tz).astimezone(timezone.utc)
    stop = datetime(end.year, end.month, end.day, 23, 59, tzinfo=tz).astimezone(timezone.utc)
    while t <= stop:
        yield t
        t += timedelta(hours=step_h)


def period_sky(start: date, end: date, tz_name: str, zodiac: str, ayanamsa: str, node_type: str) -> dict:
    tz = ZoneInfo(tz_name)
    series = []
    for t in _samples(start, end, tz):
        series.append((t.astimezone(tz).date().isoformat(), body_longitudes(julian_day_ut(t), zodiac, ayanamsa, node_type)))

    bodies = []
    for key in [b[0] for b in BODIES] + ["rahu"]:
        segs, retro_days = [], set()
        for d, pos in series:
            lon, speed = pos[key]
            sign = SIGNS[int(lon // 30)][0]
            if not segs or segs[-1]["sign"] != sign:
                segs.append({"sign": sign, "label": sign_label(sign, zodiac), "from": d, "to": d})
            segs[-1]["to"] = d
            if speed < 0 and key != "rahu":
                retro_days.add(d)
        first_speed, last_speed = series[0][1][key][1], series[-1][1][key][1]
        station = None
        if key != "rahu" and (first_speed < 0) != (last_speed < 0):
            station = "se vuelve retrógrado" if last_speed < 0 else "retoma el movimiento directo"
        bodies.append({
            "key": key, "name": BODY_NAMES[key], "segments": segs,
            "retrograde": bool(retro_days) and key != "rahu",
            "retro_all_period": len(retro_days) > 0 and last_speed < 0 and first_speed < 0,
            "station": station,
        })

    phases = []
    prev = None
    for d, pos in series:
        el = norm360(pos["moon"][0] - pos["sun"][0])
        if prev is not None:
            if prev > 300 and el < 60:
                phases.append({"date": d, "name": "Luna nueva"})
            elif prev < 180 <= el:
                phases.append({"date": d, "name": "Luna llena"})
        prev = el

    features = set()
    for b in bodies:
        for s in b["segments"]:
            features.add(f"sign:{b['key']}:{s['sign']}")
        if b["retrograde"]:
            features.add(f"retro:{b['key']}")
    return {"bodies": bodies, "lunar_events": phases, "features": sorted(features)}


def feature_history(features: list[str], all_entries: list[Entry], zodiac: str, exclude_ids: set[int]) -> list[dict]:
    """Para cada rasgo del cielo de un periodo: cómo te sentiste en otros registros con ese mismo rasgo."""
    feats_by_entry = {e.id: entry_features(e, zodiac) for e in all_entries if e.id not in exclude_ids}
    others = [e for e in all_entries if e.id not in exclude_ids]
    overall = statistics.mean(e.mood for e in others) if others else None
    out = []
    for f in features:
        with_f = [e for e in others if f in feats_by_entry[e.id]]
        stats = _mood_stats(with_f)
        diff = round(stats["mood_mean"] - overall, 2) if stats["mood_mean"] is not None and overall is not None else None
        out.append({
            "feature": f, **feature_meta(f), "label": feature_label(f, zodiac), **stats,
            "mood_diff": diff,
            # Un rasgo presente en casi todos los registros (p. ej. un planeta lento) no permite comparar.
            "background": bool(others) and len(with_f) / len(others) >= 0.8,
        })
    out.sort(key=lambda r: (r["background"], r["mood_diff"] is None, -abs(r["mood_diff"] or 0), -r["n"]))
    return out
