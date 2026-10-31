import type { Angle, Body } from '../../types'
import { g, shortDeg } from '../../lib/astro'
import { GLYPH, INK, OVERLAY, OVERLAY_ASC, RETRO, SERIF } from './common'

export type Mark =
  | { kind: 'body'; body: Body; /** true si pertenece a las posiciones superpuestas. */ over: boolean }
  | { kind: 'asc'; asc: Angle }

export const markKey = (m: Mark) => (m.kind === 'asc' ? 'asc' : `${m.body.key}-${m.over}`)

/** Lo que cae en un signo: la carta calculada, lo superpuesto y, al final, el ascendente superpuesto. */
export function marksIn(signIdx: number, bodies: Body[], overlay: Body[] = [], overlayAsc?: Angle): Mark[] {
  const marks: Mark[] = [
    ...bodies.filter((b) => b.sign_index === signIdx).map((body): Mark => ({ kind: 'body', body, over: false })),
    ...overlay.filter((b) => b.sign_index === signIdx).map((body): Mark => ({ kind: 'body', body, over: true })),
  ]
  if (overlayAsc?.sign_index === signIdx) marks.push({ kind: 'asc', asc: overlayAsc })
  return marks
}

/** Símbolo y grado dentro de una casilla. Con `dense` se reduce para que quepan más. */
export function BodyMark({ mark, x, y, dense }: { mark: Mark; x: number; y: number; dense?: boolean }) {
  if (mark.kind === 'asc') {
    return (
      <text x={x} y={y + 4.5} textAnchor="middle" fontFamily={SERIF} fontSize={dense ? 9.5 : 11} fontWeight={700} fill={OVERLAY_ASC}>
        ASC {shortDeg(mark.asc)}
        <title>{`Ascendente superpuesto: ${mark.asc.sign_name} ${mark.asc.dms}`}</title>
      </text>
    )
  }
  const { body: b, over } = mark
  const retro = b.retrograde && !b.is_node
  const color = over ? OVERLAY : retro ? RETRO : INK
  return (
    <text x={x} y={y + 4.5} textAnchor="middle" fontSize={dense ? 10.5 : 12.5} fill={color} fontWeight={over ? 600 : undefined}>
      <tspan fontFamily={GLYPH}>{g(b.symbol)}</tspan>
      <tspan fontFamily={SERIF} fontSize={dense ? 9.5 : 11.5}>{shortDeg(b)}{retro ? '℞' : ''}</tspan>
      <title>{`${over ? 'Superpuesto: ' : ''}${b.name} ${b.dms}${retro ? ' (retrógrado aparente)' : ''}`}</title>
    </text>
  )
}
