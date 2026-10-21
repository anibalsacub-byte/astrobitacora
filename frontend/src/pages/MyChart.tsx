import { useState } from 'react'
import { api } from '../api'
import ChartView from '../components/ChartView'
import ComparePanel from '../components/ComparePanel'
import { useGeolocation } from '../components/LocationPicker'
import MomentForm from '../components/MomentForm'
import { useSettings } from '../settings'
import type { AstroConfig, ChartResult, Comparison, MomentInput } from '../types'

export default function MyChart() {
  const { settings } = useSettings()
  const [config, setConfig] = useState<AstroConfig>(settings!.config)
  const [moment, setMoment] = useState<MomentInput | null>(null)
  const [result, setResult] = useState<ChartResult | null>(null)
  const [cmp, setCmp] = useState<{ now: ChartResult; comparison: Comparison } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { locate } = useGeolocation()

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const calc = (m: MomentInput) => run(async () => {
    setCmp(null)
    setResult(await api.chart(m, config))
    setMoment(m)
  })

  const nowChart = () => run(async () => {
    const place = settings?.default_location ?? await locate()
    setCmp(null)
    setMoment(null)
    setResult(await api.now(place, config))
  })

  const compare = () => moment && run(async () => {
    const r = await api.compareNow(moment, config, settings?.default_location ?? null)
    setCmp({ now: r.now, comparison: r.comparison })
  })

  return (
    <div className="space-y-6">
      <h1 className="text-4xl text-navy">Mi carta</h1>
      <section className="card p-5">
        <h2 className="mb-1 text-2xl text-navy">Consulta histórica</h2>
        <p className="mb-3 text-sm text-ink-soft">Cualquier fecha entre los años 1 y 2999. Las fechas anteriores a 1582 se interpretan en el calendario gregoriano proléptico.</p>
        <MomentForm config={config} onConfigChange={setConfig} onSubmit={calc} busy={busy}
                    initial={settings?.default_location ? { place: settings.default_location } : undefined}
                    extra={<button type="button" className="btn" disabled={busy} onClick={nowChart}>✦ Posiciones de ahora</button>} />
      </section>
      {error && <p className="text-mood-1">{error}</p>}
      {result && (
        <section className="space-y-3">
          <ChartView result={result} title={moment ? 'Carta Astral' : 'Posiciones de ahora'} />
          {moment && <button className="btn" disabled={busy} onClick={compare}>Comparar con las posiciones actuales</button>}
        </section>
      )}
      {cmp && result && <ComparePanel now={cmp.now} comparison={cmp.comparison} thenLabel={`la carta del ${result.time.local.replace('T', ' ')}`} />}
    </div>
  )
}
