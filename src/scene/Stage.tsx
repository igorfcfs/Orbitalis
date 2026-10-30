import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, type DepthOfFieldEffect, ToneMappingMode } from 'postprocessing'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ASTRONAUTS } from '../data/astronauts'
import { SYSTEMS, SYSTEM_IDS } from '../data/systems'
import { astronautStatus, estimatedHeight, physique, resolveMetric, systemStatus } from '../lib/model'
import type { Route } from '../lib/route'
import { go, paths } from '../lib/route'
import { useSim, useStore, type LayerId } from '../state/store'
import type { Sim, Status, SystemId } from '../types'
import { AnatomyLayers } from './AnatomyLayers'
import { AstronautRig, Halo } from './AstronautRig'
import { loadEnvironment } from './assets'
import { getVariant, type BodyVariant } from './bodyBuild'
import { loadHead, type HeadModel } from './headModel'
import { loadSuit, type SuitModel } from './suitModel'
import { Earth, EvaWorld, Habitat, Mars, SceneLights, Stars, Sun, WINDOW, type Scan } from './Environment'
import { RadiationParticles } from './Particles'

type V3 = [number, number, number]

const LINEUP_X: Record<string, number> = { lena: -1.95, rafael: -0.65, aiko: 0.65, daniel: 1.95 }
const PANEL_PX = 424

// ---------- Câmera ----------

const UP = new THREE.Vector3(0, 1, 0)
/** Alvo e estado da órbita livre, compartilhados com o CameraRig. */
const ORBIT = { target: new THREE.Vector3(0, 1.2, 0), enabled: true }
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpC = new THREE.Vector3()

function CameraRig({ lineup, selected, xray, suit }: { lineup: boolean; selected: SystemId | null; xray: boolean; suit: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = ORBIT
  const size = useThree((s) => s.size)
  const timer = useRef(0)
  const shift = useRef({ x: 0, y: 0 })
  const key = `${lineup}-${selected}-${xray}-${suit}`
  useEffect(() => {
    timer.current = 0
  }, [key])

  useFrame(({ pointer }, dt) => {
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
      camera.up.lerp(UP, k).normalize() // desfaz a inclinação dada no giro livre
      camera.lookAt(controls.target)
      return
    }
    if (timer.current > 2.4) return
    timer.current += dt
    // No raio-X sem sistema aberto o corpo chega mais perto, para os detalhes internos aparecerem
    const f = selected ? SYSTEMS[selected].focus : { target: [0, 0.98, 0] as V3, distance: xray ? 3.4 : suit ? 4.5 : 4.0 }
    tmpB.set(f.target[0], f.target[1], f.target[2])
    controls.target.lerp(tmpB, k)
    tmpC.copy(camera.position).sub(controls.target)
    if (tmpC.lengthSq() < 0.01) tmpC.set(0, 0.1, 1)
    tmpC.normalize()
    // Ao voltar do lineup, olha de frente
    if (timer.current < 0.05) tmpC.lerp(new THREE.Vector3(0, 0.12, 1).normalize(), 0.5).normalize()
    tmpA.copy(controls.target).addScaledVector(tmpC, f.distance * (wide ? 1 : 1.3))
    camera.position.lerp(tmpA, k)
    camera.lookAt(controls.target)
  })
  return null
}

/**
 * Órbita livre: 360° na horizontal e na vertical de cima até a altura do piso (nunca por baixo dos pés), em qualquer diagonal, sem inclinar a imagem.
 */
function FreeOrbit() {
  const { gl, camera } = useThree()
  const st = useRef({ down: false, x: 0, y: 0, vh: 0, vv: 0 })
  const sph = useRef(new THREE.Spherical())
  const off = useRef(new THREE.Vector3())
  const turn = (h: number, v: number) => {
    camera.up.copy(UP)
    off.current.copy(camera.position).sub(ORBIT.target)
    sph.current.setFromVector3(off.current)
    sph.current.theta -= h
    sph.current.phi = Math.min(Math.PI * 0.55, Math.max(Math.PI * 0.1, sph.current.phi - v))
    off.current.setFromSpherical(sph.current)
    camera.position.copy(ORBIT.target).add(off.current)
    camera.lookAt(ORBIT.target)
  }
  useEffect(() => {
    const el = gl.domElement
    const s = st.current
    const down = (e: PointerEvent) => {
      if (!ORBIT.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return
      s.down = true
      s.x = e.clientX
      s.y = e.clientY
      s.vh = s.vv = 0
    }
    const move = (e: PointerEvent) => {
      if (!s.down) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      s.x = e.clientX
      s.y = e.clientY
      const h = dx * 0.008
      const v = dy * 0.008
      turn(h, v)
      s.vh = h
      s.vv = v
    }
    const up = () => {
      s.down = false
    }
    const wheel = (e: WheelEvent) => {
      if (!ORBIT.enabled) return
      e.preventDefault()
      off.current.copy(camera.position).sub(ORBIT.target)
      const d = Math.min(7, Math.max(0.55, off.current.length() * Math.exp(e.deltaY * 0.0006)))
      camera.position.copy(ORBIT.target).addScaledVector(off.current.normalize(), d)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl, camera])
  // Inércia depois de soltar
  useFrame((_, dt) => {
    const s = st.current
    if (s.down || (!s.vh && !s.vv)) return
    const f = Math.exp(-dt * 4)
    turn(s.vh * dt * 60 * (1 - f) * 0.25, s.vv * dt * 60 * (1 - f) * 0.25)
    s.vh *= f
    s.vv *= f
    if (Math.abs(s.vh) < 1e-5) s.vh = 0
    if (Math.abs(s.vv) < 1e-5) s.vv = 0
  })
  return null
}

// ---------- Foco (profundidade de campo) ----------

const FOCUS_TARGET: V3 = [0, 1.2, 0]
const NO_LAYERS: LayerId[] = []

/** Foca no ponto que a câmera orbita; de perto o plano nítido afina, e o fundo da nave desfoca. */
function Focus() {
  const ref = useRef<DepthOfFieldEffect>(null)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3 } | null
  useFrame(() => {
    const dof = ref.current
    if (!dof || !controls) return
    dof.target?.copy(controls.target)
    dof.cocMaterial.focusRange = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 0.9, 0.6, 5.2)
  })
  return <DepthOfField ref={ref} target={FOCUS_TARGET} focusRange={4.5} bokehScale={1.3} resolutionScale={0.5} />
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
  suitModel: SuitModel | null
  headModels: Record<string, HeadModel>
  env: 'hab' | 'eva'
}

function World({ route, sim, variants, suitModel, headModels, env }: WorldProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const hoverSys = useStore((s) => s.hoverSys)
  const hoverCrew = useStore((s) => s.hoverCrew)
  const xray = useStore((s) => s.xray)
  const layers = useStore((s) => s.layers)
  const hoverLayer = useStore((s) => s.hoverLayer)
  const setHoverSys = useStore((s) => s.setHoverSys)
  const setHoverCrew = useStore((s) => s.setHoverCrew)
  const heads = useRef(new Map<string, THREE.Object3D>())
  const xs = useRef<Record<string, number>>({ ...LINEUP_X })
  const lineup = route.level === 0
  const focusedId = route.level > 0 && 'id' in route ? route.id : null
  const selected = 'system' in route ? route.system : null

  // Luz de ambiente por imagem (HDRI de estúdio); se o arquivo faltar, cai na sala procedural
  useEffect(() => {
    let alive = true
    let map: THREE.Texture | null = null
    const room = () => {
      const pm = new THREE.PMREMGenerator(gl)
      map = pm.fromScene(new RoomEnvironment(), 0.04).texture
      pm.dispose()
      return map
    }
    loadEnvironment(gl).then((t) => {
      if (!alive) return t?.dispose()
      map = t ?? room()
      scene.environment = map
    })
    return () => {
      alive = false
      scene.environment = null
      map?.dispose()
    }
  }, [gl, scene])
  useEffect(() => {
    scene.environmentRotation.y = env === 'eva' ? 0.6 : -0.35
  }, [env, scene])

  // Modo de varredura: com o raio-X ligado a sala escurece (luzes, ambiente, Marte e céu) e a anatomia aparece
  const scan = useRef(0) as Scan
  const lights = useRef<THREE.Group>(null)

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
          physique: physique(a, sim),
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
    scan.current += ((xray && !lineup ? 1 : 0) - scan.current) * (1 - Math.exp(-dt * 3))
    const d = 1 - 0.55 * scan.current
    scene.environmentIntensity = (env === 'eva' ? 0.5 : 0.85) * d
    for (const l of lights.current?.children ?? []) (l as THREE.Light).intensity = (l.userData.base as number) * d
  })

  const marsScale = 0.78 + 0.55 * (sim.day / 250)
  // Direção do Sol para o terminador de Marte: da janela vê-se o disco quase cheio; no EVA, de lado
  const sunHab = useMemo(() => new THREE.Vector3(0.62, 0.3, 0.5), [])
  const sunEva = useMemo(() => new THREE.Vector3(0.8, 0.42, 0.3), [])
  const eva = env === 'eva'

  // Janela da cabine: Marte à esquerda, a Terra pequena à direita
  const cam = new THREE.Vector3(0, 1.5, 5.2)
  const winDir = new THREE.Vector3(WINDOW.x, WINDOW.y, -4.2).sub(cam).normalize()
  const rot = (az: number, el: number) => winDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), az).applyAxisAngle(new THREE.Vector3(1, 0, 0), el)
  const marsPos = cam.clone().addScaledVector(rot(0.085, -0.07), 62)
  const earthPos = cam.clone().addScaledVector(rot(-0.1, 0.11), 90)
  const earthScale = 1.15 - 0.55 * (sim.day / 250)

  return (
    <>
      <SceneLights eva={eva} group={lights} />
      <Stars scan={scan} />
      {eva ? (
        <>
          <Mars position={[16, -7, -40]} radius={11 * marsScale} light={sunEva} scan={scan} />
          <Sun position={[40, 26, -14]} scale={42} />
          <Earth position={[-20, 22, -60]} scale={earthScale * 1.4} />
          <EvaWorld />
        </>
      ) : (
        <>
          <Mars position={marsPos.toArray() as V3} radius={7.2 * marsScale} light={sunHab} scan={scan} />
          <Earth position={earthPos.toArray() as V3} scale={earthScale} />
          <Habitat />
        </>
      )}

      {info.map(({ a, statuses, overall, bpm, heightScale, widthScale, physique: phys }) => {
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
              physique={phys}
              suitModel={suitModel}
              head={headModels[a.id] ?? null}
              bpm={bpm}
              onHoverSys={setHoverSys}
              onPickSys={(s) => go(paths.system(a.id, s))}
              onLineupHover={(h) => setHoverCrew(h ? a.id : hoverCrew === a.id ? null : hoverCrew)}
              onLineupClick={() => go(paths.body(a.id))}
              registerHead={(id, obj) => (obj ? heads.current.set(id, obj) : heads.current.delete(id))}
            >
              {isFocus && <AnatomyLayers selected={selected} layers={isFocus ? layers : NO_LAYERS} hoverLayer={isFocus ? hoverLayer : null} statuses={statuses} bpm={bpm} active />}
            </AstronautRig>
          </group>
        )
      })}

      <RadiationParticles
        intensity={sim.solar ? 1 : eva ? 0.5 : 0}
        hot={sim.solar}
        active={!lineup}
      />
      <Projector heads={heads} active={lineup} />
      <CameraRig lineup={lineup} selected={selected} xray={xray && !lineup} suit={sim.suit && !lineup} />
      <FreeOrbit />
      <EffectComposer multisampling={0}>
        <Focus />
        <Bloom intensity={eva ? 0.55 : 0.7} luminanceThreshold={0.96} luminanceSmoothing={0.25} mipmapBlur />
        <Vignette offset={0.28} darkness={0.75} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Noise opacity={0.07} blendFunction={BlendFunction.SOFT_LIGHT} />
        <SMAA />
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

/** Traje de EVA (1 MB): carrega em paralelo com o corpo e fica pronto antes do primeiro "EVA suit". */
function useSuitModel() {
  const [model, setModel] = useState<SuitModel | null>(null)
  useEffect(() => {
    let alive = true
    loadSuit()
      .then((m) => alive && setModel(m))
      .catch((e) => console.warn('[suit] failed to load', e))
    return () => {
      alive = false
    }
  }, [])
  return model
}

/**
 * Cabeças fotográficas da tripulação. A cena espera por elas (junto com o corpo) para o astronauta não aparecer com a cabeça do atlas
 * e trocar de rosto na frente do usuário; se uma falhar, a cabeça do atlas fica no lugar dela e o app segue.
 */
function useHeads() {
  const [heads, setHeads] = useState<Record<string, HeadModel>>({})
  const [done, setDone] = useState(false)
  useEffect(() => {
    let alive = true
    Promise.allSettled(
      ASTRONAUTS.map((a) =>
        loadHead(a.id).then((h) => {
          if (alive) setHeads((cur) => ({ ...cur, [a.id]: h }))
        }),
      ),
    ).then((res) => {
      for (const r of res) if (r.status === 'rejected') console.warn('[head] failed to load', r.reason)
      if (alive) setDone(true)
    })
    return () => {
      alive = false
    }
  }, [])
  return { heads, done }
}

function StageImpl({ route }: { route: Route }) {
  const sim = useSim()
  const { variants, error } = useVariants()
  const suitModel = useSuitModel()
  const { heads, done: headsDone } = useHeads()
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
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.6, 6.4], fov: 32, near: 0.05, far: 320 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
        onPointerMissed={() => useStore.getState().setHoverSys(null)}
      >
        <color attach="background" args={['#02030a']} />
        {variants && headsDone && <World route={route} sim={sim} variants={variants} suitModel={suitModel} headModels={heads} env={env} />}
      </Canvas>
      <div className="veil" style={{ opacity: veil }} />
      {!(variants && headsDone) && !error && <p className="boot" role="status">Preparing the crew bay…</p>}
      {error && <p className="boot" role="alert">The 3D model could not be loaded.</p>}
    </div>
  )
}

export const Stage = memo(StageImpl)
