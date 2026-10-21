/**
 * Lógica de la bitácora en el navegador (port de backend/app/main.py + services.py).
 * Expone las mismas operaciones que antes ofrecía la API local, ahora sin servidor.
 */
import type {
  AstroConfig, CalendarDay, ChartResult, Comparison, Entry, EntrySummary, ExperienceInsights, MomentInput,
  PeriodInsights, Personal, Place, Revision, Settings, Stats, Zodiac,
} from '../types'
import { analyze, compareCharts, experienceInsights, featureHistory, periodSky } from './analysis'
import {
  allEntries, clearEntries, deleteEntry as dbDelete, getEntry, kvGet, kvSet, putEntry, utcnow, type StoredEntry,
} from './db'
import { computeChart, computeSnapshot, julianDayUT, parseUtc } from './engine'
import { getSwe } from './swe'
import { nowLocal, resolveLocalTime, timezoneAt, TimeError } from './time'
import { BODY_KEYS, EMOTIONS } from './zodiac'

export class ServiceError extends Error {}

export const DEFAULT_CONFIG: AstroConfig = { zodiac: 'sidereal', ayanamsa: 'lahiri', house_system: 'W', node_type: 'true' }
export const DEFAULT_SETTINGS: Settings = {
  config: DEFAULT_CONFIG,
  chart_style: 'south',
  show_nodes: true,
  default_location: null,
  online_geocoding: true,
  custom_tags: ['trabajo', 'familia', 'relaciones', 'salud', 'viajes', 'estudios', 'proyectos'],
  custom_emotions: [],
}

// --- Validación de la parte personal ------------------------------------------------

function cleanList(v: unknown, lower: boolean): string[] {
  const out: string[] = []
  for (const x of Array.isArray(v) ? v : []) {
    let t = String(x).trim()
    if (lower) t = t.toLowerCase()
    t = t.slice(0, 40)
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}
const intIn = (v: unknown, lo: number, hi: number) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < lo || n > hi) throw new ServiceError(`Valor fuera de rango (${lo}–${hi}): ${v}`)
  return n
}

export function cleanPersonal(p: Partial<Personal>): Personal {
  const mood = Number(p.mood)
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) throw new ServiceError('Elige un estado de ánimo (1 a 5).')
  const sleep = p.sleep_hours === null || p.sleep_hours === undefined || (p.sleep_hours as unknown) === '' ? null : Number(p.sleep_hours)
  if (sleep !== null && (!Number.isFinite(sleep) || sleep < 0 || sleep > 24)) throw new ServiceError('Horas de sueño entre 0 y 24.')
  const valence = ['', 'positivo', 'negativo', 'mixto'].includes(p.special_valence ?? '') ? (p.special_valence ?? '') : ''
  return {
    mood,
    emotions: cleanList(p.emotions, false),
    intensity: intIn(p.intensity, 1, 10),
    what_happened: String(p.what_happened ?? ''),
    how_felt: String(p.how_felt ?? ''),
    special: String(p.special ?? ''),
    special_valence: valence as Personal['special_valence'],
    tags: cleanList(p.tags, true),
    sleep_hours: sleep,
    energy: intIn(p.energy, 1, 10),
    stress: intIn(p.stress, 1, 10),
    notes: String(p.notes ?? ''),
  }
}

// --- Momento y cartas ---------------------------------------------------------------

function checkCoords(lat: number, lon: number) {
  if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) throw new ServiceError('Coordenadas fuera de rango.')
}

function resolveMoment(m: MomentInput) {
  checkCoords(m.latitude, m.longitude)
  let tz = m.timezone
  if (m.utc_offset_minutes == null && !tz) tz = timezoneAt(m.latitude, m.longitude) ?? 'UTC'
  return resolveLocalTime(m.local_datetime, tz, m.utc_offset_minutes, m.fold)
}

function chartFor(utc: string, lat: number, lon: number, c: AstroConfig) {
  return computeChart(julianDayUT(parseUtc(utc)), lat, lon, c.zodiac, c.ayanamsa, c.house_system, c.node_type)
}

const other = (z: Zodiac): Zodiac => (z === 'sidereal' ? 'tropical' : 'sidereal')

function withAlt(time: ReturnType<typeof resolveLocalTime>, name: string, lat: number, lon: number, c: AstroConfig): ChartResult {
  return {
    time, location_name: name,
    chart: chartFor(time.utc, lat, lon, c),
    alt_chart: chartFor(time.utc, lat, lon, { ...c, zodiac: other(c.zodiac) }),
  }
}

function nowInfo(tz: string) {
  return resolveLocalTime(nowLocal(tz), tz)
}

export async function chart(m: MomentInput, c: AstroConfig): Promise<ChartResult> {
  await getSwe()
  return withAlt(resolveMoment(m), m.location_name, m.latitude, m.longitude, c)
}

export async function now(p: Place, c: AstroConfig): Promise<ChartResult> {
  await getSwe()
  checkCoords(p.latitude, p.longitude)
  const tz = p.timezone || timezoneAt(p.latitude, p.longitude) || 'UTC'
  return withAlt(nowInfo(tz), p.name, p.latitude, p.longitude, c)
}

export async function compareNow(m: MomentInput, c: AstroConfig, here: Place | null) {
  await getSwe()
  const info = resolveMoment(m)
  const natal = chartFor(info.utc, m.latitude, m.longitude, c)
  const loc = here ?? { name: m.location_name, latitude: m.latitude, longitude: m.longitude, timezone: m.utc_offset_minutes == null ? info.timezone : null }
  const tz = loc.timezone || timezoneAt(loc.latitude, loc.longitude) || 'UTC'
  const ni = nowInfo(tz)
  const cur = chartFor(ni.utc, loc.latitude, loc.longitude, c)
  return {
    then: { time: info, location_name: m.location_name, chart: natal },
    now: { time: ni, location_name: loc.name, chart: cur },
    comparison: compareCharts(natal, cur),
  }
}

// --- Ajustes ------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings>>('settings')
  return { ...DEFAULT_SETTINGS, ...s, config: { ...DEFAULT_CONFIG, ...s?.config } }
}

export async function saveSettings(s: Settings): Promise<Settings> {
  await kvSet('settings', s)
  return s
}

// --- Entradas -----------------------------------------------------------------------

function toSummary(e: StoredEntry): EntrySummary {
  return {
    id: e.id!, created_at: e.created_at, updated_at: e.updated_at, local_datetime: e.local_datetime,
    timezone: e.timezone, utc_offset: e.utc_offset, utc_datetime: e.utc_datetime, time_info: e.time_info,
    location_name: e.location_name, latitude: e.latitude, longitude: e.longitude, astro_config: e.astro_config,
    is_demo: e.is_demo, revision_count: e.revisions.length, personal: e.personal,
    summary: {
      tropical: { sun: e.astro_snapshot.tropical.summary.surya, moon: e.astro_snapshot.tropical.summary.chandra, asc: e.astro_snapshot.tropical.summary.lagna },
      sidereal: { sun: e.astro_snapshot.sidereal.summary.surya, moon: e.astro_snapshot.sidereal.summary.chandra, asc: e.astro_snapshot.sidereal.summary.lagna },
    },
    moon_phase: e.astro_snapshot.tropical.moon_phase.name,
  }
}
const toEntry = (e: StoredEntry): Entry => ({ ...toSummary(e), astro_snapshot: e.astro_snapshot })

function applyMoment(e: Partial<StoredEntry>, m: MomentInput, c: AstroConfig) {
  const info = resolveMoment(m)
  Object.assign(e, {
    local_datetime: info.local, timezone: info.timezone, utc_offset: info.utc_offset, utc_datetime: info.utc,
    time_info: info, location_name: m.location_name || `${m.latitude.toFixed(4)}, ${m.longitude.toFixed(4)}`,
    latitude: m.latitude, longitude: m.longitude, astro_config: { ...c },
    astro_snapshot: computeSnapshot(info.utc, m.latitude, m.longitude, c),
  })
}

async function stored(id: number) {
  const e = await getEntry(id)
  if (!e) throw new ServiceError('Entrada no encontrada')
  return e
}

export async function createEntry(m: MomentInput, c: AstroConfig, personal: Personal, isDemo = false): Promise<Entry> {
  await getSwe()
  const e: Partial<StoredEntry> = { created_at: utcnow(), updated_at: utcnow(), personal: cleanPersonal(personal), is_demo: isDemo, revisions: [] }
  applyMoment(e, m, c)
  return toEntry(await putEntry(e as StoredEntry))
}

export async function quickEntry(personal: Personal, place: Place | null): Promise<Entry> {
  const s = await getSettings()
  const loc = place ?? s.default_location
  if (!loc) throw new ServiceError('Falta la ubicación: elige una ciudad o define una ubicación predeterminada.')
  const tz = loc.timezone || timezoneAt(loc.latitude, loc.longitude) || 'UTC'
  return createEntry(
    { local_datetime: nowLocal(tz), timezone: tz, utc_offset_minutes: null, fold: 0, location_name: loc.name, latitude: loc.latitude, longitude: loc.longitude },
    s.config, personal,
  )
}

export async function entry(id: number) {
  return toEntry(await stored(id))
}

export async function updatePersonal(id: number, p: Personal) {
  const e = await stored(id)
  e.personal = cleanPersonal(p)
  e.updated_at = utcnow()
  return toEntry(await putEntry(e))
}

export async function recalculate(id: number, m: MomentInput, c: AstroConfig | null, reason: string) {
  await getSwe()
  const e = await stored(id)
  const keys = ['local_datetime', 'timezone', 'utc_offset', 'utc_datetime', 'time_info', 'location_name', 'latitude', 'longitude', 'astro_config', 'astro_snapshot'] as const
  const previous = Object.fromEntries(keys.map((k) => [k, structuredClone(e[k])]))
  applyMoment(e, m, c ?? e.astro_config)
  const changes: Record<string, { antes: unknown; después: unknown }> = {}
  for (const k of ['local_datetime', 'timezone', 'utc_datetime', 'location_name', 'latitude', 'longitude', 'astro_config'] as const) {
    if (JSON.stringify(previous[k]) !== JSON.stringify(e[k])) changes[k] = { antes: previous[k], después: e[k] }
  }
  e.revisions.push({ id: e.revisions.length + 1, changed_at: utcnow(), reason, previous, changes })
  e.updated_at = utcnow()
  return toEntry(await putEntry(e))
}

export async function revisions(id: number): Promise<Revision[]> {
  return (await stored(id)).revisions.map(({ id: rid, changed_at, reason, changes }) => ({ id: rid, changed_at, reason, changes }))
}

export async function deleteEntry(id: number) {
  await stored(id)
  await dbDelete(id)
  return { deleted: id }
}

export async function deleteAll() {
  return { deleted: await clearEntries() }
}

export async function searchStored(p: { date_from?: string; date_to?: string; tag?: string; q?: string; mood?: number } = {}) {
  let rows = (await allEntries()).reverse()
  if (p.date_from) rows = rows.filter((e) => e.local_datetime >= p.date_from!)
  if (p.date_to) {
    const upper = p.date_to.length === 10 ? p.date_to + 'T23:59:59' : p.date_to
    rows = rows.filter((e) => e.local_datetime <= upper)
  }
  if (p.mood) rows = rows.filter((e) => e.personal.mood === p.mood)
  if (p.tag) {
    const t = p.tag.trim().toLowerCase()
    rows = rows.filter((e) => e.personal.tags.includes(t))
  }
  if (p.q) {
    const q = p.q.toLowerCase()
    rows = rows.filter((e) => {
      const x = e.personal
      return [x.what_happened, x.how_felt, x.special, x.notes, e.location_name, x.tags.join(' '), x.emotions.join(' ')].join(' ').toLowerCase().includes(q)
    })
  }
  return rows
}

export async function entries(p: { date_from?: string; date_to?: string; tag?: string; q?: string } = {}) {
  return (await searchStored(p)).map(toSummary)
}

export async function entryCompareNow(id: number, zodiac: Zodiac, here: Place | null) {
  await getSwe()
  const e = await stored(id)
  const natal = e.astro_snapshot[zodiac]
  const c = { ...e.astro_config, zodiac }
  const loc = here ?? { name: e.location_name, latitude: e.latitude, longitude: e.longitude, timezone: e.timezone !== 'Desfase manual' ? e.timezone : null }
  const tz = loc.timezone || timezoneAt(loc.latitude, loc.longitude) || 'UTC'
  const ni = nowInfo(tz)
  const cur = chartFor(ni.utc, loc.latitude, loc.longitude, c)
  return { now: { time: ni, location_name: loc.name || e.location_name, chart: cur } as ChartResult, comparison: compareCharts(natal, cur) as Comparison }
}

export async function calendar(year: number, month: number): Promise<CalendarDay[]> {
  const start = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`
  const end = `${String(year + (month === 12 ? 1 : 0)).padStart(4, '0')}-${String((month % 12) + 1).padStart(2, '0')}-01`
  const days = new Map<string, CalendarDay>()
  for (const e of await allEntries()) {
    if (e.local_datetime < start || e.local_datetime >= end) continue
    const d = e.local_datetime.slice(0, 10)
    const day = days.get(d) ?? { date: d, entries: [], mood_avg: 0 }
    day.entries.push({ id: e.id!, time: e.local_datetime.slice(11, 16), mood: e.personal.mood, is_demo: e.is_demo })
    days.set(d, day)
  }
  for (const d of days.values()) d.mood_avg = Math.round((d.entries.reduce((a, x) => a + x.mood, 0) / d.entries.length) * 100) / 100
  return [...days.values()]
}

// --- Análisis -----------------------------------------------------------------------

type Params = Record<string, string | boolean | string[] | undefined>
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

export async function stats(p: Params): Promise<Stats> {
  const zodiac = (str(p.zodiac) ?? 'sidereal') as Zodiac
  let rows = await searchStored({ date_from: str(p.date_from), date_to: str(p.date_to), tag: str(p.tag) })
  if (p.include_demo === false) rows = rows.filter((e) => !e.is_demo)
  const filters = ((p.filters as string[]) ?? []).filter((f) => f.includes(':')).map((f) => f.split(':', 2) as [string, string])
  const pa = str(p.a_from) && str(p.a_to) ? [str(p.a_from)!, str(p.a_to)!] as [string, string] : null
  const pb = str(p.b_from) && str(p.b_to) ? [str(p.b_from)!, str(p.b_to)!] as [string, string] : null
  return analyze(rows, zodiac, filters, str(p.group) ?? 'sign:moon', pa, pb)
}

export async function experience(p: Params): Promise<ExperienceInsights> {
  const zodiac = (str(p.zodiac) ?? 'sidereal') as Zodiac
  const demo = p.include_demo === true
  const all = (await searchStored()).filter((e) => demo || !e.is_demo)
  let matched = (await searchStored({ date_from: str(p.date_from), date_to: str(p.date_to), tag: str(p.tag), q: str(p.q) })).filter((e) => demo || !e.is_demo)
  const emotion = (p.emotion as string[] | undefined) ?? []
  if (emotion.length) matched = matched.filter((e) => emotion.every((x) => e.personal.emotions.includes(x)))
  if (str(p.valence)) matched = matched.filter((e) => e.personal.special_valence === p.valence)
  if (str(p.mood_max)) matched = matched.filter((e) => e.personal.mood <= Number(p.mood_max))
  if (str(p.mood_min)) matched = matched.filter((e) => e.personal.mood >= Number(p.mood_min))
  return { ...experienceInsights(matched, all, zodiac), entries: matched.map(toSummary) }
}

export async function period(p: { date_from: string; date_to: string; zodiac: string; include_demo: boolean }): Promise<PeriodInsights> {
  await getSwe()
  const d0 = Date.parse(p.date_from + 'T00:00:00Z'), d1 = Date.parse(p.date_to + 'T00:00:00Z')
  if (Number.isNaN(d0) || Number.isNaN(d1)) throw new ServiceError('Fechas no válidas')
  if (d1 < d0 || (d1 - d0) / 86400000 > 92) throw new ServiceError('El periodo debe tener entre 1 y 93 días.')
  const zodiac = p.zodiac as Zodiac
  const s = await getSettings()
  const tz = s.default_location?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const keep = (e: StoredEntry) => p.include_demo || !e.is_demo
  const inPeriod = (await searchStored({ date_from: p.date_from, date_to: p.date_to })).filter(keep).reverse()
  const all = (await searchStored()).filter(keep)
  const ids = new Set(inPeriod.map((e) => e.id!))
  const others = all.filter((e) => !ids.has(e.id!))
  const sky = periodSky(p.date_from, p.date_to, tz, zodiac, s.config.ayanamsa, s.config.node_type)

  const days = new Map<string, number[]>()
  for (const e of inPeriod) days.set(e.local_datetime.slice(0, 10), [...(days.get(e.local_datetime.slice(0, 10)) ?? []), e.personal.mood])
  const count = (xs: string[]) => {
    const m = new Map<string, number>()
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100
  return {
    date_from: p.date_from, date_to: p.date_to, zodiac, timezone: tz,
    n: inPeriod.length,
    mood_mean: inPeriod.length ? avg(inPeriod.map((e) => e.personal.mood)) : null,
    days: [...days.entries()].sort().map(([date, moods]) => ({ date, moods, mood_avg: avg(moods) })),
    emotions: count(inPeriod.flatMap((e) => e.personal.emotions)).map(([emotion, n]) => ({ emotion, count: n })),
    tags: count(inPeriod.flatMap((e) => e.personal.tags)).map(([tag, n]) => ({ tag, count: n })),
    events: inPeriod.filter((e) => e.personal.special || e.personal.what_happened).map((e) => ({
      id: e.id!, local_datetime: e.local_datetime, text: e.personal.special || e.personal.what_happened, valence: e.personal.special_valence,
    })),
    entries: inPeriod.map(toSummary),
    sky,
    history: featureHistory(sky.features, all, zodiac, ids),
    overall_mood_mean: others.length ? avg(others.map((e) => e.personal.mood)) : null,
    note: '«En otros registros» resume cómo te sentiste las demás veces que el cielo tuvo ese rasgo. Los promedios aparecen a partir de 5 registros y describen tus datos; no implican causalidad.',
  }
}

// --- Exportación y copias de seguridad ----------------------------------------------

export async function exportJson(): Promise<string> {
  const rows = await allEntries()
  await kvSet('last_backup', utcnow())
  return JSON.stringify({
    format: 'astrobitacora-backup', version: 1, exported_at: utcnow(),
    settings: await getSettings(),
    entries: rows.map((e) => ({ ...toEntry(e), revisions: e.revisions.map(({ changed_at, reason, previous, changes }) => ({ changed_at, reason, previous, changes })) })),
  }, null, 1)
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportCsv(): Promise<string> {
  const head = ['id', 'fecha_local', 'zona', 'utc', 'lugar', 'latitud', 'longitud', 'sistema', 'casas', 'ayanamsa',
    'animo', 'intensidad', 'emociones', 'etiquetas', 'que_paso', 'como_me_senti', 'algo_especial', 'valencia',
    'sueno_h', 'energia', 'estres', 'observaciones', 'demo',
    ...(['tropical', 'sidereal'] as const).flatMap((z) => [...BODY_KEYS, 'asc', 'mc'].map((k) => `${z}_${k}`))]
  const lines = [head.map(csvCell).join(',')]
  for (const e of await allEntries()) {
    const p = e.personal, c = e.astro_config
    const pos = (['tropical', 'sidereal'] as const).flatMap((z) => {
      const ch = e.astro_snapshot[z]
      const m = Object.fromEntries(ch.bodies.map((b) => [b.key, b.longitude.toFixed(6)]))
      return [...BODY_KEYS.map((k) => m[k] ?? ''), ch.angles.asc.longitude.toFixed(6), ch.angles.mc.longitude.toFixed(6)]
    })
    lines.push([e.id, e.local_datetime, e.timezone, e.utc_datetime, e.location_name, e.latitude, e.longitude, c.zodiac, c.house_system, c.ayanamsa,
      p.mood, p.intensity ?? '', p.emotions.join('|'), p.tags.join('|'), p.what_happened, p.how_felt, p.special, p.special_valence,
      p.sleep_hours ?? '', p.energy ?? '', p.stress ?? '', p.notes, Number(e.is_demo), ...pos].map(csvCell).join(','))
  }
  return '﻿' + lines.join('\r\n')
}

/** Restaura una copia (de esta versión web o de la versión de escritorio). Las cartas se conservan tal cual. */
export async function importBackup(data: unknown, mode: 'merge' | 'replace') {
  const d = data as { format?: string; entries?: Record<string, unknown>[]; settings?: Settings }
  if (d?.format !== 'astrobitacora-backup' || !Array.isArray(d.entries)) throw new ServiceError('El archivo no es una copia de seguridad de AstroBitácora.')
  // Los registros de demostración de versiones anteriores no se restauran.
  const parsed: StoredEntry[] = d.entries.filter((it) => !it.is_demo).map((it, i) => {
    try {
      const snap = it.astro_snapshot as StoredEntry['astro_snapshot']
      if (!snap?.tropical || !snap?.sidereal) throw new Error('falta la carta')
      return {
        created_at: String(it.created_at ?? utcnow()), updated_at: String(it.updated_at ?? utcnow()),
        local_datetime: String(it.local_datetime), timezone: String(it.timezone), utc_offset: String(it.utc_offset),
        utc_datetime: String(it.utc_datetime), time_info: it.time_info as StoredEntry['time_info'],
        location_name: String(it.location_name), latitude: Number(it.latitude), longitude: Number(it.longitude),
        astro_config: it.astro_config as AstroConfig, astro_snapshot: snap,
        personal: cleanPersonal(it.personal as Personal), is_demo: Boolean(it.is_demo),
        revisions: ((it.revisions as StoredEntry['revisions']) ?? []).map((r, j) => ({ ...r, id: j + 1 })),
      }
    } catch (err) {
      throw new ServiceError(`Entrada ${i + 1} no válida en la copia: ${(err as Error).message}`)
    }
  })
  if (mode === 'replace') {
    await clearEntries()
    if (d.settings) await saveSettings({ ...DEFAULT_SETTINGS, ...d.settings })
  }
  for (const e of parsed) await putEntry(e)
  return { imported: parsed.length, mode }
}

export async function lastBackup() {
  return kvGet<string>('last_backup')
}

// --- Geocodificación (solo envía el texto buscado a OpenStreetMap) ------------------

const NOMINATIM = 'https://nominatim.openstreetmap.org'
let lastGeo = 0
async function throttle() {
  // Política de Nominatim: como máximo una petición por segundo.
  const wait = lastGeo + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastGeo = Date.now()
}

export async function geoSearch(q: string): Promise<Place[]> {
  if (!(await getSettings()).online_geocoding) throw new ServiceError('La búsqueda de ciudades en línea está desactivada en Configuración.')
  await throttle()
  let r: Response
  try {
    r = await fetch(`${NOMINATIM}/search?${new URLSearchParams({ q, format: 'jsonv2', limit: '6', 'accept-language': 'es' })}`)
  } catch {
    throw new ServiceError('No se pudo consultar el buscador de lugares. Comprueba la conexión o escribe las coordenadas.')
  }
  if (!r.ok) throw new ServiceError(`El buscador de lugares respondió ${r.status}. Escribe las coordenadas a mano.`)
  const items = (await r.json()) as { display_name: string; lat: string; lon: string }[]
  return items.map((it) => {
    const lat = Number(it.lat), lon = Number(it.lon)
    return { name: it.display_name, latitude: lat, longitude: lon, timezone: timezoneAt(lat, lon) }
  })
}

export async function geoReverse(lat: number, lon: number): Promise<Place> {
  const tz = timezoneAt(lat, lon)
  let name = `${lat.toFixed(4)}, ${lon.toFixed(4)}`
  if ((await getSettings()).online_geocoding) {
    try {
      await throttle()
      const r = await fetch(`${NOMINATIM}/reverse?${new URLSearchParams({ lat: String(lat), lon: String(lon), format: 'jsonv2', zoom: '10', 'accept-language': 'es' })}`)
      if (r.ok) name = ((await r.json()) as { display_name?: string }).display_name ?? name
    } catch { /* sin conexión: se usan las coordenadas */ }
  }
  return { name, latitude: lat, longitude: lon, timezone: tz }
}

// --- Registro de demostración (retirado) --------------------------------------------

/** Las primeras versiones creaban un registro de ejemplo; se elimina una vez de los navegadores que lo tengan. */
export async function removeDemo() {
  if (await kvGet('demo_removed')) return
  for (const e of await allEntries()) if (e.is_demo) await dbDelete(e.id!)
  await kvSet('demo_removed', true)
}

export { EMOTIONS, TimeError }
