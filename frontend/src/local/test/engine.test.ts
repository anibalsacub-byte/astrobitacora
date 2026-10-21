/**
 * Validación del motor web.
 * 1) Debe reproducir las cartas del motor Python (misma biblioteca Swiss Ephemeris).
 * 2) Debe coincidir con referencias publicadas: J. Meeus, «Astronomical Algorithms» (ejemplos 12.a, 25.b, 33.a, 47.a)
 *    y eventos fechados (equinoccio, eclipse, conjunción, ingresos, retrogradaciones).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { computeChart, julianDayUT, norm360, signInfo } from '../engine'
import { getSwe, swe } from '../swe'
import ref from './python_reference.json'

const sep = (a: number, b: number) => {
  const d = Math.abs(norm360(a) - norm360(b)) % 360
  return Math.min(d, 360 - d)
}
const utc = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi)
const F = 4 | 256 // Moshier + velocidad
const lonUT = (ms: number, id: number) => swe().calculatePosition(julianDayUT(ms), id, F)

beforeAll(async () => {
  await getSwe()
})

describe('equivalencia con el motor Python', () => {
  for (const [i, c] of ref.charts.entries()) {
    it(`carta ${i + 1}: ${c.utc} ${c.zodiac} ${c.house_system}`, () => {
      const jd = julianDayUT(Date.parse(c.utc))
      expect(Math.abs(jd - c.jd)).toBeLessThan(1e-8)
      const ch = computeChart(jd, c.lat, c.lon, c.zodiac as 'tropical' | 'sidereal', c.ayanamsa, c.house_system, c.node_type)
      for (const b of ch.bodies) {
        const [lon, lat, speed, house] = (c.bodies as Record<string, number[]>)[b.key]
        expect(sep(b.longitude, lon), `${b.key} longitud`).toBeLessThan(1e-6)
        expect(Math.abs(b.latitude - lat)).toBeLessThan(1e-6)
        expect(Math.abs(b.speed - speed)).toBeLessThan(1e-6)
        expect(b.house, `${b.key} casa`).toBe(house)
      }
      expect(sep(ch.angles.asc.longitude, c.asc)).toBeLessThan(1e-6)
      expect(sep(ch.angles.mc.longitude, c.mc)).toBeLessThan(1e-6)
      expect(ch.meta.house_system_used).toBe(c.house_system_used)
      ch.houses.cusps.forEach((x, k) => expect(sep(x, c.cusps[k]), `cúspide ${k + 1}`).toBeLessThan(1e-6))
      if (c.ayanamsa_value !== null) expect(Math.abs(ch.meta.ayanamsa_value! - c.ayanamsa_value)).toBeLessThan(1e-9)
      expect(Math.abs(ch.meta.true_obliquity - c.obliquity)).toBeLessThan(1e-9)
      expect(ch.moon_phase.index).toBe(c.phase)
      // Iluminación: Python usa swe_pheno; aquí la fórmula de Meeus 48.3 → diferencia muy pequeña.
      expect(Math.abs(ch.moon_phase.illumination - c.illumination)).toBeLessThan(0.002)
    })
  }
})

// Los ejemplos de Meeus están en Tiempo Dinámico (TD); la API web recibe TU, así que se resta ΔT (≈ 59 s en 1992).
describe('referencias publicadas', () => {
  it('Sol, Meeus 25.b (1992-10-13.0 TD): 199°54′21,818″', () => {
    expect(sep(swe().calculatePosition(2448908.5 - 59.3 / 86400, 0, F).longitude, 199 + 54 / 60 + 21.818 / 3600)).toBeLessThan(0.0015)
  })
  it('Luna, Meeus 47.a (1992-04-12.0 TD): 133,162655°', () => {
    expect(sep(swe().calculatePosition(2448724.5 - 59 / 86400, 1, F).longitude, 133.162655)).toBeLessThan(0.005)
  })
  it('Venus, Meeus 33.a (1992-12-20.0 TD): 313,08102°', () => {
    expect(sep(swe().calculatePosition(2448976.5 - 59.3 / 86400, 3, F).longitude, 313.08102)).toBeLessThan(0.002)
  })
  it('tiempo sidéreo, Meeus 12.a (1987-04-10 0h UT): 13h10m46,1351s', () => {
    expect(Math.abs(swe().siderealTime(2446895.5) - (13 + 10 / 60 + 46.1351 / 3600))).toBeLessThan(0.0001)
  })
  it('equinoccio de marzo 2024-03-20 03:06 UT', () => {
    expect(sep(lonUT(utc(2024, 3, 20, 3, 6), 0).longitude, 0)).toBeLessThan(0.003)
  })
  it('luna nueva del eclipse total 2024-04-08 18:21 UT', () => {
    const t = utc(2024, 4, 8, 18, 21)
    expect(sep(lonUT(t, 1).longitude, lonUT(t, 0).longitude)).toBeLessThan(0.05)
  })
  it('gran conjunción Júpiter–Saturno 2020-12-21', () => {
    const t = utc(2020, 12, 21, 18, 20)
    expect(sep(lonUT(t, 5).longitude, lonUT(t, 6).longitude)).toBeLessThan(0.05)
  })
  it.each([
    [9, utc(2024, 11, 18), utc(2024, 11, 21), 300], // Plutón entra en Acuario
    [8, utc(2025, 3, 29), utc(2025, 4, 1), 0], // Neptuno entra en Aries
    [6, utc(2025, 5, 23), utc(2025, 5, 27), 0], // Saturno entra en Aries
    [7, utc(2025, 7, 5), utc(2025, 7, 9), 60], // Urano entra en Géminis
  ])('ingreso del cuerpo %i', (id, before, after, boundary) => {
    expect(norm360(lonUT(before, id).longitude - boundary)).toBeGreaterThan(359)
    expect(norm360(lonUT(after, id).longitude - boundary)).toBeLessThan(1)
  })
  it('Mercurio retrógrado en abril de 2024', () => {
    expect(lonUT(utc(2024, 4, 10), 2).longitudeSpeed).toBeLessThan(0)
    expect(lonUT(utc(2024, 5, 10), 2).longitudeSpeed).toBeGreaterThan(0)
  })
  it.each([
    [40.4168, -3.7038, utc(1990, 6, 15, 10, 30)],
    [-34.6037, -58.3816, utc(2001, 9, 11, 2, 15)],
    [59.9139, 10.7522, utc(1975, 12, 24, 23, 59)],
  ])('ascendente y MC con fórmula independiente (%f, %f)', (lat, lon, t) => {
    const jd = julianDayUT(t)
    const ch = computeChart(jd, lat, lon, 'tropical', 'lahiri', 'P')
    const r = Math.PI / 180
    const eps = ch.meta.true_obliquity * r
    const ramc = norm360(swe().siderealTime(jd) * 15 + lon) * r
    const mc = norm360(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) / r)
    const asc = norm360(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat * r) * Math.sin(eps))) / r)
    expect(sep(ch.angles.mc.longitude, mc)).toBeLessThan(0.001)
    expect(sep(ch.angles.asc.longitude, asc)).toBeLessThan(0.001)
  })
  it('Placidus no definido en latitudes polares: Porfirio y aviso', () => {
    const ch = computeChart(julianDayUT(utc(2020, 6, 21, 12)), 70, 25, 'tropical', 'lahiri', 'P')
    expect(ch.meta.house_system_used).toBe('O')
    expect(ch.meta.warnings.length).toBeGreaterThan(0)
  })
  it('el grado nunca se redondea al signo siguiente', () => {
    expect(signInfo(29.99999999).sign).toBe('aries')
    expect(signInfo(29.99999999).dms.startsWith('29°59′59')).toBe(true)
    expect(signInfo(359.9999999).sign).toBe('pisces')
  })
  it('luna llena 2024-04-23: iluminación > 99 %', () => {
    const ch = computeChart(julianDayUT(utc(2024, 4, 23, 23, 49)), 0, 0)
    expect(ch.moon_phase.name).toBe('Luna llena')
    expect(ch.moon_phase.illumination).toBeGreaterThan(0.99)
  })
})
