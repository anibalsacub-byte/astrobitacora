import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSettings } from '../settings'
import type { PeriodInsights, Zodiac } from '../types'
import { BODY_NAMES, MOOD_FACES, MOOD_LABELS, g, moodColor } from '../lib/astro'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return iso(x)
}
const short = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
const dayName = new Intl.DateTimeFormat('es', { weekday: 'short' })
const fmt = (s: string) => short.format(parse(s))

export default function Week() {
  const { settings } = useSettings()
  const [from, setFrom] = useState(mondayOf(new Date()))
  const [to, setTo] = useState(addDays(mondayOf(new Date()), 6))
  const [zodiac, setZodiac] = useState<Zodiac>(settings?.config.zodiac ?? 'sidereal')
  const [res, setRes] = useState<PeriodInsights | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.period({ date_from: from, date_to: to, zodiac, include_demo: false })
      .then((r) => { setRes(r); setError(null) }).catch((e) => setError(e.message))
  }, [from, to, zodiac])

  const shift = (days: number) => { setFrom(addDays(from, days)); setTo(addDays(to, days)) }
  const len = Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000) + 1
  const dates = Array.from({ length: Math.min(len, 93) }, (_, i) => addDays(from, i))
  const byDay = Object.fromEntries((res?.days ?? []).map((d) => [d.date, d]))
  const history = (res?.history ?? []).filter((h) => h.n > 0 && !h.background)
  const background = (res?.history ?? []).filter((h) => h.background)

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-end gap-3 p-4">
        <button className="btn btn-ghost" onClick={() => shift(-len)} aria-label="Periodo anterior">‹</button>
        <div className="min-w-48 text-center">
          <div className="label">{len === 7 ? 'Semana' : `Periodo de ${len} días`}</div>
          <div className="font-display text-2xl text-navy">{fmt(from)} – {fmt(to)} {to.slice(0, 4)}</div>
        </div>
        <button className="btn btn-ghost" onClick={() => shift(len)} aria-label="Periodo siguiente">›</button>
        <button className="btn btn-ghost" onClick={() => { const m = mondayOf(new Date()); setFrom(m); setTo(addDays(m, 6)) }}>Esta semana</button>
        <label><span className="label">Desde</span><input type="date" className="input" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
        <label><span className="label">Hasta</span><input type="date" className="input" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
        <label><span className="label">Zodiaco</span>
          <select className="input" value={zodiac} onChange={(e) => setZodiac(e.target.value as Zodiac)}><option value="sidereal">Sideral</option><option value="tropical">Tropical</option></select>
        </label>      </section>
      {error && <p className="text-mood-1">{error}</p>}

      {res && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card space-y-4 p-4">
            <h2 className="text-2xl text-navy">Lo que registraste</h2>
            {dates.length <= 31 && (
              <div className="grid grid-cols-7 gap-1 text-center">
                {dates.map((d) => {
                  const day = byDay[d]
                  return (
                    <div key={d} className="rounded border border-rule/60 py-1" style={{ background: day ? `${moodColor(day.mood_avg)}26` : '#fffdf8' }}
                         title={day ? `${day.moods.length} registro(s) · ${MOOD_LABELS[Math.round(day.mood_avg) - 1]}` : 'Sin registro'}>
                      <div className="text-xs text-ink-soft">{dayName.format(parse(d))}</div>
                      <div className="num text-sm">{parse(d).getDate()}</div>
                      <div className="h-6 text-lg leading-6">{day ? MOOD_FACES[Math.round(day.mood_avg) - 1] : '·'}</div>
                    </div>
                  )
                })}
              </div>
            )}
            {res.n === 0 ? (
              <p className="text-ink-soft">No hay registros en este periodo. <Link to="/" className="underline">Registrar cómo estás hoy</Link></p>
            ) : (
              <>
                <p>{res.n} registro(s){res.mood_mean != null && <> · ánimo medio {res.mood_mean}</>}</p>
                {res.emotions.length > 0 && <p><span className="label mr-2">Emociones</span>{res.emotions.map((e) => `${e.emotion} ×${e.count}`).join(' · ')}</p>}
                {res.tags.length > 0 && <p><span className="label mr-2">Áreas</span>{res.tags.map((t) => `#${t.tag} ×${t.count}`).join(' · ')}</p>}
                {res.events.length > 0 && (
                  <div>
                    <div className="label mb-1">Qué pasó</div>
                    <ul className="space-y-1">
                      {res.events.map((ev) => (
                        <li key={ev.id}>
                          <Link to={`/registro/${ev.id}`} className="hover:underline">
                            <span className="num text-sm text-ink-soft">{fmt(ev.local_datetime.slice(0, 10))} · </span>{ev.text}
                          </Link>
                          {ev.valence && <span className={`badge ml-2 ${ev.valence === 'negativo' ? 'badge-demo' : 'badge-astro'}`}>{ev.valence}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="text-2xl text-navy">Dónde estaban los astros</h2>
            <ul className="space-y-1.5 text-[0.97rem]">
              {res.sky.bodies.map((b) => (
                <li key={b.key} className="grid grid-cols-[8.5rem_1fr] gap-2">
                  <span><span className="glyph mr-1 text-gold">{g(BODY_NAMES[b.key].symbol)}</span>{b.name.replace(' (Rahu)', '')}</span>
                  <span>
                    {b.segments.map((s, i) => (
                      <span key={i}>
                        {i > 0 && <span className="text-ink-soft"> → </span>}
                        {s.label}
                        {b.segments.length > 1 && <span className="num text-xs text-ink-soft"> ({fmt(s.from)}{s.from !== s.to ? `–${fmt(s.to)}` : ''})</span>}
                      </span>
                    ))}
                    {b.retrograde && <span className="ml-2 text-mood-1">℞{b.retro_all_period ? '' : ' parte del periodo'}</span>}
                    {b.station && <span className="ml-2 text-sm text-ink-soft">({b.station})</span>}
                  </span>
                </li>
              ))}
            </ul>
            {res.sky.lunar_events.length > 0 && (
              <p className="text-sm"><span className="label mr-2">Lunaciones</span>{res.sky.lunar_events.map((e) => `${e.name} ${fmt(e.date)}`).join(' · ')}</p>
            )}
            <p className="text-xs text-ink-soft">Fechas en la zona {res.timezone}. Las posiciones del cielo son las mismas para todo el planeta salvo el ascendente, que aquí no se usa.</p>
          </section>

          <section className="card p-4 lg:col-span-2">
            <h2 className="text-2xl text-navy">¿Se repite? Estas mismas posiciones en tus otros registros</h2>
            <p className="mb-3 text-sm text-ink-soft">
              {res.note}{res.overall_mood_mean != null && <> Tu ánimo medio en el resto de registros es <b className="num">{res.overall_mood_mean}</b>; arriba aparecen las posiciones en las que más se aleja.</>}
            </p>
            {history.length === 0 ? <p className="text-ink-soft">Todavía no hay otros registros con estas posiciones.</p> : (
              <div className="overflow-x-auto">
                <table className="data num">
                  <thead><tr><th>Posición durante el periodo</th><th>Otros registros</th><th>Ánimo medio</th><th>Emociones más frecuentes</th></tr></thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.feature}>
                        <td><span className="glyph mr-1 text-gold">{g(BODY_NAMES[h.body]?.symbol ?? '☽')}</span>{h.label}</td>
                        <td>{h.n}</td>
                        <td>{h.mood_mean != null
                          ? <span style={{ color: moodColor(h.mood_mean) }}>
                              {h.mood_mean} {MOOD_FACES[Math.round(h.mood_mean) - 1]}
                              {h.mood_diff != null && Math.abs(h.mood_diff) >= 0.1 && <span className="ml-1 text-xs text-ink-soft">({h.mood_diff > 0 ? '+' : ''}{h.mood_diff})</span>}
                            </span>
                          : <span className="text-ink-soft">pocos registros</span>}</td>
                        <td>{h.top_emotions.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {background.length > 0 && (
              <p className="mt-3 text-sm text-ink-soft">
                Presentes en casi todos tus registros, así que no sirven para comparar: {background.map((b) => b.label).join(' · ')}.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
