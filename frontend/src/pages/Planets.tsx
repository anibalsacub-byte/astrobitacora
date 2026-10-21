import { useEffect, useState } from 'react'
import { api } from '../api'
import { loadPlanetInfo } from '../components/PlanetDetail'
import { useSettings } from '../settings'
import type { Chart, ChartResult, PlanetInfo } from '../types'
import { SIGN_BY_KEY, g } from '../lib/astro'

const num = (x: number, d: number) => x.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: d })

function orbitText(days: number) {
  if (days < 1000) return { main: `${num(Math.round(days), 0)} días`, sub: `(${num(days / 365.25, 2)} ${days > 300 && days < 400 ? 'año' : 'años'})` }
  return { main: `${num(days / 365.25, 2)} años`, sub: '' }
}

function rotationText(p: PlanetInfo) {
  const h = Math.abs(p.rotation_hours)
  const main = h < 48 ? `${num(h, 1)} horas` : `${num(h / 24, 1)} días`
  const sub = p.physical_retrograde ? '(rotación retrógrada)' : p.key === 'earth' ? '(día sideral; el día solar dura 24 h)' : ''
  return { main, sub }
}

const BANDS = new Set(['jupiter', 'saturn'])

/** Esfera en tonos grises, al estilo de las ilustraciones de la plantilla. */
function Sphere({ k }: { k: string }) {
  const id = `sph-${k}`
  return (
    <svg width="46" height="46" viewBox="-26 -26 52 52" aria-hidden>
      <defs>
        <radialGradient id={id} cx="35%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#f2efe8" />
          <stop offset="55%" stopColor="#9d988e" />
          <stop offset="100%" stopColor="#3b3833" />
        </radialGradient>
        <clipPath id={`${id}-c`}><circle r="18" /></clipPath>
      </defs>
      {k === 'saturn' && <ellipse rx="25" ry="7" fill="none" stroke="#5d5850" strokeWidth="2" transform="rotate(-18)" />}
      <circle r="18" fill={`url(#${id})`} />
      {BANDS.has(k) && (
        <g clipPath={`url(#${id}-c)`} stroke="#4a463f" strokeOpacity=".35">
          {[-9, -4, 2, 8].map((y) => <line key={y} x1="-20" x2="20" y1={y} y2={y + 1} strokeWidth={y % 2 ? 2.2 : 1.2} />)}
        </g>
      )}
      {k === 'earth' && (
        <g clipPath={`url(#${id}-c)`} fill="#4a463f" fillOpacity=".35">
          <path d="M-12 -10 q6 -6 12 -2 q2 6 -4 8 q-6 2 -8 -6z M2 4 q8 -2 10 4 q-2 8 -8 8 q-4 -6 -2 -12z" />
        </g>
      )}
      {k === 'saturn' && <path d="M-25 -0.5 A25 7 0 0 0 25 0.5" fill="none" stroke="#5d5850" strokeWidth="2" transform="rotate(-18)" />}
    </svg>
  )
}

function pos(chart: Chart | undefined, key: string) {
  const b = chart?.bodies.find((x) => x.key === key)
  if (!b) return null
  const s = SIGN_BY_KEY[b.sign]
  return { text: chart!.meta.zodiac === 'sidereal' ? s.rashi : s.name, glyph: g(s.symbol), deg: Math.floor(b.degree_in_sign), retro: b.retrograde && !b.is_node }
}

export default function Planets() {
  const { settings } = useSettings()
  const [data, setData] = useState<{ source: string; planets: PlanetInfo[]; nodes_note: string } | null>(null)
  const [now, setNow] = useState<ChartResult | null>(null)
  useEffect(() => { loadPlanetInfo().then(setData) }, [])
  useEffect(() => {
    // Las longitudes geocéntricas no dependen del lugar; se usa la ubicación predeterminada si existe.
    const place = settings?.default_location ?? { name: 'Geocéntrico', latitude: 0, longitude: 0, timezone: 'UTC' }
    if (settings) api.now(place, { ...settings.config, zodiac: 'tropical' }).then(setNow).catch(() => {})
  }, [settings])

  const planets = data?.planets.filter((p) => !['sun', 'moon'].includes(p.key)) ?? []
  const lights = data?.planets.filter((p) => ['sun', 'moon'].includes(p.key)) ?? []
  const Position = ({ k }: { k: string }) => {
    if (k === 'earth') return <span className="text-ink-soft">— (punto de observación)</span>
    const t = pos(now?.chart, k), s = pos(now?.alt_chart, k)
    if (!t) return <span className="text-ink-soft">…</span>
    return (
      <span className="num">
        <span className="glyph text-gold">{t.glyph}</span> {t.text} {t.deg}°
        {s && <> <span className="text-ink-soft">/</span> <span className="glyph text-gold">{s.glyph}</span> {s.text} {s.deg}°</>}
        {t.retro && <span className="ml-1 text-mood-1" title="Retrógrado aparente">℞</span>}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      <header className="text-center">
        <div className="ornament">✦ · · ☾ ☀ ☽ · · ✦</div>
        <h1 className="text-5xl tracking-wide text-navy">PLANETAS</h1>
        <p className="font-display text-lg tracking-[.2em] text-ink-soft">Y SUS TIEMPOS DE TRASLACIÓN Y ROTACIÓN</p>
      </header>

      <div className="card overflow-x-auto">
        <table className="data">
          <thead>
            <tr className="bg-parchment/50">
              <th className="text-center">Planeta</th>
              <th className="text-center">Símbolo<br />astrológico</th>
              <th className="text-center">Tiempo de traslación<br /><span className="normal-case">(alrededor del Sol)</span></th>
              <th className="text-center">Tiempo de rotación<br /><span className="normal-case">(sobre su eje)</span></th>
              <th>Descripción</th>
              <th>Posición ahora<br /><span className="normal-case">tropical / sideral</span></th>
            </tr>
          </thead>
          <tbody>
            {planets.map((p) => {
              const o = orbitText(p.orbit_days!), r = rotationText(p)
              return (
                <tr key={p.key}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Sphere k={p.key} />
                      <div>
                        <div className="font-display text-lg tracking-wider">{p.name.toUpperCase()}</div>
                        {p.key === 'pluto' && <div className="text-xs text-ink-soft">(planeta enano)</div>}
                      </div>
                    </div>
                  </td>
                  <td className="glyph text-center text-3xl">{g(p.symbol)}</td>
                  <td className="num text-center">{o.main}{o.sub && <div className="text-sm text-ink-soft">{o.sub}</div>}</td>
                  <td className="num text-center">{r.main}{r.sub && <div className="text-sm text-ink-soft">{r.sub}</div>}</td>
                  <td className="max-w-xs text-[0.95rem]">{p.description}</td>
                  <td className="whitespace-nowrap"><Position k={p.key} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {lights.map((p) => (
          <article key={p.key} className="card p-4">
            <div className="flex items-baseline gap-3">
              <span className="glyph text-3xl text-gold">{g(p.symbol)}</span>
              <h2 className="text-2xl text-navy">{p.name}</h2>
              <span className="label">{p.kind}</span>
            </div>
            <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-y-1 text-[0.95rem]">
              <dt className="text-ink-soft">Traslación</dt><dd>{p.orbit}</dd>
              <dt className="text-ink-soft">Rotación</dt><dd>{p.rotation}</dd>
              <dt className="text-ink-soft">Ahora</dt><dd><Position k={p.key} /></dd>
            </dl>
            <p className="mt-2 text-[0.95rem]">{p.description}</p>
          </article>
        ))}
        {data && (
          <article className="card p-4">
            <div className="flex items-baseline gap-3">
              <span className="glyph text-3xl text-gold">{g('☊')}{g('☋')}</span>
              <h2 className="text-2xl text-navy">Nodos lunares</h2>
            </div>
            <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-y-1 text-[0.95rem]">
              <dt className="text-ink-soft">Rahu ahora</dt><dd><Position k="rahu" /></dd>
            </dl>
            <p className="mt-2 text-[0.95rem]">{data.nodes_note}</p>
          </article>
        )}
      </div>

      <p className="max-w-3xl text-sm text-ink-soft">
        <span className="badge badge-astro mr-2">Astronomía</span>
        Periodos siderales. La «rotación retrógrada» es física: el cuerpo gira sobre su eje en sentido contrario a su órbita. El símbolo ℞ de la
        última columna indica el <i>retrógrado aparente</i>, un efecto de perspectiva visto desde la Tierra; son fenómenos distintos.
        {now && <> Posiciones calculadas para {now.time.utc.replace('T', ' ').replace('Z', ' UTC')}.</>} Fuente: {data?.source}
      </p>
    </div>
  )
}
