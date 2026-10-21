"""Conversión de hora local a UTC con reglas IANA históricas."""
import pytest

from app.astro.timeutil import TimeError, resolve_local_time, timezone_at


def test_madrid_summer_and_winter():
    assert resolve_local_time("2024-07-01T12:00", "Europe/Madrid")["utc"] == "2024-07-01T10:00:00Z"
    w = resolve_local_time("2024-01-15T12:00", "Europe/Madrid")
    assert w["utc"] == "2024-01-15T11:00:00Z" and w["dst"] is False


def test_mexico_abolished_dst_in_2022():
    # Con horario de verano en 2021 (UTC−5), sin él desde 2023 (UTC−6)
    assert resolve_local_time("2021-07-01T12:00", "America/Mexico_City")["utc"] == "2021-07-01T17:00:00Z"
    assert resolve_local_time("2023-07-01T12:00", "America/Mexico_City")["utc"] == "2023-07-01T18:00:00Z"


def test_argentina_historical_dst_2008():
    # Argentina aplicó horario de verano en el verano austral 2008-2009 (UTC−2)
    assert resolve_local_time("2009-01-15T12:00", "America/Argentina/Buenos_Aires")["utc"] == "2009-01-15T14:00:00Z"
    assert resolve_local_time("2015-01-15T12:00", "America/Argentina/Buenos_Aires")["utc"] == "2015-01-15T15:00:00Z"


def test_nonexistent_spring_forward():
    r = resolve_local_time("2024-03-31T02:30", "Europe/Madrid")
    assert r["status"] == "nonexistent" and r["warnings"]


def test_ambiguous_fall_back():
    first = resolve_local_time("2024-10-27T02:30", "Europe/Madrid", fold=0)
    second = resolve_local_time("2024-10-27T02:30", "Europe/Madrid", fold=1)
    assert first["status"] == "ambiguous"
    assert first["utc"] == "2024-10-27T00:30:00Z"
    assert second["utc"] == "2024-10-27T01:30:00Z"


def test_manual_offset():
    r = resolve_local_time("1890-05-01T09:00", None, utc_offset_minutes=-(4 * 60 + 16))
    assert r["utc"] == "1890-05-01T13:16:00Z"


def test_invalid_inputs():
    with pytest.raises(TimeError):
        resolve_local_time("2024-13-01T00:00", "UTC")
    with pytest.raises(TimeError):
        resolve_local_time("2024-01-01T00:00", "Mars/Olympus")


def test_timezone_from_coordinates():
    assert timezone_at(40.4168, -3.7038) == "Europe/Madrid"
    assert timezone_at(-34.6037, -58.3816) == "America/Argentina/Buenos_Aires"
