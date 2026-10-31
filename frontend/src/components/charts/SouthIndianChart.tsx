import type { Body, Chart } from '../../types'
import { SIGNS, g } from '../../lib/astro'
import { BodyMark, marksIn } from './BodyMark'
import { GLYPH, GOLD, INK, NAVY, SERIF, SOFT, gridLayout } from './common'

/**
 * Carta del Sur de la India: cuadrícula 4×4 con los signos fijos (Piscis arriba a la izquierda,
 * avanzando en sentido horario); el centro 2×2 queda libre y el Lagna se marca con una diagonal.
 */
const CELL: [number, number][] = [
  [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0],
]

export default function SouthIndianChart({ chart, bodies, overlay, size, x = 0, y = 0 }: {
  chart: Chart; bodies: Body[]; overlay?: Body[]; size: number; x?: number; y?: number
}) {
  const ascSign = chart.angles.asc.sign_index
  const k = size / 400
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <rect x={0} y={0} width={400} height={400} fill="#fffdf6" stroke={INK} strokeWidth={1.6} />
      {CELL.map(([cx, cy], signIdx) => {
        const x0 = cx * 100, y0 = cy * 100
        const items = marksIn(signIdx, bodies, overlay)
        const dense = items.length > 4
        const pts = dense
          ? gridLayout(items.length, x0 + 50, y0 + 54, 5, items.length > 10 ? 30 : 42, 13)
          : gridLayout(items.length, x0 + 50, y0 + 58, 4, 44, 15)
        const house = ((signIdx - ascSign + 12) % 12) + 1
        return (
          <g key={signIdx}>
            <rect x={x0} y={y0} width={100} height={100} fill={signIdx === ascSign ? 'rgba(216,195,143,.18)' : 'none'} stroke={INK} strokeWidth={1} />
            <text x={x0 + 6} y={y0 + 15} fontSize={11} fill={GOLD}>
              <tspan fontFamily={GLYPH}>{g(SIGNS[signIdx].symbol)}</tspan>
              <tspan fontFamily={SERIF} dx={2}>{SIGNS[signIdx].rashi}</tspan>
            </text>
            <text x={x0 + 94} y={y0 + 94} textAnchor="end" fontFamily={SERIF} fontSize={10} fill={SOFT}>{house}</text>
            {signIdx === ascSign && (
              <>
                <line x1={x0} y1={y0 + 76} x2={x0 + 24} y2={y0 + 100} stroke={NAVY} strokeWidth={1.4} />
                <text x={x0 + 26} y={y0 + 95} fontFamily={SERIF} fontSize={10.5} fontStyle="italic" fill={NAVY}>Asc</text>
              </>
            )}
            {items.map((m, j) => (
              <BodyMark key={`${m.body.key}-${m.over}`} mark={m} x={pts[j][0]} y={pts[j][1]} dense={dense} />
            ))}
          </g>
        )
      })}
      {/* El centro queda libre, como en la plantilla; solo una nota discreta del zodiaco. */}
      <rect x={100} y={100} width={200} height={200} fill="#fffdf6" stroke={INK} strokeWidth={1} />
      <text x={200} y={290} textAnchor="middle" fontFamily={SERIF} fontSize={10} fontStyle="italic" fill={SOFT}>
        {chart.meta.zodiac === 'sidereal' ? 'zodiaco sideral' : 'zodiaco tropical'}
      </text>
    </g>
  )
}
