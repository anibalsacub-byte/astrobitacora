import { forwardRef } from 'react'
import type { Chart, ChartResult, ChartStyle } from '../../types'
import { SIGN_BY_KEY, fmtDate, g, visibleBodies } from '../../lib/astro'
import NorthIndianChart from './NorthIndianChart'
import SouthIndianChart from './SouthIndianChart'
import WheelChart from './WheelChart'
import { BODY, GLYPH, GOLD, INK, PAPER, SERIF, SOFT } from './common'
import { Crescent, FieldLine, RisingSun, ScallopFrame, Sparkle, StarMedallion, Starburst, SunFace } from './Ornaments'

const W = 600, H = 950
const TOP = 52, BOTTOM = 905, LEFT = 44, RIGHT = W - 44

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/** Signo y grado de un punto ('asc', 'moon' o 'sun') en una carta. */
function point(chart: Chart, key: 'asc' | 'moon' | 'sun') {
  const p = key === 'asc' ? chart.angles.asc : chart.bodies.find((b) => b.key === key)!
  const s = SIGN_BY_KEY[p.sign]
  const name = chart.meta.zodiac === 'sidereal' ? `${s.rashi} (${s.name})` : s.name
  return { glyph: g(s.symbol), text: `${name} ${Math.floor(p.degree_in_sign)}°${String(Math.floor((p.degree_in_sign % 1) * 60)).padStart(2, '0')}′` }
}

/** Borde de la plantilla: líneas, estrellas en las esquinas, lunas y medallones en los costados. */
function Border() {
  const sideSegs = (x: number, flip: boolean) => (
    <g>
      <line x1={x} y1={TOP + 18} x2={x} y2={230} stroke={INK} strokeWidth={0.8} />
      <line x1={x} y1={240} x2={x} y2={300} stroke={INK} strokeWidth={0.8} strokeDasharray="1 3" />
      <Sparkle x={x} y={318} r={7} />
      <Crescent x={x} y={360} r={9} flip={flip} />
      <line x1={x} y1={378} x2={x} y2={410} stroke={INK} strokeWidth={0.8} strokeDasharray="1 3" />
      <StarMedallion x={x} y={432} />
      <line x1={x} y1={455} x2={x} y2={520} stroke={INK} strokeWidth={0.8} strokeDasharray="1 3" />
      <circle cx={x} cy={530} r={2.2} fill={INK} />
      <path d={`M${x} ${545} l3 4 l-3 4 l-3 -4z`} fill="none" stroke={INK} strokeWidth={0.8} />
      <line x1={x} y1={560} x2={x} y2={640} stroke={INK} strokeWidth={0.8} strokeDasharray="1 3" />
      <line x1={x} y1={650} x2={x} y2={BOTTOM - 18} stroke={INK} strokeWidth={0.8} />
    </g>
  )
  return (
    <g>
      {/* superior: línea interrumpida por el sol con lunas a los lados */}
      <line x1={LEFT + 16} y1={TOP} x2={226} y2={TOP} stroke={INK} strokeWidth={0.8} />
      <line x1={374} y1={TOP} x2={RIGHT - 16} y2={TOP} stroke={INK} strokeWidth={0.8} />
      <Sparkle x={150} y={TOP} r={5} /><Sparkle x={450} y={TOP} r={5} />
      <circle cx={222} cy={TOP} r={2} fill={INK} /><circle cx={378} cy={TOP} r={2} fill={INK} />
      <Crescent x={240} y={TOP} r={8} flip /><Crescent x={360} y={TOP} r={8} />
      <SunFace x={W / 2} y={TOP + 8} />
      {/* inferior */}
      <line x1={LEFT + 16} y1={BOTTOM} x2={260} y2={BOTTOM} stroke={INK} strokeWidth={0.8} />
      <line x1={LEFT + 16} y1={BOTTOM + 5} x2={200} y2={BOTTOM + 5} stroke={INK} strokeWidth={0.5} />
      <line x1={340} y1={BOTTOM} x2={RIGHT - 16} y2={BOTTOM} stroke={INK} strokeWidth={0.8} />
      <line x1={400} y1={BOTTOM + 5} x2={RIGHT - 16} y2={BOTTOM + 5} stroke={INK} strokeWidth={0.5} />
      <circle cx={232} cy={BOTTOM} r={3.2} fill={INK} /><circle cx={368} cy={BOTTOM} r={3.2} fill={INK} />
      <Sparkle x={250} y={BOTTOM} r={5} /><Sparkle x={350} y={BOTTOM} r={5} />
      <Sparkle x={160} y={BOTTOM} r={4} /><Sparkle x={440} y={BOTTOM} r={4} />
      <RisingSun x={W / 2} y={BOTTOM} />
      {sideSegs(LEFT, false)}
      {sideSegs(RIGHT, true)}
      <Starburst x={LEFT} y={TOP} /><Starburst x={RIGHT} y={TOP} />
      <Starburst x={LEFT} y={BOTTOM} /><Starburst x={RIGHT} y={BOTTOM} />
    </g>
  )
}

/**
 * Ficha de carta según la plantilla de referencia: Fecha / Hora / Lugar, carta central dentro de un
 * marco ondulado y Lagna / Chandralagna / Suryalagna. Los tres últimos muestran «tropical / sideral»
 * cuando se dispone de ambas cartas.
 */
const ChartSheet = forwardRef<SVGSVGElement, { result: ChartResult; style: ChartStyle; showNodes: boolean; title?: string }>(
  function ChartSheet({ result, style, showNodes, title }, ref) {
    const { chart, time, alt_chart } = result
    const sid = chart.meta.zodiac === 'sidereal'
    const trop = sid ? alt_chart : chart
    const side = sid ? chart : alt_chart
    const bodies = visibleBodies(chart, showNodes)

    const fields: [string, string][] = [
      ['Fecha', fmtDate(time.local)],
      ['Hora', `${time.local.slice(11, 16)}  (UTC${time.utc_offset}${time.tz_abbrev && !/^[+-]/.test(time.tz_abbrev) ? ` · ${time.tz_abbrev}` : ''})`],
      ['Lugar', trunc(result.location_name || `${chart.meta.latitude.toFixed(4)}, ${chart.meta.longitude.toFixed(4)}`, 48)],
    ]
    const bottom = (['asc', 'moon', 'sun'] as const).map((k, i) => ({
      label: ['Lagna/Ascendente', 'Chandralagna/Signo Lunar', 'Suryalagna/Signo Solar'][i],
      values: [trop && point(trop, k), side && point(side, k)].filter(Boolean) as { glyph: string; text: string }[],
    }))
    const both = Boolean(trop && side)

    const chartSize = 372
    const cx = (W - chartSize) / 2, cy = 270
    const ChartComp = style === 'south' ? SouthIndianChart : style === 'wheel' ? WheelChart : NorthIndianChart
    const styleName = style === 'south' ? 'estilo del sur de la India' : style === 'wheel' ? 'rueda occidental' : 'estilo del norte de la India'
    const legend = bodies.map((b) => ({ s: b.symbol, n: b.name.replace(' (Rahu)', '').replace(' (Ketu)', '') }))
    const ly = 790

    return (
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img"
           aria-label={`Carta astral ${fields[0][1]}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <rect x={0} y={0} width={W} height={H} fill={PAPER} />
        <Border />

        <text x={W / 2} y={126} textAnchor="middle" fontFamily={SERIF} fontSize={11.5} fill={SOFT} letterSpacing={1.6}>
          {`${(title ?? 'Carta astral').toUpperCase()} · ZODIACO ${sid ? 'SIDERAL' : 'TROPICAL'} · ${styleName.toUpperCase()}`}
        </text>

        {fields.map(([k, v], i) => (
          <g key={k}>
            <text x={86} y={165 + i * 33} fontFamily={SERIF} fontSize={20} fill={INK}>{k}:</text>
            <FieldLine x1={168} x2={520} y={170 + i * 33} />
            <text x={176} y={164 + i * 33} fontFamily={BODY} fontSize={15} fill={INK}>{v}</text>
          </g>
        ))}

        <ScallopFrame x={cx} y={cy} w={chartSize} h={chartSize} />
        <ChartComp chart={chart} bodies={bodies} size={chartSize} x={cx} y={cy} />

        {bottom.map((b, i) => (
          <g key={b.label}>
            <text x={70} y={698 + i * 31} fontFamily={SERIF} fontSize={17} fill={INK}>{b.label}:</text>
            <line x1={262} y1={702 + i * 31} x2={530} y2={702 + i * 31} stroke={INK} strokeWidth={0.7} />
            <text x={266} y={697 + i * 31} fontSize={13.5} fill={INK}>
              {b.values.map((v, j) => (
                <tspan key={j}>
                  {j > 0 && <tspan fontFamily={BODY} fill={SOFT}>{'  /  '}</tspan>}
                  <tspan fontFamily={GLYPH} fill={GOLD}>{v.glyph}</tspan>
                  <tspan fontFamily={BODY} dx={3}>{v.text}</tspan>
                </tspan>
              ))}
            </text>
          </g>
        ))}
        <text x={530} y={775} textAnchor="end" fontFamily={BODY} fontSize={10.5} fontStyle="italic" fill={SOFT}>
          {both ? `tropical  /  sideral (${chart.meta.ayanamsa_name ?? alt_chart?.meta.ayanamsa_name ?? 'Lahiri'})` : sid ? 'zodiaco sideral' : 'zodiaco tropical'}
        </text>

        {legend.map((it, i) => {
          const col = i % 4, row = Math.floor(i / 4)
          return (
            <text key={i} x={92 + col * 112} y={ly + 10 + row * 17} fontSize={11.5} fill={INK}>
              <tspan fontFamily={GLYPH}>{g(it.s)}</tspan>
              <tspan fontFamily={BODY} dx={4}>{it.n}</tspan>
            </text>
          )
        })}
        <text x={W / 2} y={858} textAnchor="middle" fontFamily={BODY} fontSize={9.5} fill={SOFT}>
          {`UTC ${time.utc.replace('T', ' ').replace('Z', '')} · ${chart.meta.engine}${sid ? ` · Ayanamsa ${chart.meta.ayanamsa_value?.toFixed(4)}°` : ''}`}
        </text>
        <text x={W / 2} y={871} textAnchor="middle" fontFamily={BODY} fontSize={9.5} fill={SOFT}>
          {style === 'wheel' ? `Casas: ${chart.meta.house_system_name}` : 'Casas védicas: signo entero desde el Lagna'}{' · ℞ = retrógrado aparente'}
        </text>
      </svg>
    )
  },
)
export default ChartSheet
