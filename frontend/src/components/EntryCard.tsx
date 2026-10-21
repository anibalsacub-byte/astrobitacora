import { Link } from 'react-router-dom'
import type { EntrySummary } from '../types'
import { MOOD_FACES, MOOD_LABELS, fmtDate, fmtTime, moodColor, signLabel } from '../lib/astro'

export default function EntryCard({ e }: { e: EntrySummary }) {
  const z = e.astro_config.zodiac
  const s = e.summary[z]
  return (
    <Link to={`/registro/${e.id}`} className="card block min-w-0 p-3 transition hover:border-gold">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl"
              style={{ background: `${moodColor(e.personal.mood)}22`, border: `1px solid ${moodColor(e.personal.mood)}` }}
              title={MOOD_LABELS[e.personal.mood - 1]}>
          {MOOD_FACES[e.personal.mood - 1]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-lg text-navy">{fmtDate(e.local_datetime)}</span>
            <span className="num text-ink-soft">{fmtTime(e.local_datetime)}</span>
            {e.is_demo && <span className="badge badge-demo">Demostración</span>}
          </div>
          <p className="truncate">{e.personal.what_happened || e.personal.how_felt || <em className="text-ink-soft">Sin texto</em>}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-soft">
            {e.personal.emotions.length > 0 && <span>{e.personal.emotions.join(', ')}</span>}
            <span>☽ {signLabel(s.moon, z, false)}</span>
            {e.personal.tags.map((t) => <span key={t}>#{t}</span>)}
          </div>
        </div>
      </div>
    </Link>
  )
}
