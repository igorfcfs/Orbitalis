import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { LayerId } from '../state/store'
import type { Status, SystemId } from '../types'
import { INITIAL_LAYERS, LAYERS, SYSTEM_LAYERS, WARM_LAYERS } from './anatomy'
import { useAnatomy } from './useAnatomy'

const STATUS_HEX: Record<Status, string> = { nominal: '#3DDC97', watch: '#FFB547', critical: '#FF5D5D' }
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Entry {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  layer: LayerId
  system: SystemId | 'rest'
}

/**
 * Aparência de cada sistema no raio-X: opacidade sozinho e com outros por baixo (`stacked`), brilho próprio,
 * quanto da luz da sala ele recebe (`lit`) e brilho de borda. Os músculos, por fora, ficam bem visíveis e
 * deixam o esqueleto e os órgãos aparecerem através deles.
 */
const STYLE: Partial<Record<LayerId, { opacity: number; stacked: number; glow: number; lit: number; rim: number; thin?: boolean }>> = {
  muscles: { opacity: 0.94, stacked: 0.68, glow: 0.2, lit: 0.55, rim: 0.9 },
  skeleton: { opacity: 0.95, stacked: 0.95, glow: 0.55, lit: 0.16, rim: 0.45 },
  organs: { opacity: 0.88, stacked: 0.78, glow: 0.5, lit: 0.16, rim: 0.7 },
  vessels: { opacity: 0.96, stacked: 0.96, glow: 1.15, lit: 0.1, rim: 0.3, thin: true },
  nerves: { opacity: 0.96, stacked: 0.96, glow: 1.25, lit: 0.1, rim: 0.3, thin: true },
}

const tint = new THREE.Color()
const rimTint = new THREE.Color()

/**
 * Anatomia interna dentro do personagem. Fica escondida; aparece ao dissolver a região selecionada
 * ou no raio-X, com um tom por sistema. O sistema com status fora do normal brilha na cor do status,
 * e passar o cursor num sistema do painel de camadas o destaca e esmaece os outros.
 */
export function AnatomyLayers({
  selected, layers, hoverLayer, statuses, bpm, active,
}: { selected: SystemId | null; layers: LayerId[]; hoverLayer: LayerId | null; statuses: Record<SystemId, Status>; bpm: number; active: boolean }) {
  // Os sistemas que faltam carregam um a um, em segundo plano, para o raio-X não esperar
  const [warm, setWarm] = useState<LayerId[]>([])
  useEffect(() => {
    if (!active) return
    const timers = WARM_LAYERS.map(({ id, after }) => setTimeout(() => setWarm((w) => (w.includes(id) ? w : [...w, id])), after))
    return () => timers.forEach(clearTimeout)
  }, [active])

  const want = useMemo(() => {
    const set = new Set<LayerId>(active ? INITIAL_LAYERS : [])
    for (const l of warm) set.add(l)
    for (const l of layers) set.add(l)
    if (selected && selected !== 'neuro_ocular') for (const l of SYSTEM_LAYERS[selected]) set.add(l)
    return [...set]
  }, [selected, active, layers, warm])
  const anatomy = useAnatomy(want)
  const entries = useRef<Entry[]>([])
  const fadeIn = useRef(0)
  const layerCount = Object.keys(anatomy.layers).length

  const built = useMemo(() => {
    const out: { key: string; layer: LayerId; system: SystemId | 'rest'; geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; order: number }[] = []
    for (const l of Object.values(anatomy.layers)) {
      const info = LAYERS.find((x) => x.id === l.id)!
      const style = STYLE[l.id]!
      for (const b of l.buckets) {
        const hue = new THREE.Color(info.color)
        const material = new THREE.MeshStandardMaterial({
          // Quase só luz própria (menos nos músculos, que precisam de volume): o tom de cada sistema não se perde na luz da sala
          color: hue.clone().multiplyScalar(style.lit), roughness: l.id === 'muscles' ? 0.42 : 0.6, metalness: 0, transparent: true,
          emissive: hue.clone(), emissiveIntensity: style.glow, side: style.thin ? THREE.DoubleSide : THREE.FrontSide,
        })
        // Brilho de borda (Fresnel): dá forma às camadas translúcidas sem tampar o que está dentro
        const rim = { value: style.rim }
        const rimCol = { value: hue.clone() }
        material.userData.rim = rim
        material.userData.rimCol = rimCol
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uRim = rim
          shader.uniforms.uRimCol = rimCol
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uRim; uniform vec3 uRimCol;')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
              float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.0);
              totalEmissiveRadiance += uRimCol * rimF * uRim;`)
        }
        material.customProgramCacheKey = () => 'anatomy-rim'
        out.push({ key: `${l.id}:${b.system}`, layer: l.id, system: b.system, geometry: b.geometry, material, order: info.renderOrder })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerCount])

  useEffect(() => () => built.forEach((b) => b.material.dispose()), [built])

  const hues = useMemo(() => Object.fromEntries(LAYERS.map((l) => [l.id, new THREE.Color(l.color)])) as Record<LayerId, THREE.Color>, [])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const k = 1 - Math.exp(-dt * 6)
    const still = calm()
    const beat = still ? 0 : Math.exp(-(((t * bpm) / 60) % 1) * 9)
    // Os olhos não se dissolvem ao abrir a região: as camadas ficariam atrás da pele e só apareceriam por frestas e narinas
    const wantsSel = selected && selected !== 'neuro_ocular' ? SYSTEM_LAYERS[selected] : []
    fadeIn.current += ((selected && selected !== 'neuro_ocular' || layers.length ? 1 : 0) - fadeIn.current) * k
    const visible = new Set<LayerId>([...layers, ...wantsSel])
    const stacked = visible.size > 1
    for (const e of entries.current) {
      if (!e?.mesh) continue
      const show = fadeIn.current > 0.02 && visible.has(e.layer)
      e.mesh.visible = show
      if (!show) continue
      const style = STYLE[e.layer]!
      const m = e.material
      let opacity = style.opacity
      let glow = style.glow
      let rim = style.rim
      if (stacked) opacity = style.stacked
      // O tom do sistema fica sempre visível. O status aparece no contorno (e no corpo todo, se o sistema estiver aberto).
      tint.copy(hues[e.layer])
      rimTint.copy(hues[e.layer])
      if (e.system !== 'rest') {
        const st = statuses[e.system]
        const sel = selected === e.system
        if (selected && !sel) opacity *= 0.3
        if (st !== 'nominal') {
          rimTint.set(STATUS_HEX[st])
          rim = rim * 1.7 + 0.3
          glow += 0.1
          if (sel) {
            tint.set(STATUS_HEX[st])
            glow += 0.7
          }
          if (st === 'critical' && !still) rim += Math.sin(t * 4) * 0.25
        } else if (sel) glow += 0.4
        if (e.system === 'cardiovascular' && e.layer === 'organs') glow += beat * 0.6
      } else if (selected) {
        opacity *= 0.25
      }
      // Cursor num sistema do painel: ele aparece inteiro e os outros esmaecem
      if (hoverLayer) {
        if (e.layer === hoverLayer) {
          opacity = Math.max(opacity, 0.85)
          glow *= 1.5
          rim *= 1.4
        } else {
          opacity *= 0.25
          glow *= 0.4
        }
      }
      m.opacity += (opacity * fadeIn.current - m.opacity) * k
      m.depthWrite = m.opacity > 0.9
      m.emissive.lerp(tint, k)
      m.emissiveIntensity += (glow - m.emissiveIntensity) * k
      const rimU = m.userData.rim as { value: number }
      rimU.value += (rim - rimU.value) * k
      ;(m.userData.rimCol as { value: THREE.Color }).value.lerp(rimTint, k)
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
