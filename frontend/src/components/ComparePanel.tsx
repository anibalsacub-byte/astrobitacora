import type { ChartResult, Comparison } from '../types'
import { g, signLabel } from '../lib/astro'
import ChartView from './ChartView'

export default function ComparePanel({ now, comparison, thenLabel }: { now: ChartResult; comparison: Comparison; thenLabel: string }) {
  const z = comparison.zodiac
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        Comparación entre {thenLabel} y el instante actual ({now.time.local.replace('T', ' ')}, {now.time.timezone}), recalculado ahora mismo.
        Zodiaco {z === 'sidereal' ? 'sideral' : 'tropical'}.
      </p>
      <div className="card overflow-x-auto p-4">
        <div className="mb-2 flex items-center gap-2"><span className="badge badge-astro">Astronomía</span><h3 className="text-xl text-navy">Cambios de posición</h3></div>
        <table className="data num">
          <thead><tr><th>Astro</th><th>Entonces</th><th>Ahora</th><th>Avance</th><th>Casa natal que recorre</th></tr></thead>
          <tbody>
            {comparison.changes.map((c) => (
              <tr key={c.key}>
                <td><span className="glyph mr-1 text-gold">{g(c.symbol)}</span>{c.name}</td>
                <td>{signLabel(c.then_sign, z)} {c.then_dms}{c.then_retrograde && c.key !== 'rahu' && c.key !== 'ketu' ? ' ℞' : ''}</td>
                <td className={c.sign_changed ? 'font-semibold' : ''}>{signLabel(c.now_sign, z)} {c.now_dms}{c.now_retrograde && c.key !== 'rahu' && c.key !== 'ketu' ? ' ℞' : ''}</td>
                <td>{c.delta_longitude.toFixed(1)}°</td>
                <td>{c.natal_house_now}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card p-4">
        <div className="mb-2 flex items-center gap-2"><span className="badge badge-astrol">Astrología</span><h3 className="text-xl text-navy">Tránsitos principales</h3></div>
        {comparison.transits.length === 0
          ? <p className="text-ink-soft">No hay aspectos mayores dentro de los orbes usados.</p>
          : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {comparison.transits.slice(0, 24).map((t, i) => (
                <li key={i} className="num">
                  <span className="glyph text-gold">{g(t.transiting_symbol)}</span> {t.transiting_name} actual{' '}
                  <span className="glyph">{g(t.aspect_symbol)}</span> {t.aspect_name.toLowerCase()}{' '}
                  {t.natal_symbol.length <= 2 ? <span className="glyph text-gold">{g(t.natal_symbol)}</span> : <b>{t.natal_symbol}</b>} {t.natal_name} de entonces
                  <span className="ml-1 text-sm text-ink-soft">(orbe {t.orb.toFixed(2)}°)</span>
                </li>
              ))}
            </ul>
          )}
        <p className="mt-3 text-sm text-ink-soft">
          Orbes: conjunción, cuadratura, trígono y oposición ±3°; sextil ±2°. {comparison.note}
        </p>
      </div>
      <div>
        <h3 className="mb-2 text-xl text-navy">Carta de ahora</h3>
        <ChartView result={now} title="Posiciones de ahora" />
      </div>
    </div>
  )
}
