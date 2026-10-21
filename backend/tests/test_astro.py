"""Validación astronómica contra valores de referencia publicados.

Referencias:
- J. Meeus, "Astronomical Algorithms", 2.ª ed. (1998): ejemplos 12.a, 25.b, 33.a y 47.a.
- Efemérides de eventos fechados (equinoccio, eclipse, conjunción, ingresos) publicados por
  el USNO / NASA GSFC / IMCCE.
"""
import math
from datetime import datetime, timezone

import pytest
import swisseph as swe

from app.astro.engine import compute_chart, julian_day_ut, norm360, sign_info

FLAGS = swe.FLG_SWIEPH | swe.FLG_SPEED


def lon_tt(jd_tt, pid):
    return swe.calc(jd_tt, pid, FLAGS)[0]


def lon_ut(dt, pid):
    return swe.calc_ut(julian_day_ut(dt), pid, FLAGS)[0]


def sep(a, b):
    d = abs(norm360(a) - norm360(b)) % 360
    return min(d, 360 - d)


def utc(*args):
    return datetime(*args, tzinfo=timezone.utc)


# --- Casos de Meeus (Tiempo Dinámico) ---------------------------------------------

def test_sun_meeus_25b():
    # 1992 oct 13.0 TD: longitud aparente 199°54′21,818″
    x = lon_tt(2448908.5, swe.SUN)
    assert sep(x[0], 199 + 54 / 60 + 21.818 / 3600) < 0.0015


def test_moon_meeus_47a():
    # 1992 abr 12.0 TD: λ aparente 133,162655°, β −3,229126°
    x = lon_tt(2448724.5, swe.MOON)
    assert sep(x[0], 133.162655) < 0.005
    assert abs(x[1] - (-3.229126)) < 0.005


def test_venus_meeus_33a():
    # 1992 dic 20.0 TD: λ aparente 313,08102°, β −2,08474°
    x = lon_tt(2448976.5, swe.VENUS)
    assert sep(x[0], 313.08102) < 0.002
    assert abs(x[1] - (-2.08474)) < 0.002


def test_sidereal_time_meeus_12a():
    # 1987 abr 10, 0h UT: tiempo sidéreo aparente en Greenwich 13h10m46,1351s
    st = swe.sidtime(2446895.5)
    assert abs(st - (13 + 10 / 60 + 46.1351 / 3600)) < 0.0001


# --- Eventos fechados ---------------------------------------------------------------

def test_march_equinox_2024():
    # Equinoccio de marzo: 2024-03-20 03:06 UT
    x = lon_ut(utc(2024, 3, 20, 3, 6), swe.SUN)
    assert sep(x[0], 0.0) < 0.003


def test_new_moon_total_eclipse_2024_04_08():
    # Luna nueva (eclipse total de Sol): 2024-04-08 18:21 UT
    dt = utc(2024, 4, 8, 18, 21)
    assert sep(lon_ut(dt, swe.MOON)[0], lon_ut(dt, swe.SUN)[0]) < 0.05


def test_great_conjunction_2020():
    # Conjunción Júpiter–Saturno: 2020-12-21 ≈18:20 UT en 0°29′ de Acuario
    dt = utc(2020, 12, 21, 18, 20)
    j, s = lon_ut(dt, swe.JUPITER)[0], lon_ut(dt, swe.SATURN)[0]
    assert sep(j, s) < 0.05
    assert sep(j, 300 + 29 / 60) < 0.1


@pytest.mark.parametrize("pid,before,after,boundary", [
    (swe.PLUTO, utc(2024, 11, 18), utc(2024, 11, 21), 300.0),    # Plutón entra en Acuario 2024-11-19
    (swe.NEPTUNE, utc(2025, 3, 29), utc(2025, 4, 1), 0.0),       # Neptuno entra en Aries 2025-03-30
    (swe.SATURN, utc(2025, 5, 23), utc(2025, 5, 27), 0.0),       # Saturno entra en Aries 2025-05-25
    (swe.URANUS, utc(2025, 7, 5), utc(2025, 7, 9), 60.0),        # Urano entra en Géminis 2025-07-07
])
def test_outer_planet_ingresses(pid, before, after, boundary):
    b = norm360(lon_ut(before, pid)[0] - boundary)
    a = norm360(lon_ut(after, pid)[0] - boundary)
    assert b > 359.0, "antes del ingreso debe estar justo detrás del límite"
    assert a < 1.0, "después del ingreso debe haber cruzado el límite"


def test_mercury_retrograde_april_2024():
    # Mercurio retrógrado del 1 al 25 de abril de 2024
    assert lon_ut(utc(2024, 4, 10), swe.MERCURY)[3] < 0
    assert lon_ut(utc(2024, 5, 10), swe.MERCURY)[3] > 0


# --- Ascendente y Medio Cielo -------------------------------------------------------

@pytest.mark.parametrize("lat,lon,dt", [
    (40.4168, -3.7038, utc(1990, 6, 15, 10, 30)),     # Madrid
    (-34.6037, -58.3816, utc(2001, 9, 11, 2, 15)),    # Buenos Aires
    (19.4326, -99.1332, utc(2024, 4, 8, 18, 0)),      # Ciudad de México
    (59.9139, 10.7522, utc(1975, 12, 24, 23, 59)),    # Oslo
])
def test_ascendant_and_mc_independent_formula(lat, lon, dt):
    jd = julian_day_ut(dt)
    chart = compute_chart(jd, lat, lon, "tropical", house_system="P")
    eps = math.radians(chart["meta"]["true_obliquity"])
    ramc = math.radians(norm360(swe.sidtime(jd) * 15 + lon))
    phi = math.radians(lat)
    mc = math.degrees(math.atan2(math.sin(ramc), math.cos(ramc) * math.cos(eps))) % 360
    asc = math.degrees(math.atan2(math.cos(ramc), -(math.sin(ramc) * math.cos(eps) + math.tan(phi) * math.sin(eps)))) % 360
    assert sep(chart["angles"]["mc"]["longitude"], mc) < 0.001
    assert sep(chart["angles"]["asc"]["longitude"], asc) < 0.001


def test_ascendant_is_on_eastern_horizon():
    lat, lon = 40.4168, -3.7038
    jd = julian_day_ut(utc(2010, 3, 1, 20, 0))
    asc = compute_chart(jd, lat, lon)["angles"]["asc"]["longitude"]
    az, alt, _ = swe.azalt(jd, swe.ECL2HOR, (lon, lat, 0), 0, 0, (asc, 0, 1))
    assert abs(alt) < 0.01
    assert 180 < az < 360  # Swiss Ephemeris mide el azimut desde el sur hacia el oeste: este = 270°


# --- Sideral y coherencia -----------------------------------------------------------

def test_lahiri_ayanamsa_j2000():
    chart = compute_chart(2451545.0, 0, 0, "sidereal", ayanamsa="lahiri")
    assert abs(chart["meta"]["ayanamsa_value"] - 23.85) < 0.02


def test_sidereal_equals_tropical_minus_ayanamsa():
    jd = julian_day_ut(utc(1985, 7, 13, 16, 0))
    t = compute_chart(jd, 28.61, 77.21, "tropical")
    s = compute_chart(jd, 28.61, 77.21, "sidereal")
    ay = s["meta"]["ayanamsa_value"]
    for bt, bs in zip(t["bodies"], s["bodies"]):
        assert sep(bt["longitude"] - ay, bs["longitude"]) < 1e-4, bt["key"]
    assert sep(t["angles"]["asc"]["longitude"] - ay, s["angles"]["asc"]["longitude"]) < 1e-4


def test_ketu_opposite_rahu():
    c = compute_chart(2451545.0, 10, 10)
    b = {x["key"]: x for x in c["bodies"]}
    assert sep(b["rahu"]["longitude"] + 180, b["ketu"]["longitude"]) < 1e-9


def test_whole_sign_houses():
    c = compute_chart(julian_day_ut(utc(2000, 1, 1, 12)), 40, -3.7, house_system="W")
    asc_sign = c["angles"]["asc"]["sign_index"]
    assert sep(c["houses"]["cusps"][0], asc_sign * 30) < 1e-9
    for b in c["bodies"]:
        assert b["house"] == b["whole_sign_house"]


def test_polar_latitude_falls_back_from_placidus():
    c = compute_chart(julian_day_ut(utc(2020, 6, 21, 12)), 70.0, 25.0, house_system="P")
    assert c["meta"]["house_system_used"] == "O"
    assert c["meta"]["warnings"]


def test_sign_info_never_rounds_into_next_sign():
    s = sign_info(29.99999999)
    assert s["sign"] == "aries" and s["dms"].startswith("29°59′59")
    assert sign_info(359.9999999)["sign"] == "pisces"
    assert sign_info(360.0)["sign"] == "aries"


def test_moon_phase_full_moon():
    # Luna llena: 2024-04-23 23:49 UT
    c = compute_chart(julian_day_ut(utc(2024, 4, 23, 23, 49)), 0, 0)
    assert c["moon_phase"]["name"] == "Luna llena"
    assert c["moon_phase"]["illumination"] > 0.99
