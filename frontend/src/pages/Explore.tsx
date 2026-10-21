import { useEffect, useState } from 'react'
import { api } from '../api'
import EntryCard from '../components/EntryCard'
import { useSettings } from '../settings'
import type { ExperienceInsights, Zodiac } from '../types'
import { BODY_NAMES, DEFAULT_EMOTIONS, g, signLabel } from '../lib/astro'

type Kind = 'emotion' | 'tag' | 'low' | 'high' | 'negative' | 'positive' | 'keyword'
const KINDS: { key: Kind; label: string }[] = [
  { key: 'emotion', label: 'Una emoción' },
  { key: 'tag', label: 'Un área de mi vida' },
  { key: 'low', label: 'Días de ánimo bajo' },
  { key: 'high', label: 'Días de ánimo alto' },
  { key: 'negative', label: 'Acontecimientos negativos' },
  { key: 'positive', label: 'Acontecimientos positivos' },
  { key: 'keyword', label: 'Una palabra' },
]
const BODY_ORDER = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'rahu']
const REL: Record<string, string> = { insuficiente: 'Muy pocos registros', orientativa: 'Orientativo', descriptiva: 'Descriptivo' }

export function Bar({ pct, rest }: { pct: number; rest: number | null }) {
  return (
    <div className="space-y-0.5" aria-hidden>
      <div className="h-2.5 rounded-sm bg-parchment"><div className="h-2.5 rounded-sm bg-navy" style={{ width: `${pct}%` }} /></div>
      {rest !== null && <div className="h-1.5 rounded-sm bg-parchment"><div className="h-1.5 rounded-sm bg-ink-soft/45" style={{ width: `${rest}%` }} /></div>}
    </div>
  )
}

export default function Explore({ initial }: { initial?: { kind: Kind; value: string } }) {
  const { settings } = useSettings()
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'emotion')
  const [value, setValue] = useState(initial?.value ?? 'Cansancio')
  const [zodiac, setZodiac] = useState<Zodiac>(settings?.config.zodiac ?? 'sidereal')
  const [range, setRange] = useState({ date_from: '', date_to: '' })
  const [includeDemo, setIncludeDemo] = useState(false)
  const [res, setRes] = useState<ExperienceInsights | null>(null)
  const [showEntries, setShowEntries] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emotions = [...DEFAULT_EMOTIONS, ...(settings?.custom_emotions ?? [])]
  const tags = settings?.custom_tags ?? []

  useEffect(() => {
    const p: Record<string, string | boolean | string[] | undefined> = { zodiac, include_demo: includeDemo, ...range }
    if (kind === 'emotion') p.emotion = [value]
    if (kind === 'tag') p.tag = value
    if (kind === 'keyword') { if (value.trim().length < 2) return; p.q = value.trim() }
    if (kind === 'low') p.mood_max = '2'
    if (kind === 'high') p.mood_min = '4'
    if (kind === 'negative') p.valence = 'negativo'
    if (kind === 'positive') p.valence = 'positivo'
    api.experience(p).then((r) => { setRes(r); setError(null) }).catch((e) => setError(e.message))
  }, [kind, value, zodiac, range, includeDemo])

  const describe = () => {
    switch (kind) {
      case 'emotion': return `sentiste ${value.toLowerCase()}`
      case 'tag': return `registraste algo de «${value}»`
      case 'low': return 'tu ánimo estuvo bajo (mal o muy mal)'
      case 'high': return 'tu ánimo estuvo alto (bien o muy bien)'
      case 'negative': return 'marcaste un acontecimiento negativo'
      case 'positive': return 'marcaste un acontecimiento positivo'
      default: return `escribiste «${value}»`
    }
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-4">
        <h2 className="text-2xl text-navy">¿Qué experiencia quieres explorar?</h2>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button key={k.key} className="chip" aria-pressed={kind === k.key} onClick={() => {
              setKind(k.key)
              if (k.key === 'emotion') setValue('Cansancio')
              if (k.key === 'tag') setValue(tags[0] ?? '')
              if (k.key === 'keyword') setValue('')
            }}>{k.label}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {kind === 'emotion' && (
            <label className="sm:col-span-2"><span className="label">Emoción</span>
              <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>{emotions.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
          )}
          {kind === 'tag' && (
            <label className="sm:col-span-2"><span className="label">Área</span>
              <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>{tags.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
          )}
          {kind === 'keyword' && (
            <label className="sm:col-span-2"><span className="label">Palabra o frase</span>
              <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="p. ej. examen, discusión, viaje" />
            </label>
          )}
          <label><span className="label">Desde (opcional)</span><input type="date" className="input" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} /></label>
          <label><span className="label">Hasta (opcional)</span><input type="date" className="input" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">Zodiaco
            <select className="input w-auto py-0.5" value={zodiac} onChange={(e) => setZodiac(e.target.value as Zodiac)}>
              <option value="sidereal">Sideral</option><option value="tropical">Tropical</option>
            </select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} /> Incluir el registro de demostración</label>
        </div>
      </section>

      {error && <p className="text-mood-1">{error}</p>}
      {res && (
        <>
          <section>
            <h2 className="text-3xl text-navy">
              {res.n === 0 ? 'Aún no hay registros en los que ' : `${res.n} ${res.n === 1 ? 'vez' : 'veces'} `}{describe()}
            </h2>
            <p className="text-ink-soft">
              {res.n > 0 && <>De {res.n + res.n_rest} registros en total · <span className="badge badge-astrol">{REL[res.reliability]}</span>
                {res.matched_stats.mood_mean != null && <> · ánimo medio {res.matched_stats.mood_mean}</>}
                {res.matched_stats.top_emotions.length > 0 && <> · emociones frecuentes: {res.matched_stats.top_emotions.join(', ')}</>}</>}
            </p>
            {res.warnings.map((w) => <p key={w} className="text-sm text-mood-2">⚠︎ {w}</p>)}
          </section>

          {res.highlights.length > 0 && (
            <section className="card p-4">
              <h3 className="text-2xl text-navy">Lo que se repite en el cielo</h3>
              <p className="mb-3 text-sm text-ink-soft">
                Posiciones que aparecen al menos dos veces en estos registros y con más frecuencia que en el resto.
                <span className="ml-2 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm bg-navy" /> estos registros</span>
                <span className="ml-2 inline-flex items-center gap-1"><span className="inline-block h-1.5 w-4 rounded-sm bg-ink-soft/45" /> el resto</span>
              </p>
              <ul className="space-y-3">
                {res.highlights.map((h) => (
                  <li key={h.feature} className="grid gap-2 sm:grid-cols-[minmax(0,16rem)_1fr]">
                    <div>
                      <div className="font-display text-lg leading-tight">
                        <span className="glyph mr-1 text-gold">{g(BODY_NAMES[h.body]?.symbol ?? '☽')}</span>{h.label}
                      </div>
                      <div className="num text-sm text-ink-soft">
                        {h.count} de {res.n} ({h.pct} %){h.rest_pct !== null && <> · resto: {h.rest_count} de {res.n_rest} ({h.rest_pct} %)</>}
                      </div>
                    </div>
                    <div className="self-center"><Bar pct={h.pct} rest={h.rest_pct} /></div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {res.n > 0 && (
            <section className="card p-4">
              <h3 className="text-2xl text-navy">Dónde estaban tus astros esas {res.n === 1 ? 'vez' : 'veces'}</h3>
              <p className="mb-3 text-sm text-ink-soft">Signo de cada astro y cuántas de esas veces estaba allí ({zodiac === 'sidereal' ? 'zodiaco sideral' : 'zodiaco tropical'}).</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {BODY_ORDER.filter((k) => res.by_body[k]).map((k) => (
                  <div key={k} className="rounded border border-rule/60 px-3 py-2">
                    <div className="mb-1"><span className="glyph mr-1 text-gold">{g(BODY_NAMES[k].symbol)}</span><b className="font-medium">{BODY_NAMES[k].name}</b></div>
                    <div className="flex flex-wrap gap-1 text-sm">
                      {res.by_body[k].map((s) => (
                        <span key={s.sign} className="rounded-full border border-rule/70 bg-[#fffdf8] px-2" title={`${s.pct} %`}>
                          {signLabel(s.sign, zodiac, false)} <b className="num">×{s.count}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {res.n > 0 && (
            <section>
              <button className="text-navy underline decoration-gold-soft underline-offset-4" onClick={() => setShowEntries(!showEntries)}>
                {showEntries ? '▾' : '▸'} Ver los {res.n} registros
              </button>
              {showEntries && <div className="mt-2 grid gap-2 md:grid-cols-2">{res.entries.map((e) => <EntryCard key={e.id} e={e} />)}</div>}
            </section>
          )}
          <p className="max-w-3xl rounded border border-gold-soft bg-[#f7efd9] px-4 py-2 text-sm">{res.note}</p>
        </>
      )}
    </div>
  )
}
