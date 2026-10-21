import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import ChartView from '../components/ChartView'
import JournalForm from '../components/JournalForm'
import MomentForm from '../components/MomentForm'
import { useSettings } from '../settings'
import type { AstroConfig, ChartResult, MomentInput, Personal } from '../types'

export default function NewEntry() {
  const { settings } = useSettings()
  const nav = useNavigate()
  const [config, setConfig] = useState<AstroConfig>(settings!.config)
  const [moment, setMoment] = useState<MomentInput | null>(null)
  const [result, setResult] = useState<ChartResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calc = async (m: MomentInput) => {
    setBusy(true)
    setError(null)
    try {
      setResult(await api.chart(m, config))
      setMoment(m)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = async (p: Personal) => {
    if (!moment) return
    setBusy(true)
    setError(null)
    try {
      const e = await api.createEntry(moment, config, p)
      nav(`/registro/${e.id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl text-navy">Nueva entrada</h1>
      <section className="card p-5">
        <h2 className="mb-3 text-2xl text-navy">1 · Momento y lugar</h2>
        <MomentForm config={config} onConfigChange={setConfig} onSubmit={calc} busy={busy && !result}
                    initial={settings?.default_location ? { place: settings.default_location } : undefined} />
      </section>
      {error && <p className="text-mood-1">{error}</p>}
      {result && (
        <>
          <section>
            <h2 className="mb-3 text-2xl text-navy">2 · Carta calculada</h2>
            <ChartView result={result} />
          </section>
          <section className="card p-5">
            <h2 className="mb-1 text-2xl text-navy">3 · Registro personal</h2>
            <p className="mb-4 text-sm text-ink-soft">
              La entrada guardará esta carta tal como está (zodiaco tropical y sideral). Si después cambias la configuración, la carta guardada no se altera.
            </p>
            <JournalForm onSubmit={save} busy={busy} />
          </section>
        </>
      )}
    </div>
  )
}
