/** Constantes zodiacales y cuerpos (equivalente a backend/app/astro/zodiac.py). */

// [clave, nombre, símbolo, rashi]
export const SIGNS: [string, string, string, string][] = [
  ['aries', 'Aries', '♈', 'Mesha'],
  ['taurus', 'Tauro', '♉', 'Vrishabha'],
  ['gemini', 'Géminis', '♊', 'Mithuna'],
  ['cancer', 'Cáncer', '♋', 'Karka'],
  ['leo', 'Leo', '♌', 'Simha'],
  ['virgo', 'Virgo', '♍', 'Kanya'],
  ['libra', 'Libra', '♎', 'Tula'],
  ['scorpio', 'Escorpio', '♏', 'Vrischika'],
  ['sagittarius', 'Sagitario', '♐', 'Dhanu'],
  ['capricorn', 'Capricornio', '♑', 'Makara'],
  ['aquarius', 'Acuario', '♒', 'Kumbha'],
  ['pisces', 'Piscis', '♓', 'Meena'],
]
export const SIGN_IDX: Record<string, number> = Object.fromEntries(SIGNS.map((s, i) => [s[0], i]))

// [clave, id Swiss Ephemeris, nombre, símbolo, abreviatura]
export const BODIES: [string, number, string, string, string][] = [
  ['sun', 0, 'Sol', '☉', 'Su'],
  ['moon', 1, 'Luna', '☽', 'Lu'],
  ['mercury', 2, 'Mercurio', '☿', 'Me'],
  ['venus', 3, 'Venus', '♀', 'Ve'],
  ['mars', 4, 'Marte', '♂', 'Ma'],
  ['jupiter', 5, 'Júpiter', '♃', 'Ju'],
  ['saturn', 6, 'Saturno', '♄', 'Sa'],
  ['uranus', 7, 'Urano', '♅', 'Ur'],
  ['neptune', 8, 'Neptuno', '♆', 'Ne'],
  ['pluto', 9, 'Plutón', '♇', 'Pl'],
]
export const NODE_IDS: Record<string, number> = { mean: 10, true: 11 }
export const ECL_NUT = -1
export const RAHU = ['rahu', 'Nodo norte (Rahu)', '☊', 'Ra'] as const
export const KETU = ['ketu', 'Nodo sur (Ketu)', '☋', 'Ke'] as const
export const BODY_KEYS = [...BODIES.map((b) => b[0]), 'rahu', 'ketu']
export const BODY_NAMES: Record<string, string> = { ...Object.fromEntries(BODIES.map((b) => [b[0], b[2]])), rahu: RAHU[1], ketu: KETU[1] }

export const AYANAMSAS: Record<string, [number, string]> = {
  lahiri: [1, 'Lahiri (Chitrapaksha)'],
  raman: [3, 'Raman'],
  krishnamurti: [5, 'Krishnamurti (KP)'],
  fagan_bradley: [0, 'Fagan/Bradley'],
}

export const HOUSE_SYSTEMS: Record<string, string> = {
  P: 'Placidus',
  W: 'Signo entero (Whole Sign)',
  K: 'Koch',
  E: 'Casas iguales',
  O: 'Porfirio',
  R: 'Regiomontano',
  C: 'Campanus',
}
/** Código que entiende swe_houses (casas iguales = 'A' o 'E'). */
export const HOUSE_CODE: Record<string, string> = { P: 'P', W: 'W', K: 'K', E: 'A', O: 'O', R: 'R', C: 'C' }
export const POLAR_UNDEFINED = new Set(['P', 'K'])

export const ZODIACS: Record<string, string> = { tropical: 'Tropical (occidental)', sidereal: 'Sideral (védico)' }

export const MOON_PHASES = [
  'Luna nueva', 'Creciente', 'Cuarto creciente', 'Gibosa creciente',
  'Luna llena', 'Gibosa menguante', 'Cuarto menguante', 'Menguante',
]

export const EMOTIONS = [
  'Alegría', 'Tristeza', 'Ansiedad', 'Tranquilidad', 'Enojo', 'Entusiasmo', 'Cansancio', 'Motivación', 'Nostalgia', 'Gratitud',
]
