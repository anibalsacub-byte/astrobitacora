export type Zodiac = 'tropical' | 'sidereal'
export type ChartStyle = 'north' | 'south' | 'wheel'

export interface AstroConfig {
  zodiac: Zodiac
  ayanamsa: 'lahiri' | 'raman' | 'krishnamurti' | 'fagan_bradley'
  house_system: 'P' | 'W' | 'K' | 'E' | 'O' | 'R' | 'C'
  node_type: 'mean' | 'true'
}

interface SignInfo {
  sign_index: number
  sign: string
  sign_name: string
  sign_symbol: string
  rashi: string
  degree_in_sign: number
  dms: string
}

export interface Body extends SignInfo {
  key: string
  name: string
  symbol: string
  abbr: string
  longitude: number
  latitude: number
  distance_au: number
  speed: number
  retrograde: boolean
  is_node: boolean
  house: number
  whole_sign_house: number
}

export interface Angle extends SignInfo {
  key: string
  name: string
  symbol: string
  longitude: number
}

export interface Chart {
  meta: {
    jd_ut: number
    zodiac: Zodiac
    zodiac_name: string
    ayanamsa: string | null
    ayanamsa_name: string | null
    ayanamsa_value: number | null
    house_system: string
    house_system_used: string
    house_system_name: string
    node_type: string
    engine: string
    engine_version: string
    true_obliquity: number
    sidereal_time_hours: number
    latitude: number
    longitude: number
    warnings: string[]
  }
  bodies: Body[]
  angles: { asc: Angle; mc: Angle }
  houses: { cusps: number[]; system: string }
  summary: { lagna: string; chandra: string; surya: string }
  moon_phase: { elongation: number; name: string; index: number; illumination: number }
}

export interface TimeInfo {
  local: string
  timezone: string
  tz_abbrev: string
  utc_offset: string
  dst: boolean | null
  utc: string
  status: 'ok' | 'ambiguous' | 'nonexistent'
  fold: number
  warnings: string[]
}

export interface ChartResult {
  time: TimeInfo
  location_name: string
  chart: Chart
  /** La misma carta en el otro zodiaco (la ficha muestra tropical / sideral). */
  alt_chart?: Chart
}

export interface Place {
  name: string
  latitude: number
  longitude: number
  timezone: string | null
}

export interface MomentInput {
  local_datetime: string
  timezone: string | null
  utc_offset_minutes: number | null
  fold: 0 | 1
  location_name: string
  latitude: number
  longitude: number
}

export interface Personal {
  mood: number
  emotions: string[]
  intensity: number | null
  what_happened: string
  how_felt: string
  special: string
  special_valence: '' | 'positivo' | 'negativo' | 'mixto'
  tags: string[]
  sleep_hours: number | null
  energy: number | null
  stress: number | null
  notes: string
}

export interface EntrySummary {
  id: number
  created_at: string
  updated_at: string
  local_datetime: string
  timezone: string
  utc_offset: string
  utc_datetime: string
  time_info: TimeInfo
  location_name: string
  latitude: number
  longitude: number
  astro_config: AstroConfig
  is_demo: boolean
  revision_count: number
  personal: Personal
  summary: Record<Zodiac, { sun: string; moon: string; asc: string }>
  moon_phase: string
}

export interface Entry extends EntrySummary {
  astro_snapshot: Record<Zodiac, Chart>
}

export interface Revision {
  id: number
  changed_at: string
  reason: string
  changes: Record<string, { antes: unknown; después: unknown }>
}

export interface Settings {
  config: AstroConfig
  chart_style: ChartStyle
  show_nodes: boolean
  default_location: Place | null
  online_geocoding: boolean
  custom_tags: string[]
  custom_emotions: string[]
}

export interface Comparison {
  zodiac: Zodiac
  changes: {
    key: string; name: string; symbol: string
    then_sign: string; then_dms: string; then_longitude: number; then_retrograde: boolean
    now_sign: string; now_dms: string; now_longitude: number; now_retrograde: boolean
    sign_changed: boolean; delta_longitude: number; natal_house_now: number
  }[]
  transits: {
    transiting: string; transiting_name: string; transiting_symbol: string
    natal: string; natal_name: string; natal_symbol: string
    aspect: string; aspect_name: string; aspect_symbol: string; orb: number
  }[]
  orbs: Record<string, number>
  note: string
}

export interface CalendarDay {
  date: string
  mood_avg: number
  entries: { id: number; time: string; mood: number; is_demo: boolean }[]
}

export interface Summary {
  n: number
  reliability: 'insuficiente' | 'orientativa' | 'descriptiva'
  mood_mean: number | null
  mood_sd: number | null
  intensity_mean: number | null
}

export interface Stats {
  n: number
  zodiac: Zodiac
  group: string
  overall: Summary
  series: { id: number; local_datetime: string; mood: number; intensity: number | null; valence: string; is_demo: boolean }[]
  daily: { date: string; mood: number; n: number }[]
  emotions: { emotion: string; count: number; pct: number }[]
  tags: { tag: string; count: number }[]
  valence: Record<'positivo' | 'negativo' | 'mixto' | 'sin_marcar', number>
  groups: ({ key: string; label: string } & Summary)[]
  periods: null | {
    a: { range: [string, string] } & Summary
    b: { range: [string, string] } & Summary
    mood_diff: number | null
  }
  thresholds: { min_n: number; small_n: number }
  warnings: string[]
  disclaimer: string
}

export interface FeatureRow {
  feature: string
  kind: 'sign' | 'retro' | 'phase'
  body: string
  label: string
}

export interface ExperienceInsights {
  n: number
  n_rest: number
  zodiac: Zodiac
  reliability: 'insuficiente' | 'orientativa' | 'descriptiva'
  highlights: (FeatureRow & { count: number; pct: number; rest_count: number; rest_pct: number | null; diff: number | null })[]
  by_body: Record<string, { sign: string; count: number; pct: number }[]>
  matched_stats: { n: number; mood_mean: number | null; top_emotions: string[] }
  warnings: string[]
  note: string
  entries: EntrySummary[]
}

export interface PeriodInsights {
  date_from: string
  date_to: string
  zodiac: Zodiac
  timezone: string
  n: number
  mood_mean: number | null
  days: { date: string; moods: number[]; mood_avg: number }[]
  emotions: { emotion: string; count: number }[]
  tags: { tag: string; count: number }[]
  events: { id: number; local_datetime: string; text: string; valence: string }[]
  entries: EntrySummary[]
  sky: {
    bodies: { key: string; name: string; segments: { sign: string; label: string; from: string; to: string }[]; retrograde: boolean; retro_all_period: boolean; station: string | null }[]
    lunar_events: { date: string; name: string }[]
    features: string[]
  }
  history: (FeatureRow & { n: number; mood_mean: number | null; mood_diff: number | null; background: boolean; top_emotions: string[] })[]
  overall_mood_mean: number | null
  note: string
}

export interface PlanetInfo {
  key: string; name: string; symbol: string; kind: string
  orbit: string; orbit_days: number | null
  rotation: string; rotation_hours: number; physical_retrograde: boolean
  description: string
}
