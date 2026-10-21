import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import type { Stats, Summary, Zodiac } from '../types'
import { BODY_NAMES, MOOD_LABELS, SIGNS, fmtDate, g, moodColor } from '../lib/astro'

const NAVY = '#13203b'
const GRID = '#e3d6b8'
const AXIS = { fontSize: 12, fill: '#4a453d' }
const PLANETS = ['moon', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'rahu', 'asc']

const GROUPS: { value: string; label: string }[] = [
  ...PLANETS.map((p) => ({ value: `sign:${p}`, label: `Signo de ${BODY_NAMES[p].name.replace(' (Rahu)', '')}` })),
  { value: 'phase', label: 'Fase lunar' },
  ...['mercury', 'venus', 'mars', 'jupiter', 'saturn'].map((p) => ({ value: `retro:${p}`, label: `${BODY_NAMES[p].name}: directo / retrógrado` })),
]

const RELIABILITY: Record<Summary['reliability'], string> = {
  insuficiente: 'Muestra insuficiente',
  orientativa: 'Orientativa',
  descriptiva: 'Descriptiva',
}

function Tip({ active, payload, render }: { active?: boolean; payload?: { payload: Record<string, unknown> }[]; render: (p: Record<string, unknown>) => ReactNode }) {
  if (!active || !payload?.length) return null
  return <div className="card px-3 py-2 text-sm shadow">{render(payload[0].payload)}</div>
}

function Panel({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="card p-4">
      <h2 className="text-xl text-navy">{title}</h2>
      {note && <p className="mb-2 text-sm text-ink-soft">{note}</p>}
      {children}
    </section>
  )
}

function SummaryLine({ s }: { s: Summary }) {
  return (
    <span className="num">
      n = {s.n} · {s.mood_mean != null ? `ánimo medio ${s.mood_mean}${s.mood_sd != null ? ` (DE ${s.mood_sd})` : ''}` : 'sin promedio'}
      {s.intensity_mean != null && ` · intensidad media ${s.intensity_mean}`} · <i>{RELIABILITY[s.reliability]}</i>
    </span>
  )
}

export default function Patterns() {
  const [zodiac, setZodiac] = useState<Zodiac>('sidereal')
  const [group, setGroup] = useState('sign:moon')
  const [range, setRange] = useState({ date_from: '', date_to: '', tag: '' })
  const [filters, setFilters] = useState<string[]>([])
  const [fPlanet, setFPlanet] = useState('moon')
  const [fSign, setFSign] = useState('virgo')
  const [periods, setPeriods] = useState({ a_from: '', a_to: '', b_from: '', b_to: '' })
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.stats({ zodiac, group, ...range, filters, ...periods })
      .then((s) => { setStats(s); setError(null) })
      .catch((e) => setError(e.message))
  }, [zodiac, group, range, filters, periods])

  const groupLabel = GROUPS.find((x) => x.value === group)?.label ?? group
  const groupData = stats?.groups.map((r) => ({ ...r, value: r.mood_mean ?? 0 })) ?? []

  return (
    <div className="space-y-5">
      <p className="max-w-3xl rounded border border-gold-soft bg-[#f7efd9] px-4 py-2 text-sm">
        {stats?.disclaimer ?? 'Estas cifras describen asociaciones en tus propios registros; no demuestran causalidad.'}
        {' '}Con menos de {stats?.thresholds.min_n ?? 5} registros no se calculan promedios y por debajo de {stats?.thresholds.small_n ?? 20} se marcan como orientativos.
      </p>

      <section className="card grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-6">
        <label><span className="label">Zodiaco</span>
          <select className="input" value={zodiac} onChange={(e) => setZodiac(e.target.value as Zodiac)}>
            <option value="sidereal">Sideral</option><option value="tropical">Tropical</option>
          </select>
        </label>
        <label><span className="label">Desde</span><input type="date" className="input" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} /></label>
        <label><span className="label">Hasta</span><input type="date" className="input" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} /></label>
        <label><span className="label">Etiqueta</span><input className="input" value={range.tag} onChange={(e) => setRange({ ...range, tag: e.target.value })} /></label>
        <label className="lg:col-span-2"><span className="label">Comparar por</span>
          <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
            {GROUPS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2 md:col-span-3 lg:col-span-6">
          <span className="label pb-2">Filtrar por posición:</span>
          <select className="input w-auto" value={fPlanet} onChange={(e) => setFPlanet(e.target.value)}>
            {PLANETS.map((p) => <option key={p} value={p}>{BODY_NAMES[p].name}</option>)}
          </select>
          <span className="pb-2">en</span>
          <select className="input w-auto" value={fSign} onChange={(e) => setFSign(e.target.value)}>
            {SIGNS.map((s) => <option key={s.key} value={s.key}>{zodiac === 'sidereal' ? `${s.rashi} (${s.name})` : s.name}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={() => !filters.includes(`${fPlanet}:${fSign}`) && setFilters([...filters, `${fPlanet}:${fSign}`])}>Añadir filtro</button>
          {filters.map((f) => {
            const [p, s] = f.split(':')
            return (
              <button key={f} className="chip" aria-pressed onClick={() => setFilters(filters.filter((x) => x !== f))} title="Quitar filtro">
                {BODY_NAMES[p].name} en {SIGNS.find((x) => x.key === s)?.name} ✕
              </button>
            )
          })}
        </div>
      </section>

      {error && <p className="text-mood-1">{error}</p>}
      {stats && (
        <>
          <p className="text-lg"><SummaryLine s={stats.overall} /></p>
          {stats.warnings.map((w) => <p key={w} className="text-sm text-mood-2">⚠︎ {w}</p>)}

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Evolución del estado de ánimo" note="Promedio diario (1 = muy mal, 5 = muy bien).">
              {stats.daily.length === 0 ? <p className="text-ink-soft">Sin datos.</p> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={stats.daily} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tick={AXIS} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} />
                    <Tooltip cursor={{ stroke: '#a8843a' }} content={<Tip render={(p) => <>{fmtDate(String(p.date))}<br />Ánimo medio {String(p.mood)} · {String(p.n)} registro(s)</>} />} />
                    <Line type="monotone" dataKey="mood" stroke={NAVY} strokeWidth={2} dot={{ r: 4, fill: NAVY, stroke: '#fbf7ee', strokeWidth: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title="Frecuencia de emociones" note="Porcentaje de registros en que aparece cada emoción.">
              {stats.emotions.length === 0 ? <p className="text-ink-soft">Sin datos.</p> : (
                <ResponsiveContainer width="100%" height={Math.max(160, stats.emotions.length * 28)}>
                  <BarChart data={stats.emotions} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 10 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" tick={AXIS} unit=" %" domain={[0, 100]} />
                    <YAxis type="category" dataKey="emotion" tick={AXIS} width={96} />
                    <Tooltip cursor={{ fill: 'rgba(216,195,143,.2)' }} content={<Tip render={(p) => <>{String(p.emotion)}: {String(p.count)} registro(s), {String(p.pct)} %</>} />} />
                    <Bar dataKey="pct" fill={NAVY} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title={`Ánimo según ${groupLabel.toLowerCase()}`} note={`Zodiaco ${zodiac === 'sidereal' ? 'sideral' : 'tropical'}. Las barras solo aparecen con al menos ${stats.thresholds.min_n} registros por grupo.`}>
              {groupData.length === 0 ? <p className="text-ink-soft">Sin datos.</p> : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={groupData} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 11 }} interval={0} angle={groupData.length > 5 ? -30 : 0} textAnchor={groupData.length > 5 ? 'end' : 'middle'} height={groupData.length > 5 ? 60 : 30} />
                      <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} />
                      <Tooltip cursor={{ fill: 'rgba(216,195,143,.2)' }} content={<Tip render={(p) => <>{String(p.label)}<br />n = {String(p.n)} · {p.mood_mean != null ? `ánimo medio ${String(p.mood_mean)}` : 'muestra insuficiente'}</>} />} />
                      <Bar dataKey="value" fill={NAVY} radius={[4, 4, 0, 0]} barSize={22} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                  <table className="data num mt-2 text-sm">
                    <thead><tr><th>Grupo</th><th>n</th><th>Ánimo medio</th><th>DE</th><th>Fiabilidad</th></tr></thead>
                    <tbody>
                      {stats.groups.map((r) => (
                        <tr key={r.key}><td>{r.label}</td><td>{r.n}</td><td>{r.mood_mean ?? '—'}</td><td>{r.mood_sd ?? '—'}</td><td>{RELIABILITY[r.reliability]}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </Panel>

            <Panel title="Acontecimientos especiales" note="Según la valoración marcada en «¿Hubo algo especial?».">
              <ul className="space-y-2">
                {(['positivo', 'negativo', 'mixto', 'sin_marcar'] as const).map((k) => {
                  const v = stats.valence[k]
                  const pct = stats.n ? (100 * v) / stats.n : 0
                  return (
                    <li key={k} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-2">
                      <span>{k === 'sin_marcar' ? 'Sin marcar' : k[0].toUpperCase() + k.slice(1)}</span>
                      <span className="h-3 rounded-sm bg-parchment"><span className="block h-3 rounded-sm bg-navy" style={{ width: `${pct}%` }} /></span>
                      <span className="num text-right">{v}</span>
                    </li>
                  )
                })}
              </ul>
              {stats.tags.length > 0 && (
                <p className="mt-3 text-sm text-ink-soft">Etiquetas: {stats.tags.map((t) => `#${t.tag} (${t.count})`).join(' · ')}</p>
              )}
            </Panel>
          </div>

          <Panel title="Calendario emocional" note="Cada registro, coloreado por estado de ánimo.">
            <div className="flex flex-wrap gap-1">
              {stats.series.map((s) => (
                <Link key={s.id} to={`/registro/${s.id}`} title={`${s.local_datetime.replace('T', ' ')} · ${MOOD_LABELS[s.mood - 1]}`}
                      className="h-5 w-5 rounded-sm" style={{ background: moodColor(s.mood) }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-soft">
              {MOOD_LABELS.map((l, i) => <span key={l} className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: moodColor(i + 1) }} />{l}</span>)}
            </div>
          </Panel>

          <Panel title="Comparar dos periodos">
            <div className="grid gap-3 sm:grid-cols-4">
              {(['a_from', 'a_to', 'b_from', 'b_to'] as const).map((k) => (
                <label key={k}><span className="label">{k.startsWith('a') ? 'Periodo A' : 'Periodo B'} · {k.endsWith('from') ? 'desde' : 'hasta'}</span>
                  <input type="date" className="input" value={periods[k]} onChange={(e) => setPeriods({ ...periods, [k]: e.target.value })} />
                </label>
              ))}
            </div>
            {stats.periods ? (
              <div className="mt-3 space-y-1">
                <p><b>A</b> ({stats.periods.a.range.join(' → ')}): <SummaryLine s={stats.periods.a} /></p>
                <p><b>B</b> ({stats.periods.b.range.join(' → ')}): <SummaryLine s={stats.periods.b} /></p>
                <p>{stats.periods.mood_diff != null
                  ? `Diferencia de ánimo medio (B − A): ${stats.periods.mood_diff > 0 ? '+' : ''}${stats.periods.mood_diff}. Es una descripción, no una prueba de que algo haya cambiado.`
                  : 'No hay registros suficientes en ambos periodos para comparar promedios.'}</p>
              </div>
            ) : <p className="mt-2 text-sm text-ink-soft">Completa las cuatro fechas para comparar.</p>}
          </Panel>

          <p className="text-sm text-ink-soft">Símbolos: {PLANETS.slice(0, 10).map((p) => `${g(BODY_NAMES[p].symbol)} ${BODY_NAMES[p].name}`).join(' · ')}</p>
        </>
      )}
    </div>
  )
}
