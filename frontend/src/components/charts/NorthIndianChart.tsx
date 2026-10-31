import type { Body, Chart } from '../../types'
import { BodyMark, marksIn } from './BodyMark'
import { GOLD, INK, RULE, SERIF, SOFT, gridLayout, type Pt } from './common'

/**
 * Carta del Norte de la India: cuadrado con sus dos diagonales y un rombo que une los puntos medios.
 * Las casas están fijas (la 1 es el rombo superior y se avanza en sentido antihorario);
 * los signos rotan: la casa 1 contiene el signo del Lagna y cada casa siguiente el signo siguiente.
 */
const TL: Pt = [0, 0], TR: Pt = [400, 0], BR: Pt = [400, 400], BL: Pt = [0, 400]
const T: Pt = [200, 0], R: Pt = [400, 200], B: Pt = [200, 400], L: Pt = [0, 200], C: Pt = [200, 200]
const a: Pt = [100, 100], b: Pt = [300, 100], c: Pt = [300, 300], d: Pt = [100, 300]

type Kind = 'diamond' | 'triH' | 'triV'
const HOUSES: { poly: Pt[]; center: Pt; inner: Pt; kind: Kind }[] = [
  { poly: [T, b, C, a], center: [200, 100], inner: C, kind: 'diamond' },
  { poly: [TL, T, a], center: [100, 36], inner: a, kind: 'triH' },
  { poly: [TL, a, L], center: [36, 100], inner: a, kind: 'triV' },
  { poly: [L, a, C, d], center: [100, 200], inner: C, kind: 'diamond' },
  { poly: [L, d, BL], center: [36, 300], inner: d, kind: 'triV' },
  { poly: [BL, d, B], center: [100, 364], inner: d, kind: 'triH' },
  { poly: [B, d, C, c], center: [200, 300], inner: C, kind: 'diamond' },
  { poly: [B, c, BR], center: [300, 364], inner: c, kind: 'triH' },
  { poly: [BR, c, R], center: [364, 300], inner: c, kind: 'triV' },
  { poly: [R, c, C, b], center: [300, 200], inner: C, kind: 'diamond' },
  { poly: [R, b, TR], center: [364, 100], inner: b, kind: 'triV' },
  { poly: [TR, b, T], center: [300, 36], inner: b, kind: 'triH' },
]
const MAX_ROWS: Record<Kind, number> = { diamond: 5, triH: 2, triV: 4 }
const MAX_ROWS_DENSE: Record<Kind, number> = { diamond: 6, triH: 3, triV: 5 }

function toward(p: Pt, q: Pt, dist: number): Pt {
  const dx = q[0] - p[0], dy = q[1] - p[1]
  const len = Math.hypot(dx, dy) || 1
  return [p[0] + (dx / len) * dist, p[1] + (dy / len) * dist]
}

export default function NorthIndianChart({ chart, bodies, overlay, size, x = 0, y = 0 }: {
  chart: Chart; bodies: Body[]; overlay?: Body[]; size: number; x?: number; y?: number
}) {
  const ascSign = chart.angles.asc.sign_index
  const k = size / 400
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <rect x={0} y={0} width={400} height={400} fill="#fffdf6" stroke={INK} strokeWidth={1.6} />
      <line x1={0} y1={0} x2={400} y2={400} stroke={INK} strokeWidth={1.1} />
      <line x1={400} y1={0} x2={0} y2={400} stroke={INK} strokeWidth={1.1} />
      <polygon points="200,0 400,200 200,400 0,200" fill="none" stroke={INK} strokeWidth={1.1} />
      {HOUSES.map((h, i) => {
        const signIdx = (ascSign + i) % 12
        const num = toward(h.inner, h.center, h.kind === 'diamond' ? 20 : 17)
        const items = marksIn(signIdx, bodies, overlay)
        const dense = items.length > 4
        const cy = h.center[1] + (i === 0 ? -8 : 0)
        const pts = dense
          ? gridLayout(items.length, h.center[0], cy, MAX_ROWS_DENSE[h.kind], 33, 12.5)
          : gridLayout(items.length, h.center[0], cy, MAX_ROWS[h.kind], 40, 15)
        return (
          <g key={i}>
            <polygon points={h.poly.map((p) => p.join(',')).join(' ')} fill="transparent">
              <title>{`Casa ${i + 1} · signo ${signIdx + 1}`}</title>
            </polygon>
            <text x={num[0]} y={num[1] + 4} textAnchor="middle" fontFamily={SERIF} fontSize={13} fill={GOLD} fontWeight={600}>
              {signIdx + 1}
            </text>
            {items.map((m, j) => (
              <BodyMark key={`${m.body.key}-${m.over}`} mark={m} x={pts[j][0]} y={pts[j][1]} dense={dense} />
            ))}
            {i === 0 && (
              <text x={200} y={152} textAnchor="middle" fontFamily={SERIF} fontSize={11} fontStyle="italic" fill={SOFT}>
                Asc {chart.angles.asc.dms.split('′')[0]}′
              </text>
            )}
          </g>
        )
      })}
      <rect x={-5} y={-5} width={410} height={410} fill="none" stroke={RULE} strokeWidth={0.6} />
    </g>
  )
}
