import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSettings } from '../settings'
import type { Entry, Place } from '../types'
import { DEFAULT_EMOTIONS, g, signLabel } from '../lib/astro'
import { ChipSet, EMPTY_PERSONAL, MoodPicker } from './JournalForm'

/** Registro del día en pocos segundos: la carta del momento se calcula sola al guardar. */
export default function QuickLog({ place, onSaved }: { place: Place | null; onSaved?: (e: Entry) => void }) {
  const { settings } = useSettings()
  const [mood, setMood] = useState(0)
  const [emotions, setEmotions] = useState<string[]>([])
  const [text, setText] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<Entry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const allEmotions = [...DEFAULT_EMOTIONS, ...(settings?.custom_emotions ?? []).filter((e) => !DEFAULT_EMOTIONS.includes(e))]

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const e = await api.quickEntry({ ...EMPTY_PERSONAL, mood, emotions, what_happened: text, tags }, place)
      setSaved(e)
      onSaved?.(e)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (saved) {
    const z = saved.astro_config.zodiac
    const s = saved.summary[z]
    return (
      <div className="card p-5">
        <h2 className="text-2xl text-navy">Registro guardado ✓</h2>
        <p className="mt-1">
          {saved.local_datetime.slice(11, 16)} · {saved.location_name}. En ese momento: <span className="glyph text-gold">{g('☉')}</span> Sol en{' '}
          {signLabel(s.sun, z, false)}, <span className="glyph text-gold">{g('☽')}</span> Luna en {signLabel(s.moon, z, false)} ({saved.moon_phase.toLowerCase()}).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/registro/${saved.id}`} className="btn btn-ghost">Añadir más detalle</Link>
          <button className="btn btn-ghost" onClick={() => { setSaved(null); setMood(0); setEmotions([]); setText(''); setTags([]) }}>Otro registro</button>
          <Link to="/patrones" className="btn btn-ghost">Ver mis patrones</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="text-3xl text-navy">¿Cómo estás hoy?</h2>
        <p className="text-sm text-ink-soft">Registra el momento en unos segundos; la carta del cielo de ahora se guarda automáticamente con tu entrada.</p>
      </div>
      <MoodPicker value={mood} onChange={setMood} />
      <div>
        <div className="label mb-1">¿Qué sientes? (puedes elegir varias)</div>
        <ChipSet options={allEmotions} value={emotions} onChange={setEmotions} />
      </div>
      <label className="block"><span className="label">¿Qué pasó hoy?</span>
        <textarea className="input min-h-20" value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="Una o dos frases bastan: lo que hiciste, lo que salió bien o mal…" />
      </label>
      <div>
        <div className="label mb-1">¿De qué área de tu vida?</div>
        <ChipSet options={settings?.custom_tags ?? []} value={tags} onChange={(v) => setTags(v.map((t) => t.toLowerCase()))} allowNew placeholder="Otra…" />
      </div>
      {error && <p className="text-mood-1">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-gold" disabled={busy || !mood || !place} onClick={save}>{busy ? 'Guardando…' : 'Guardar registro'}</button>
        {!mood && <span className="text-sm text-ink-soft">Elige primero cómo te sientes.</span>}
        {mood > 0 && !place && <span className="text-sm text-ink-soft">Falta la ubicación (arriba).</span>}
        <Link to="/nueva" className="ml-auto text-sm text-navy underline decoration-gold-soft underline-offset-4">Registro detallado u otra fecha →</Link>
      </div>
    </div>
  )
}
