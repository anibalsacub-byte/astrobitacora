/** Bitácora en el navegador: persistencia, edición, recálculo trazable, patrones y copias de seguridad. */
import { beforeAll, describe, expect, it } from 'vitest'
import * as S from '../service'
import type { MomentInput, Personal } from '../../types'

const MADRID = { location_name: 'Madrid', latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid', utc_offset_minutes: null, fold: 0 as const }
const at = (local: string): MomentInput => ({ ...MADRID, local_datetime: local })
const P = (p: Partial<Personal>): Personal => ({ ...S.cleanPersonal({ mood: 3, ...p }) })
const cfg = S.DEFAULT_CONFIG

beforeAll(async () => {
  await S.seedDemo()
  await S.saveSettings({ ...S.DEFAULT_SETTINGS, default_location: { name: 'Madrid', latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid' } })
  // Cansancio con la Luna en Capricornio tropical; días normales intercalados.
  for (const d of ['2024-01-10', '2024-02-06', '2024-03-05', '2024-04-01']) {
    await S.createEntry(at(`${d}T21:00`), cfg, P({ mood: 2, emotions: ['Cansancio'], tags: ['proyectos'] }))
  }
  for (const d of ['2024-01-03', '2024-01-17', '2024-01-24', '2024-02-14', '2024-02-21', '2024-03-12']) {
    await S.createEntry(at(`${d}T21:00`), cfg, P({ mood: 4, emotions: ['Alegría'] }))
  }
})

describe('bitácora', () => {
  it('el registro de demostración existe una sola vez', async () => {
    await S.seedDemo()
    expect((await S.entries()).filter((e) => e.is_demo)).toHaveLength(1)
  })

  it('ciclo de vida completo', async () => {
    const e = await S.createEntry(at('2024-05-10T08:30'), cfg, P({ mood: 4, emotions: ['Alegría'], tags: ['Salud', 'familia'], what_happened: 'Paseo por el Retiro' }))
    expect(e.utc_datetime).toBe('2024-05-10T06:30:00Z')
    expect(e.personal.tags).toEqual(['salud', 'familia'])
    const snap = JSON.stringify(e.astro_snapshot)

    await S.createEntry(at('2024-05-10T22:00'), cfg, P({ mood: 2 }))
    const day = (await S.calendar(2024, 5)).find((d) => d.date === '2024-05-10')!
    expect(day.entries).toHaveLength(2)
    expect(day.mood_avg).toBe(3)

    const edited = await S.updatePersonal(e.id, { ...e.personal, mood: 5, how_felt: 'Muy bien' })
    expect(JSON.stringify(edited.astro_snapshot)).toBe(snap)

    const re = await S.recalculate(e.id, at('2024-05-10T09:30'), null, 'Hora corregida')
    expect(re.utc_datetime).toBe('2024-05-10T07:30:00Z')
    const revs = await S.revisions(e.id)
    expect(revs).toHaveLength(1)
    expect(revs[0].reason).toBe('Hora corregida')
    expect(revs[0].changes.local_datetime).toBeTruthy()

    expect((await S.entryCompareNow(e.id, 'sidereal', null)).comparison.changes.length).toBeGreaterThanOrEqual(10)
    expect((await S.entries({ q: 'retiro' })).some((x) => x.id === e.id)).toBe(true)
    expect((await S.entries({ tag: 'salud' })).some((x) => x.id === e.id)).toBe(true)
    await S.deleteEntry(e.id)
    await expect(S.entry(e.id)).rejects.toThrow()
  })

  it('valida la parte personal', () => {
    expect(() => S.cleanPersonal({ mood: 7 })).toThrow()
    expect(() => S.cleanPersonal({ mood: 3, intensity: 11 })).toThrow()
  })

  it('registro rápido con la ubicación predeterminada', async () => {
    const e = await S.quickEntry(P({ mood: 3, emotions: ['Tranquilidad'] }), null)
    expect(e.timezone).toBe('Europe/Madrid')
    await S.deleteEntry(e.id)
  })
})

describe('patrones', () => {
  it('detecta la Luna repetida en los registros de cansancio', async () => {
    const r = await S.experience({ emotion: ['Cansancio'], zodiac: 'tropical' })
    expect(r.n).toBe(4)
    const moon = r.highlights.filter((h) => h.kind === 'sign' && h.body === 'moon')
    expect(moon.length).toBeGreaterThan(0)
    expect(moon[0].count).toBeGreaterThanOrEqual(3)
  })

  it('pocos registros: sin coincidencias', async () => {
    const r = await S.experience({ tag: 'proyectos', date_from: '2024-01-01', date_to: '2024-01-31' })
    expect(r.reliability).toBe('insuficiente')
    expect(r.highlights).toEqual([])
  })

  it('semana: cielo, lunaciones e historial', async () => {
    const r = await S.period({ date_from: '2024-01-08', date_to: '2024-01-14', zodiac: 'tropical', include_demo: false })
    expect(r.n).toBe(1)
    expect(r.sky.bodies.find((b) => b.key === 'moon')!.segments.length).toBeGreaterThanOrEqual(3)
    expect(r.sky.lunar_events.some((e) => e.name === 'Luna nueva')).toBe(true)
    expect(r.history.length).toBeGreaterThan(0)
  })

  it('estadísticas sin promedios con muestras pequeñas', async () => {
    const s = await S.stats({ zodiac: 'sidereal', group: 'sign:moon' })
    expect(s.disclaimer).toContain('no demuestra')
    expect(s.groups.every((g) => g.n >= 5 || g.mood_mean === null)).toBe(true)
  })
})

describe('copias de seguridad', () => {
  it('exporta y restaura sin alterar las cartas', async () => {
    const json = await S.exportJson()
    const data = JSON.parse(json)
    const n = data.entries.length
    expect((await S.exportCsv()).split('\r\n').length).toBe(n + 1)
    expect((await S.importBackup(data, 'replace')).imported).toBe(n)
    const again = JSON.parse(await S.exportJson())
    expect(again.entries.map((e: { astro_snapshot: unknown }) => JSON.stringify(e.astro_snapshot)))
      .toEqual(data.entries.map((e: { astro_snapshot: unknown }) => JSON.stringify(e.astro_snapshot)))
    expect(await S.lastBackup()).toBeTruthy()
  })

  it('rechaza archivos que no son copias', async () => {
    await expect(S.importBackup({ foo: 1 }, 'merge')).rejects.toThrow()
  })
})
