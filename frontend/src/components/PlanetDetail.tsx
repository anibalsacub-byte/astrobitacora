import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import type { Body, ChartResult, PlanetInfo } from '../types'
import { g, signLabel } from '../lib/astro'
import Modal from './Modal'

let cache: Promise<{ source: string; planets: PlanetInfo[]; nodes_note: string }> | null = null
export const loadPlanetInfo = () => (cache ??= api.planets())

export default function PlanetDetail({ body, result, onClose }: { body: Body; result: ChartResult; onClose: () => void }) {
  const [info, setInfo] = useState<{ source: string; planets: PlanetInfo[]; nodes_note: string } | null>(null)
  useEffect(() => { loadPlanetInfo().then(setInfo).catch(() => {}) }, [])
  const p = info?.planets.find((x) => x.key === body.key)
  const z = result.chart.meta.zodiac
  const row = (k: string, v: ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-rule/50 py-1"><span className="text-ink-soft">{k}</span><span className="num text-right">{v}</span></div>
  )
  return (
    <Modal title={`${g(body.symbol)} ${body.name}`} onClose={onClose}>
      <section className="mb-4">
        <div className="mb-1 flex items-center gap-2"><span className="badge badge-astro">Astronomía</span><span className="label">Posición geocéntrica aparente</span></div>
        {row('Longitud eclíptica', `${body.longitude.toFixed(4)}°`)}
        {row('Latitud eclíptica', `${body.latitude.toFixed(4)}°`)}
        {!body.is_node && row('Distancia', body.key === 'moon' ? `${Math.round(body.distance_au * 149597870.7).toLocaleString('es')} km` : `${body.distance_au.toFixed(4)} UA`)}
        {row('Velocidad en longitud', `${body.speed.toFixed(4)} °/día`)}
        {row('Movimiento aparente', body.is_node ? (body.retrograde ? 'Retrógrado (lo habitual en los nodos)' : 'Directo') : body.retrograde ? '℞ Retrógrado aparente' : 'Directo')}
        {row('Calculado para', `${result.time.local.replace('T', ' ')} (UTC${result.time.utc_offset})`)}
      </section>
      <section className="mb-4">
        <div className="mb-1 flex items-center gap-2"><span className="badge badge-astrol">Astrología</span><span className="label">Convenciones de la carta</span></div>
        {row(`Signo (${z === 'sidereal' ? 'sideral' : 'tropical'})`, signLabel(body.sign, z))}
        {row('Grado dentro del signo', body.dms)}
        {row(`Casa (${result.chart.meta.house_system_name})`, body.house)}
        {row('Casa por signo entero', body.whole_sign_house)}
      </section>
      {p && (
        <section>
          <div className="mb-1 flex items-center gap-2"><span className="badge badge-astro">Datos físicos</span><span className="label">{p.kind}</span></div>
          {row('Traslación', p.orbit)}
          {row('Rotación', p.rotation)}
          <p className="mt-2">{p.description}</p>
          {p.physical_retrograde && (
            <p className="mt-2 text-sm text-ink-soft">
              La rotación retrógrada de {p.name} es física (gira sobre su eje en sentido contrario a su órbita). No tiene relación con el
              «retrógrado aparente» de la carta, que es un efecto de perspectiva visto desde la Tierra.
            </p>
          )}
          <p className="mt-2 text-xs text-ink-soft">Fuente: {info?.source}</p>
        </section>
      )}
      {body.is_node && info && <p className="text-sm">{info.nodes_note}</p>}
    </Modal>
  )
}
