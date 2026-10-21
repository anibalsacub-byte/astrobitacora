import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import ChartView from '../components/ChartView'
import ComparePanel from '../components/ComparePanel'
import JournalForm from '../components/JournalForm'
import Modal from '../components/Modal'
import MomentForm from '../components/MomentForm'
import { useSettings } from '../settings'
import type { AstroConfig, ChartResult, Comparison, Entry, MomentInput, Revision, Zodiac } from '../types'
import { MOOD_FACES, MOOD_LABELS, fmtDate, fmtTime, moodColor } from '../lib/astro'

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null
  return <div><div className="label">{label}</div><div className="whitespace-pre-wrap">{children}</div></div>
}

export default function EntryPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { settings } = useSettings()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [zodiac, setZodiac] = useState<Zodiac>('sidereal')
  const [editing, setEditing] = useState(false)
  const [recalc, setRecalc] = useState(false)
  const [recalcCfg, setRecalcCfg] = useState<AstroConfig | null>(null)
  const [reason, setReason] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [cmp, setCmp] = useState<{ now: ChartResult; comparison: Comparison } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const e = await api.entry(Number(id))
    setEntry(e)
    setZodiac(e.astro_config.zodiac)
    setRecalcCfg(e.astro_config)
    setRevisions(await api.revisions(e.id))
  }, [id])
  useEffect(() => { load().catch((e) => setError(e.message)) }, [load])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  if (error && !entry) return <p className="text-mood-1">{error}</p>
  if (!entry) return <p className="text-ink-soft">Cargando…</p>

  const p = entry.personal
  const result: ChartResult = {
    time: entry.time_info, location_name: entry.location_name, chart: entry.astro_snapshot[zodiac],
    alt_chart: entry.astro_snapshot[zodiac === 'sidereal' ? 'tropical' : 'sidereal'],
  }
  const initialMoment: Partial<MomentInput> = {
    local_datetime: entry.local_datetime,
    timezone: entry.timezone === 'Desfase manual' ? null : entry.timezone,
    utc_offset_minutes: entry.timezone === 'Desfase manual'
      ? (entry.utc_offset.startsWith('-') ? -1 : 1) * (Number(entry.utc_offset.slice(1, 3)) * 60 + Number(entry.utc_offset.slice(4, 6)))
      : null,
    fold: (entry.time_info.fold ?? 0) as 0 | 1,
    location_name: entry.location_name, latitude: entry.latitude, longitude: entry.longitude,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/calendario" className="text-sm text-navy underline decoration-gold-soft underline-offset-4">← Calendario</Link>
          <h1 className="text-4xl text-navy">{fmtDate(entry.local_datetime)} · <span className="num">{fmtTime(entry.local_datetime)}</span></h1>
          <p className="text-ink-soft">{entry.location_name} · {entry.timezone} (UTC{entry.utc_offset})
            {entry.is_demo && <span className="badge badge-demo ml-2">Registro de demostración</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy} onClick={() => run(async () => {
            const r = await api.entryCompareNow(entry.id, zodiac, settings?.default_location ?? null)
            setCmp(r)
          })}>Comparar con ahora</button>
          <button className="btn btn-ghost" onClick={() => setRecalc(true)}>Corregir fecha, hora o lugar</button>
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Eliminar</button>
        </div>
      </div>
      {error && <p className="text-mood-1">{error}</p>}

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl text-navy">Registro personal</h2>
          {!editing && <button className="btn btn-ghost" onClick={() => setEditing(true)}>Editar</button>}
        </div>
        {editing ? (
          <JournalForm initial={p} submitLabel="Guardar cambios" busy={busy} onCancel={() => setEditing(false)}
                       onSubmit={(np) => run(async () => { setEntry(await api.updatePersonal(entry.id, np)); setEditing(false) })} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full text-3xl"
                    style={{ background: `${moodColor(p.mood)}22`, border: `1px solid ${moodColor(p.mood)}` }}>{MOOD_FACES[p.mood - 1]}</span>
              <div>
                <div className="font-display text-2xl" style={{ color: moodColor(p.mood) }}>{MOOD_LABELS[p.mood - 1]}</div>
                {p.intensity != null && <div className="text-ink-soft">Intensidad {p.intensity}/10</div>}
              </div>
            </div>
            <Field label="Emociones">{p.emotions.join(', ')}</Field>
            <Field label="¿Qué pasó?">{p.what_happened}</Field>
            <Field label="¿Cómo me sentí?">{p.how_felt}</Field>
            <Field label={`Algo especial${p.special_valence ? ` (${p.special_valence})` : ''}`}>{p.special}</Field>
            <Field label="Etiquetas">{p.tags.map((t) => `#${t}`).join('  ')}</Field>
            <Field label="Datos opcionales">
              {[p.sleep_hours != null && `Sueño: ${p.sleep_hours} h`, p.energy != null && `Energía: ${p.energy}/10`, p.stress != null && `Estrés: ${p.stress}/10`].filter(Boolean).join(' · ')}
            </Field>
            <Field label="Observaciones">{p.notes}</Field>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-3 text-2xl text-navy">Carta guardada</h2>
          {(['sidereal', 'tropical'] as const).map((z) => (
            <button key={z} className="chip" aria-pressed={zodiac === z} onClick={() => { setZodiac(z); setCmp(null) }}>
              {z === 'sidereal' ? 'Sideral' : 'Tropical'}{entry.astro_config.zodiac === z ? ' (usado al guardar)' : ''}
            </button>
          ))}
        </div>
        <p className="mb-3 text-sm text-ink-soft">
          Guardada el {entry.created_at.slice(0, 10)} con {entry.astro_snapshot[zodiac].meta.engine}. Estos datos no cambian aunque cambies tu configuración.
          {entry.revision_count > 0 && ` Recalculada ${entry.revision_count} vez/veces (ver historial abajo).`}
        </p>
        <ChartView result={result} />
      </section>

      {cmp && <ComparePanel now={cmp.now} comparison={cmp.comparison} thenLabel="esta entrada" />}

      {revisions.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-xl text-navy">Historial de recálculos</h2>
          <ul className="space-y-2 text-sm">
            {revisions.map((r) => (
              <li key={r.id}>
                <b>{r.changed_at.replace('T', ' ').replace('Z', ' UTC')}</b>{r.reason && ` — ${r.reason}`}
                <ul className="ml-4 list-disc text-ink-soft">
                  {Object.entries(r.changes).map(([k, v]) => (
                    <li key={k}>{k}: {JSON.stringify(v.antes)} → {JSON.stringify(v.después)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recalc && recalcCfg && (
        <Modal title="Corregir momento o lugar" onClose={() => setRecalc(false)} wide>
          <p className="mb-3 text-sm">
            Se recalcularán las posiciones astronómicas con los nuevos datos. Las posiciones anteriores se conservarán en el historial de la entrada.
            Tu registro personal no se modifica.
          </p>
          <label className="mb-3 block"><span className="label">Motivo de la corrección</span>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="p. ej. hora mal anotada" />
          </label>
          <MomentForm initial={initialMoment} config={recalcCfg} onConfigChange={setRecalcCfg} submitLabel="Recalcular y guardar" busy={busy}
                      onSubmit={(m) => run(async () => {
                        await api.recalculate(entry.id, m, recalcCfg, reason)
                        setRecalc(false)
                        setReason('')
                        setCmp(null)
                        await load()
                      })} />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Eliminar entrada" onClose={() => setConfirmDelete(false)}>
          <p className="mb-4">Esta entrada y su historial se borrarán <b>definitivamente</b> de la base de datos local. No se puede deshacer.</p>
          <div className="flex gap-2">
            <button className="btn btn-danger" disabled={busy} onClick={() => run(async () => { await api.deleteEntry(entry.id); nav('/calendario') })}>
              Eliminar definitivamente
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
