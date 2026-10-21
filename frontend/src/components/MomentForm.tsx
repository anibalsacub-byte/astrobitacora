import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { AstroConfig, MomentInput, Place } from '../types'
import { AYANAMSAS, HOUSE_SYSTEMS } from '../lib/astro'
import LocationPicker from './LocationPicker'

/** Fecha-hora actual en la zona horaria indicada, como 'YYYY-MM-DDTHH:MM'. */
export function nowIn(tz: string | null): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

function parseOffset(s: string): number | null {
  const m = s.trim().match(/^([+-−])?(\d{1,2})(?::?(\d{2}))?$/)
  if (!m) return null
  const sign = m[1] === '-' || m[1] === '−' ? -1 : 1
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

const TIMEZONES: string[] = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []

export function ConfigFields({ config, onChange }: { config: AstroConfig; onChange: (c: AstroConfig) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="label">Zodiaco</span>
        <select className="input" value={config.zodiac} onChange={(e) => onChange({ ...config, zodiac: e.target.value as AstroConfig['zodiac'] })}>
          <option value="sidereal">Sideral (védico)</option>
          <option value="tropical">Tropical (occidental)</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Casas</span>
        <select className="input" value={config.house_system} onChange={(e) => onChange({ ...config, house_system: e.target.value as AstroConfig['house_system'] })}>
          {Object.entries(HOUSE_SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Ayanamsa (sideral)</span>
        <select className="input" value={config.ayanamsa} disabled={config.zodiac !== 'sidereal'}
                onChange={(e) => onChange({ ...config, ayanamsa: e.target.value as AstroConfig['ayanamsa'] })}>
          {Object.entries(AYANAMSAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Nodos lunares</span>
        <select className="input" value={config.node_type} onChange={(e) => onChange({ ...config, node_type: e.target.value as AstroConfig['node_type'] })}>
          <option value="true">Nodo verdadero</option>
          <option value="mean">Nodo medio</option>
        </select>
      </label>
    </div>
  )
}

export default function MomentForm({ initial, config, onConfigChange, onSubmit, submitLabel = 'Calcular carta', busy, extra }: {
  initial?: Partial<MomentInput> & { place?: Place | null }
  config: AstroConfig
  onConfigChange: (c: AstroConfig) => void
  onSubmit: (m: MomentInput) => void
  submitLabel?: string
  busy?: boolean
  extra?: ReactNode
}) {
  const [place, setPlace] = useState<Place | null>(
    initial?.place ?? (initial?.latitude !== undefined
      ? { name: initial.location_name ?? '', latitude: initial.latitude, longitude: initial.longitude!, timezone: initial.timezone ?? null }
      : null),
  )
  const start = initial?.local_datetime ?? nowIn(place?.timezone ?? null)
  const [date, setDate] = useState(start.slice(0, 10))
  const [time, setTime] = useState(start.slice(11, 19).length === 8 && !start.endsWith(':00') ? start.slice(11, 19) : start.slice(11, 16))
  const [tz, setTz] = useState<string>(initial?.timezone ?? place?.timezone ?? '')
  const [manualOffset, setManualOffset] = useState(initial?.utc_offset_minutes != null)
  const [offset, setOffset] = useState(initial?.utc_offset_minutes != null
    ? `${initial.utc_offset_minutes < 0 ? '-' : '+'}${String(Math.floor(Math.abs(initial.utc_offset_minutes) / 60)).padStart(2, '0')}:${String(Math.abs(initial.utc_offset_minutes) % 60).padStart(2, '0')}`
    : '+00:00')
  const [fold, setFold] = useState<0 | 1>(initial?.fold ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [showAdv, setShowAdv] = useState(false)
  const tzOptions = useMemo(() => TIMEZONES, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!place) return setError('Elige un lugar (búsqueda, ubicación del dispositivo o coordenadas).')
    if (!date || !time) return setError('Indica fecha y hora.')
    let mins: number | null = null
    if (manualOffset) {
      mins = parseOffset(offset)
      if (mins === null) return setError('Desfase no válido. Usa el formato +02:00 o -05:30.')
    }
    setError(null)
    onSubmit({
      local_datetime: `${date}T${time.length === 5 ? time + ':00' : time}`,
      timezone: manualOffset ? null : tz || place.timezone,
      utc_offset_minutes: mins,
      fold,
      location_name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block"><span className="label">Fecha</span>
          <input type="date" className="input num" value={date} min="0001-01-01" max="2999-12-31" onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="block"><span className="label">Hora local</span>
          <input type="time" step={1} className="input num" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <div className="flex items-end">
          <button type="button" className="btn btn-ghost" onClick={() => { const n = nowIn(tz || place?.timezone || null); setDate(n.slice(0, 10)); setTime(n.slice(11, 16)) }}>
            Ahora
          </button>
        </div>
      </div>

      <div>
        <span className="label">Lugar</span>
        <LocationPicker value={place} onChange={(p) => { setPlace(p); if (p.timezone) setTz(p.timezone) }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Zona horaria (IANA)</span>
          <input className="input" list="tz-list" value={tz} disabled={manualOffset} placeholder="Se detecta a partir de las coordenadas"
                 onChange={(e) => setTz(e.target.value)} />
          <datalist id="tz-list">{tzOptions.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={manualOffset} onChange={(e) => setManualOffset(e.target.checked)} /> Desfase UTC manual
          </label>
          {manualOffset && <input className="input num w-28" value={offset} onChange={(e) => setOffset(e.target.value)} aria-label="Desfase UTC" />}
        </div>
      </div>

      <button type="button" className="text-sm text-navy underline decoration-gold-soft underline-offset-4" onClick={() => setShowAdv(!showAdv)}>
        {showAdv ? '▾' : '▸'} Sistema astrológico y opciones avanzadas
      </button>
      {showAdv && (
        <div className="space-y-3 rounded border border-rule/70 p-3">
          <ConfigFields config={config} onChange={onConfigChange} />
          <label className="block"><span className="label">Si la hora se repite por un cambio de horario</span>
            <select className="input" value={fold} onChange={(e) => setFold(Number(e.target.value) as 0 | 1)}>
              <option value={0}>Primera ocurrencia (antes del cambio)</option>
              <option value={1}>Segunda ocurrencia (después del cambio)</option>
            </select>
          </label>
        </div>
      )}

      {error && <p className="text-mood-1">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-gold" disabled={busy}>{busy ? 'Calculando…' : submitLabel}</button>
        {extra}
      </div>
    </form>
  )
}
