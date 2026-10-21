/**
 * Motor astronómico en el navegador (port de backend/app/astro/engine.py).
 *
 * Posiciones geocéntricas aparentes (aberración, deflexión y nutación) sobre la eclíptica verdadera
 * de la fecha. La capa sideral solo resta el ayanamsa verdadero.
 */
import type { Angle, Body, Chart, Zodiac } from '../types'
import { swe } from './swe'
import {
  AYANAMSAS, BODIES, ECL_NUT, HOUSE_CODE, HOUSE_SYSTEMS, KETU, MOON_PHASES, NODE_IDS, POLAR_UNDEFINED, RAHU, SIGNS, ZODIACS,
} from './zodiac'

const MOSHIER = 4
const SPEED = 256
const SIDEREAL = 65536
const FLAGS = MOSHIER | SPEED

export class AstroError extends Error {}

export const norm360 = (x: number) => ((x % 360) + 360) % 360

/** Día juliano (TU) a partir de un instante UTC en milisegundos. Calendario gregoriano. */
export function julianDayUT(utcMs: number): number {
  const d = new Date(utcMs)
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + d.getUTCMilliseconds() / 3.6e6
  return swe().julianDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour)
}

export const parseUtc = (iso: string) => Date.parse(iso.endsWith('Z') ? iso : iso + 'Z')

/** Signo y grado; se trunca al segundo de arco para no mostrar nunca «30°» de un signo. */
export function signInfo(lon: number) {
  lon = norm360(lon)
  const total = Math.floor(lon * 3600 + 1e-7) % (360 * 3600)
  const idx = Math.floor(total / (30 * 3600))
  let rem = total - idx * 30 * 3600
  const d = Math.floor(rem / 3600)
  rem -= d * 3600
  const m = Math.floor(rem / 60)
  const s = rem - m * 60
  const [key, name, symbol, rashi] = SIGNS[idx]
  return {
    sign_index: idx, sign: key, sign_name: name, sign_symbol: symbol, rashi,
    degree_in_sign: lon - idx * 30,
    dms: `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″`,
  }
}

function houseOf(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i], b = cusps[(i + 1) % 12]
    const span = norm360(b - a)
    if (norm360(lon - a) < span || span === 0) return i + 1
  }
  return 12
}

function calc(jd: number, id: number, flags: number) {
  const p = swe().calculatePosition(jd, id, flags)
  return { lon: p.longitude, lat: p.latitude, dist: p.distance, speed: p.longitudeSpeed }
}

/**
 * Fracción iluminada de la Luna a partir del ángulo de fase (Meeus, Astronomical Algorithms, 48.2–48.3):
 * cos ψ = cos β·cos(λ − λ☉);  tan i = R·sin ψ / (Δ − R·cos ψ);  k = (1 + cos i) / 2
 */
export function moonIllumination(moon: { lon: number; lat: number; dist: number }, sun: { lon: number; dist: number }) {
  const rad = Math.PI / 180
  const psi = Math.acos(Math.cos(moon.lat * rad) * Math.cos((moon.lon - sun.lon) * rad))
  const i = Math.atan2(sun.dist * Math.sin(psi), moon.dist - sun.dist * Math.cos(psi))
  return (1 + Math.cos(i)) / 2
}

export function computeChart(
  jd: number, lat: number, lon: number,
  zodiac: Zodiac = 'tropical', ayanamsa = 'lahiri', houseSystem = 'P', nodeType = 'true', includeNodes = true,
): Chart {
  if (!ZODIACS[zodiac]) throw new AstroError(`Zodiaco desconocido: ${zodiac}`)
  if (!AYANAMSAS[ayanamsa]) throw new AstroError(`Ayanamsa desconocido: ${ayanamsa}`)
  if (!HOUSE_SYSTEMS[houseSystem]) throw new AstroError(`Sistema de casas desconocido: ${houseSystem}`)
  if (NODE_IDS[nodeType] === undefined) throw new AstroError(`Tipo de nodo desconocido: ${nodeType}`)
  if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) throw new AstroError('Coordenadas fuera de rango.')

  const s = swe()
  const warnings: string[] = []
  let flags = FLAGS
  let ayan: number | null = null
  if (zodiac === 'sidereal') {
    s.setSiderealMode(AYANAMSAS[ayanamsa][0])
    flags |= SIDEREAL
    // Ayanamsa «verdadero» (con nutación): es exactamente tropical aparente − sideral.
    ayan = s.getAyanamsaExUt(jd, MOSHIER)
  }
  const trueObliquity = calc(jd, ECL_NUT, MOSHIER).lon

  const raw: { key: string; name: string; symbol: string; abbr: string; x: ReturnType<typeof calc>; isNode: boolean }[] = []
  for (const [key, id, name, symbol, abbr] of BODIES) raw.push({ key, name, symbol, abbr, x: calc(jd, id, flags), isNode: false })
  if (includeNodes) {
    const n = calc(jd, NODE_IDS[nodeType], flags)
    raw.push({ key: RAHU[0], name: RAHU[1], symbol: RAHU[2], abbr: RAHU[3], x: n, isNode: true })
    raw.push({ key: KETU[0], name: KETU[1], symbol: KETU[2], abbr: KETU[3], x: { ...n, lon: norm360(n.lon + 180), lat: -n.lat }, isNode: true })
  }

  let hsUsed = houseSystem
  if (POLAR_UNDEFINED.has(houseSystem) && Math.abs(lat) >= 90 - trueObliquity) {
    hsUsed = 'O'
    warnings.push(
      `${HOUSE_SYSTEMS[houseSystem]} no está definido a ${Math.abs(lat).toFixed(2)}° de latitud ` +
      `(círculo polar, límite ${(90 - trueObliquity).toFixed(2)}°). Se usa Porfirio como aproximación.`,
    )
  }
  let houses
  try {
    houses = s.calculateHouses(jd, lat, lon, HOUSE_CODE[hsUsed] as never)
  } catch {
    warnings.push(`No se pudo calcular ${HOUSE_SYSTEMS[hsUsed]}; se usa Porfirio.`)
    hsUsed = 'O'
    houses = s.calculateHouses(jd, lat, lon, 'O' as never)
  }
  // Casas siderales = casas tropicales − ayanamsa (lo mismo que hace swe_houses_ex con SEFLG_SIDEREAL).
  const shift = ayan ?? 0
  let cusps = houses.cusps.slice(houses.cusps.length === 13 ? 1 : 0).map((c: number) => norm360(c - shift))
  let asc = norm360(houses.ascendant - shift)
  const mc = norm360(houses.mc - shift)
  if (hsUsed === 'W') {
    // En signo entero las cúspides caen en el 0° del signo del ascendente del zodiaco elegido.
    const first = Math.floor(asc / 30) * 30
    cusps = Array.from({ length: 12 }, (_, i) => norm360(first + i * 30))
  }
  asc = norm360(asc)
  const ascSign = Math.floor(asc / 30)

  const bodies: Body[] = raw.map((r) => {
    const l = norm360(r.x.lon)
    const si = signInfo(l)
    return {
      key: r.key, name: r.name, symbol: r.symbol, abbr: r.abbr,
      longitude: l, latitude: r.x.lat, distance_au: r.x.dist, speed: r.x.speed,
      retrograde: r.x.speed < 0, is_node: r.isNode, ...si,
      house: houseOf(l, cusps),
      whole_sign_house: ((si.sign_index - ascSign + 12) % 12) + 1,
    }
  })
  const byKey = Object.fromEntries(bodies.map((b) => [b.key, b]))
  const elong = norm360(byKey.moon.longitude - byKey.sun.longitude)
  const phaseIdx = Math.floor(((elong + 22.5) % 360) / 45)
  const sunT = calc(jd, 0, MOSHIER), moonT = calc(jd, 1, MOSHIER)

  const angle = (key: string, name: string, symbol: string, l: number): Angle => ({ key, name, symbol, longitude: l, ...signInfo(l) })
  const angles = { asc: angle('asc', 'Ascendente', 'Asc', asc), mc: angle('mc', 'Medio Cielo', 'MC', mc) }
  if (zodiac === 'sidereal') {
    warnings.push('Posiciones siderales = posición tropical − ayanamsa. Las casas védicas de la carta usan signo entero desde el Lagna.')
  }

  return {
    meta: {
      jd_ut: jd, zodiac, zodiac_name: ZODIACS[zodiac],
      ayanamsa: zodiac === 'sidereal' ? ayanamsa : null,
      ayanamsa_name: zodiac === 'sidereal' ? AYANAMSAS[ayanamsa][1] : null,
      ayanamsa_value: ayan,
      house_system: houseSystem, house_system_used: hsUsed, house_system_name: HOUSE_SYSTEMS[hsUsed],
      node_type: nodeType,
      engine: 'Swiss Ephemeris (teoría analítica de Moshier)',
      engine_version: s.version(),
      true_obliquity: trueObliquity,
      sidereal_time_hours: s.siderealTime(jd),
      latitude: lat, longitude: lon, warnings,
    },
    bodies,
    angles,
    houses: { cusps, system: hsUsed },
    summary: { lagna: angles.asc.sign, chandra: byKey.moon.sign, surya: byKey.sun.sign },
    moon_phase: { elongation: elong, name: MOON_PHASES[phaseIdx], index: phaseIdx, illumination: moonIllumination(moonT, sunT) },
  }
}

/** Longitud y velocidad de cada cuerpo, sin casas: para muestrear periodos. */
export function bodyLongitudes(jd: number, zodiac: Zodiac = 'tropical', ayanamsa = 'lahiri', nodeType = 'true') {
  const s = swe()
  let flags = FLAGS
  if (zodiac === 'sidereal') {
    s.setSiderealMode(AYANAMSAS[ayanamsa][0])
    flags |= SIDEREAL
  }
  const out: Record<string, [number, number]> = {}
  for (const [key, id] of BODIES) {
    const x = calc(jd, id, flags)
    out[key] = [norm360(x.lon), x.speed]
  }
  const n = calc(jd, NODE_IDS[nodeType], flags)
  out.rahu = [norm360(n.lon), n.speed]
  return out
}

export interface SnapshotConfig { ayanamsa?: string; house_system?: string; node_type?: string }

export function computeSnapshot(utcIso: string, lat: number, lon: number, config: SnapshotConfig): Record<Zodiac, Chart> {
  const jd = julianDayUT(parseUtc(utcIso))
  const a = config.ayanamsa ?? 'lahiri', h = config.house_system ?? 'P', n = config.node_type ?? 'true'
  return {
    tropical: computeChart(jd, lat, lon, 'tropical', a, h, n),
    sidereal: computeChart(jd, lat, lon, 'sidereal', a, h, n),
  }
}
