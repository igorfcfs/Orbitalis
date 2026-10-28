import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ASTRONAUTS } from '../data/astronauts'
import { SYSTEMS, SYSTEM_IDS } from '../data/systems'
import { astronautStatus, estimatedHeight, resolveMetric, systemStatus } from '../lib/model'
import type { Route } from '../lib/route'
import { go, paths } from '../lib/route'
import { useSim, useStore } from '../state/store'
import type { Sim, Status, SystemId } from '../types'
import { AnatomyLayers } from './AnatomyLayers'
import { AstronautRig, Halo } from './AstronautRig'
import { getVariant, type BodyVariant } from './bodyBuild'
import { Earth, EvaWorld, Habitat, Mars, SceneLights, Stars, Sun, WINDOW } from './Environment'
import { RadiationParticles } from './Particles'

type V3 = [number, number, number]

const LINEUP_X: Record<string, number> = { lena: -1.95, rafael: -0.65, aiko: 0.65, daniel: 1.95 }
const PANEL_PX = 424

// ---------- Câmera ----------

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpC = new THREE.Vector3()

function CameraRig({ lineup, selected }: { lineup: boolean; selected: SystemId | null }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void; enabled: boolean } | null
  const size = useThree((s) => s.size)
  const timer = useRef(0)
  const shift = useRef({ x: 0, y: 0 })
  const key = `${lineup}-${selected}`
  useEffect(() => {
    timer.current = 0
  }, [key])

  useFrame(({ pointer }, dt) => {
    if (!controls) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wide = size.width >= 1024
    // Desloca a imagem para o corpo ficar no centro da área livre (sem o painel)
    const tx = !lineup && wide ? PANEL_PX / 2 : 0
    const ty = lineup ? -size.height * 0.085 : !wide ? size.height * 0.2 : 0
    const ks = 1 - Math.exp(-dt * 4)
    shift.current.x += (tx - shift.current.x) * ks
    shift.current.y += (ty - shift.current.y) * ks
    camera.setViewOffset(size.width, size.height, shift.current.x, shift.current.y, size.width, size.height)

    controls.enabled = !lineup
    const k = still ? 1 : 1 - Math.exp(-dt * (lineup ? 2.2 : 3.2))
    if (lineup) {
      const aspect = size.width / size.height
      const dist = Math.max(5.9, 2.7 / (Math.tan((camera.fov * Math.PI) / 360) * aspect))
      tmpA.set(pointer.x * 0.35, 1.62 + pointer.y * 0.08, dist) // posição
      tmpB.set(pointer.x * 0.12, 1.28, 0) // alvo
      camera.position.lerp(tmpA, k)
      controls.target.lerp(tmpB, k)
      camera.lookAt(controls.target)
      return
    }
    if (timer.current > 2.4) return
    timer.current += dt
    const f = selected ? SYSTEMS[selected].focus : { target: [0, 0.98, 0] as V3, distance: 4.0 }
    tmpB.set(f.target[0], f.target[1], f.target[2])
    controls.target.lerp(tmpB, k)
    tmpC.copy(camera.position).sub(controls.target)
    if (tmpC.lengthSq() < 0.01) tmpC.set(0, 0.1, 1)
    tmpC.normalize()
    // Ao voltar do lineup, olha de frente
    if (timer.current < 0.05) tmpC.lerp(new THREE.Vector3(0, 0.12, 1).normalize(), 0.5).normalize()
    tmpA.copy(controls.target).addScaledVector(tmpC, f.distance * (wide ? 1 : 1.3))
    camera.position.lerp(tmpA, k)
    controls.update()
  })
  return null
}

// ---------- Projeção de rótulos para o DOM ----------

function Projector({ heads, active }: { heads: React.MutableRefObject<Map<string, THREE.Object3D>>; active: boolean }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame(() => {
    for (const [id, obj] of heads.current) {
      const el = document.querySelector<HTMLElement>(`[data-plate="${id}"]`)
      if (!el) continue
      if (!active) {
        el.style.opacity = '0'
        continue
      }
      tmpA.setFromMatrixPosition(obj.matrixWorld).project(camera)
      // O deslocamento da vista já está na matriz de projeção
      const x = (tmpA.x * 0.5 + 0.5) * size.width
      const y = (-tmpA.y * 0.5 + 0.5) * size.height
      el.style.opacity = '1'
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`
    }
  })
  return null
}

// ---------- Mundo ----------

interface WorldProps {
  route: Route
  sim: Sim
  variants: Record<'male' | 'female', BodyVariant>
  env: 'hab' | 'eva'
}

function World({ route, sim, variants, env }: WorldProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const hoverSys = useStore((s) => s.hoverSys)
  const hoverCrew = useStore((s) => s.hoverCrew)
  const xray = useStore((s) => s.xray)
  const setHoverSys = useStore((s) => s.setHoverSys)
  const setHoverCrew = useStore((s) => s.setHoverCrew)
  const heads = useRef(new Map<string, THREE.Object3D>())
  const xs = useRef<Record<string, number>>({ ...LINEUP_X })
  const lineup = route.level === 0
  const focusedId = route.level > 0 && 'id' in route ? route.id : null
  const selected = 'system' in route ? route.system : null

  // Ambiente de reflexos (sem baixar nada)
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = tex
    return () => {
      scene.environment = null
      tex.dispose()
      pm.dispose()
    }
  }, [gl, scene])
  useEffect(() => {
    scene.environmentIntensity = env === 'eva' ? 0.45 : 0.5
  }, [env, scene])

  const info = useMemo(
    () =>
      ASTRONAUTS.map((a) => {
        const statuses = Object.fromEntries(SYSTEM_IDS.map((s) => [s, systemStatus(a, s, sim)])) as Record<SystemId, Status>
        const mass = resolveMetric(a, 'mass', sim)
        const bmi = mass.value / (a.heightM * a.heightM)
        return {
          a,
          statuses,
          overall: astronautStatus(a, sim),
          bpm: resolveMetric(a, 'rhr', sim).value,
          heightScale: estimatedHeight(a, sim.day).value / 1.8,
          widthScale: Math.min(1.12, Math.max(0.92, Math.sqrt(bmi / 22))),
        }
      }),
    [sim],
  )

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 3.2)
    for (const a of ASTRONAUTS) {
      const target = lineup || a.id !== focusedId ? LINEUP_X[a.id] : 0
      xs.current[a.id] += (target - xs.current[a.id]) * k
    }
  })

  const marsScale = 0.78 + 0.55 * (sim.day / 250)
  const sunDir = useMemo(() => new THREE.Vector3(0.7, 0.35, -0.25), [])
  const eva = env === 'eva'

  // Janela da cabine: Marte à esquerda, a Terra pequena à direita
  const cam = new THREE.Vector3(0, 1.5, 5.2)
  const winDir = new THREE.Vector3(WINDOW.x, WINDOW.y, -4.2).sub(cam).normalize()
  const rot = (az: number, el: number) => winDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), az).applyAxisAngle(new THREE.Vector3(1, 0, 0), el)
  const marsPos = cam.clone().addScaledVector(rot(0.2, -0.03), 62)
  const earthPos = cam.clone().addScaledVector(rot(-0.07, 0.04), 90)
  const earthScale = 1.15 - 0.55 * (sim.day / 250)

  return (
    <>
      <SceneLights eva={eva} />
      <Stars />
      {eva ? (
        <>
          <Mars position={[16, -7, -40]} radius={11 * marsScale} light={sunDir} />
          <Sun position={[40, 26, -14]} scale={42} />
          <Earth position={[-20, 22, -60]} scale={earthScale * 1.4} />
          <EvaWorld />
        </>
      ) : (
        <>
          <Mars position={marsPos.toArray() as V3} radius={14.5 * marsScale} light={sunDir} />
          <Earth position={earthPos.toArray() as V3} scale={earthScale} />
          <Habitat />
        </>
      )}

      {info.map(({ a, statuses, overall, bpm, heightScale, widthScale }) => {
        const isFocus = a.id === focusedId
        const variant = variants[a.look.build]
        return (
          <group key={a.id}>
            <FollowX xs={xs} id={a.id} hidden={!lineup && !isFocus}>
              <Halo status={overall} active={isFocus} hot={hoverCrew === a.id} />
            </FollowX>
            <AstronautRig
              astro={a}
              variant={variant}
              statuses={statuses}
              overall={overall}
              selected={isFocus ? selected : null}
              hoverSys={isFocus ? hoverSys : null}
              suit={isFocus && sim.suit}
              xray={isFocus && xray}
              fadeTarget={lineup || isFocus ? 0 : 1}
              focused={isFocus}
              lineup={lineup}
              hovered={lineup && hoverCrew === a.id}
              xs={xs}
              heightScale={heightScale}
              widthScale={widthScale}
              bpm={bpm}
              onHoverSys={setHoverSys}
              onPickSys={(s) => go(paths.system(a.id, s))}
              onLineupHover={(h) => setHoverCrew(h ? a.id : hoverCrew === a.id ? null : hoverCrew)}
              onLineupClick={() => go(paths.body(a.id))}
              registerHead={(id, obj) => (obj ? heads.current.set(id, obj) : heads.current.delete(id))}
            >
              {isFocus && <AnatomyLayers selected={selected} xray={xray} statuses={statuses} bpm={bpm} active />}
            </AstronautRig>
          </group>
        )
      })}

      <RadiationParticles
        intensity={sim.solar ? 1 : eva ? 0.75 : 0}
        hot={sim.solar}
        active={!lineup}
      />
      <Projector heads={heads} active={lineup} />
      <CameraRig lineup={lineup} selected={selected} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        minDistance={0.55}
        maxDistance={7}
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.62}
        minAzimuthAngle={-Math.PI * 0.45}
        maxAzimuthAngle={Math.PI * 0.45}
        zoomSpeed={0.6}
        target={[0, 1.2, 0]}
      />
      <EffectComposer multisampling={4}>
        <Bloom intensity={eva ? 0.55 : 0.75} luminanceThreshold={0.96} luminanceSmoothing={0.25} mipmapBlur />
        <Vignette offset={0.28} darkness={0.75} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}

/** Mantém o grupo no x animado do astronauta. */
function FollowX({ xs, id, hidden, children }: { xs: React.MutableRefObject<Record<string, number>>; id: string; hidden: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.position.x = xs.current[id]
  })
  return (
    <group ref={ref} visible={!hidden}>
      {children}
    </group>
  )
}

// ---------- Palco ----------

function useVariants() {
  const [v, setV] = useState<Record<'male' | 'female', BodyVariant> | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    Promise.all([getVariant('male'), getVariant('female')])
      .then(([male, female]) => alive && setV({ male, female }))
      .catch((e) => {
        console.warn('[body] failed to build', e)
        if (alive) setError(true)
      })
    return () => {
      alive = false
    }
  }, [])
  return { variants: v, error }
}

function StageImpl({ route }: { route: Route }) {
  const sim = useSim()
  const { variants, error } = useVariants()
  const [env, setEnv] = useState<'hab' | 'eva'>(sim.suit ? 'eva' : 'hab')
  const [veil, setVeil] = useState(0)
  const suit = sim.suit
  const first = useRef(true)

  // Ciclo da câmara de ar: o traje se forma, a imagem escurece, a cena troca
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (suit) {
      const a = setTimeout(() => setVeil(1), 1500)
      const b = setTimeout(() => {
        setEnv('eva')
        setVeil(0)
      }, 2000)
      return () => {
        clearTimeout(a)
        clearTimeout(b)
      }
    }
    setVeil(1)
    const c = setTimeout(() => {
      setEnv('hab')
      setVeil(0)
    }, 380)
    return () => clearTimeout(c)
  }, [suit])

  return (
    <div className="stage3d" aria-hidden={false}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 1.6, 6.4], fov: 32, near: 0.05, far: 320 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
        onPointerMissed={() => useStore.getState().setHoverSys(null)}
      >
        <color attach="background" args={['#02030a']} />
        {variants && <World route={route} sim={sim} variants={variants} env={env} />}
      </Canvas>
      <div className="veil" style={{ opacity: veil }} />
      {!variants && !error && <p className="boot" role="status">Preparing the crew bay…</p>}
      {error && <p className="boot" role="alert">The 3D model could not be loaded.</p>}
    </div>
  )
}

export const Stage = memo(StageImpl)
