import { useRef, useState } from 'react'
import type { Body, ChartResult, ChartStyle } from '../types'
import { useSettings } from '../settings'
import { exportPdf, exportPng, exportSvg } from '../lib/exportChart'
import { fmtDate, g, signLabel, systemLabel } from '../lib/astro'
import ChartSheet from './charts/ChartSheet'
import { OVERLAY } from './charts/common'
import Modal from './Modal'
import PlanetDetail from './PlanetDetail'
import PositionsTable from './PositionsTable'

const STYLES: { key: ChartStyle; label: string }[] = [
  { key: 'south', label: 'Sur (plantilla)' },
  { key: 'north', label: 'Norte (rombos)' },
  { key: 'wheel', label: 'Rueda occidental' },
]

const ZOOMS = [50, 80, 100, 150, 200]

export function Warnings({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul className="rounded border border-gold-soft bg-[#f7efd9] px-4 py-2 text-sm text-ink-soft">
      {items.map((w, i) => <li key={i}>⚠︎ {w}</li>)}
    </ul>
  )
}

export default function ChartView({ result, title, compact, overlay, overlayLabel }: {
  result: ChartResult; title?: string; compact?: boolean
  /** Posiciones que se dibujan sobre la misma carta (Superponer). */
  overlay?: ChartResult | null
  /** Nombre de esas posiciones en la leyenda: «ahora» o «fecha elegida». */
  overlayLabel?: string
}) {
  const { settings } = useSettings()
  const [style, setStyle] = useState<ChartStyle>(settings?.chart_style ?? 'south')
  const [zoom, setZoom] = useState(false)
  const [scale, setScale] = useState(100)
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
    <div className={compact ? '' : 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]'}>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {STYLES.map((s) => (
            <button key={s.key} className="chip" aria-pressed={style === s.key} onClick={() => setStyle(s.key)}>{s.label}</button>
          ))}
        </div>
        <div className="card overflow-hidden">
          <button className="block w-full cursor-zoom-in" onClick={() => { setScale(100); setZoom(true) }} title="Ampliar o reducir la carta">
            <ChartSheet ref={svgRef} result={result} style={style} showNodes={showNodes} title={title} overlay={overlay} overlayLabel={overlayLabel} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => { setScale(100); setZoom(true) }}>⤢ Zoom</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => doExport('png')}>Exportar PNG</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => doExport('pdf')}>Exportar PDF</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => doExport('svg')}>SVG</button>
        </div>
      </div>

      {!compact && (
        <div className="min-w-0 space-y-4">
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
          {overlay && (
            <div className="card p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-xl" style={{ color: OVERLAY }}>{overlayLabel === 'ahora' || !overlayLabel ? 'Posiciones de ahora' : `Posiciones del ${fmtDate(overlay.time.local)}`} (superpuestas)</h3>
                <span className="text-xs text-ink-soft">Pulsa un astro para ver su ficha</span>
              </div>
              <PositionsTable result={overlay} showNodes={showNodes} onSelect={(b) => setDetail(b)} />
            </div>
          )}
        </div>
      )}

      {zoom && (
        <Modal title="Zoom de la carta" onClose={() => setZoom(false)} wide>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {ZOOMS.map((z) => (
              <button key={z} className="chip num" aria-pressed={scale === z} onClick={() => setScale(z)}>{z} %</button>
            ))}
            <input type="range" className="min-w-24 flex-1" min={50} max={300} step={10} value={scale} aria-label="Zoom"
                   onChange={(e) => setScale(Number(e.target.value))} />
            <span className="num w-14 text-right text-sm">{scale} %</span>
          </div>
          <div className="max-h-[78vh] overflow-auto rounded border border-rule">
            {/* 100 % = el ancho disponible en la pantalla */}
            <div className="mx-auto" style={{ width: `${scale}%`, maxWidth: scale > 100 ? 'none' : undefined }}>
              <ChartSheet ref={zoomRef} result={result} style={style} showNodes={showNodes} title={title} overlay={overlay} overlayLabel={overlayLabel} />
            </div>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Leyenda: {chart.bodies.filter((b) => showNodes || !b.is_node).map((b) => `${g(b.symbol)} ${b.name}`).join(' · ')}
          </p>
        </Modal>
      )}
      {detail && (
        <PlanetDetail body={detail} result={overlay?.chart.bodies.includes(detail) ? overlay : result} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
