"""Exporta cartas de referencia calculadas con el motor Python (pyswisseph) para validar el motor web (WASM).

Uso: python tools/export_reference.py ../frontend/src/local/test/python_reference.json
"""
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.astro.engine import compute_chart, julian_day_ut  # noqa: E402
from app.astro.timeutil import resolve_local_time  # noqa: E402

rnd = random.Random(2026)
PLACES = [
    (40.4168, -3.7038), (-34.6037, -58.3816), (19.4326, -99.1332), (28.6139, 77.2090), (59.9139, 10.7522),
    (-33.8688, 151.2093), (64.1466, -21.9426), (0.0, 0.0), (-54.8019, -68.3030), (35.6762, 139.6503),
]
SYSTEMS = ["P", "W", "K", "E", "O", "R", "C"]

cases = []
for i in range(40):
    lat, lon = PLACES[i % len(PLACES)]
    t = datetime(1900, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=rnd.randint(0, int(200 * 365.25 * 86400)))
    jd = julian_day_ut(t)
    zodiac = "sidereal" if i % 2 else "tropical"
    hs = SYSTEMS[i % len(SYSTEMS)]
    ayan = ["lahiri", "raman", "krishnamurti", "fagan_bradley"][i % 4]
    node = "true" if i % 3 else "mean"
    c = compute_chart(jd, lat, lon, zodiac, ayan, hs, node)
    cases.append({
        "utc": t.isoformat().replace("+00:00", "Z"), "jd": jd, "lat": lat, "lon": lon,
        "zodiac": zodiac, "house_system": hs, "ayanamsa": ayan, "node_type": node,
        "bodies": {b["key"]: [b["longitude"], b["latitude"], b["speed"], b["house"]] for b in c["bodies"]},
        "asc": c["angles"]["asc"]["longitude"], "mc": c["angles"]["mc"]["longitude"],
        "cusps": c["houses"]["cusps"], "house_system_used": c["meta"]["house_system_used"],
        "ayanamsa_value": c["meta"]["ayanamsa_value"], "obliquity": c["meta"]["true_obliquity"],
        "illumination": c["moon_phase"]["illumination"], "phase": c["moon_phase"]["index"],
    })

# Conversión de hora local → UTC con zoneinfo, para comparar con Intl en el navegador.
times = []
for local, tz, fold in [
    ("2024-07-01T12:00", "Europe/Madrid", 0), ("2024-01-15T12:00", "Europe/Madrid", 0),
    ("2021-07-01T12:00", "America/Mexico_City", 0), ("2023-07-01T12:00", "America/Mexico_City", 0),
    ("2009-01-15T12:00", "America/Argentina/Buenos_Aires", 0), ("2015-01-15T12:00", "America/Argentina/Buenos_Aires", 0),
    ("2024-03-31T02:30", "Europe/Madrid", 0), ("2024-03-31T02:30", "Europe/Madrid", 1),
    ("2024-10-27T02:30", "Europe/Madrid", 0), ("2024-10-27T02:30", "Europe/Madrid", 1),
    ("1985-07-13T16:00", "Asia/Kolkata", 0), ("1995-03-10T08:15", "Australia/Sydney", 0),
    ("2024-04-08T11:07", "America/Mazatlan", 0), ("2000-01-01T00:00", "Pacific/Auckland", 0),
]:
    r = resolve_local_time(local, tz, None, fold)
    times.append({"local": local, "tz": tz, "fold": fold, "utc": r["utc"], "status": r["status"], "dst": r["dst"]})

out = Path(sys.argv[1])
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({"charts": cases, "times": times}, indent=1), encoding="utf-8")
print(f"{len(cases)} cartas y {len(times)} conversiones horarias → {out}")
