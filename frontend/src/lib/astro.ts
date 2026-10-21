import type { Body, Chart, Zodiac } from '../types'

const VS = '︎' // fuerza la presentación como texto (no emoji)

export const SIGNS = [
  { key: 'aries', name: 'Aries', symbol: '♈', rashi: 'Mesha' },
  { key: 'taurus', name: 'Tauro', symbol: '♉', rashi: 'Vrishabha' },
  { key: 'gemini', name: 'Géminis', symbol: '♊', rashi: 'Mithuna' },
  { key: 'cancer', name: 'Cáncer', symbol: '♋', rashi: 'Karka' },
  { key: 'leo', name: 'Leo', symbol: '♌', rashi: 'Simha' },
  { key: 'virgo', name: 'Virgo', symbol: '♍', rashi: 'Kanya' },
  { key: 'libra', name: 'Libra', symbol: '♎', rashi: 'Tula' },
  { key: 'scorpio', name: 'Escorpio', symbol: '♏', rashi: 'Vrischika' },
  { key: 'sagittarius', name: 'Sagitario', symbol: '♐', rashi: 'Dhanu' },
  { key: 'capricorn', name: 'Capricornio', symbol: '♑', rashi: 'Makara' },
  { key: 'aquarius', name: 'Acuario', symbol: '♒', rashi: 'Kumbha' },
  { key: 'pisces', name: 'Piscis', symbol: '♓', rashi: 'Meena' },
]
export const SIGN_BY_KEY = Object.fromEntries(SIGNS.map((s, i) => [s.key, { ...s, index: i }]))

export const BODY_NAMES: Record<string, { name: string; symbol: string }> = {
  sun: { name: 'Sol', symbol: '☉' }, moon: { name: 'Luna', symbol: '☽' }, mercury: { name: 'Mercurio', symbol: '☿' },
  venus: { name: 'Venus', symbol: '♀' }, mars: { name: 'Marte', symbol: '♂' }, jupiter: { name: 'Júpiter', symbol: '♃' },
  saturn: { name: 'Saturno', symbol: '♄' }, uranus: { name: 'Urano', symbol: '♅' }, neptune: { name: 'Neptuno', symbol: '♆' },
  pluto: { name: 'Plutón', symbol: '♇' }, rahu: { name: 'Nodo norte (Rahu)', symbol: '☊' }, ketu: { name: 'Nodo sur (Ketu)', symbol: '☋' },
  asc: { name: 'Ascendente', symbol: 'Asc' }, mc: { name: 'Medio Cielo', symbol: 'MC' },
}

export const HOUSE_SYSTEMS: Record<string, string> = {
  P: 'Placidus', W: 'Signo entero (Whole Sign)', K: 'Koch', E: 'Casas iguales', O: 'Porfirio', R: 'Regiomontano', C: 'Campanus',
}
export const AYANAMSAS: Record<string, string> = {
  lahiri: 'Lahiri (Chitrapaksha)', raman: 'Raman', krishnamurti: 'Krishnamurti (KP)', fagan_bradley: 'Fagan/Bradley',
}

export const g = (s: string) => (s.length <= 2 ? s + VS : s)

export function signLabel(key: string, zodiac: Zodiac, withSymbol = true): string {
  const s = SIGN_BY_KEY[key]
  if (!s) return key
  const name = zodiac === 'sidereal' ? `${s.rashi} (${s.name})` : s.name
  return withSymbol ? `${g(s.symbol)} ${name}` : name
}

export function systemLabel(chart: Chart): string {
  const m = chart.meta
  return m.zodiac === 'sidereal'
    ? `Sideral · ${m.ayanamsa_name} ${m.ayanamsa_value?.toFixed(4)}° · ${m.house_system_name}`
    : `Tropical · ${m.house_system_name}`
}

export const shortDeg = (b: { degree_in_sign: number }) => `${Math.floor(b.degree_in_sign)}°`

export function bodyShort(b: Body): string {
  return `${g(b.symbol)}${shortDeg(b)}${b.retrograde && !b.is_node ? '℞' : ''}`
}

export function visibleBodies(chart: Chart, showNodes: boolean): Body[] {
  return chart.bodies.filter((b) => showNodes || !b.is_node)
}

export const MOOD_FACES = ['😣', '😕', '😐', '🙂', '😄']
export const MOOD_LABELS = ['Muy mal', 'Mal', 'Neutral', 'Bien', 'Muy bien']
export const MOOD_COLORS = ['#8a3b3b', '#b9714e', '#9a9384', '#6c8f6e', '#2f6f6a']
export const moodColor = (m: number) => MOOD_COLORS[Math.min(5, Math.max(1, Math.round(m))) - 1]

export const DEFAULT_EMOTIONS = [
  'Alegría', 'Tristeza', 'Ansiedad', 'Tranquilidad', 'Enojo', 'Entusiasmo', 'Cansancio', 'Motivación', 'Nostalgia', 'Gratitud',
]

const dtf = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })
export function fmtDate(localIso: string): string {
  const [y, m, d] = localIso.slice(0, 10).split('-').map(Number)
  const dt = new Date(2000, m - 1, d)
  dt.setFullYear(y)
  return dtf.format(dt)
}
export const fmtTime = (localIso: string) => localIso.slice(11, 16)
