import { useSearchParams } from 'react-router-dom'
import Explore from './Explore'
import Patterns from './Patterns'
import Week from './Week'

const TABS = [
  { key: 'experiencia', label: 'Explorar una experiencia', hint: '¿Dónde estaban mis astros cuando me sentí así?' },
  { key: 'semana', label: 'Mi semana / un periodo', hint: 'Lo que registré y el cielo de esos días' },
  { key: 'estadisticas', label: 'Estadísticas generales', hint: 'Evolución, emociones y comparaciones' },
] as const

export default function PatternsHub() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('vista') ?? 'experiencia'
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl text-navy">Mis patrones</h1>
        <p className="text-ink-soft">Parte de tus registros diarios y mira qué posiciones del cielo los acompañaban.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} title={t.hint}
                  className={`rounded-md border px-4 py-2 text-left transition ${tab === t.key ? 'border-navy bg-navy text-paper' : 'border-rule bg-paper hover:border-gold'}`}
                  onClick={() => setParams({ vista: t.key })}>
            <div className="font-medium">{t.label}</div>
            <div className={`text-xs ${tab === t.key ? 'text-paper/75' : 'text-ink-soft'}`}>{t.hint}</div>
          </button>
        ))}
      </div>
      {tab === 'experiencia' && <Explore />}
      {tab === 'semana' && <Week />}
      {tab === 'estadisticas' && <Patterns />}
    </div>
  )
}
