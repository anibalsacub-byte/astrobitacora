"""Conversión explícita de hora local a UTC con zonas horarias IANA (incluye DST histórico)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from timezonefinder import TimezoneFinder

_tf: TimezoneFinder | None = None

MIN_YEAR, MAX_YEAR = 1, 2999


class TimeError(ValueError):
    pass


def timezone_at(lat: float, lon: float) -> str | None:
    """Zona IANA para unas coordenadas, calculada sin conexión."""
    global _tf
    if _tf is None:
        _tf = TimezoneFinder()
    return _tf.timezone_at(lat=lat, lng=lon) or _tf.closest_timezone_at(lat=lat, lng=lon)


def _fmt_offset(td: timedelta) -> str:
    total = int(td.total_seconds())
    sign = "+" if total >= 0 else "-"
    total = abs(total)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{sign}{h:02d}:{m:02d}" + (f":{s:02d}" if s else "")


def resolve_local_time(
    local: str,
    tz_name: str | None,
    utc_offset_minutes: int | None = None,
    fold: int = 0,
) -> dict:
    """Interpreta una fecha-hora local y la convierte a UTC.

    - Con `utc_offset_minutes` se usa un desfase fijo manual (útil para fechas antiguas).
    - Con `tz_name` se aplican las reglas IANA vigentes en esa fecha (incluido el horario de verano).
    - Detecta horas inexistentes (salto de primavera) y ambiguas (retroceso de otoño); `fold`
      elige la primera (0) o segunda (1) ocurrencia.
    """
    try:
        naive = datetime.fromisoformat(local)
    except ValueError as exc:
        raise TimeError(f"Fecha u hora no válida: {local!r}") from exc
    if naive.tzinfo is not None:
        naive = naive.replace(tzinfo=None)
    if not (MIN_YEAR <= naive.year <= MAX_YEAR):
        raise TimeError(f"Año fuera del rango soportado ({MIN_YEAR}–{MAX_YEAR}).")

    warnings: list[str] = []
    status = "ok"
    if utc_offset_minutes is not None:
        if abs(utc_offset_minutes) > 18 * 60:
            raise TimeError("El desfase UTC manual debe estar entre −18:00 y +18:00.")
        aware = naive.replace(tzinfo=timezone(timedelta(minutes=utc_offset_minutes)))
        tz_label = "Desfase manual"
        abbrev = ""
        dst = None
    else:
        if not tz_name:
            raise TimeError("Falta la zona horaria.")
        try:
            tz = ZoneInfo(tz_name)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise TimeError(f"Zona horaria desconocida: {tz_name}") from exc
        a0 = naive.replace(tzinfo=tz, fold=0)
        a1 = naive.replace(tzinfo=tz, fold=1)
        if a0.utcoffset() != a1.utcoffset():
            back = a0.astimezone(timezone.utc).astimezone(tz).replace(tzinfo=None)
            if back != naive:
                status = "nonexistent"
                warnings.append(
                    "Esa hora no existió localmente (salto por cambio de horario). "
                    f"Se interpreta con el desfase {'posterior' if fold else 'anterior'} al cambio."
                )
            else:
                status = "ambiguous"
                warnings.append(
                    "Esa hora ocurrió dos veces (retroceso por cambio de horario). "
                    f"Se usa la {'segunda' if fold else 'primera'} ocurrencia."
                )
        aware = a1 if fold else a0
        tz_label = tz_name
        abbrev = aware.tzname() or ""
        dst = bool(aware.dst())
        if abbrev == "LMT":
            warnings.append("Para esta fecha la base IANA usa la hora media local (LMT) de la ciudad de referencia de la zona.")
        if naive.year < 1970:
            warnings.append(
                "Antes de 1970 las reglas de la base IANA pueden ser incompletas para algunas regiones; "
                "si conoces el desfase oficial de esa fecha, introdúcelo manualmente."
            )

    utc = aware.astimezone(timezone.utc)
    return {
        "local": naive.isoformat(timespec="seconds"),
        "timezone": tz_label,
        "tz_abbrev": abbrev,
        "utc_offset": _fmt_offset(aware.utcoffset()),
        "dst": dst,
        "utc": utc.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "status": status,
        "fold": fold,
        "warnings": warnings,
    }


def now_local(tz_name: str) -> str:
    return datetime.now(ZoneInfo(tz_name)).replace(tzinfo=None).isoformat(timespec="seconds")
