import { NavLink, Route, Routes } from 'react-router-dom'
import { useSettings } from './settings'
import Home from './pages/Home'
import NewEntry from './pages/NewEntry'
import MyChart from './pages/MyChart'
import EntryPage from './pages/EntryPage'
import CalendarPage from './pages/CalendarPage'
import PatternsHub from './pages/PatternsHub'
import Planets from './pages/Planets'
import SettingsPage from './pages/SettingsPage'

const NAV = [
  ['/', 'Inicio'],
  ['/nueva', 'Nueva entrada'],
  ['/carta', 'Mi carta'],
  ['/calendario', 'Calendario'],
  ['/patrones', 'Mis patrones'],
  ['/astros', 'Astros'],
  ['/configuracion', 'Configuración'],
] as const

export default function App() {
  const { settings, error } = useSettings()
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2">
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
              <circle cx="16" cy="16" r="13" fill="none" stroke="#d8c38f" strokeWidth="1.2" />
              <circle cx="16" cy="16" r="5.5" fill="none" stroke="#d8c38f" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="1.5" fill="#d8c38f" />
              <path d="M22 6.5a7 7 0 1 0 3.5 8.5 5.5 5.5 0 1 1-3.5-8.5z" fill="#d8c38f" opacity=".5" />
            </svg>
            <span className="font-display text-2xl tracking-wide">AstroBitácora</span>
          </NavLink>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}
                       className={({ isActive }) => `rounded px-2.5 py-1 text-[0.98rem] ${isActive ? 'bg-paper/12 text-gold-soft' : 'text-paper/85 hover:text-paper'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <p className="card mb-4 p-3 text-mood-1">
            No se pudo abrir el almacenamiento del navegador: {error}. Si usas una ventana privada, prueba en una ventana normal.
          </p>
        )}
        {settings ? (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/nueva" element={<NewEntry />} />
            <Route path="/carta" element={<MyChart />} />
            <Route path="/registro/:id" element={<EntryPage />} />
            <Route path="/calendario" element={<CalendarPage />} />
            <Route path="/patrones" element={<PatternsHub />} />
            <Route path="/astros" element={<Planets />} />
            <Route path="/configuracion" element={<SettingsPage />} />
          </Routes>
        ) : !error && <p className="text-ink-soft">Cargando…</p>}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-sm text-ink-soft">
        <div className="ornament mb-1">✦ ☉ ✦ ☽ ✦</div>
        Posiciones calculadas con Swiss Ephemeris. La interpretación astrológica es una capa simbólica, no una explicación causal.
        Tus registros se guardan solo en este dispositivo; haz copias de seguridad desde Configuración.
      </footer>
    </div>
  )
}
