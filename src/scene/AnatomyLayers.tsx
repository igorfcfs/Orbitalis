import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { LayerId } from '../state/store'
import type { Status, SystemId } from '../types'
import { LAYERS, SYSTEM_LAYERS, INITIAL_LAYERS } from './anatomy'
import { useAnatomy } from './useAnatomy'

const STATUS_HEX: Record<Status, string> = { nominal: '#3DDC97', watch: '#FFB547', critical: '#FF5D5D' }
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Entry {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  layer: LayerId
  system: SystemId | 'rest'
}

const target = new THREE.Color()
const neutral = new THREE.Color('#6f8fd6')

/**
 * Anatomia interna dentro do personagem. Fica escondida; aparece ao dissolver a região
 * selecionada ou no raio-X, e o sistema selecionado brilha na cor do seu status.
 */
export function AnatomyLayers({
  selected, xray, statuses, bpm, active,
}: { selected: SystemId | null; xray: boolean; statuses: Record<SystemId, Status>; bpm: number; active: boolean }) {
  const want = useMemo(() => {
    const set = new Set<LayerId>(active ? INITIAL_LAYERS : [])
    if (selected) for (const l of SYSTEM_LAYERS[selected]) set.add(l)
    return [...set]
  }, [selected, active])
  const anatomy = useAnatomy(want)
  const entries = useRef<Entry[]>([])
  const fadeIn = useRef(0)
  const layerCount = Object.keys(anatomy.layers).length

  const built = useMemo(() => {
    const out: { key: string; layer: LayerId; system: SystemId | 'rest'; geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; order: number }[] = []
    for (const l of Object.values(anatomy.layers)) {
      const info = LAYERS.find((x) => x.id === l.id)!
      for (const b of l.buckets) {
        const material = new THREE.MeshStandardMaterial({
          color: info.color, roughness: 0.5, metalness: 0.05, transparent: true, emissive: new THREE.Color('#000000'), side: THREE.DoubleSide,
        })
        out.push({ key: `${l.id}:${b.system}`, layer: l.id, system: b.system, geometry: b.geometry, material, order: info.renderOrder })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerCount])

  useEffect(() => () => built.forEach((b) => b.material.dispose()), [built])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const k = 1 - Math.exp(-dt * 6)
    const still = calm()
    const beat = still ? 0 : Math.exp(-(((t * bpm) / 60) % 1) * 9)
    const wantsSel = selected ? SYSTEM_LAYERS[selected] : []
    fadeIn.current += ((selected || xray ? 1 : 0) - fadeIn.current) * k
    for (const e of entries.current) {
      if (!e?.mesh) continue
      const show = fadeIn.current > 0.02 && (xray ? e.layer === 'skeleton' || e.layer === 'organs' || wantsSel.includes(e.layer) : wantsSel.includes(e.layer))
      e.mesh.visible = show
      if (!show) continue
      const m = e.material
      let opacity: number
      let glow = 0
      let hex: string | null = null
      if (e.system === 'rest') {
        opacity = selected ? 0.18 : e.layer === 'skeleton' ? 0.92 : 0.8
      } else {
        const st = statuses[e.system]
        const sel = selected === e.system
        opacity = selected && !sel ? 0.3 : 1
        hex = st === 'nominal' ? null : STATUS_HEX[st]
        glow = sel ? 0.75 : st === 'nominal' ? 0.05 : 0.45
        if (st === 'critical' && !still) glow += Math.sin(t * 4) * 0.12
        if (e.system === 'cardiovascular' && e.layer === 'organs') glow += beat * 0.6
      }
      m.opacity += (opacity * fadeIn.current - m.opacity) * k
      m.depthWrite = m.opacity > 0.9
      if (hex) target.set(hex)
      else target.copy(neutral)
      m.emissive.lerp(target, k)
      m.emissiveIntensity += (glow - m.emissiveIntensity) * k
    }
  })

  return (
    <group>
      {built.map((b, i) => (
        <mesh
          key={b.key}
          geometry={b.geometry}
          material={b.material}
          renderOrder={b.order}
          frustumCulled={false}
          visible={false}
          ref={(m) => {
            if (m) entries.current[i] = { mesh: m, material: b.material, layer: b.layer, system: b.system }
          }}
        />
      ))}
    </group>
  )
}
