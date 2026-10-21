import type { Body, ChartResult } from '../types'
import { g, signLabel, visibleBodies } from '../lib/astro'

export default function PositionsTable({ result, showNodes, onSelect }: {
  result: ChartResult; showNodes: boolean; onSelect?: (b: Body) => void
}) {
  const { chart, time } = result
  const z = chart.meta.zodiac
  const vedicHouses = z === 'sidereal' && chart.meta.house_system_used !== 'W'
  return (
    <div className="overflow-x-auto">
      <table className="data num text-[0.95rem]">
        <thead>
          <tr>
            <th>Astro</th>
            <th>Signo ({z === 'sidereal' ? 'sideral' : 'tropical'})</th>
            <th>Grado en signo</th>
            <th>Longitud eclíptica</th>
            <th>Casa · {chart.meta.house_system_name}</th>
            {vedicHouses && <th>Casa védica</th>}
            <th>Movimiento</th>
          </tr>
        </thead>
        <tbody>
          {visibleBodies(chart, showNodes).map((b) => (
            <tr key={b.key} className={onSelect ? 'cursor-pointer' : ''} onClick={() => onSelect?.(b)}>
              <td><span className="glyph mr-1.5 text-gold">{g(b.symbol)}</span>{b.name}</td>
              <td>{signLabel(b.sign, z)}</td>
              <td>{b.dms}</td>
              <td>{b.longitude.toFixed(4)}°</td>
              <td>{b.house}</td>
              {vedicHouses && <td>{b.whole_sign_house}</td>}
              <td>
                {b.is_node
                  ? <span className="text-ink-soft">{b.retrograde ? 'Retrógrado (habitual en nodos)' : 'Directo'}</span>
                  : b.retrograde
                    ? <span className="text-mood-1">℞ Retrógrado aparente</span>
                    : b.key === 'sun' || b.key === 'moon' ? <span className="text-ink-soft">—</span> : 'Directo'}
                <span className="ml-2 text-xs text-ink-soft">{b.speed >= 0 ? '+' : ''}{b.speed.toFixed(3)}°/día</span>
              </td>
            </tr>
          ))}
          {(['asc', 'mc'] as const).map((k) => {
            const a = chart.angles[k]
            return (
              <tr key={k}>
                <td><span className="mr-1.5 font-semibold text-navy">{a.symbol}</span>{a.name}</td>
                <td>{signLabel(a.sign, z)}</td>
                <td>{a.dms}</td>
                <td>{a.longitude.toFixed(4)}°</td>
                <td>{k === 'asc' ? 'Cúspide 1' : 'Eje 10'}</td>
                {vedicHouses && <td>—</td>}
                <td className="text-ink-soft">Punto calculado</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-sm text-ink-soft">
        Calculado para {time.local.replace('T', ' ')} hora local ({time.timezone}, UTC{time.utc_offset}
        {time.dst ? ', horario de verano' : ''}) = {time.utc.replace('T', ' ').replace('Z', ' UTC')} ·
        lat {chart.meta.latitude.toFixed(4)}°, lon {chart.meta.longitude.toFixed(4)}° · {chart.meta.engine} {chart.meta.engine_version}
        {chart.meta.zodiac === 'sidereal' && <> · Ayanamsa {chart.meta.ayanamsa_name}: {chart.meta.ayanamsa_value?.toFixed(4)}°</>}
        · Nodos: {chart.meta.node_type === 'true' ? 'verdaderos' : 'medios'}.
      </p>
    </div>
  )
}
