import { useEffect, useRef, useState } from 'react'
import type { LayerId } from '../state/store'
import { LAYERS, loadLayer, type LoadedLayer } from './anatomy'

export type LayerState = 'idle' | 'loading' | 'ready' | 'error'

export interface AnatomyState {
  layers: Partial<Record<LayerId, LoadedLayer>>
  status: Record<LayerId, LayerState>
}

const idle = (): Record<LayerId, LayerState> =>
  ({ skin: 'idle', ...Object.fromEntries(LAYERS.map((l) => [l.id, 'idle'])) }) as Record<LayerId, LayerState>

/** Carrega as camadas pedidas (uma vez cada). */
export function useAnatomy(wanted: LayerId[]): AnatomyState {
  const [layers, setLayers] = useState<AnatomyState['layers']>({})
  const [status, setStatus] = useState(idle)
  const started = useRef(new Set<LayerId>())

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

  return { layers, status }
}
