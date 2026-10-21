import { useEffect, useState } from 'react'
import { api, downloadText, stamp } from '../api'
import LocationPicker from '../components/LocationPicker'
import { ConfigFields } from '../components/MomentForm'
import Modal from '../components/Modal'
import { useSettings } from '../settings'
import type { Settings } from '../types'

/** Dirección pública del código fuente (obligatoria por la AGPL al ofrecer la app en la web). */
const SOURCE_URL: string = import.meta.env.VITE_SOURCE_URL ?? ''

export default function SettingsPage() {
  const { settings, save } = useSettings()
  const [s, setS] = useState<Settings>(settings!)
  const [msg, setMsg] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [wipe, setWipe] = useState(false)
  const [wipeText, setWipeText] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [lastBackup, setLastBackup] = useState<string | undefined>()
  useEffect(() => { api.lastBackup().then(setLastBackup).catch(() => {}) }, [])

  const persist = async (next: Settings) => {
    setS(next)
    await save(next)
    setMsg('Configuración guardada.')
    setTimeout(() => setMsg(null), 2500)
  }

  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      const r = await api.importBackup(data, importMode)
      setMsg(`Restauradas ${r.imported} entradas (${importMode === 'replace' ? 'reemplazando' : 'añadiendo a'} las existentes).`)
    } catch (e) {
      setMsg(`No se pudo restaurar: ${(e as Error).message}`)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-4xl text-navy">Configuración</h1>
      {msg && <p className="card px-4 py-2 text-navy">{msg}</p>}

      <section className="card space-y-3 p-5">
        <h2 className="text-2xl text-navy">Sistema astrológico predeterminado</h2>
        <ConfigFields config={s.config} onChange={(c) => persist({ ...s, config: c })} />
        <p className="text-sm text-ink-soft">
          Tropical: el zodiaco se mide desde el equinoccio de marzo (0° Aries = punto vernal). Sideral: se mide respecto a las estrellas fijas;
          la diferencia es el <i>ayanamsa</i> (≈ 24,2° en 2026 con Lahiri), que crece unos 50″ por año por la precesión. Cambiar esta opción no altera
          las entradas guardadas: cada una conserva ambas versiones.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Estilo de carta</span>
            <select className="input" value={s.chart_style} onChange={(e) => persist({ ...s, chart_style: e.target.value as Settings['chart_style'] })}>
              <option value="south">Sur de la India (cuadrícula de la plantilla)</option>
              <option value="north">Norte de la India (rombos)</option>
              <option value="wheel">Rueda occidental</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" checked={s.show_nodes} onChange={(e) => persist({ ...s, show_nodes: e.target.checked })} /> Mostrar nodos lunares (Rahu / Ketu)
          </label>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-2xl text-navy">Ubicación predeterminada</h2>
        <p className="text-sm text-ink-soft">Se usa en «Posiciones de ahora» y como lugar inicial de las nuevas entradas. Su zona horaria se detecta a partir de las coordenadas.</p>
        <LocationPicker value={s.default_location} onChange={(p) => persist({ ...s, default_location: p })} />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-2xl text-navy">Etiquetas sugeridas</h2>
        <div className="flex flex-wrap gap-1.5">
          {s.custom_tags.map((t) => (
            <button key={t} className="chip" onClick={() => persist({ ...s, custom_tags: s.custom_tags.filter((x) => x !== t) })} title="Quitar">#{t} ✕</button>
          ))}
          <input className="input w-44 py-0.5" value={tagDraft} placeholder="Nueva etiqueta…" onChange={(e) => setTagDraft(e.target.value)}
                 onKeyDown={(e) => {
                   const t = tagDraft.trim().toLowerCase()
                   if (e.key === 'Enter' && t && !s.custom_tags.includes(t)) { persist({ ...s, custom_tags: [...s.custom_tags, t] }); setTagDraft('') }
                 }} />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-2xl text-navy">Privacidad, exportación y copias de seguridad</h2>
        <ul className="list-disc space-y-1 pl-5 text-[0.97rem]">
          <li>Tus registros se guardan <b>solo en este navegador y en este dispositivo</b>. No hay servidor ni cuenta: nadie más puede leerlos.</li>
          <li>Los cálculos astronómicos se hacen en tu dispositivo con Swiss Ephemeris; funcionan sin conexión.</li>
          <li>La búsqueda de ciudades envía únicamente el texto buscado a OpenStreetMap Nominatim. Puedes desactivarla e introducir coordenadas a mano.</li>
          <li>
            <b>Haz copias de seguridad.</b> Si borras los datos del navegador, cambias de dispositivo o desinstalas la app, los registros se pierden.
            La copia JSON te permite restaurarlos aquí o en otro dispositivo.
            {lastBackup ? ` Última copia: ${lastBackup.slice(0, 10)}.` : ' Aún no has hecho ninguna copia.'}
          </li>
        </ul>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.online_geocoding} onChange={(e) => persist({ ...s, online_geocoding: e.target.checked })} /> Permitir geocodificación en línea
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={async () => {
            downloadText(await api.exportJson(), `astrobitacora-${stamp()}.json`, 'application/json')
            setLastBackup(await api.lastBackup())
          }}>Copia de seguridad (JSON)</button>
          <button className="btn" onClick={async () => downloadText(await api.exportCsv(), `astrobitacora-${stamp()}.csv`, 'text/csv;charset=utf-8')}>
            Exportar a hoja de cálculo (CSV)
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Restaurar copia JSON</span>
          <select className="input w-auto" value={importMode} onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}>
            <option value="merge">Añadir a los registros actuales</option>
            <option value="replace">Reemplazar todos los registros</option>
          </select>
          <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
        <button className="btn btn-danger" onClick={() => setWipe(true)}>Eliminar todos los registros…</button>
      </section>

      <section className="card space-y-2 p-5 text-[0.97rem]">
        <h2 className="text-2xl text-navy">Licencias</h2>
        <p>AstroBitácora es software libre bajo licencia <b>AGPL-3.0</b>: puedes usarlo, estudiarlo, modificarlo y redistribuirlo, y su código
          fuente está disponible públicamente{SOURCE_URL ? <> en <a className="underline" href={SOURCE_URL} target="_blank" rel="noreferrer">{SOURCE_URL}</a></> : ''}.</p>
        <p><b>Swiss Ephemeris</b> © Astrodienst AG, compilado a WebAssembly (<code>@swisseph/browser</code>), con licencia AGPL-3.0.</p>
        <p><b>@photostructure/tz-lookup</b> (CC0), <b>idb</b> (ISC), <b>React</b>, <b>Recharts</b>, <b>jsPDF</b>, <b>Workbox</b> (MIT).
          Tipografías Cormorant Garamond y EB Garamond (SIL OFL). Datos de lugares © colaboradores de OpenStreetMap (ODbL).</p>
      </section>

      {wipe && (
        <Modal title="Eliminar todos los registros" onClose={() => setWipe(false)}>
          <p className="mb-2">Se borrarán definitivamente todas las entradas y su historial. Te recomiendo exportar una copia antes.</p>
          <p className="mb-2">Escribe <b>BORRAR TODO</b> para confirmar:</p>
          <input className="input mb-3" value={wipeText} onChange={(e) => setWipeText(e.target.value)} />
          <button className="btn btn-danger" disabled={wipeText !== 'BORRAR TODO'}
                  onClick={async () => { const r = await api.deleteAll(); setWipe(false); setWipeText(''); setMsg(`Eliminadas ${r.deleted} entradas.`) }}>
            Eliminar definitivamente
          </button>
        </Modal>
      )}
    </div>
  )
}
