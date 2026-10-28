import { useEffect } from 'react'
import { go, paths, useRoute } from './lib/route'
import { ATTRIBUTION } from './scene/anatomy'
import { useStore } from './state/store'
import { BodyScreen } from './ui/BodyScreen'
import { CrewScreen } from './ui/CrewScreen'
import { SourcesScreen } from './ui/SourcesScreen'
import { TopBar } from './ui/TopBar'

function Credits() {
  const open = useStore((s) => s.creditsOpen)
  const setCredits = useStore((s) => s.setCredits)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCredits(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setCredits])
  if (!open) return null
  return (
    <div className="modal-back" onClick={() => setCredits(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Credits" onClick={(e) => e.stopPropagation()}>
        <h2>Credits</h2>
        <p className="small">{ATTRIBUTION}</p>
        <p className="small muted">The exported layers are Shandon’s Body Atlas, built from Z-Anatomy, and remain under CC BY-SA 4.0. Orbitalis code is original.</p>
        <p className="small muted">Crew, names and signals are fictional.</p>
        <button type="button" className="btn primary" onClick={() => setCredits(false)}>Close</button>
      </div>
    </div>
  )
}

export default function App() {
  const route = useRoute()

  // O app abre direto em Crew, sem landing page.
  useEffect(() => {
    if (!window.location.hash) go(paths.crew)
  }, [])

  return (
    <>
      <TopBar route={route} />
      {route.level === 0 ? route.page === 'sources' ? <SourcesScreen /> : <CrewScreen /> : <BodyScreen route={route} />}
      <Credits />
    </>
  )
}
