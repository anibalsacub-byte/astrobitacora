"""«¿Dónde estaban mis astros?»: exploración de experiencias, periodos y registro rápido."""
import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["ASTRO_DB_URL"] = f"sqlite:///{os.path.join(_tmp, 'insights.db')}"

from datetime import date  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.db as dbmod  # noqa: E402
from app.insights import period_sky  # noqa: E402
from app.main import app  # noqa: E402

MADRID = {"location_name": "Madrid", "latitude": 40.4168, "longitude": -3.7038, "timezone": "Europe/Madrid"}


@pytest.fixture(scope="module")
def client():
    # Este módulo usa su propia base de datos aunque otros tests ya hayan importado app.db
    from sqlalchemy import create_engine
    eng =create_engine(os.environ["ASTRO_DB_URL"], connect_args={"check_same_thread": False})
    dbmod.engine = eng
    dbmod.SessionLocal.configure(bind=eng)
    with TestClient(app) as c:
        # Cansancio en días con la Luna en Capricornio tropical (270°–300°), y días normales intercalados
        for d in ["2024-01-10", "2024-02-06", "2024-03-05", "2024-04-01"]:
            c.post("/api/entries", json={**MADRID, "local_datetime": f"{d}T21:00",
                                         "personal": {"mood": 2, "emotions": ["Cansancio"], "tags": ["proyectos"]}})
        for d in ["2024-01-03", "2024-01-17", "2024-01-24", "2024-02-14", "2024-02-21", "2024-03-12"]:
            c.post("/api/entries", json={**MADRID, "local_datetime": f"{d}T21:00", "personal": {"mood": 4, "emotions": ["Alegría"]}})
        yield c


def test_experience_finds_recurring_moon_sign(client):
    r = client.get("/api/insights/experience", params={"emotion": "Cansancio", "zodiac": "tropical"}).json()
    assert r["n"] == 4 and r["n_rest"] == 6
    moon = [h for h in r["highlights"] if h["kind"] == "sign" and h["body"] == "moon"]
    assert moon, "la Luna en el mismo signo debería destacar"
    assert moon[0]["count"] >= 3 and moon[0]["diff"] > 0
    assert "no una relación de causa" in r["note"]


def test_experience_by_tag_and_small_sample(client):
    r = client.get("/api/insights/experience", params={"tag": "proyectos", "date_from": "2024-01-01", "date_to": "2024-01-31"}).json()
    assert r["n"] == 1 and r["reliability"] == "insuficiente" and r["highlights"] == []


def test_period_sky_and_history(client):
    r = client.get("/api/insights/period", params={"date_from": "2024-01-08", "date_to": "2024-01-14", "zodiac": "tropical"}).json()
    assert r["n"] == 1 and r["days"][0]["date"] == "2024-01-10"
    moon = next(b for b in r["sky"]["bodies"] if b["key"] == "moon")
    assert len(moon["segments"]) >= 3  # la Luna recorre 3–4 signos por semana
    assert any(ev["name"] == "Luna nueva" for ev in r["sky"]["lunar_events"])  # luna nueva 2024-01-11
    assert r["history"] and all("n" in h for h in r["history"])


def test_period_detects_mercury_station():
    # Mercurio retoma el movimiento directo el 2024-04-25
    sky = period_sky(date(2024, 4, 20), date(2024, 4, 30), "UTC", "tropical", "lahiri", "true")
    merc = next(b for b in sky["bodies"] if b["key"] == "mercury")
    assert merc["retrograde"] and merc["station"] == "retoma el movimiento directo"


def test_quick_entry(client):
    r = client.post("/api/entries/quick", json={"personal": {"mood": 3, "emotions": ["Tranquilidad"]}, "place": {**MADRID, "name": "Madrid"}})
    assert r.status_code == 201
    assert r.json()["timezone"] == "Europe/Madrid"
    assert client.post("/api/entries/quick", json={"personal": {"mood": 3}}).status_code == 422
