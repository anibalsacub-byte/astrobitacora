import type { Body } from '../../types'
import { g, shortDeg } from '../../lib/astro'
import { GLYPH, INK, OVERLAY, RETRO, SERIF } from './common'

export interface Mark {
  body: Body
  /** true si pertenece a las posiciones superpuestas («ahora»). */
  over: boolean
}

/** Astros de un signo: primero los de la carta calculada y después los superpuestos. */
export function marksIn(signIdx: number, bodies: Body[], overlay: Body[] = []): Mark[] {
  return [
    ...bodies.filter((b) => b.sign_index === signIdx).map((body) => ({ body, over: false })),
    ...overlay.filter((b) => b.sign_index === signIdx).map((body) => ({ body, over: true })),
  ]
}

/** Símbolo y grado de un astro dentro de una casilla. Con `dense` se reduce para que quepan más. */
export function BodyMark({ mark, x, y, dense }: { mark: Mark; x: number; y: number; dense?: boolean }) {
  const { body: b, over } = mark
  const retro = b.retrograde && !b.is_node
  const color = over ? OVERLAY : retro ? RETRO : INK
  return (
    <text x={x} y={y + 4.5} textAnchor="middle" fontSize={dense ? 10.5 : 12.5} fill={color} fontWeight={over ? 600 : undefined}>
      <tspan fontFamily={GLYPH}>{g(b.symbol)}</tspan>
      <tspan fontFamily={SERIF} fontSize={dense ? 9.5 : 11.5}>{shortDeg(b)}{retro ? '℞' : ''}</tspan>
      <title>{`${over ? 'Ahora: ' : ''}${b.name} ${b.dms}${retro ? ' (retrógrado aparente)' : ''}`}</title>
    </text>
  )
}
