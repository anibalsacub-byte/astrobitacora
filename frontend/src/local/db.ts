/**
 * Almacenamiento en el propio navegador (IndexedDB). Los registros nunca salen del dispositivo:
 * no hay servidor que los reciba. Para cambiar de dispositivo se usa la copia de seguridad JSON.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AstroConfig, Chart, Personal, TimeInfo, Zodiac } from '../types'

export interface StoredRevision {
  id: number
  changed_at: string
  reason: string
  previous: Record<string, unknown>
  changes: Record<string, { antes: unknown; después: unknown }>
}

export interface StoredEntry {
  id?: number
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
  astro_snapshot: Record<Zodiac, Chart>
  personal: Personal
  is_demo: boolean
  revisions: StoredRevision[]
}

interface Schema extends DBSchema {
  entries: { key: number; value: StoredEntry; indexes: { by_local: string } }
  kv: { key: string; value: unknown }
}

export const DB_NAME = 'astrobitacora'
let dbp: Promise<IDBPDatabase<Schema>> | null = null

export function db() {
  dbp ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(d) {
      const s = d.createObjectStore('entries', { keyPath: 'id', autoIncrement: true })
      s.createIndex('by_local', 'local_datetime')
      d.createObjectStore('kv')
    },
  })
  return dbp
}

/** Solo para pruebas: cierra y olvida la conexión. */
export async function resetDbForTests() {
  if (dbp) (await dbp).close()
  dbp = null
}

export const utcnow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

export async function allEntries(): Promise<StoredEntry[]> {
  return (await db()).getAllFromIndex('entries', 'by_local')
}

export async function getEntry(id: number) {
  return (await db()).get('entries', id)
}

export async function putEntry(e: StoredEntry): Promise<StoredEntry> {
  const id = await (await db()).put('entries', e)
  return { ...e, id: id as number }
}

export async function deleteEntry(id: number) {
  await (await db()).delete('entries', id)
}

export async function clearEntries() {
  const d = await db()
  const n = await d.count('entries')
  await d.clear('entries')
  return n
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db()).get('kv', key) as Promise<T | undefined>
}

export async function kvSet(key: string, value: unknown) {
  await (await db()).put('kv', value, key)
}

/** Pide al navegador que no borre estos datos aunque falte espacio. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}
