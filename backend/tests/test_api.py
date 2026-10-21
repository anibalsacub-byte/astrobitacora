"""Pruebas de la API con una base de datos temporal."""
import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["ASTRO_DB_URL"] = f"sqlite:///{os.path.join(_tmp, 'test.db')}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

MADRID = {"location_name": "Madrid, España", "latitude": 40.4168, "longitude": -3.7038, "timezone": "Europe/Madrid"}
PERSONAL = {"mood": 4, "emotions": ["Alegría", "Gratitud"], "intensity": 6, "what_happened": "Paseo por el Retiro",
            "how_felt": "En calma", "tags": ["Salud", "familia"]}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_demo_entry_seeded(client):
    rows = client.get("/api/entries").json()
    assert any(r["is_demo"] for r in rows)


def test_chart_endpoint(client):
    r = client.post("/api/astro/chart", json={**MADRID, "local_datetime": "2024-07-01T12:00", "config": {"zodiac": "tropical", "house_system": "P"}})
    assert r.status_code == 200
    body = r.json()
    assert body["time"]["utc"] == "2024-07-01T10:00:00Z"
    assert body["chart"]["meta"]["zodiac"] == "tropical"
    assert {b["key"] for b in body["chart"]["bodies"]} >= {"sun", "moon", "pluto", "rahu", "ketu"}


def test_now_is_recalculated(client):
    r = client.post("/api/astro/now", json={"latitude": 40.4, "longitude": -3.7})
    assert r.status_code == 200
    assert r.json()["time"]["timezone"] == "Europe/Madrid"


def test_invalid_date_returns_422(client):
    r = client.post("/api/astro/chart", json={**MADRID, "local_datetime": "2024-02-30T10:00"})
    assert r.status_code == 422


def test_entry_lifecycle(client):
    r = client.post("/api/entries", json={**MADRID, "local_datetime": "2024-05-10T08:30", "personal": PERSONAL})
    assert r.status_code == 201
    e = r.json()
    eid = e["id"]
    assert e["personal"]["tags"] == ["salud", "familia"]
    snap_before = e["astro_snapshot"]

    # Varias entradas el mismo día
    client.post("/api/entries", json={**MADRID, "local_datetime": "2024-05-10T22:00", "personal": {**PERSONAL, "mood": 2}})
    cal = client.get("/api/calendar", params={"year": 2024, "month": 5}).json()
    day = next(d for d in cal if d["date"] == "2024-05-10")
    assert len(day["entries"]) == 2 and day["mood_avg"] == 3.0

    # Editar la parte personal no altera los datos astronómicos
    r = client.put(f"/api/entries/{eid}/personal", json={**PERSONAL, "mood": 5, "how_felt": "Muy bien"})
    assert r.json()["astro_snapshot"] == snap_before
    assert r.json()["personal"]["mood"] == 5

    # Recalcular con otra hora deja trazabilidad
    r = client.post(f"/api/entries/{eid}/recalculate", json={**MADRID, "local_datetime": "2024-05-10T09:30", "reason": "Hora corregida"})
    assert r.status_code == 200
    assert r.json()["utc_datetime"] == "2024-05-10T07:30:00Z"
    revs = client.get(f"/api/entries/{eid}/revisions").json()
    assert len(revs) == 1 and revs[0]["reason"] == "Hora corregida"
    assert "local_datetime" in revs[0]["changes"]

    # Comparación con ahora
    r = client.post(f"/api/entries/{eid}/compare-now", json=None)
    assert r.status_code == 200
    assert len(r.json()["comparison"]["changes"]) >= 10

    # Búsqueda
    assert any(x["id"] == eid for x in client.get("/api/entries", params={"q": "retiro"}).json())
    assert any(x["id"] == eid for x in client.get("/api/entries", params={"tag": "salud"}).json())
    assert not client.get("/api/entries", params={"date_from": "2030-01-01"}).json()

    # Borrado definitivo requiere confirmación
    assert client.delete(f"/api/entries/{eid}").status_code == 400
    assert client.delete(f"/api/entries/{eid}", params={"confirm": True}).status_code == 200
    assert client.get(f"/api/entries/{eid}").status_code == 404


def test_stats_and_small_sample_warning(client):
    s = client.get("/api/stats", params={"group": "sign:moon", "zodiac": "sidereal"}).json()
    assert s["n"] >= 1
    assert s["warnings"]
    assert all(g["mood_mean"] is None for g in s["groups"] if g["n"] < 5)
    assert "no demuestra" in s["disclaimer"]


def test_export_and_restore(client):
    backup = client.get("/api/export/json").json()
    n = len(backup["entries"])
    assert client.get("/api/export/csv").status_code == 200
    r = client.post("/api/import/json", params={"mode": "replace"}, json=backup)
    assert r.json()["imported"] == n
    restored = client.get("/api/export/json").json()["entries"]
    assert [e["astro_snapshot"] for e in restored] == [e["astro_snapshot"] for e in backup["entries"]]
