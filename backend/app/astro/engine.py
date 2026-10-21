"""Motor de cálculo astronómico basado en Swiss Ephemeris.

Todas las posiciones son geocéntricas aparentes (incluyen aberración, deflexión y nutación),
referidas a la eclíptica verdadera de la fecha. La capa sideral solo resta el ayanamsa.
"""
from __future__ import annotations

import math
import threading
from datetime import datetime, timezone
from pathlib import Path

import swisseph as swe

from .zodiac import (
    AYANAMSAS, BODIES, HOUSE_SYSTEMS, KETU, MOON_PHASES, NODE_IDS, POLAR_UNDEFINED, RAHU, SIGNS, ZODIACS,
)

EPHE_DIR = Path(__file__).resolve().parents[2] / "ephe"
EPHE_DIR.mkdir(exist_ok=True)
swe.set_ephe_path(str(EPHE_DIR))

# Swiss Ephemeris mantiene estado global (modo sideral); serializamos los cálculos.
_LOCK = threading.Lock()


class AstroError(ValueError):
    pass


def norm360(x: float) -> float:
    return x % 360.0


def julian_day_ut(utc: datetime) -> float:
    utc = utc.astimezone(timezone.utc)
    hour = utc.hour + utc.minute / 60 + utc.second / 3600 + utc.microsecond / 3.6e9
    return swe.julday(utc.year, utc.month, utc.day, hour, swe.GREG_CAL)


def parse_utc(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def sign_info(lon: float) -> dict:
    """Signo y grado dentro del signo. Se trunca al segundo de arco para que el texto
    nunca muestre un grado que pertenezca al signo siguiente."""
    lon = norm360(lon)
    total = int(math.floor(lon * 3600 + 1e-7)) % (360 * 3600)
    idx = total // (30 * 3600)
    rem = total - idx * 30 * 3600
    d, rem = divmod(rem, 3600)
    m, s = divmod(rem, 60)
    key, name, symbol, vedic = SIGNS[idx]
    return {
        "sign_index": idx,
        "sign": key,
        "sign_name": name,
        "sign_symbol": symbol,
        "rashi": vedic,
        "degree_in_sign": lon - idx * 30,
        "dms": f"{d}°{m:02d}′{s:02d}″",
    }


def _calc(jd_ut: float, pid: int, flags: int) -> tuple[tuple, int]:
    res = swe.calc_ut(jd_ut, pid, flags)
    return res[0], res[1]


def _house_of(lon: float, cusps: list[float]) -> int:
    for i in range(12):
        a, b = cusps[i], cusps[(i + 1) % 12]
        span = norm360(b - a)
        if norm360(lon - a) < span or span == 0:
            return i + 1
    return 12


def engine_label(retflag: int) -> str:
    if retflag & swe.FLG_SWIEPH:
        return "Swiss Ephemeris (archivos .se1)"
    if retflag & swe.FLG_JPLEPH:
        return "Swiss Ephemeris (JPL)"
    return "Swiss Ephemeris (teoría analítica de Moshier)"


def compute_chart(
    jd_ut: float,
    lat: float,
    lon: float,
    zodiac: str = "tropical",
    ayanamsa: str = "lahiri",
    house_system: str = "P",
    node_type: str = "true",
    include_nodes: bool = True,
) -> dict:
    if zodiac not in ZODIACS:
        raise AstroError(f"Zodiaco desconocido: {zodiac}")
    if ayanamsa not in AYANAMSAS:
        raise AstroError(f"Ayanamsa desconocido: {ayanamsa}")
    if house_system not in HOUSE_SYSTEMS:
        raise AstroError(f"Sistema de casas desconocido: {house_system}")
    if node_type not in NODE_IDS:
        raise AstroError(f"Tipo de nodo desconocido: {node_type}")
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise AstroError("Coordenadas fuera de rango.")

    warnings: list[str] = []
    with _LOCK:
        flags = swe.FLG_SWIEPH | swe.FLG_SPEED
        ayan_value = None
        if zodiac == "sidereal":
            swe.set_sid_mode(AYANAMSAS[ayanamsa][0], 0, 0)
            flags |= swe.FLG_SIDEREAL
            # Ayanamsa "verdadero" (con nutación): es exactamente tropical aparente − sideral.
            res = swe.get_ayanamsa_ex_ut(jd_ut, swe.FLG_SWIEPH)
            ayan_value = res[1] if isinstance(res, tuple) else res

        nut, _ = _calc(jd_ut, swe.ECL_NUT, 0)
        true_obliquity = nut[0]

        raw: list[tuple] = []
        retflag_seen = 0
        for key, pid, name, symbol, abbr in BODIES:
            xx, rf = _calc(jd_ut, pid, flags)
            retflag_seen |= rf
            raw.append((key, name, symbol, abbr, xx, False))
        if include_nodes:
            xx, _ = _calc(jd_ut, NODE_IDS[node_type], flags)
            raw.append((RAHU[0], RAHU[1], RAHU[2], RAHU[3], xx, True))
            kx = (norm360(xx[0] + 180), -xx[1], xx[2], xx[3], -xx[4], xx[5])
            raw.append((KETU[0], KETU[1], KETU[2], KETU[3], kx, True))

        hs_used = house_system
        if house_system in POLAR_UNDEFINED and abs(lat) >= 90 - true_obliquity:
            hs_used = "O"
            warnings.append(
                f"{HOUSE_SYSTEMS[house_system]} no está definido a {abs(lat):.2f}° de latitud "
                f"(círculo polar, límite {90 - true_obliquity:.2f}°). Se usa Porfirio como aproximación."
            )
        hflags = swe.FLG_SIDEREAL if zodiac == "sidereal" else 0
        try:
            cusps, ascmc = swe.houses_ex(jd_ut, lat, lon, hs_used.encode(), hflags)
        except swe.Error:
            warnings.append(f"No se pudo calcular {HOUSE_SYSTEMS[hs_used]}; se usa Porfirio.")
            hs_used = "O"
            cusps, ascmc = swe.houses_ex(jd_ut, lat, lon, b"O", hflags)
        cusps = list(cusps)
        if len(cusps) == 13:
            cusps = cusps[1:]

        sidereal_time = swe.sidtime(jd_ut)
        moon_pheno = swe.pheno_ut(jd_ut, swe.MOON, swe.FLG_SWIEPH)
        illum = moon_pheno[0][1] if isinstance(moon_pheno[0], (list, tuple)) else moon_pheno[1]

    asc, mc = norm360(ascmc[0]), norm360(ascmc[1])
    asc_sign = int(asc // 30)

    bodies = []
    for key, name, symbol, abbr, xx, is_node in raw:
        lon_ = norm360(xx[0])
        si = sign_info(lon_)
        bodies.append({
            "key": key,
            "name": name,
            "symbol": symbol,
            "abbr": abbr,
            "longitude": lon_,
            "latitude": xx[1],
            "distance_au": xx[2],
            "speed": xx[3],
            "retrograde": xx[3] < 0,
            "is_node": is_node,
            **si,
            "house": _house_of(lon_, cusps),
            "whole_sign_house": (si["sign_index"] - asc_sign) % 12 + 1,
        })

    by_key = {b["key"]: b for b in bodies}
    elong = norm360(by_key["moon"]["longitude"] - by_key["sun"]["longitude"])
    phase_idx = int(((elong + 22.5) % 360) // 45)

    angles = {
        "asc": {"key": "asc", "name": "Ascendente", "symbol": "Asc", "longitude": asc, **sign_info(asc)},
        "mc": {"key": "mc", "name": "Medio Cielo", "symbol": "MC", "longitude": mc, **sign_info(mc)},
    }

    if zodiac == "sidereal":
        warnings.append("Posiciones siderales = posición tropical − ayanamsa. Las casas védicas de la carta usan signo entero desde el Lagna.")

    return {
        "meta": {
            "jd_ut": jd_ut,
            "zodiac": zodiac,
            "zodiac_name": ZODIACS[zodiac],
            "ayanamsa": ayanamsa if zodiac == "sidereal" else None,
            "ayanamsa_name": AYANAMSAS[ayanamsa][1] if zodiac == "sidereal" else None,
            "ayanamsa_value": ayan_value,
            "house_system": house_system,
            "house_system_used": hs_used,
            "house_system_name": HOUSE_SYSTEMS[hs_used],
            "node_type": node_type,
            "engine": engine_label(retflag_seen),
            "engine_version": swe.version,
            "true_obliquity": true_obliquity,
            "sidereal_time_hours": sidereal_time,
            "latitude": lat,
            "longitude": lon,
            "warnings": warnings,
        },
        "bodies": bodies,
        "angles": angles,
        "houses": {"cusps": [norm360(c) for c in cusps], "system": hs_used},
        "summary": {
            "lagna": angles["asc"]["sign"],
            "chandra": by_key["moon"]["sign"],
            "surya": by_key["sun"]["sign"],
        },
        "moon_phase": {
            "elongation": elong,
            "name": MOON_PHASES[phase_idx],
            "index": phase_idx,
            "illumination": illum,
        },
    }


def body_longitudes(jd_ut: float, zodiac: str = "tropical", ayanamsa: str = "lahiri", node_type: str = "true") -> dict:
    """Longitud y velocidad de cada cuerpo (sin casas): para muestrear periodos de forma eficiente."""
    out = {}
    with _LOCK:
        flags = swe.FLG_SWIEPH | swe.FLG_SPEED
        if zodiac == "sidereal":
            swe.set_sid_mode(AYANAMSAS[ayanamsa][0], 0, 0)
            flags |= swe.FLG_SIDEREAL
        for key, pid, *_ in BODIES:
            xx, _ = _calc(jd_ut, pid, flags)
            out[key] = (norm360(xx[0]), xx[3])
        xx, _ = _calc(jd_ut, NODE_IDS[node_type], flags)
        out["rahu"] = (norm360(xx[0]), xx[3])
    return out


def compute_snapshot(utc_iso: str, lat: float, lon: float, config: dict) -> dict:
    """Instantánea completa para la bitácora: ambos zodiacos con la misma configuración."""
    jd = julian_day_ut(parse_utc(utc_iso))
    common = dict(
        ayanamsa=config.get("ayanamsa", "lahiri"),
        house_system=config.get("house_system", "P"),
        node_type=config.get("node_type", "true"),
    )
    return {
        "tropical": compute_chart(jd, lat, lon, zodiac="tropical", **common),
        "sidereal": compute_chart(jd, lat, lon, zodiac="sidereal", **common),
    }
