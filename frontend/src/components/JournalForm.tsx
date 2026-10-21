import { useState, type FormEvent } from 'react'
import type { Personal } from '../types'
import { DEFAULT_EMOTIONS, MOOD_COLORS, MOOD_FACES, MOOD_LABELS } from '../lib/astro'
import { useSettings } from '../settings'

export const EMPTY_PERSONAL: Personal = {
  mood: 3, emotions: [], intensity: null, what_happened: '', how_felt: '', special: '', special_valence: '',
  tags: [], sleep_hours: null, energy: null, stress: null, notes: '',
}

export function MoodPicker({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Estado de ánimo">
      {MOOD_FACES.map((f, i) => {
        const v = i + 1
        const on = value === v
        return (
          <button key={v} type="button" role="radio" aria-checked={on} aria-label={MOOD_LABELS[i]} onClick={() => onChange(v)}
                  className="flex w-20 flex-col items-center rounded-md border px-2 py-2 transition"
                  style={{ borderColor: on ? MOOD_COLORS[i] : 'var(--color-rule)', background: on ? `${MOOD_COLORS[i]}1f` : '#fffdf8' }}>
            <span className="text-3xl" aria-hidden>{f}</span>
            <span className="text-sm" style={{ color: on ? MOOD_COLORS[i] : undefined }}>{MOOD_LABELS[i]}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ChipSet({ options, value, onChange, allowNew, placeholder }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; allowNew?: boolean; placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const all = [...options, ...value.filter((v) => !options.includes(v))]
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  const add = () => {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {all.map((o) => <button key={o} type="button" className="chip" aria-pressed={value.includes(o)} onClick={() => toggle(o)}>{o}</button>)}
      {allowNew && (
        <input className="input w-40 py-0.5" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }} onBlur={add} />
      )}
    </div>
  )
}

function Scale({ label, value, onChange, min = 1, max = 10 }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        {value != null && <button type="button" className="text-xs text-ink-soft underline" onClick={() => onChange(null)}>quitar</button>}
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
          <button key={n} type="button" className="chip num w-9 justify-center px-0" aria-pressed={value === n} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
    </div>
  )
}

export default function JournalForm({ initial, onSubmit, submitLabel = 'Guardar entrada', busy, onCancel }: {
  initial?: Personal; onSubmit: (p: Personal) => void; submitLabel?: string; busy?: boolean; onCancel?: () => void
}) {
  const { settings } = useSettings()
  const [p, setP] = useState<Personal>(initial ?? EMPTY_PERSONAL)
  const [more, setMore] = useState(Boolean(initial && (initial.sleep_hours != null || initial.energy != null || initial.stress != null || initial.notes)))
  const set = <K extends keyof Personal>(k: K, v: Personal[K]) => setP((x) => ({ ...x, [k]: v }))
  const emotions = [...DEFAULT_EMOTIONS, ...(settings?.custom_emotions ?? []).filter((e) => !DEFAULT_EMOTIONS.includes(e))]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(p)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <div className="label mb-1">¿Cómo estuvo tu ánimo?</div>
        <MoodPicker value={p.mood} onChange={(m) => set('mood', m)} />
      </div>
      <div>
        <div className="label mb-1">Emociones (puedes elegir varias)</div>
        <ChipSet options={emotions} value={p.emotions} onChange={(v) => set('emotions', v)} allowNew placeholder="Otra emoción…" />
      </div>
      <Scale label="Intensidad emocional (1–10)" value={p.intensity} onChange={(v) => set('intensity', v)} />
      <label className="block"><span className="label">¿Qué pasó hoy?</span>
        <textarea className="input min-h-24" value={p.what_happened} onChange={(e) => set('what_happened', e.target.value)} />
      </label>
      <label className="block"><span className="label">¿Cómo me sentí?</span>
        <textarea className="input min-h-24" value={p.how_felt} onChange={(e) => set('how_felt', e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="block"><span className="label">¿Hubo algo especial? (opcional)</span>
          <textarea className="input min-h-16" value={p.special} onChange={(e) => set('special', e.target.value)} />
        </label>
        <label className="block"><span className="label">Ese acontecimiento fue…</span>
          <select className="input" value={p.special_valence} onChange={(e) => set('special_valence', e.target.value as Personal['special_valence'])}>
            <option value="">Sin marcar</option>
            <option value="positivo">Positivo</option>
            <option value="negativo">Negativo</option>
            <option value="mixto">Mixto</option>
          </select>
        </label>
      </div>
      <div>
        <div className="label mb-1">Etiquetas</div>
        <ChipSet options={settings?.custom_tags ?? []} value={p.tags} onChange={(v) => set('tags', v.map((t) => t.toLowerCase()))} allowNew placeholder="Nueva etiqueta…" />
      </div>

      <button type="button" className="text-sm text-navy underline decoration-gold-soft underline-offset-4" onClick={() => setMore(!more)}>
        {more ? '▾' : '▸'} Datos opcionales (sueño, energía, estrés, observaciones)
      </button>
      {more && (
        <div className="space-y-3 rounded border border-rule/70 p-3">
          <label className="block w-40"><span className="label">Horas de sueño</span>
            <input type="number" min={0} max={24} step={0.5} className="input num" value={p.sleep_hours ?? ''}
                   onChange={(e) => set('sleep_hours', e.target.value === '' ? null : Number(e.target.value))} />
          </label>
          <Scale label="Nivel de energía" value={p.energy} onChange={(v) => set('energy', v)} />
          <Scale label="Nivel de estrés" value={p.stress} onChange={(v) => set('stress', v)} />
          <label className="block"><span className="label">Observaciones</span>
            <textarea className="input min-h-16" value={p.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn btn-gold" disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  )
}
