/**
 * Hora local → UTC con las reglas IANA del navegador (Intl, que incluye el horario de verano histórico).
 * Port de backend/app/astro/timeutil.py, con la misma semántica de `fold` para horas ambiguas o inexistentes.
 */
import tzlookup from '@photostructure/tz-lookup'
import type { TimeInfo } from '../types'

export class TimeError extends Error {}

export const MIN_YEAR = 1
export const MAX_YEAR = 2999

export function timezoneAt(lat: number, lon: number): string | null {
  try {
    return tzlookup(lat, lon)
  } catch {
    return null
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function formatter(tz: string) {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', era: 'short',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    })
    fmtCache.set(tz, f)
  }
  return f
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz)
    return true
  } catch {
    return false
  }
}

/** UTC «de pared» en ms para año/mes/día/h/m/s, sin el problema de Date.UTC con años < 100. */
function wallMs(y: number, mo: number, d: number, h: number, mi: number, s: number) {
  const dt = new Date(0)
  dt.setUTCFullYear(y, mo - 1, d)
  dt.setUTCHours(h, mi, s, 0)
  return dt.getTime()
}

/** Desfase (ms) de la zona en un instante UTC. */
export function offsetAt(utcMs: number, tz: string): number {
  const p: Record<string, string> = {}
  for (const part of formatter(tz).formatToParts(new Date(utcMs))) p[part.type] = part.value
  let year = Number(p.year)
  if (p.era === 'BC' || p.era === 'B') year = 1 - year
  const wall = wallMs(year, Number(p.month), Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return wall - Math.floor(utcMs / 1000) * 1000
}

function fmtOffset(ms: number): string {
  const total = Math.round(ms / 1000)
  const sign = total >= 0 ? '+' : '-'
  const a = Math.abs(total)
  const h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = a % 60
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${s ? ':' + String(s).padStart(2, '0') : ''}`
}

function isoLocal(ms: number) {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(y, 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export function isoUtc(ms: number) {
  return isoLocal(ms) + 'Z'
}

export function parseLocal(local: string) {
  const m = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) throw new TimeError(`Fecha u hora no válida: ${local}`)
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number)
  const ms = wallMs(y, mo, d, h, mi, s)
  const back = new Date(ms)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() + 1 !== mo || back.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) {
    throw new TimeError(`Fecha u hora no válida: ${local}`)
  }
  if (y < MIN_YEAR || y > MAX_YEAR) throw new TimeError(`Año fuera del rango soportado (${MIN_YEAR}–${MAX_YEAR}).`)
  return { ms, year: y }
}

function shortName(utcMs: number, tz: string) {
  try {
    const p = new Intl.DateTimeFormat('es', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(utcMs))
    return p.find((x) => x.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

export function resolveLocalTime(local: string, tz: string | null, utcOffsetMinutes: number | null = null, fold: 0 | 1 = 0): TimeInfo {
  const { ms: wall, year } = parseLocal(local)
  const warnings: string[] = []
  let status: TimeInfo['status'] = 'ok'
  let offset: number
  let label: string
  let abbrev = ''
  let dst: boolean | null = null

  if (utcOffsetMinutes !== null && utcOffsetMinutes !== undefined) {
    if (Math.abs(utcOffsetMinutes) > 18 * 60) throw new TimeError('El desfase UTC manual debe estar entre −18:00 y +18:00.')
    offset = utcOffsetMinutes * 60000
    label = 'Desfase manual'
  } else {
    if (!tz) throw new TimeError('Falta la zona horaria.')
    if (!isValidTimeZone(tz)) throw new TimeError(`Zona horaria desconocida: ${tz}`)
    // Desfases vigentes justo antes y justo después del instante: si difieren, hay una transición cerca.
    const before = offsetAt(wall - 86400000, tz)
    const after = offsetAt(wall + 86400000, tz)
    const valid = [...new Set([before, after])].filter((o) => offsetAt(wall - o, tz) === o).sort((a, b) => b - a)
    if (valid.length === 2) {
      status = 'ambiguous'
      offset = fold ? valid[1] : valid[0]
      warnings.push(`Esa hora ocurrió dos veces (retroceso por cambio de horario). Se usa la ${fold ? 'segunda' : 'primera'} ocurrencia.`)
    } else if (valid.length === 1) {
      offset = valid[0]
    } else {
      status = 'nonexistent'
      offset = fold ? after : before
      warnings.push(
        'Esa hora no existió localmente (salto por cambio de horario). ' +
        `Se interpreta con el desfase ${fold ? 'posterior' : 'anterior'} al cambio.`,
      )
    }
    label = tz
    const utc = wall - offset
    abbrev = shortName(utc, tz)
    // Horario de verano: el desfase supera al mínimo del año (enero/julio).
    const jan = offsetAt(wallMs(year, 1, 15, 12, 0, 0), tz)
    const jul = offsetAt(wallMs(year, 7, 15, 12, 0, 0), tz)
    dst = jan !== jul && offset > Math.min(jan, jul)
    if (offset % 60000 !== 0) warnings.push('Para esta fecha la base IANA usa la hora media local (LMT) de la ciudad de referencia de la zona.')
    if (year < 1970) {
      warnings.push(
        'Antes de 1970 las reglas de la base IANA pueden ser incompletas para algunas regiones; ' +
        'si conoces el desfase oficial de esa fecha, introdúcelo manualmente.',
      )
    }
  }

  const utc = wall - offset
  return {
    local: isoLocal(wall),
    timezone: label,
    tz_abbrev: abbrev,
    utc_offset: fmtOffset(offset),
    dst,
    utc: isoUtc(utc),
    status,
    fold,
    warnings,
  }
}

/** Fecha-hora local actual en una zona, 'YYYY-MM-DDTHH:MM:SS'. */
export function nowLocal(tz: string): string {
  const now = Date.now()
  return isoLocal(Math.floor(now / 1000) * 1000 + offsetAt(now, tz))
}
