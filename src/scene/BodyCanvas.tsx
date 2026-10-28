import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SYSTEMS, SYSTEM_IDS } from '../data/systems'
import { STATUS_GLYPH, STATUS_LABEL } from '../lib/model'
import { go, paths } from '../lib/route'
import type { LayerId } from '../state/store'
import type { Status, SystemId } from '../types'
import { LAYERS, type Normalization } from './anatomy'
import type { AnatomyState } from './useAnatomy'

type V3 = [number, number, number]

const STATUS_HEX: Record<Status, string> = { nominal: '#3DDC97', watch: '#FFB547', critical: '#FF5D5D' }
const LIVE_HEX = '#5CC8FF'
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------- Materiais compartilhados ----------

/** Pele: holograma de Fresnel com varredura. Um material para a camada inteira. */
const skinMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uSweep: { value: -1 },
    uAlpha: { value: 1 },
    uBase: { value: new THREE.Color('#34476B') },
    uRim: { value: new THREE.Color('#A9C0EA') },
  },
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV; varying float vY;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = -mv.xyz;
      vY = (modelMatrix * vec4(position, 1.0)).y;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uSweep; uniform float uAlpha; uniform vec3 uBase; uniform vec3 uRim;
    varying vec3 vN; varying vec3 vV; varying float vY;
    void main() {
      float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
      float lines = 0.5 + 0.5 * sin(vY * 160.0);
      float band = smoothstep(0.07, 0.0, abs(vY - uSweep));
      vec3 col = mix(uBase, uRim, f) + band * 0.5;
      float a = (0.07 + f * 0.7 + lines * 0.03 + band * 0.25) * uAlpha;
      gl_FragColor = vec4(col, a);
    }`,
})

/** Aura de radiação: casca de Fresnel na cor LIVE. */
const auraMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uAlpha: { value: 0.2 }, uColor: { value: new THREE.Color(LIVE_HEX) } },
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uAlpha; uniform vec3 uColor;
    varying vec3 vN; varying vec3 vV;
    void main() {
      float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
      gl_FragColor = vec4(uColor, f * uAlpha);
    }`,
})

let glowTexture: THREE.CanvasTexture | null = null
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  glowTexture = new THREE.CanvasTexture(c)
  return glowTexture
}

// ---------- Modelo anatômico (Z-Anatomy) ----------

interface Entry {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial | THREE.ShaderMaterial
  layer: LayerId
  system: SystemId | 'rest'
}

interface ModelProps {
  anatomy: AnatomyState
  norm: Normalization
  visible: Record<LayerId, boolean>
  statuses: Record<SystemId, Status>
  selected: SystemId | null
  bpm: number
}

const target = new THREE.Color()
const neutralGlow = new THREE.Color('#6f8fd6')

function AnatomyModel({ anatomy, norm, visible, statuses, selected, bpm }: ModelProps) {
  const entries = useRef<Entry[]>([])
  const layerCount = Object.keys(anatomy.layers).length

  const built = useMemo(() => {
    const out: { key: string; layer: LayerId; system: SystemId | 'rest'; geometry: THREE.BufferGeometry; material: Entry['material']; order: number }[] = []
    for (const l of Object.values(anatomy.layers)) {
      const info = LAYERS.find((x) => x.id === l.id)!
      for (const b of l.buckets) {
        const material =
          l.id === 'skin'
            ? skinMaterial
            : new THREE.MeshStandardMaterial({
                color: info.color, roughness: 0.55, metalness: 0.05, transparent: true, emissive: new THREE.Color('#000000'), side: THREE.DoubleSide,
              })
        out.push({ key: `${l.id}:${b.system}`, layer: l.id, system: b.system, geometry: b.geometry, material, order: info.renderOrder })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerCount])

  useEffect(
    () => () => {
      for (const b of built) if (b.material !== skinMaterial) (b.material as THREE.Material).dispose()
    },
    [built],
  )

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const k = 1 - Math.exp(-dt * 6)
    const calm = reducedMotion()
    skinMaterial.uniforms.uSweep.value = calm ? -1 : ((t / 5) % 1.6) * 2.1 - 0.15
    skinMaterial.uniforms.uAlpha.value += ((selected ? 0.4 : 1) - skinMaterial.uniforms.uAlpha.value) * k
    const beat = calm ? 0 : Math.exp(-(((t * bpm) / 60) % 1) * 9)

    for (const e of entries.current) {
      if (!e?.mesh) continue
      e.mesh.visible = visible[e.layer]
      if (e.layer === 'skin') continue
      const m = e.material as THREE.MeshStandardMaterial
      let opacity: number
      let glow = 0
      let hex: string | null = null
      if (e.system === 'rest') {
        opacity = selected ? 0.16 : e.layer === 'skeleton' ? 0.9 : 0.75
      } else {
        const st = statuses[e.system]
        const sel = selected === e.system
        opacity = selected && !sel ? 0.3 : 1
        hex = st === 'nominal' ? null : STATUS_HEX[st]
        glow = sel ? 0.7 : st === 'nominal' ? 0.06 : 0.42
        if (st === 'critical' && !calm) glow += Math.sin(t * 4) * 0.12
        if (e.system === 'cardiovascular' && e.layer === 'organs') glow += beat * 0.55
      }
      m.opacity += (opacity - m.opacity) * k
      m.depthWrite = m.opacity > 0.9
      if (hex) target.set(hex)
      else target.copy(neutralGlow)
      m.emissive.lerp(target, k)
      m.emissiveIntensity += (glow - m.emissiveIntensity) * k
    }
  })

  return (
    <group matrixAutoUpdate={false} matrix={norm.matrix}>
      {built.map((b, i) => (
        <mesh
          key={b.key}
          geometry={b.geometry}
          material={b.material}
          renderOrder={b.order}
          frustumCulled={false}
          ref={(m) => {
            if (m) entries.current[i] = { mesh: m, material: b.material, layer: b.layer, system: b.system }
          }}
        />
      ))}
    </group>
  )
}

// ---------- Corpo simplificado por primitivas (reserva se o download falhar) ----------

function Bone({ a, b, r = 0.011 }: { a: V3; b: V3; r?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const A = new THREE.Vector3(...a)
    const B = new THREE.Vector3(...b)
    const d = B.clone().sub(A)
    const len = d.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    return { pos: A.add(B).multiplyScalar(0.5), quat, len }
  }, [a, b])
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 6]} />
      <meshBasicMaterial color="#9FB3D6" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

const LIMBS = [-1, 1].map((s) => ({
  s,
  femur: [[s * 0.09, 0.88, 0], [s * 0.09, 0.5, 0]] as [V3, V3],
  tibia: [[s * 0.09, 0.47, 0], [s * 0.09, 0.08, 0]] as [V3, V3],
  humerus: [[s * 0.21, 1.46, 0], [s * 0.265, 1.19, 0]] as [V3, V3],
  radius: [[s * 0.268, 1.17, 0], [s * 0.305, 0.9, 0]] as [V3, V3],
}))

function ProceduralBody() {
  const torso = useMemo(
    () => [[0.15, 0.86], [0.17, 0.93], [0.15, 1.08], [0.165, 1.24], [0.2, 1.37], [0.195, 1.46], [0.11, 1.53], [0.05, 1.56]].map(([r, y]) => new THREE.Vector2(r, y)),
    [],
  )
  return (
    <group>
      <mesh material={skinMaterial} position={[0, 1.7, 0]} scale={[0.92, 1.12, 1]}>
        <sphereGeometry args={[0.1, 32, 24]} />
      </mesh>
      <mesh material={skinMaterial} scale={[1, 1, 0.62]}>
        <latheGeometry args={[torso, 40]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={skinMaterial} position={[s * 0.255, 1.29, 0]} rotation={[0, 0, s * 0.1]}>
            <capsuleGeometry args={[0.044, 0.22, 6, 16]} />
          </mesh>
          <mesh material={skinMaterial} position={[s * 0.295, 1.04, 0]} rotation={[0, 0, s * 0.06]}>
            <capsuleGeometry args={[0.037, 0.22, 6, 16]} />
          </mesh>
          <mesh material={skinMaterial} position={[s * 0.09, 0.69, 0]}>
            <capsuleGeometry args={[0.076, 0.34, 6, 16]} />
          </mesh>
          <mesh material={skinMaterial} position={[s * 0.09, 0.3, 0]}>
            <capsuleGeometry args={[0.055, 0.36, 6, 16]} />
          </mesh>
        </group>
      ))}
      {LIMBS.map((l) => (
        <group key={l.s}>
          <Bone a={l.femur[0]} b={l.femur[1]} r={0.016} />
          <Bone a={l.tibia[0]} b={l.tibia[1]} r={0.013} />
          <Bone a={l.humerus[0]} b={l.humerus[1]} r={0.013} />
          <Bone a={l.radius[0]} b={l.radius[1]} r={0.01} />
        </group>
      ))}
      <Bone a={[0, 0.93, -0.035]} b={[0, 1.53, -0.05]} r={0.014} />
    </group>
  )
}

// ---------- Aura, brilhos, piso, câmera ----------

function RadiationAura({ status, focused }: { status: Status; focused: boolean }) {
  const dim = useRef(1)
  useFrame(({ clock }, dt) => {
    dim.current += ((focused ? 0.3 : 1) - dim.current) * Math.min(1, dt * 4)
    const base = status === 'nominal' ? 0.16 : status === 'watch' ? 0.3 : 0.5
    const pulse = status === 'critical' && !reducedMotion() ? Math.sin(clock.elapsedTime * 4) * 0.15 : 0
    auraMaterial.uniforms.uAlpha.value = (base + pulse) * dim.current
  })
  return (
    <mesh position={[0, 0.93, 0]} scale={[0.62, 1.1, 0.5]} material={auraMaterial}>
      <sphereGeometry args={[1, 40, 28]} />
    </mesh>
  )
}

function Glow({ position, status }: { position: V3; status: Status }) {
  const ref = useRef<THREE.SpriteMaterial>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const amp = status === 'critical' && !reducedMotion() ? 0.25 : 0
    ref.current.opacity = (status === 'critical' ? 0.6 : 0.4) + Math.sin(clock.elapsedTime * 3) * amp
  })
  return (
    <sprite position={position} scale={[0.3, 0.3, 1]}>
      <spriteMaterial ref={ref} map={getGlowTexture()} color={STATUS_HEX[status]} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
    </sprite>
  )
}

function Floor() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
      {[[0.58, 0.595, 0.55], [0.95, 0.955, 0.22], [1.45, 1.452, 0.12]].map(([a, b, o]) => (
        <mesh key={a}>
          <ringGeometry args={[a, b, 96]} />
          <meshBasicMaterial color="#8C9AB5" transparent opacity={o} depthWrite={false} />
        </mesh>
      ))}
      <mesh>
        <circleGeometry args={[1.1, 64]} />
        <meshBasicMaterial map={getGlowTexture()} color="#5A74A8" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

const tmpTarget = new THREE.Vector3()
const tmpDir = new THREE.Vector3()
const tmpDesired = new THREE.Vector3()

function CameraRig({ target, distance }: { target: V3; distance: number }) {
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null
  const camera = useThree((s) => s.camera)
  const elapsed = useRef(0)
  useEffect(() => {
    elapsed.current = 0
  }, [target, distance])
  useFrame((_, dt) => {
    if (!controls || elapsed.current > 1.8) return
    elapsed.current += dt
    const k = reducedMotion() ? 1 : 1 - Math.exp(-dt * 4)
    controls.target.lerp(tmpTarget.set(...target), k)
    tmpDir.copy(camera.position).sub(controls.target).normalize()
    tmpDesired.copy(controls.target).addScaledVector(tmpDir, distance)
    camera.position.lerp(tmpDesired, k)
    controls.update()
  })
  return null
}

// ---------- Hotspots (DOM, acessíveis por teclado) ----------

function Hotspot({
  astroId, system, status, selected, position, showLabel,
}: { astroId: string; system: SystemId; status: Status; selected: boolean; position: V3; showLabel: boolean }) {
  const def = SYSTEMS[system]
  return (
    <Html position={position} center zIndexRange={[20, 0]}>
      <button
        type="button"
        className={`hotspot s-${status}${selected ? ' selected' : ''}${position[0] < 0 ? ' left' : ''}${showLabel ? ' labeled' : ''}`}
        aria-label={`${def.name} system, ${STATUS_LABEL[status].toLowerCase()}`}
        aria-current={selected || undefined}
        onClick={() => go(paths.system(astroId, system))}
      >
        <span className="hotspot-dot" aria-hidden="true">{STATUS_GLYPH[status]}</span>
        <span className="hotspot-label">{def.name}</span>
      </button>
    </Html>
  )
}

// ---------- Cena ----------

export interface BodyCanvasProps {
  astroId: string
  anatomy: AnatomyState
  visible: Record<LayerId, boolean>
  selected: SystemId | null
  statuses: Record<SystemId, Status>
  bpm: number
  heightScale: number
  widthScale: number
  /** Nível 1: rótulos sempre visíveis */
  labels: boolean
}

function BodyCanvasImpl({ astroId, anatomy, visible, selected, statuses, bpm, heightScale, widthScale, labels }: BodyCanvasProps) {
  const focus = useMemo(
    () => (selected ? SYSTEMS[selected].focus : { target: [0, 0.95, 0] as V3, distance: 4.6 }),
    [selected],
  )

  const hotspots = useMemo(
    () =>
      Object.fromEntries(
        SYSTEM_IDS.map((s) => {
          const def = SYSTEMS[s]
          const a = anatomy.anchors[s]
          const o = def.hotspotOffset
          const p: V3 = a ? [a[0] + o[0], a[1] + o[1], a[2] + o[2]] : def.hotspot
          return [s, p]
        }),
      ) as Record<SystemId, V3>,
    [anatomy.anchors],
  )
  useEffect(() => {
    if (anatomy.norm) console.info('[anatomy] hotspots', JSON.stringify(Object.fromEntries(Object.entries(hotspots).map(([k, v]) => [k, v.map((n) => +n.toFixed(2))]))))
  }, [anatomy.norm, hotspots])

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.15, 4.6], fov: 32, near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#c9d8ff', '#1a2440', 0.9]} />
      <directionalLight position={[2.5, 3.5, 4]} intensity={2.2} />
      <directionalLight position={[-3, 2, -3]} intensity={1.0} color="#8fb0ff" />
      <group scale={[widthScale, heightScale, widthScale]}>
        <Floor />
        {anatomy.norm && !anatomy.failed ? (
          <AnatomyModel anatomy={anatomy} norm={anatomy.norm} visible={visible} statuses={statuses} selected={selected} bpm={bpm} />
        ) : anatomy.failed ? (
          <ProceduralBody />
        ) : null}
        <RadiationAura status={statuses.radiation} focused={selected !== null && selected !== 'radiation'} />
        {SYSTEM_IDS.map((s) => statuses[s] !== 'nominal' && <Glow key={s} position={hotspots[s]} status={statuses[s]} />)}
        {/* Sentinela: o drei Html descarta a primeira instância montada; esta absorve a perda. */}
        <Html position={[0, 0, 0]}><span hidden /></Html>
        {SYSTEM_IDS.map((s) => (
          <Hotspot key={s} astroId={astroId} system={s} status={statuses[s]} selected={selected === s} position={hotspots[s]} showLabel={labels} />
        ))}
      </group>
      <CameraRig target={focus.target} distance={focus.distance} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableDamping
        target={[0, 0.95, 0]}
        minPolarAngle={Math.PI * 0.32}
        maxPolarAngle={Math.PI * 0.6}
        minAzimuthAngle={-Math.PI * 0.4}
        maxAzimuthAngle={Math.PI * 0.4}
      />
    </Canvas>
  )
}

export const BodyCanvas = memo(BodyCanvasImpl)
