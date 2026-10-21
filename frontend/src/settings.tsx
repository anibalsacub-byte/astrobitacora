import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { requestPersistence } from './local/db'
import { removeDemo } from './local/service'
import type { Settings } from './types'

interface Ctx {
  settings: Settings | null
  save: (s: Settings) => Promise<void>
  error: string | null
}

const SettingsContext = createContext<Ctx>({ settings: null, save: async () => {}, error: null })

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      // Retira el antiguo registro de ejemplo y pide almacenamiento persistente.
      await removeDemo().catch(() => {})
      requestPersistence()
      setSettings(await api.settings())
    })().catch((e) => setError(String(e.message ?? e)))
  }, [])

  const save = useCallback(async (s: Settings) => {
    setSettings(await api.saveSettings(s))
  }, [])

  return <SettingsContext.Provider value={{ settings, save, error }}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)
