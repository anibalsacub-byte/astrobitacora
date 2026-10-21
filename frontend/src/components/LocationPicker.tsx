import { useState } from 'react'
import { api } from '../api'
import type { Place } from '../types'

export function useGeolocation() {
  const [busy, setBusy] = useState(false)
  const locate = () =>
    new Promise<Place>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Este navegador no permite obtener la ubicación.'))
      setBusy(true)
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            resolve(await api.geoReverse(Number(pos.coords.latitude.toFixed(5)), Number(pos.coords.longitude.toFixed(5))))
          } catch (e) {
            reject(e)
          } finally {
            setBusy(false)
          }
        },
        (err) => {
          setBusy(false)
          reject(new Error(err.code === 1
            ? 'El navegador no permitió acceder a tu ubicación. Busca tu ciudad o escribe las coordenadas; también puedes activar el permiso de ubicación para este sitio en tu navegador.'
            : 'No se pudo obtener la ubicación del dispositivo. Busca tu ciudad o escribe las coordenadas.'))
        },
        { timeout: 15000 },
      )
    })
  return { locate, busy }
}

export default function LocationPicker({ value, onChange }: { value: Place | null; onChange: (p: Place) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [lat, setLat] = useState(value ? String(value.latitude) : '')
  const [lon, setLon] = useState(value ? String(value.longitude) : '')
  const [name, setName] = useState(value?.name ?? '')
  const { locate, busy } = useGeolocation()

  const sync = (p: Place) => {
    setLat(String(p.latitude))
    setLon(String(p.longitude))
    setName(p.name)
    onChange(p)
  }

  const search = async () => {
    if (q.trim().length < 2) return
    setSearching(true)
    setError(null)
    try {
      setResults(await api.geoSearch(q.trim()))
    } catch (e) {
      setError((e as Error).message)
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  const applyManual = async () => {
    const la = Number(lat.replace(',', '.')), lo = Number(lon.replace(',', '.'))
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
      setError('Latitud entre −90 y 90, longitud entre −180 y 180 (este positivo).')
      return
    }
    setError(null)
    const { timezone } = await api.timezoneAt(la, lo)
    onChange({ name: name || `${la.toFixed(4)}, ${lo.toFixed(4)}`, latitude: la, longitude: lo, timezone })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="input" placeholder="Ciudad y país, p. ej. «Sevilla, España»" value={q}
               onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())} />
        <button type="button" className="btn btn-ghost shrink-0" onClick={search} disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button>
        <button type="button" className="btn btn-ghost shrink-0" disabled={busy} title="Usar la ubicación del dispositivo"
                onClick={() => locate().then(sync).catch((e) => setError(e.message))}>{busy ? '…' : '⌖'}</button>
      </div>
      {results && (
        <ul className="card max-h-56 overflow-y-auto">
          {results.length === 0 && <li className="px-3 py-2 text-ink-soft">Sin resultados.</li>}
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" className="w-full px-3 py-1.5 text-left hover:bg-gold-soft/20"
                      onClick={() => { sync(r); setResults(null) }}>
                {r.name}
                <span className="num ml-2 text-xs text-ink-soft">{r.latitude.toFixed(3)}, {r.longitude.toFixed(3)} · {r.timezone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
        <input className="input col-span-3 sm:col-span-1" placeholder="Nombre del lugar" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input num" placeholder="Latitud" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitud" />
        <input className="input num" placeholder="Longitud" value={lon} onChange={(e) => setLon(e.target.value)} aria-label="Longitud" />
        <button type="button" className="btn btn-ghost" onClick={applyManual}>Usar</button>
      </div>
      <p className="text-xs text-ink-soft">
        Grados decimales; norte y este positivos. La búsqueda envía solo el texto del lugar a OpenStreetMap (Nominatim); tu diario nunca sale de este equipo.
      </p>
      {value && (
        <p className="text-sm">
          <span className="label mr-2">Seleccionado</span>{value.name}
          <span className="num ml-2 text-ink-soft">({value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}{value.timezone ? ` · ${value.timezone}` : ''})</span>
        </p>
      )}
      {error && <p className="text-sm text-mood-1">{error}</p>}
    </div>
  )
}
