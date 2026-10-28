import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

const N = 460
const BOX = { x: [-4.5, 4.5], y: [-0.6, 4.4], z: [-4.5, 3.5] }
const DIR = new THREE.Vector3(-0.55, -0.22, 0.5).normalize()

/**
 * Partículas de radiação cruzando a cena. Fora do casco (traje) passam livres;
 * num evento solar enchem o céu. Dentro do habitat em condições normais não aparecem.
 */
export function RadiationParticles({ intensity, hot, active }: { intensity: number; hot: boolean; active: boolean }) {
  const ref = useRef<THREE.LineSegments>(null)
  const data = useMemo(() => {
    const pos = new Float32Array(N * 3)
    const speed = new Float32Array(N)
    const r = (a: number, b: number) => a + Math.random() * (b - a)
    for (let i = 0; i < N; i++) {
      pos[3 * i] = r(BOX.x[0], BOX.x[1])
      pos[3 * i + 1] = r(BOX.y[0], BOX.y[1])
      pos[3 * i + 2] = r(BOX.z[0], BOX.z[1])
      speed[i] = r(2.4, 6.5)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3))
    return { pos, speed, geo }
  }, [])
  const head = useMemo(() => new THREE.Color('#9fe0ff'), [])
  const hotHead = useMemo(() => new THREE.Color('#ff8a7a'), [])

  useFrame((_, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const on = active && intensity > 0.01
    mesh.visible = on
    if (!on) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const P = data.geo.getAttribute('position') as THREE.BufferAttribute
    const C = data.geo.getAttribute('color') as THREE.BufferAttribute
    const col = hot ? hotHead : head
    for (let i = 0; i < N; i++) {
      if (!still) {
        data.pos[3 * i] += DIR.x * data.speed[i] * dt
        data.pos[3 * i + 1] += DIR.y * data.speed[i] * dt
        data.pos[3 * i + 2] += DIR.z * data.speed[i] * dt
      }
      if (data.pos[3 * i] < BOX.x[0] || data.pos[3 * i + 1] < BOX.y[0] || data.pos[3 * i + 2] > BOX.z[1]) {
        data.pos[3 * i] = BOX.x[1] - Math.random() * 3
        data.pos[3 * i + 1] = BOX.y[0] + Math.random() * (BOX.y[1] - BOX.y[0]) + 1.2
        data.pos[3 * i + 2] = BOX.z[0] + Math.random() * 3
      }
      const tail = 0.18 + data.speed[i] * 0.06
      P.setXYZ(2 * i, data.pos[3 * i], data.pos[3 * i + 1], data.pos[3 * i + 2])
      P.setXYZ(2 * i + 1, data.pos[3 * i] - DIR.x * tail, data.pos[3 * i + 1] - DIR.y * tail, data.pos[3 * i + 2] - DIR.z * tail)
      C.setXYZ(2 * i, col.r, col.g, col.b)
      C.setXYZ(2 * i + 1, 0, 0, 0)
    }
    P.needsUpdate = true
    C.needsUpdate = true
    data.geo.setDrawRange(0, Math.floor(N * Math.min(1, intensity)) * 2)
  })

  return (
    <lineSegments ref={ref} geometry={data.geo} frustumCulled={false} visible={false}>
      <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} opacity={0.9} />
    </lineSegments>
  )
}
