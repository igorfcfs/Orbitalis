import { Component, useEffect, useState, type ReactNode } from 'react'
import type { Route } from '../lib/route'
import { useStore } from '../state/store'
import { Stage } from './Stage'
import { webglAvailable } from './webgl'

/**
 * Isola a cena 3D (RF-20). Sem WebGL, com erro na cena ou com o contexto perdido, o app segue sem o 3D:
 * a lista de sistemas, o painel, o menu e a tripulação (em lista) continuam completos, com um aviso discreto.
 */
export class SceneBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.failed ? <SceneNote /> : this.props.children
  }
}

export function SceneNote() {
  return (
    <div className="stage3d">
      <p className="scene-note" role="status">3D view unavailable on this device. All data and actions still work from the lists and panels.</p>
    </div>
  )
}

export function SafeStage({ route }: { route: Route }) {
  const failed = useStore((s) => s.sceneFailed)
  const setFailed = useStore((s) => s.setSceneFailed)
  const [ok] = useState(() => webglAvailable())
  useEffect(() => {
    if (!ok) setFailed(true)
  }, [ok, setFailed])
  useEffect(() => {
    // O evento não sobe pela árvore: a captura na janela pega o de qualquer canvas
    const lost = () => setFailed(true)
    window.addEventListener('webglcontextlost', lost, true)
    return () => window.removeEventListener('webglcontextlost', lost, true)
  }, [setFailed])
  if (!ok || failed) return <SceneNote />
  return (
    <SceneBoundary onFail={() => setFailed(true)}>
      <Stage route={route} />
    </SceneBoundary>
  )
}
