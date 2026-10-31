import type { Body, Chart } from '../../types'
import { SIGNS, g } from '../../lib/astro'
import { GLYPH, GOLD, INK, NAVY, OVERLAY, RETRO, RULE, SERIF, SOFT } from './common'

/** Longitudes de dibujo: separa los glifos que caerían superpuestos (mínimo 9° de arco en pantalla). */
function spread(sorted: Body[]) {
  const disp = sorted.map((b) => b.longitude)
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < disp.length; i++) if (disp[i] - disp[i - 1] < 9) disp[i] = disp[i - 1] + 9
  }
  return disp
}

/**
 * Rueda occidental: el Ascendente a la izquierda y las longitudes avanzando en sentido antihorario.
 * Las posiciones superpuestas se dibujan en un anillo interior propio.
 */
export default function WheelChart({ chart, bodies, overlay, size, x = 0, y = 0 }: {
  chart: Chart; bodies: Body[]; overlay?: Body[]; size: number; x?: number; y?: number
}) {
  const asc = chart.angles.asc.longitude
  const C = 200
  const rOut = 196, rZod = 166, rPlanet = 139, rDeg = 122, rOver = 104, rOverDeg = 89, rHouse = 72, rIn = 58
  const ang = (lon: number) => ((180 + lon - asc) * Math.PI) / 180
  const P = (lon: number, r: number) => [C + r * Math.cos(ang(lon)), C - r * Math.sin(ang(lon))] as const

  const sorted = [...bodies].sort((p, q) => p.longitude - q.longitude)
  const disp = spread(sorted)
  const sortedOver = [...(overlay ?? [])].sort((p, q) => p.longitude - q.longitude)
  const dispOver = spread(sortedOver)

  const cusps = chart.houses.cusps
  const k = size / 400
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle cx={C} cy={C} r={rOut} fill="#fffdf6" stroke={INK} strokeWidth={1.5} />
      <circle cx={C} cy={C} r={rZod} fill="none" stroke={INK} strokeWidth={1} />
      <circle cx={C} cy={C} r={rIn} fill="none" stroke={RULE} strokeWidth={0.8} />
      {SIGNS.map((s, i) => {
        const [x1, y1] = P(i * 30, rZod)
        const [x2, y2] = P(i * 30, rOut)
        const [gx, gy] = P(i * 30 + 15, (rZod + rOut) / 2)
        return (
          <g key={s.key}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={0.9} />
            <text x={gx} y={gy + 6} textAnchor="middle" fontFamily={GLYPH} fontSize={17} fill={GOLD}>{g(s.symbol)}<title>{s.name}</title></text>
          </g>
        )
      })}
      {Array.from({ length: 72 }, (_, i) => {
        const [x1, y1] = P(i * 5, rZod)
        const [x2, y2] = P(i * 5, rZod - (i % 2 ? 4 : 7))
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={RULE} strokeWidth={0.6} />
      })}
      {cusps.map((cu, i) => {
        const [x1, y1] = P(cu, rIn)
        const [x2, y2] = P(cu, rZod)
        const next = cusps[(i + 1) % 12]
        const mid = cu + (((next - cu) % 360) + 360) % 360 / 2
        const [hx, hy] = P(mid, rHouse)
        const angle = i === 0 || i === 3 || i === 6 || i === 9
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={angle ? NAVY : RULE} strokeWidth={angle ? 1.4 : 0.8} />
            <text x={hx} y={hy + 4} textAnchor="middle" fontFamily={SERIF} fontSize={11} fill={SOFT}>{i + 1}</text>
          </g>
        )
      })}
      {(['asc', 'mc'] as const).map((key) => {
        const lon = chart.angles[key].longitude
        const [tx, ty] = P(lon, rOut + 0.1)
        const [lx, ly] = P(lon, rZod - 10)
        return (
          <g key={key}>
            <circle cx={tx} cy={ty} r={2.2} fill={NAVY} />
            <text x={lx} y={ly + 3.5} textAnchor="middle" fontFamily={SERIF} fontSize={9.5} fontWeight={600} fill={NAVY}>{key === 'asc' ? 'Asc' : 'MC'}</text>
          </g>
        )
      })}
      {sorted.map((b, i) => {
        const [px, py] = P(b.longitude, rZod)
        const [qx, qy] = P(disp[i], rPlanet + 8)
        const [gx, gy] = P(disp[i], rPlanet)
        const [dx, dy] = P(disp[i], rDeg)
        const color = b.retrograde && !b.is_node ? RETRO : INK
        return (
          <g key={b.key}>
            <line x1={px} y1={py} x2={qx} y2={qy} stroke={RULE} strokeWidth={0.7} />
            <text x={gx} y={gy + 6} textAnchor="middle" fontFamily={GLYPH} fontSize={16} fill={color}>
              {g(b.symbol)}<title>{`${b.name} ${b.sign_name} ${b.dms}`}</title>
            </text>
            <text x={dx} y={dy + 4} textAnchor="middle" fontFamily={SERIF} fontSize={10} fill={color}>
              {Math.floor(b.degree_in_sign)}°{b.retrograde && !b.is_node ? '℞' : ''}
            </text>
          </g>
        )
      })}
      {sortedOver.map((b, i) => {
        const [gx, gy] = P(dispOver[i], rOver)
        const [dx, dy] = P(dispOver[i], rOverDeg)
        return (
          <g key={`over-${b.key}`} fill={OVERLAY}>
            <text x={gx} y={gy + 5} textAnchor="middle" fontFamily={GLYPH} fontSize={14}>
              {g(b.symbol)}<title>{`Ahora: ${b.name} ${b.sign_name} ${b.dms}`}</title>
            </text>
            <text x={dx} y={dy + 3.5} textAnchor="middle" fontFamily={SERIF} fontSize={9}>
              {Math.floor(b.degree_in_sign)}°{b.retrograde && !b.is_node ? '℞' : ''}
            </text>
          </g>
        )
      })}
    </g>
  )
}
