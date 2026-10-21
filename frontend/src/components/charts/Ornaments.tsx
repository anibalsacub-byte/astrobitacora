import { INK, PAPER } from './common'

/** Adornos de la ficha, dibujados a línea como en la plantilla impresa. */

export function Starburst({ x, y, r = 14 }: { x: number; y: number; r?: number }) {
  return (
    <g stroke={INK} strokeWidth={0.9} strokeLinecap="round">
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8
        const len = i % 4 === 0 ? r : i % 2 === 0 ? r * 0.65 : r * 0.4
        return <line key={i} x1={x} y1={y} x2={x + Math.cos(a) * len} y2={y + Math.sin(a) * len} />
      })}
      <circle cx={x} cy={y} r={2} fill={INK} />
    </g>
  )
}

/** Luna creciente (o menguante con flip): círculo de tinta recortado por otro del color del papel. */
export function Crescent({ x, y, r = 8, flip = false }: { x: number; y: number; r?: number; flip?: boolean }) {
  const d = flip ? -1 : 1
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={INK} />
      <circle cx={x + d * r * 0.42} cy={y - r * 0.12} r={r * 0.86} fill={PAPER} />
    </g>
  )
}

export function Sparkle({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  const k = r * 0.22
  return (
    <path d={`M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k}Z`} fill={INK} />
  )
}

export function StarMedallion({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={15} fill="none" stroke={INK} strokeWidth={0.8} strokeDasharray="1 2.2" />
      <Sparkle x={x} y={y} r={11} />
    </g>
  )
}

export function SunFace({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={INK} strokeLinecap="round">
      <circle cx={x} cy={y} r={40} fill="none" strokeWidth={0.8} strokeDasharray="1 2.6" />
      {Array.from({ length: 32 }, (_, i) => {
        const a = (i * Math.PI) / 16
        const r1 = 18.5, r2 = i % 2 ? 26 : 32
        return <line key={i} x1={x + Math.cos(a) * r1} y1={y + Math.sin(a) * r1} x2={x + Math.cos(a) * r2} y2={y + Math.sin(a) * r2} strokeWidth={0.9} />
      })}
      <circle cx={x} cy={y} r={15.5} fill={PAPER} strokeWidth={1.1} />
      <path d={`M${x - 8} ${y - 4.5} q3 -2 6 0 M${x + 2} ${y - 4.5} q3 -2 6 0`} fill="none" strokeWidth={0.9} />
      <circle cx={x - 5} cy={y - 2} r={1.1} fill={INK} stroke="none" />
      <circle cx={x + 5} cy={y - 2} r={1.1} fill={INK} stroke="none" />
      <path d={`M${x} ${y - 2} l-1.5 5 h3`} fill="none" strokeWidth={0.8} />
      <path d={`M${x - 4.5} ${y + 6.5} q4.5 3 9 0`} fill="none" strokeWidth={0.9} />
    </g>
  )
}

/** Sol naciente con luna creciente, como el adorno inferior de la plantilla. */
export function RisingSun({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={INK} strokeLinecap="round">
      {Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI + (i * Math.PI) / 12
        const r2 = i % 2 ? 22 : 30
        return <line key={i} x1={x + Math.cos(a) * 16} y1={y + Math.sin(a) * 16} x2={x + Math.cos(a) * r2} y2={y + Math.sin(a) * r2} strokeWidth={0.9} />
      })}
      <circle cx={x} cy={y} r={13} fill={PAPER} strokeWidth={1.4} />
      <Crescent x={x - 1} y={y} r={8} />
      <Sparkle x={x + 3} y={y} r={7} />
    </g>
  )
}

/** Marco ondulado (cartela) alrededor de la carta: dos lóbulos por lado y pico en el centro. */
export function ScallopFrame({ x, y, w, h, pad = 14, bulge = 7 }: { x: number; y: number; w: number; h: number; pad?: number; bulge?: number }) {
  const x0 = x - pad, y0 = y - pad, x1 = x + w + pad, y1 = y + h + pad
  const side = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
    const mx = (ax + bx) / 2, my = (ay + by) / 2
    const q1x = ax + (bx - ax) / 4 + nx * bulge, q1y = ay + (by - ay) / 4 + ny * bulge
    const q2x = ax + (3 * (bx - ax)) / 4 + nx * bulge, q2y = ay + (3 * (by - ay)) / 4 + ny * bulge
    return `Q${q1x} ${q1y} ${mx + nx * 2} ${my + ny * 2} Q${q2x} ${q2y} ${bx} ${by}`
  }
  const d = [
    `M${x0} ${y0}`,
    side(x0, y0, x1, y0, 0, -1),
    side(x1, y0, x1, y1, 1, 0),
    side(x1, y1, x0, y1, 0, 1),
    side(x0, y1, x0, y0, -1, 0),
    'Z',
  ].join(' ')
  return (
    <g fill="none" stroke={INK}>
      <path d={d} strokeWidth={1.3} />
      <rect x={x - 5} y={y - 5} width={w + 10} height={h + 10} strokeWidth={0.7} />
    </g>
  )
}

/** Línea con punta de flecha, como los renglones de Fecha / Hora / Lugar. */
export function FieldLine({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g stroke={INK}>
      <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={0.8} />
      <path d={`M${x2 - 5} ${y - 2.6} L${x2 + 1} ${y} L${x2 - 5} ${y + 2.6}`} fill={INK} strokeWidth={0.5} />
    </g>
  )
}
