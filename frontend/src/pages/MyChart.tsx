import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import ChartView from '../components/ChartView'
import ComparePanel from '../components/ComparePanel'
import LocationPicker, { useGeolocation } from '../components/LocationPicker'
import Modal from '../components/Modal'
import MomentForm, { nowIn } from '../components/MomentForm'
import { fmtDate, fmtTime } from '../lib/astro'
import { useSettings } from '../settings'
import type { AstroConfig, ChartResult, Comparison, MomentInput, Place } from '../types'

export default function MyChart() {
  const { settings, save } = useSettings()
  const natal = settings?.natal ?? null
  const [config, setConfig] = useState<AstroConfig>(natal?.config ?? settings!.config)
  const [formKey, setFormKey] = useState(0)
  const [confirm, setConfirm] = useState<'replace' | 'delete' | null>(null)
  const [moment, setMoment] = useState<MomentInput | null>(null)
  const [result, setResult] = useState<ChartResult | null>(null)
  const [cmp, setCmp] = useState<{ now: ChartResult; comparison: Comparison } | null>(null)
  const [calcConfig, setCalcConfig] = useState<AstroConfig>(settings!.config)
  const [overlay, setOverlay] = useState<ChartResult | null>(null)
  const [overlayLabel, setOverlayLabel] = useState('ahora')
  const [picker, setPicker] = useState(false)
  const [pick, setPick] = useState({ date: nowIn(null).slice(0, 10), time: '12:00' })
  const [pickPlace, setPickPlace] = useState<Place | null>(null)
  const chartRef = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { locate } = useGeolocation()

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const loadNatal = () => natal && run(async () => {
    setCmp(null)
    setOverlay(null)
    setConfig(natal.config)
    setCalcConfig(natal.config)
    setResult(await api.chart(natal.moment, natal.config))
    setMoment(natal.moment)
    setFormKey((k) => k + 1)
  })

  // La carta natal guardada aparece sola al entrar, sin volver a escribir los datos.
  useEffect(() => { loadNatal() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isNatal = Boolean(natal && moment
    && JSON.stringify(natal.moment) === JSON.stringify(moment)
    && JSON.stringify(natal.config) === JSON.stringify(calcConfig))

  const saveNatal = () => moment && run(async () => {
    await save({ ...settings!, natal: { moment, config: calcConfig, saved_at: new Date().toISOString() } })
    setConfirm(null)
  })

  const deleteNatal = () => run(async () => {
    await save({ ...settings!, natal: null })
    setConfirm(null)
  })

  const calc = (m: MomentInput) => run(async () => {
    setCmp(null)
    setOverlay(null)
    setResult(await api.chart(m, config))
    setMoment(m)
    setCalcConfig(config)
  })

  const nowChart = () => run(async () => {
    const place = settings?.default_location ?? await locate()
    setCmp(null)
    setOverlay(null)
    setMoment(null)
    setResult(await api.now(place, config))
  })

  // Añade las posiciones actuales a la carta calculada, sin sustituirla. Se recalculan en cada pulsación
  // y usan el mismo sistema que la carta; las posiciones geocéntricas no dependen del lugar.
  const superimpose = () => {
    if (overlay) return setOverlay(null)
    if (!moment) return
    run(async () => {
      setOverlay(await api.now(overlayPlace(moment), calcConfig))
      setOverlayLabel('ahora')
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const overlayPlace = (m: MomentInput) => settings?.default_location
    ?? { name: m.location_name, latitude: m.latitude, longitude: m.longitude, timezone: m.timezone }

  // Igual que Superponer, pero con la fecha, hora y lugar elegidos; el lugar determina el ascendente.
  const superimposeDate = () => {
    if (!moment) return
    run(async () => {
      const p = pickPlace ?? overlayPlace(moment)
      setOverlay(await api.chart({
        local_datetime: `${pick.date}T${pick.time}:00`, timezone: p.timezone, utc_offset_minutes: null, fold: 0,
        location_name: p.name, latitude: p.latitude, longitude: p.longitude,
      }, calcConfig))
      setOverlayLabel('fecha elegida')
      setPicker(false)
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const compare = () => moment && run(async () => {
    const r = await api.compareNow(moment, calcConfig, settings?.default_location ?? null)
    setCmp({ now: r.now, comparison: r.comparison })
  })

  return (
    <div className="space-y-6">
      <h1 className="text-4xl text-navy">Mi carta</h1>
      <section className="card flex flex-wrap items-center justify-between gap-3 border-gold p-4">
        <div className="min-w-0">
          <div className="label">☉ Mi carta natal</div>
          {natal
            ? <p>{fmtDate(natal.moment.local_datetime)}, {fmtTime(natal.moment.local_datetime)} · {natal.moment.location_name}</p>
            : <p>Aún no la has guardado. Escribe abajo tu fecha, hora y lugar de nacimiento, pulsa <b>Calcular carta</b> y luego <b>Guardar como mi carta natal</b>.</p>}
        </div>
        {natal && (
          <div className="flex flex-wrap gap-2">
            {!isNatal && <button className="btn" disabled={busy} onClick={loadNatal}>Ver mi carta natal</button>}
            <button className="btn btn-danger" disabled={busy} onClick={() => setConfirm('delete')}>Eliminar</button>
          </div>
        )}
      </section>
      <section className="card p-5">
        <h2 className="mb-1 text-2xl text-navy">Consulta histórica</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Cualquier fecha entre los años 1 y 2999. Las fechas anteriores a 1582 se interpretan en el calendario gregoriano proléptico.
        </p>
        <MomentForm key={formKey} config={config} onConfigChange={setConfig} onSubmit={calc} busy={busy}
                    initial={natal ? natal.moment : settings?.default_location ? { place: settings.default_location } : undefined}
                    extra={<>
                      <button type="button" className="btn" disabled={busy} onClick={nowChart}>✦ Posiciones de ahora</button>
                      <button type="button" className="btn btn-ghost" disabled={busy || !moment} aria-pressed={Boolean(overlay)} onClick={superimpose}
                              title={moment ? 'Añade las posiciones de ahora a la carta calculada' : 'Primero calcula una carta'}>
                        ◎ {overlay ? 'Quitar superposición' : 'Superponer'}
                      </button>
                      <button type="button" className="btn btn-ghost" disabled={busy || !moment} onClick={() => { setError(null); if (moment) setPickPlace((p) => p ?? overlayPlace(moment)); setPicker(true) }}
                              title={moment ? 'Añade las posiciones de la fecha que elijas a la carta calculada' : 'Primero calcula una carta'}>
                        ◎ Superponer fecha
                      </button>
                      {!isNatal && (
                        <button type="button" className="btn btn-gold" disabled={busy || !moment} onClick={() => (natal ? setConfirm('replace') : saveNatal())}
                                title={moment ? 'Guarda la carta calculada para tenerla siempre aquí' : 'Primero calcula una carta'}>
                          ☉ {natal ? 'Reemplazar mi carta natal' : 'Guardar como mi carta natal'}
                        </button>
                      )}
                    </>} />
      </section>
      {error && <p className="text-mood-1">{error}</p>}
      {result && (
        <section ref={chartRef} className="scroll-mt-4 space-y-3">
          <ChartView result={result} title={isNatal ? 'Mi carta natal' : moment ? 'Carta Astral' : 'Posiciones de ahora'} overlay={overlay} overlayLabel={overlayLabel} />
          {moment && <button className="btn" disabled={busy} onClick={compare}>Comparar con las posiciones actuales</button>}
          {moment && isNatal && <p className="text-sm text-ink-soft">Guardada solo en este dispositivo e incluida en tu copia de seguridad.</p>}
        </section>
      )}
      {cmp && result && <ComparePanel now={cmp.now} comparison={cmp.comparison} thenLabel={`la carta del ${result.time.local.replace('T', ' ')}`} />}
      {picker && (
        <Modal title="Superponer una fecha" onClose={() => setPicker(false)}>
          <p className="mb-3 text-sm text-ink-soft">Las posiciones de esa fecha se dibujarán en azul sobre la carta{isNatal ? ' natal' : ''}, sin borrarla.</p>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); superimposeDate() }}>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Fecha</span>
                <input type="date" className="input num" required min="0001-01-01" max="2999-12-31" value={pick.date}
                       onChange={(e) => setPick({ ...pick, date: e.target.value })} />
              </label>
              <label><span className="label">Hora</span>
                <input type="time" className="input num" required value={pick.time} onChange={(e) => setPick({ ...pick, time: e.target.value })} />
              </label>
            </div>
            <div>
              <span className="label">Lugar (determina el ascendente)</span>
              <LocationPicker value={pickPlace} onChange={setPickPlace} />
            </div>
            {error && <p className="text-sm text-mood-1">{error}</p>}
            <div className="flex gap-2">
              <button className="btn btn-gold" disabled={busy}>{busy ? 'Calculando…' : 'Superponer'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setPicker(false)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm === 'delete' ? 'Eliminar mi carta natal' : 'Reemplazar mi carta natal'} onClose={() => setConfirm(null)}>
          <p className="mb-4">
            {confirm === 'delete'
              ? 'Se borrarán tus datos de nacimiento de este dispositivo. Tus registros del diario no se modifican.'
              : `Tu carta natal actual (${fmtDate(natal!.moment.local_datetime)}) se sustituirá por la que estás viendo. Tus registros del diario no se modifican.`}
          </p>
          <div className="flex gap-2">
            <button className={confirm === 'delete' ? 'btn btn-danger' : 'btn btn-gold'} disabled={busy} onClick={confirm === 'delete' ? deleteNatal : saveNatal}>
              {confirm === 'delete' ? 'Eliminar' : 'Reemplazar'}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
