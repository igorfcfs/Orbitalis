import { useEffect } from 'react'
import { go, paths, parentPath, useRoute } from './lib/route'
import { Stage } from './scene/Stage'
import { useStore } from './state/store'
import { CrewOverlay, Credits, Dock, Hud, HoverTip, LayersRail, MenuSheet, SystemsRail } from './ui/Hud'
import { Panel } from './ui/Panel'
import { SourcesScreen } from './ui/SourcesScreen'

export default function App() {
  const route = useRoute()
  const suit = useStore((s) => s.suit)
  const xray = useStore((s) => s.xray)
  const setSuit = useStore((s) => s.setSuit)
  const setXray = useStore((s) => s.setXray)

  // O app abre direto em Crew, sem landing page.
  useEffect(() => {
    if (!window.location.hash) go(paths.crew)
  }, [])

  // Na formação da tripulação todos estão vestidos de macacão e sem raio-X
  useEffect(() => {
    if (route.level === 0) {
      setSuit(false)
      setXray(false)
    }
  }, [route.level, setSuit, setXray])

  // Esc sobe um nível
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useStore.getState()
      if (s.menuOpen || s.creditsOpen) return
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
      if (route.level === 0 && !route.page) return
      go(parentPath(route))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route])

  return (
    <>
      <Stage route={route} />
      <div className="ui">
        <Hud />
        {route.level === 0 && !route.page && <CrewOverlay />}
        {route.level === 0 && route.page === 'sources' && <SourcesScreen />}
        {route.level !== 0 && (
          <>
            {/* O índice dos sistemas vem antes do painel: é o que se lê (e o Tab alcança) primeiro */}
            <SystemsRail route={route} />
            <Panel route={route} />
            {!suit && xray && <LayersRail />}
            <Dock route={route} />
          </>
        )}
        <HoverTip route={route} />
      </div>
      <MenuSheet route={route} />
      <Credits />
    </>
  )
}
