import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import ChartView from '../components/ChartView'
import EntryCard from '../components/EntryCard'
import LocationPicker, { useGeolocation } from '../components/LocationPicker'
import QuickLog from '../components/QuickLog'
import { useSettings } from '../settings'
import type { ChartResult, EntrySummary, Place } from '../types'
import { g, signLabel } from '../lib/astro'

export default function Home() {
  const { settings, save } = useSettings()
  const [place, setPlace] = useState<Place | null>(settings?.default_location ?? null)
  const [remember, setRemember] = useState(true)
  const [now, setNow] = useState<ChartResult | null>(null)
  const [showChart, setShowChart] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<EntrySummary[]>([])
  const { locate, busy: locating } = useGeolocation()

  const choose = (p: Place) => {
    setError(null)
    setPlace(p)
    if (remember && settings) save({ ...settings, default_location: p }).catch(() => {})
  }

  const computeNow = useCallback(async (p: Place) => {
    if (!settings) return
    setBusy(true)
    setError(null)
    try {
      setNow(await api.now(p, settings.config))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [settings])

  const loadRecent = () => api.entries().then((r) => setRecent(r.slice(0, 4))).catch(() => {})
  useEffect(() => { if (place) computeNow(place) }, [place, computeNow])
  useEffect(() => { loadRecent() }, [])

  const today = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const z = now?.chart.meta.zodiac
  const b = (k: string) => now?.chart.bodies.find((x) => x.key === k)

  return (
    <div className="space-y-6">
      <section>
        <div className="label">Hoy</div>
        <h1 className="text-4xl text-navy first-letter:uppercase">{today}</h1>
      </section>

      {!place && (
        <div className="card space-y-3 p-4">
          <p>Para guardar tus registros con el cielo del momento necesito tu ubicación. Usa la del dispositivo o elige una ciudad:</p>
          <button className="btn btn-ghost" disabled={locating} onClick={() => { setError(null); locate().then(choose).catch((e) => setError(e.message)) }}>
            ⌖ {locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
          </button>
          {error && <p className="rounded border border-mood-2/40 bg-mood-2/10 px-3 py-2 text-sm text-ink">{error}</p>}
          <LocationPicker value={null} onChange={choose} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Guardar como ubicación predeterminada
          </label>
        </div>
      )}

      <QuickLog place={place} onSaved={loadRecent} />

      {now && z && (
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl text-navy">El cielo ahora</h2>
              <p>
                <span className="glyph text-gold">{g('☉')}</span> Sol en {signLabel(b('sun')!.sign, z, false)} ·{' '}
                <span className="glyph text-gold">{g('☽')}</span> Luna en {signLabel(b('moon')!.sign, z, false)} ({now.chart.moon_phase.name.toLowerCase()}) ·
                Asc. {signLabel(now.chart.angles.asc.sign, z, false)}
                {now.chart.bodies.filter((x) => x.retrograde && !x.is_node).length > 0 && (
                  <> · ℞ {now.chart.bodies.filter((x) => x.retrograde && !x.is_node).map((x) => x.name).join(', ')}</>
                )}
              </p>
              <p className="text-sm text-ink-soft">{now.location_name} · calculado a las {now.time.local.slice(11, 16)} ({now.time.timezone})</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" disabled={busy || !place} onClick={() => place && computeNow(place)}>✦ {busy ? 'Calculando…' : 'Posiciones de ahora'}</button>
              <button className="btn btn-ghost" onClick={() => setShowChart(!showChart)}>{showChart ? 'Ocultar carta' : 'Ver carta'}</button>
            </div>
          </div>
          {showChart && <div className="mt-4"><ChartView result={now} title="Carta del momento" /></div>}
        </section>
      )}
      {place && error && <p className="text-mood-1">{error}</p>}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-2xl text-navy">Últimos registros</h2>
          <div className="flex gap-4">
            <Link to="/patrones" className="text-navy underline decoration-gold-soft underline-offset-4">Mis patrones</Link>
            <Link to="/calendario" className="text-navy underline decoration-gold-soft underline-offset-4">Calendario</Link>
          </div>
        </div>
        {recent.length === 0 ? <p className="text-ink-soft">Aún no hay registros.</p> : (
          <div className="grid gap-2 md:grid-cols-2">{recent.map((e) => <EntryCard key={e.id} e={e} />)}</div>
        )}
      </section>
    </div>
  )
}
