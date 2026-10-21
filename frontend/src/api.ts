/**
 * Capa de acceso a datos. Todo se ejecuta en el navegador (src/local): no hay servidor
 * y los registros personales nunca salen del dispositivo.
 */
import * as S from './local/service'
import { PLANETS, NODES_NOTE, SOURCE } from './local/planetInfo'
import { timezoneAt } from './local/time'
import type { AstroConfig, MomentInput, Personal, Place, Settings } from './types'

export class ApiError extends Error {}

/** Convierte cualquier error en ApiError con un mensaje legible. */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw new ApiError((e as Error)?.message || String(e))
  }
}

type Params = Record<string, string | boolean | string[] | undefined>

export const api = {
  chart: (m: MomentInput, config: AstroConfig) => run(() => S.chart(m, config)),
  now: (p: Place, config: AstroConfig) => run(() => S.now(p, config)),
  compareNow: (m: MomentInput, config: AstroConfig, now?: Place | null) => run(() => S.compareNow(m, config, now ?? null)),
  timezoneAt: async (lat: number, lon: number) => ({ timezone: timezoneAt(lat, lon) }),
  geoSearch: (q: string) => run(() => S.geoSearch(q)),
  geoReverse: (lat: number, lon: number) => run(() => S.geoReverse(lat, lon)),
  planets: async () => ({ source: SOURCE, planets: PLANETS, nodes_note: NODES_NOTE }),

  entries: (p: { date_from?: string; date_to?: string; tag?: string; q?: string } = {}) => run(() => S.entries(p)),
  entry: (id: number) => run(() => S.entry(id)),
  createEntry: (m: MomentInput, config: AstroConfig, personal: Personal) => run(() => S.createEntry(m, config, personal)),
  updatePersonal: (id: number, personal: Personal) => run(() => S.updatePersonal(id, personal)),
  recalculate: (id: number, m: MomentInput, config: AstroConfig, reason: string) => run(() => S.recalculate(id, m, config, reason)),
  revisions: (id: number) => run(() => S.revisions(id)),
  deleteEntry: (id: number) => run(() => S.deleteEntry(id)),
  deleteAll: () => run(() => S.deleteAll()),
  entryCompareNow: (id: number, zodiac: string, now?: Place | null) => run(() => S.entryCompareNow(id, zodiac as 'tropical' | 'sidereal', now ?? null)),
  quickEntry: (personal: Personal, place: Place | null) => run(() => S.quickEntry(personal, place)),
  experience: (p: Params) => run(() => S.experience(p)),
  period: (p: { date_from: string; date_to: string; zodiac: string; include_demo: boolean }) => run(() => S.period(p)),
  calendar: (year: number, month: number) => run(() => S.calendar(year, month)),
  stats: (p: Params) => run(() => S.stats(p)),

  settings: () => run(() => S.getSettings()),
  saveSettings: (s: Settings) => run(() => S.saveSettings(s)),
  importBackup: (data: unknown, mode: 'merge' | 'replace') => run(() => S.importBackup(data, mode)),
  exportJson: () => run(() => S.exportJson()),
  exportCsv: () => run(() => S.exportCsv()),
  lastBackup: () => run(() => S.lastBackup()),
}

/** Descarga un texto como archivo. */
export function downloadText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
