/**
 * Estadística descriptiva y «¿dónde estaban mis astros?» (port de services.analyze, insights.py y transits.py).
 * Todo describe los propios registros: ninguna cifra implica causalidad.
 */
import type { Chart, Comparison, Stats, Summary, Zodiac } from '../types'
import type { StoredEntry } from './db'
import { bodyLongitudes, julianDayUT, norm360 } from './engine'
import { offsetAt } from './time'
import { BODIES, BODY_NAMES, MOON_PHASES, SIGNS, SIGN_IDX } from './zodiac'

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d
function stdev(xs: number[]) {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}
function counter<T>(xs: T[]): [T, number][] {
  const m = new Map<T, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  // Orden estable: más frecuente primero, empate por primera aparición (como Counter.most_common).
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

// --- Estadísticas generales ---------------------------------------------------------

const MIN_N = 5
const SMALL_N = 20
const reliability = (n: number): Summary['reliability'] => (n < MIN_N ? 'insuficiente' : n < SMALL_N ? 'orientativa' : 'descriptiva')

function summary(entries: StoredEntry[]): Summary {
  const n = entries.length
  const moods = entries.map((e) => e.personal.mood)
  const intens = entries.map((e) => e.personal.intensity).filter((x): x is number => x != null)
  const rel = reliability(n)
  const show = rel !== 'insuficiente'
  return {
    n, reliability: rel,
    mood_mean: show ? round(mean(moods)) : null,
    mood_sd: show && n > 1 ? round(stdev(moods)) : null,
    intensity_mean: show && intens.length >= MIN_N ? round(mean(intens)) : null,
  }
}

function body(e: StoredEntry, zodiac: Zodiac, key: string) {
  const ch = e.astro_snapshot[zodiac]
  return ch.bodies.find((b) => b.key === key) ?? (ch.angles as Record<string, { sign: string; rashi: string }>)[key] ?? null
}

export const signLabel = (sign: string, zodiac: Zodiac) => {
  const s = SIGNS[SIGN_IDX[sign]]
  return zodiac === 'sidereal' ? `${s[3]} (${s[1]})` : s[1]
}

function groupKey(e: StoredEntry, zodiac: Zodiac, group: string): [string, string] | null {
  const [kind, planet] = group.split(':')
  if (kind === 'sign') {
    const b = body(e, zodiac, planet || 'moon')
    return b ? [b.sign, signLabel(b.sign, zodiac)] : null
  }
  if (kind === 'phase') {
    const p = e.astro_snapshot.tropical.moon_phase
    return [String(p.index), p.name]
  }
  if (kind === 'retro') {
    const b = e.astro_snapshot[zodiac].bodies.find((x) => x.key === (planet || 'mercury'))
    if (!b) return null
    return b.retrograde ? ['retro', 'Retrógrado aparente'] : ['directo', 'Directo']
  }
  throw new Error(`Agrupación desconocida: ${group}`)
}

function order(group: string, key: string) {
  if (group.startsWith('sign')) return SIGN_IDX[key]
  if (group.startsWith('phase')) return Number(key)
  return key === 'directo' ? 0 : 1
}

export function analyze(
  entries: StoredEntry[], zodiac: Zodiac, filters: [string, string][], group: string,
  periodA: [string, string] | null, periodB: [string, string] | null,
): Stats {
  for (const [planet, sign] of filters) entries = entries.filter((e) => body(e, zodiac, planet)?.sign === sign)
  entries = [...entries].sort((a, b) => a.local_datetime.localeCompare(b.local_datetime))
  const n = entries.length

  const daily = new Map<string, number[]>()
  for (const e of entries) {
    const d = e.local_datetime.slice(0, 10)
    daily.set(d, [...(daily.get(d) ?? []), e.personal.mood])
  }
  const groups = new Map<string, StoredEntry[]>()
  const labels = new Map<string, string>()
  for (const e of entries) {
    const gk = groupKey(e, zodiac, group)
    if (!gk) continue
    groups.set(gk[0], [...(groups.get(gk[0]) ?? []), e])
    labels.set(gk[0], gk[1])
  }
  let periods: Stats['periods'] = null
  if (periodA && periodB) {
    const inRange = (e: StoredEntry, r: [string, string]) => r[0] <= e.local_datetime.slice(0, 10) && e.local_datetime.slice(0, 10) <= r[1]
    const a = summary(entries.filter((e) => inRange(e, periodA)))
    const b = summary(entries.filter((e) => inRange(e, periodB)))
    periods = {
      a: { range: periodA, ...a }, b: { range: periodB, ...b },
      mood_diff: a.mood_mean != null && b.mood_mean != null ? round(b.mood_mean - a.mood_mean) : null,
    }
  }
  const warnings: string[] = []
  if (n < MIN_N) warnings.push(`Solo hay ${n} registro(s) con estos filtros: no se calculan promedios.`)
  else if (n < SMALL_N) warnings.push(`Con ${n} registros, cualquier diferencia entre grupos puede deberse al azar.`)
  const valence = counter(entries.map((e) => e.personal.special_valence || 'sin_marcar'))
  const vmap = Object.fromEntries(valence)

  return {
    n, zodiac, group,
    overall: summary(entries),
    series: entries.map((e) => ({
      id: e.id!, local_datetime: e.local_datetime, mood: e.personal.mood, intensity: e.personal.intensity,
      valence: e.personal.special_valence, is_demo: e.is_demo,
    })),
    daily: [...daily.entries()].sort().map(([date, v]) => ({ date, mood: round(mean(v)), n: v.length })),
    emotions: counter(entries.flatMap((e) => e.personal.emotions)).map(([emotion, count]) => ({ emotion, count, pct: round((100 * count) / n, 1) })),
    tags: counter(entries.flatMap((e) => e.personal.tags)).map(([tag, count]) => ({ tag, count })),
    valence: { positivo: vmap.positivo ?? 0, negativo: vmap.negativo ?? 0, mixto: vmap.mixto ?? 0, sin_marcar: vmap.sin_marcar ?? 0 },
    groups: [...groups.entries()]
      .map(([key, v]) => ({ key, label: labels.get(key)!, ...summary(v) }))
      .sort((a, b) => order(group, a.key) - order(group, b.key)),
    periods,
    thresholds: { min_n: MIN_N, small_n: SMALL_N },
    warnings,
    disclaimer: 'Estas cifras describen asociaciones en tus propios registros. Una coincidencia entre posiciones planetarias y estados de ánimo no demuestra que los astros los causen.',
  }
}

// --- Rasgos del cielo y coincidencias -----------------------------------------------

const MIN_MATCH = 3
const SMALL_MATCH = 10
const MIN_FEATURE = 2
const MIN_DIFF = 5

export function featureLabel(f: string, zodiac: Zodiac) {
  const [kind, a, b] = f.split(':')
  if (kind === 'sign') return `${BODY_NAMES[a]} en ${signLabel(b, zodiac)}`
  if (kind === 'retro') return `${BODY_NAMES[a]} retrógrado`
  if (kind === 'phase') return `Fase lunar: ${MOON_PHASES[Number(a)].toLowerCase()}`
  return f
}

function featureMeta(f: string) {
  const [kind, a] = f.split(':')
  return { kind: kind as 'sign' | 'retro' | 'phase', body: kind === 'phase' ? 'moon' : a }
}

export function entryFeatures(e: StoredEntry, zodiac: Zodiac): Set<string> {
  const feats = new Set<string>()
  for (const b of e.astro_snapshot[zodiac].bodies) {
    if (b.key === 'ketu') continue
    feats.add(`sign:${b.key}:${b.sign}`)
    if (b.retrograde && !b.is_node) feats.add(`retro:${b.key}`)
  }
  feats.add(`phase:${e.astro_snapshot.tropical.moon_phase.index}`)
  return feats
}

function moodStats(entries: StoredEntry[]) {
  const n = entries.length
  return {
    n,
    mood_mean: n >= 5 ? round(mean(entries.map((e) => e.personal.mood))) : null,
    top_emotions: counter(entries.flatMap((e) => e.personal.emotions)).slice(0, 3).map(([k]) => k),
  }
}

export function experienceInsights(matched: StoredEntry[], all: StoredEntry[], zodiac: Zodiac) {
  const ids = new Set(matched.map((e) => e.id))
  const rest = all.filter((e) => !ids.has(e.id))
  const nm = matched.length, nr = rest.length
  const fm = new Map<string, number>(), fr = new Map<string, number>()
  for (const e of matched) for (const f of entryFeatures(e, zodiac)) fm.set(f, (fm.get(f) ?? 0) + 1)
  for (const e of rest) for (const f of entryFeatures(e, zodiac)) fr.set(f, (fr.get(f) ?? 0) + 1)

  const rows = [...fm.entries()].map(([f, c]) => {
    const pm = c / nm
    const pr = nr ? (fr.get(f) ?? 0) / nr : null
    return {
      feature: f, ...featureMeta(f), label: featureLabel(f, zodiac),
      count: c, pct: round(100 * pm, 1), rest_count: fr.get(f) ?? 0,
      rest_pct: pr !== null ? round(100 * pr, 1) : null,
      diff: pr !== null ? round(100 * (pm - pr), 1) : null,
    }
  })
  let highlights = rows
    .filter((r) => r.count >= MIN_FEATURE && (r.diff === null || r.diff >= MIN_DIFF))
    .sort((a, b) => (b.diff ?? b.pct) - (a.diff ?? a.pct) || b.count - a.count)
  const byBody: Record<string, { sign: string; count: number; pct: number }[]> = {}
  for (const r of rows) if (r.kind === 'sign') (byBody[r.body] ??= []).push({ sign: r.feature.split(':')[2], count: r.count, pct: r.pct })
  for (const v of Object.values(byBody)) v.sort((a, b) => b.count - a.count)

  const rel = nm < MIN_MATCH ? 'insuficiente' : nm < SMALL_MATCH ? 'orientativa' : 'descriptiva'
  const warnings: string[] = []
  if (rel === 'insuficiente') {
    warnings.push(`Solo ${nm} registro(s) coinciden: hacen falta al menos ${MIN_MATCH} para buscar coincidencias.`)
    highlights = []
  } else if (rel === 'orientativa') {
    warnings.push(`Con ${nm} registros, las coincidencias pueden deberse al azar. Sigue registrando para ver si se mantienen.`)
  }
  if (nr < 5) warnings.push('Hay pocos registros fuera de esta selección para comparar.')
  if (highlights.length) {
    warnings.push('Se comparan muchas posiciones a la vez, así que algunas coincidencias aparecerán por puro azar. Las que se mantengan a medida que sumes registros son las que merecen atención.')
  }
  return {
    n: nm, n_rest: nr, zodiac, reliability: rel as 'insuficiente' | 'orientativa' | 'descriptiva',
    highlights: highlights.slice(0, 12), by_body: byBody, matched_stats: moodStats(matched), warnings,
    note: 'Muestra en qué posiciones estaban los astros cuando registraste esta experiencia y con qué frecuencia se dan en el resto de tus registros. Es una descripción de tus datos, no una relación de causa.',
  }
}

// --- Cielo de un periodo ------------------------------------------------------------

function localDate(utcMs: number, tz: string) {
  const d = new Date(utcMs + offsetAt(utcMs, tz))
  return d.toISOString().slice(0, 10)
}

export function periodSky(from: string, to: string, tz: string, zodiac: Zodiac, ayanamsa: string, nodeType: string) {
  const startWall = Date.parse(from + 'T00:00:00Z'), endWall = Date.parse(to + 'T23:59:00Z')
  const start = startWall - offsetAt(startWall, tz), end = endWall - offsetAt(endWall, tz)
  const series: [string, Record<string, [number, number]>][] = []
  for (let t = start; t <= end; t += 6 * 3600 * 1000) series.push([localDate(t, tz), bodyLongitudes(julianDayUT(t), zodiac, ayanamsa, nodeType)])

  const keys = [...BODIES.map((b) => b[0]), 'rahu']
  const bodies = keys.map((key) => {
    const segs: { sign: string; label: string; from: string; to: string }[] = []
    const retroDays = new Set<string>()
    for (const [d, pos] of series) {
      const [lon, speed] = pos[key]
      const sign = SIGNS[Math.floor(lon / 30)][0]
      if (!segs.length || segs[segs.length - 1].sign !== sign) segs.push({ sign, label: signLabel(sign, zodiac), from: d, to: d })
      segs[segs.length - 1].to = d
      if (speed < 0 && key !== 'rahu') retroDays.add(d)
    }
    const first = series[0][1][key][1], last = series[series.length - 1][1][key][1]
    const station = key !== 'rahu' && (first < 0) !== (last < 0) ? (last < 0 ? 'se vuelve retrógrado' : 'retoma el movimiento directo') : null
    return {
      key, name: BODY_NAMES[key], segments: segs,
      retrograde: retroDays.size > 0 && key !== 'rahu',
      retro_all_period: retroDays.size > 0 && first < 0 && last < 0,
      station,
    }
  })
  const lunar: { date: string; name: string }[] = []
  let prev: number | null = null
  for (const [d, pos] of series) {
    const el = norm360(pos.moon[0] - pos.sun[0])
    if (prev !== null) {
      if (prev > 300 && el < 60) lunar.push({ date: d, name: 'Luna nueva' })
      else if (prev < 180 && el >= 180) lunar.push({ date: d, name: 'Luna llena' })
    }
    prev = el
  }
  const features = new Set<string>()
  for (const b of bodies) {
    for (const s of b.segments) features.add(`sign:${b.key}:${s.sign}`)
    if (b.retrograde) features.add(`retro:${b.key}`)
  }
  return { bodies, lunar_events: lunar, features: [...features].sort() }
}

export function featureHistory(features: string[], all: StoredEntry[], zodiac: Zodiac, exclude: Set<number>) {
  const others = all.filter((e) => !exclude.has(e.id!))
  const feats = new Map(others.map((e) => [e.id!, entryFeatures(e, zodiac)]))
  const overall = others.length ? mean(others.map((e) => e.personal.mood)) : null
  return features
    .map((f) => {
      const withF = others.filter((e) => feats.get(e.id!)!.has(f))
      const st = moodStats(withF)
      return {
        feature: f, ...featureMeta(f), label: featureLabel(f, zodiac), ...st,
        mood_diff: st.mood_mean !== null && overall !== null ? round(st.mood_mean - overall) : null,
        background: others.length > 0 && withF.length / others.length >= 0.8,
      }
    })
    .sort((a, b) =>
      Number(a.background) - Number(b.background) ||
      Number(a.mood_diff === null) - Number(b.mood_diff === null) ||
      Math.abs(b.mood_diff ?? 0) - Math.abs(a.mood_diff ?? 0) ||
      b.n - a.n)
}

// --- Comparación de cartas (tránsitos) ----------------------------------------------

const ASPECTS: [string, string, string, number, number][] = [
  ['conjunction', 'Conjunción', '☌', 0, 3],
  ['sextile', 'Sextil', '⚹', 60, 2],
  ['square', 'Cuadratura', '□', 90, 3],
  ['trine', 'Trígono', '△', 120, 3],
  ['opposition', 'Oposición', '☍', 180, 3],
]
const sep = (a: number, b: number) => {
  const d = Math.abs(norm360(a) - norm360(b)) % 360
  return d > 180 ? 360 - d : d
}
function houseOf(lon: number, cusps: number[]) {
  for (let i = 0; i < 12; i++) if (norm360(lon - cusps[i]) < norm360(cusps[(i + 1) % 12] - cusps[i])) return i + 1
  return 12
}

export function compareCharts(natal: Chart, current: Chart): Comparison {
  if (natal.meta.zodiac !== current.meta.zodiac) throw new Error('Ambas cartas deben usar el mismo zodiaco para compararlas.')
  const points: Record<string, { name: string; symbol: string; sign: string; dms: string; longitude: number; retrograde?: boolean }> = {}
  for (const b of natal.bodies) points[b.key] = b
  points.asc = natal.angles.asc
  points.mc = natal.angles.mc
  const changes = current.bodies.filter((c) => points[c.key]).map((c) => {
    const o = points[c.key]
    return {
      key: c.key, name: c.name, symbol: c.symbol,
      then_sign: o.sign, then_dms: o.dms, then_longitude: o.longitude, then_retrograde: o.retrograde ?? false,
      now_sign: c.sign, now_dms: c.dms, now_longitude: c.longitude, now_retrograde: c.retrograde,
      sign_changed: o.sign !== c.sign, delta_longitude: norm360(c.longitude - o.longitude),
      natal_house_now: houseOf(c.longitude, natal.houses.cusps),
    }
  })
  const transits: Comparison['transits'] = []
  for (const c of current.bodies) {
    if (c.key === 'ketu') continue
    for (const [key, o] of Object.entries(points)) {
      if (key === 'ketu') continue
      const s = sep(c.longitude, o.longitude)
      for (const [akey, aname, asym, angle, orb] of ASPECTS) {
        const diff = Math.abs(s - angle)
        if (diff <= orb) {
          transits.push({
            transiting: c.key, transiting_name: c.name, transiting_symbol: c.symbol,
            natal: key, natal_name: o.name, natal_symbol: o.symbol,
            aspect: akey, aspect_name: aname, aspect_symbol: asym, orb: round(diff),
          })
        }
      }
    }
  }
  transits.sort((a, b) => a.orb - b.orb)
  return {
    zodiac: current.meta.zodiac, changes, transits,
    orbs: Object.fromEntries(ASPECTS.map((a) => [a[0], a[4]])),
    note: 'Los aspectos y tránsitos son una clasificación astrológica de las distancias angulares; no implican causalidad física.',
  }
}
