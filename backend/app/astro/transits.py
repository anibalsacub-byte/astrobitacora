"""Comparación entre una carta guardada y otra calculada (por ejemplo, la de ahora).

La parte astronómica es la diferencia de longitudes; la clasificación en "aspectos" y
"tránsitos" es una convención astrológica, y así se etiqueta.
"""
from __future__ import annotations

from .engine import norm360

ASPECTS = [
    ("conjunction", "Conjunción", "☌", 0, 3.0),
    ("sextile", "Sextil", "⚹", 60, 2.0),
    ("square", "Cuadratura", "□", 90, 3.0),
    ("trine", "Trígono", "△", 120, 3.0),
    ("opposition", "Oposición", "☍", 180, 3.0),
]


def _sep(a: float, b: float) -> float:
    d = abs(norm360(a) - norm360(b)) % 360
    return 360 - d if d > 180 else d


def _house_of(lon: float, cusps: list[float]) -> int:
    for i in range(12):
        a, b = cusps[i], cusps[(i + 1) % 12]
        if norm360(lon - a) < norm360(b - a):
            return i + 1
    return 12


def compare_charts(natal: dict, current: dict) -> dict:
    if natal["meta"]["zodiac"] != current["meta"]["zodiac"]:
        raise ValueError("Ambas cartas deben usar el mismo zodiaco para compararlas.")
    natal_points = {b["key"]: b for b in natal["bodies"]}
    natal_points.update(natal["angles"])
    cusps = natal["houses"]["cusps"]

    changes = []
    for cur in current["bodies"]:
        old = natal_points.get(cur["key"])
        if not old:
            continue
        changes.append({
            "key": cur["key"],
            "name": cur["name"],
            "symbol": cur["symbol"],
            "then_sign": old["sign"],
            "then_dms": old["dms"],
            "then_longitude": old["longitude"],
            "then_retrograde": old.get("retrograde", False),
            "now_sign": cur["sign"],
            "now_dms": cur["dms"],
            "now_longitude": cur["longitude"],
            "now_retrograde": cur["retrograde"],
            "sign_changed": old["sign"] != cur["sign"],
            "delta_longitude": norm360(cur["longitude"] - old["longitude"]),
            "natal_house_now": _house_of(cur["longitude"], cusps),
        })

    transits = []
    for cur in current["bodies"]:
        if cur["key"] == "ketu":
            continue  # redundante con Rahu
        for key, old in natal_points.items():
            if key == "ketu":
                continue
            sep = _sep(cur["longitude"], old["longitude"])
            for akey, aname, asym, angle, orb in ASPECTS:
                diff = abs(sep - angle)
                if diff <= orb:
                    transits.append({
                        "transiting": cur["key"],
                        "transiting_name": cur["name"],
                        "transiting_symbol": cur["symbol"],
                        "natal": key,
                        "natal_name": old["name"],
                        "natal_symbol": old["symbol"],
                        "aspect": akey,
                        "aspect_name": aname,
                        "aspect_symbol": asym,
                        "orb": round(diff, 2),
                    })
    transits.sort(key=lambda t: t["orb"])
    return {
        "zodiac": current["meta"]["zodiac"],
        "changes": changes,
        "transits": transits,
        "orbs": {a[0]: a[4] for a in ASPECTS},
        "note": (
            "Los aspectos y tránsitos son una clasificación astrológica de las distancias angulares; "
            "no implican causalidad física."
        ),
    }
