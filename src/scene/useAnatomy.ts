import { useEffect, useRef, useState } from 'react'
import type { LayerId } from '../state/store'
import type { SystemId } from '../types'
import { LAYERS, anchorPositions, loadLayer, normalize, type LoadedLayer, type Normalization } from './anatomy'

export type LayerState = 'idle' | 'loading' | 'ready' | 'error'

export interface AnatomyState {
  layers: Partial<Record<LayerId, LoadedLayer>>
  status: Record<LayerId, LayerState>
  norm: Normalization | null
  anchors: Partial<Record<SystemId, [number, number, number]>>
  /** Pele ou esqueleto falharam: usar o corpo simplificado */
  failed: boolean
}

const idle = (): Record<LayerId, LayerState> =>
  Object.fromEntries(LAYERS.map((l) => [l.id, 'idle'])) as Record<LayerId, LayerState>

/** Carrega as camadas pedidas (uma vez cada) e normaliza o corpo quando pele e esqueleto chegam. */
export function useAnatomy(wanted: LayerId[]): AnatomyState {
  const [layers, setLayers] = useState<AnatomyState['layers']>({})
  const [status, setStatus] = useState(idle)
  const started = useRef(new Set<LayerId>())
  const [norm, setNorm] = useState<Normalization | null>(null)

  useEffect(() => {
    for (const id of wanted) {
      if (started.current.has(id)) continue
      started.current.add(id)
      setStatus((s) => ({ ...s, [id]: 'loading' }))
      const t0 = performance.now()
      loadLayer(id)
        .then((layer) => {
          setLayers((l) => ({ ...l, [id]: layer }))
          setStatus((s) => ({ ...s, [id]: 'ready' }))
          const sys = Object.entries(layer.matched).map(([k, n]) => `${k}:${n}`).join(' ')
          console.info(`[anatomy] ${id}: ${Math.round(layer.triangles / 1000)}k triangles in ${Math.round(performance.now() - t0)} ms · nodes by system → ${sys}`)
        })
        .catch((e) => {
          console.warn(`[anatomy] ${id} failed`, e)
          started.current.delete(id)
          setStatus((s) => ({ ...s, [id]: 'error' }))
        })
    }
  }, [wanted])

  const skin = layers.skin
  const skeleton = layers.skeleton
  useEffect(() => {
    if (norm || !skin || !(skeleton || status.skeleton === 'error')) return
    const n = normalize(skin, skeleton)
    console.info(
      `[anatomy] normalized: source height ${n.height.toFixed(3)} → 1.800, scale ${n.scale.toFixed(3)}, rotation Y ${((n.rotationY * 180) / Math.PI).toFixed(0)}°, feet at y=0, facing +z`,
    )
    setNorm(n)
  }, [skin, skeleton, status.skeleton, norm])

  const anchors = norm ? anchorPositions(Object.values(layers), norm) : {}
  return { layers, status, norm, anchors, failed: status.skin === 'error' || status.skeleton === 'error' }
}
