import { useRef, useState } from 'react'
import type { Body, ChartResult, ChartStyle } from '../types'
import { useSettings } from '../settings'
import { exportPdf, exportPng, exportSvg } from '../lib/exportChart'
import { g, signLabel, systemLabel } from '../lib/astro'
import ChartSheet from './charts/ChartSheet'
import Modal from './Modal'
import PlanetDetail from './PlanetDetail'
import PositionsTable from './PositionsTable'

const STYLES: { key: ChartStyle; label: string }[] = [
  { key: 'south', label: 'Sur (plantilla)' },
  { key: 'north', label: 'Norte (rombos)' },
  { key: 'wheel', label: 'Rueda occidental' },
]

export function Warnings({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul className="rounded border border-gold-soft bg-[#f7efd9] px-4 py-2 text-sm text-ink-soft">
      {items.map((w, i) => <li key={i}>⚠︎ {w}</li>)}
    </ul>
  )
}

export default function ChartView({ result, title, compact }: { result: ChartResult; title?: string; compact?: boolean }) {
  const { settings } = useSettings()
  const [style, setStyle] = useState<ChartStyle>(settings?.chart_style ?? 'south')
  const [zoom, setZoom] = useState(false)
  const [scale, setScale] = useState(1.4)
  const [detail, setDetail] = useState<Body | null>(null)
  const [busy, setBusy] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<SVGSVGElement>(null)
  const showNodes = settings?.show_nodes ?? true
  const fname = `carta-${result.time.local.slice(0, 16).replace(':', '')}`

  const doExport = async (kind: 'png' | 'pdf' | 'svg') => {
    const svg = svgRef.current ?? zoomRef.current
    if (!svg) return
    setBusy(true)
    try {
      if (kind === 'png') await exportPng(svg, fname)
      else if (kind === 'pdf') await exportPdf(svg, fname)
      else exportSvg(svg, fname)
    } finally {
      setBusy(false)
    }
  }

  const { chart } = result
  const moon = chart.bodies.find((b) => b.key === 'moon')!
  const sun = chart.bodies.find((b) => b.key === 'sun')!

  return (
    <div className={compact ? '' : 'grid gap-6 lg:grid-cols-[minmax(0,560px)_1fr]'}>
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {STYLES.map((s) => (
            <button key={s.key} className="chip" aria-pressed={style === s.key} onClick={() => setStyle(s.key)}>{s.label}</button>
          ))}
        </div>
        <div className="card overflow-hidden">
          <button className="block w-full cursor-zoom-in" onClick={() => setZoom(true)} title="Ampliar carta">
            <ChartSheet ref={svgRef} result={result} style={style} showNodes={showNodes} title={title} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => setZoom(true)}>⤢ Ampliar</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => doExport('png')}>Exportar PNG</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => doExport('pdf')}>Exportar PDF</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => doExport('svg')}>SVG</button>
        </div>
      </div>

      {!compact && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="label mb-1">Sistema</div>
            <div className="font-display text-xl text-navy">{systemLabel(chart)}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div><div className="label">{chart.meta.zodiac === 'sidereal' ? 'Lagna' : 'Ascendente'}</div><div>{signLabel(chart.angles.asc.sign, chart.meta.zodiac)}</div></div>
              <div><div className="label">{chart.meta.zodiac === 'sidereal' ? 'Chandra Rashi' : 'Signo lunar'}</div><div>{signLabel(moon.sign, chart.meta.zodiac)}</div></div>
              <div><div className="label">{chart.meta.zodiac === 'sidereal' ? 'Surya Rashi' : 'Signo solar'}</div><div>{signLabel(sun.sign, chart.meta.zodiac)}</div></div>
            </div>
            <div className="mt-3 text-sm text-ink-soft">
              <span className="badge badge-astro mr-2">Astronomía</span>
              Fase lunar: {chart.moon_phase.name} · iluminación {(chart.moon_phase.illumination * 100).toFixed(0)} % · elongación {chart.moon_phase.elongation.toFixed(1)}°
            </div>
          </div>
          <Warnings items={[...result.time.warnings, ...chart.meta.warnings]} />
          <div className="card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-xl text-navy">Posiciones</h3>
              <span className="text-xs text-ink-soft">Pulsa un astro para ver su ficha</span>
            </div>
            <PositionsTable result={result} showNodes={showNodes} onSelect={setDetail} />
          </div>
        </div>
      )}

      {zoom && (
        <Modal title="Carta ampliada" onClose={() => setZoom(false)} wide>
          <div className="mb-2 flex items-center gap-3">
            <span className="label">Zoom</span>
            <input type="range" min={1} max={3} step={0.1} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
            <span className="num text-sm">{Math.round(scale * 100)} %</span>
          </div>
          <div className="max-h-[78vh] overflow-auto rounded border border-rule">
            <div style={{ width: `${scale * 600}px`, maxWidth: 'none' }}>
              <ChartSheet ref={zoomRef} result={result} style={style} showNodes={showNodes} title={title} />
            </div>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Leyenda: {chart.bodies.filter((b) => showNodes || !b.is_node).map((b) => `${g(b.symbol)} ${b.name}`).join(' · ')}
          </p>
        </Modal>
      )}
      {detail && <PlanetDetail body={detail} result={result} onClose={() => setDetail(null)} />}
    </div>
  )
}
