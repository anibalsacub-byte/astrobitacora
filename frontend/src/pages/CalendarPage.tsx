import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import ChartView from '../components/ChartView'
import EntryCard from '../components/EntryCard'
import type { CalendarDay, Entry, EntrySummary } from '../types'
import { MOOD_FACES, MOOD_LABELS, fmtDate, g, moodColor, signLabel } from '../lib/astro'

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const monthName = (y: number, m: number) =>
  new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function DayDetail({ date }: { date: string }) {
  const [entries, setEntries] = useState<EntrySummary[]>([])
  const [sel, setSel] = useState<Entry | null>(null)
  useEffect(() => {
    api.entries({ date_from: date, date_to: date }).then(async (r) => {
      const asc = [...r].reverse()
      setEntries(asc)
      setSel(asc.length ? await api.entry(asc[0].id) : null)
    })
  }, [date])
  if (!entries.length) return <p className="text-ink-soft">No hay registros el {fmtDate(date)}. <Link to="/nueva" className="underline">Crear uno</Link></p>
  const z = sel?.astro_config.zodiac ?? 'sidereal'
  const chart = sel?.astro_snapshot[z]
  return (
    <div className="space-y-4">
      <h2 className="text-2xl text-navy">{fmtDate(date)}</h2>
      <div className="grid gap-2">
        {entries.map((e) => <EntryCard key={e.id} e={e} />)}
      </div>
      {sel && chart && (
        <div className="card p-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xl text-navy">Carta de las {sel.local_datetime.slice(11, 16)}</h3>
            {entries.length > 1 && (
              <div className="flex gap-1">
                {entries.map((e) => (
                  <button key={e.id} className="chip num" aria-pressed={sel.id === e.id} onClick={() => api.entry(e.id).then(setSel)}>
                    {e.local_datetime.slice(11, 16)}
                  </button>
                ))}
              </div>
            )}
            <Link to={`/registro/${sel.id}`} className="text-sm underline">Abrir entrada completa →</Link>
          </div>
          <div className="mb-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <div>Ánimo: {MOOD_FACES[sel.personal.mood - 1]} {MOOD_LABELS[sel.personal.mood - 1]}{sel.personal.intensity ? ` · intensidad ${sel.personal.intensity}` : ''}</div>
            <div>Emociones: {sel.personal.emotions.join(', ') || '—'}</div>
            {chart.bodies.filter((b) => ['sun', 'moon'].includes(b.key) || (b.retrograde && !b.is_node)).map((b) => (
              <div key={b.key}><span className="glyph text-gold">{g(b.symbol)}</span> {b.name}: {signLabel(b.sign, z, false)} {b.dms}{b.retrograde ? ' ℞' : ''}</div>
            ))}
            <div>Asc: {signLabel(chart.angles.asc.sign, z, false)} {chart.angles.asc.dms}</div>
            <div>Fase lunar: {chart.moon_phase.name}</div>
          </div>
          <div className="max-w-md"><ChartView result={{ time: sel.time_info, location_name: sel.location_name, chart, alt_chart: sel.astro_snapshot[z === 'sidereal' ? 'tropical' : 'sidereal'] }} compact /></div>
        </div>
      )}
    </div>
  )
}

export default function CalendarPage() {
  const today = new Date()
  const [y, setY] = useState(today.getFullYear())
  const [m, setM] = useState(today.getMonth() + 1)
  const [days, setDays] = useState<Record<string, CalendarDay>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState({ date_from: '', date_to: '', tag: '', q: '' })
  const [results, setResults] = useState<EntrySummary[] | null>(null)

  useEffect(() => {
    api.calendar(y, m).then((r) => setDays(Object.fromEntries(r.map((d) => [d.date, d]))))
  }, [y, m])

  const move = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1)
    setY(d.getFullYear())
    setM(d.getMonth() + 1)
  }
  const first = new Date(y, m - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const nDays = new Date(y, m, 0).getDate()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: nDays }, (_, i) => i + 1)]
  const todayIso = iso(today.getFullYear(), today.getMonth() + 1, today.getDate())

  return (
    <div className="space-y-6">
      <h1 className="text-4xl text-navy">Calendario</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <button className="btn btn-ghost" onClick={() => move(-1)} aria-label="Mes anterior">‹</button>
            <h2 className="text-2xl capitalize text-navy">{monthName(y, m)}</h2>
            <button className="btn btn-ghost" onClick={() => move(1)} aria-label="Mes siguiente">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => <div key={w} className="label py-1">{w}</div>)}
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />
              const key = iso(y, m, d)
              const info = days[key]
              const isSel = selected === key
              return (
                <button key={key} onClick={() => setSelected(key)}
                        className={`flex aspect-square flex-col items-center justify-center rounded border text-sm transition ${isSel ? 'border-navy ring-1 ring-navy' : 'border-rule/60'} ${key === todayIso ? 'font-semibold' : ''}`}
                        style={{ background: info ? `${moodColor(info.mood_avg)}26` : '#fffdf8' }}
                        title={info ? `${info.entries.length} registro(s) · ánimo medio ${info.mood_avg}` : undefined}>
                  <span className="num">{d}</span>
                  {info && <span className="text-lg leading-none">{MOOD_FACES[Math.round(info.mood_avg) - 1]}</span>}
                  {info && info.entries.length > 1 && <span className="text-[10px] text-ink-soft">×{info.entries.length}</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-soft">
            {MOOD_LABELS.map((l, i) => (
              <span key={l} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: moodColor(i + 1) }} />{l}</span>
            ))}
          </div>
        </section>
        <section>{selected ? <DayDetail date={selected} /> : <p className="text-ink-soft">Selecciona un día para ver sus registros.</p>}</section>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-2xl text-navy">Buscar registros</h2>
        <form className="grid gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
              onSubmit={(e) => { e.preventDefault(); api.entries(search).then(setResults) }}>
          <label><span className="label">Desde</span><input type="date" className="input" value={search.date_from} onChange={(e) => setSearch({ ...search, date_from: e.target.value })} /></label>
          <label><span className="label">Hasta</span><input type="date" className="input" value={search.date_to} onChange={(e) => setSearch({ ...search, date_to: e.target.value })} /></label>
          <label><span className="label">Etiqueta</span><input className="input" value={search.tag} onChange={(e) => setSearch({ ...search, tag: e.target.value })} placeholder="trabajo" /></label>
          <label><span className="label">Palabras clave</span><input className="input" value={search.q} onChange={(e) => setSearch({ ...search, q: e.target.value })} /></label>
          <div className="flex items-end"><button className="btn">Buscar</button></div>
        </form>
        {results && (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {results.length === 0 ? <p className="text-ink-soft">Sin resultados.</p> : results.map((e) => <EntryCard key={e.id} e={e} />)}
          </div>
        )}
      </section>
    </div>
  )
}
