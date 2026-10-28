import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { SYSTEM_IDS } from '../data/systems'
import type { Astronaut, Status, SystemId } from '../types'
import { BODY_POINTS, SYS_BY_INDEX, SYS_INDEX, warp, type BodyVariant } from './bodyBuild'
import { makeBodyUniforms, patchBodyMaterial, patchPartMaterial, type BodyUniforms } from './bodyShader'
import { eyeTexture, glowTexture, nameplateTexture, patchTexture } from './textures'

THREE.Mesh.prototype.raycast = acceleratedRaycast

const STATUS_HEX: Record<Status, string> = { nominal: '#3DDC97', watch: '#FFB547', critical: '#FF5D5D' }
const LIVE_HEX = '#5CC8FF'
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Escala do modelo em metros para 1.80 m (corpo com cabelo = 1.743 m) */
export const NORM_SCALE = 1.8 / 1.743

// ---------- Materiais ----------

function makeMaterials(astro: Astronaut, u: BodyUniforms) {
  const look = astro.look
  const skin = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.56, metalness: 0, vertexColors: true })
  patchBodyMaterial(skin, u, 'skin')
  const cover = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, metalness: 0, vertexColors: true, side: THREE.DoubleSide })
  patchBodyMaterial(cover, u, 'cover')
  const suit = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.6, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
    sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff'),
  })
  patchBodyMaterial(suit, u, 'suit')
  const hair = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide })
  patchBodyMaterial(hair, u, 'hair')
  const lash = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.hair).multiplyScalar(0.55), roughness: 0.6, side: THREE.DoubleSide })
  patchBodyMaterial(lash, u, 'hair')

  const eye = new THREE.MeshPhysicalMaterial({
    map: eyeTexture(look.eyes), roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04,
  })
  patchPartMaterial(eye, u, 'fade')

  const part = (color: string, roughness: number, metalness: number, mode: 'suit' | 'cover' | 'fade') => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    patchPartMaterial(m, u, mode)
    return m
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#cfe3ff', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.6,
  })
  patchPartMaterial(glass, u, 'suit')
  const visor = new THREE.MeshStandardMaterial({
    color: '#d9a548', roughness: 0.14, metalness: 1, transparent: true, opacity: 0.62, envMapIntensity: 1.5, side: THREE.DoubleSide,
  })
  patchPartMaterial(visor, u, 'suit')
  const lastName = astro.name.split(' ').slice(-1)[0]
  const plateSuit = new THREE.MeshStandardMaterial({ map: nameplateTexture(lastName, astro.role, look.accent, false), roughness: 0.7 })
  patchPartMaterial(plateSuit, u, 'suit')
  const plateCover = new THREE.MeshStandardMaterial({ map: nameplateTexture(lastName, astro.role, look.accent, true), roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2 })
  patchPartMaterial(plateCover, u, 'cover')
  const patchCover = new THREE.MeshStandardMaterial({ map: patchTexture(look.accent), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })
  patchPartMaterial(patchCover, u, 'cover')
  const screen = new THREE.MeshStandardMaterial({ color: '#0b1a2a', emissive: new THREE.Color('#9fd8ff'), emissiveIntensity: 1.6, toneMapped: false })
  patchPartMaterial(screen, u, 'suit')
  const dosi = new THREE.MeshStandardMaterial({ color: '#202737', roughness: 0.45, metalness: 0.4 })
  patchPartMaterial(dosi, u, 'cover')
  const dosiScreen = new THREE.MeshStandardMaterial({ color: '#0b0f19', roughness: 0.3 })
  patchPartMaterial(dosiScreen, u, 'cover')
  const trim = new THREE.MeshStandardMaterial({ color: '#1a2744', roughness: 0.9 })
  patchPartMaterial(trim, u, 'cover')
  const led = new THREE.MeshStandardMaterial({ color: '#0b0f19', emissive: new THREE.Color(LIVE_HEX), emissiveIntensity: 1.4, toneMapped: false })
  patchPartMaterial(led, u, 'cover')
  return {
    skin, cover, suit, hair, lash, eye, glass, visor, plateSuit, plateCover, patchCover, screen, dosi, dosiScreen, led, trim,
    white: part('#eef1f6', 0.55, 0.0, 'suit'),
    grey: part('#9aa4b5', 0.35, 0.65, 'suit'),
    dark: part('#171c28', 0.5, 0.3, 'suit'),
    accent: part(look.accent, 0.5, 0.1, 'suit'),
    coverDark: part('#0d1220', 0.5, 0.3, 'cover'),
  }
}

type Mats = ReturnType<typeof makeMaterials>

// ---------- Peças do traje ----------

function Ring({ center, dir, radius, tube, material, squash = 1 }: {
  center: THREE.Vector3; dir: THREE.Vector3; radius: number; tube: number; material: THREE.Material; squash?: number
}) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()), [dir])
  return (
    <mesh position={center} quaternion={q} material={material} scale={[1, squash, 1]}>
      <torusGeometry args={[radius, tube, 14, 40]} />
    </mesh>
  )
}

function SuitParts({ mats, build, surfaceZ }: {
  mats: Mats; build: BodyVariant['build']; surfaceZ: (x: number, y: number) => number
}) {
  const w = (p: THREE.Vector3) => warp(p.clone(), build)
  const P = BODY_POINTS
  const head = useMemo(() => w(P.head), [build]) // eslint-disable-line react-hooks/exhaustive-deps
  const neck = useMemo(() => w(P.neck), [build]) // eslint-disable-line react-hooks/exhaustive-deps
  const pack = useMemo(() => new RoundedBoxGeometry(0.42, 0.58, 0.17, 5, 0.035), [])
  const lower = useMemo(() => new RoundedBoxGeometry(0.3, 0.12, 0.12, 4, 0.02), [])
  const chest = useMemo(() => new RoundedBoxGeometry(0.21, 0.13, 0.05, 4, 0.012), [])
  const arms = [1, -1].map((s) => {
    const sh = P[s > 0 ? 'shoulderL' : 'shoulderR'], el = P[s > 0 ? 'elbowL' : 'elbowR'], wr = P[s > 0 ? 'wristL' : 'wristR']
    return { s, sh: w(sh), el: w(el), wr: w(wr), upper: w(el).sub(w(sh)), fore: w(wr).sub(w(el)) }
  })
  const legs = [1, -1].map((s) => {
    const kn = P[s > 0 ? 'kneeL' : 'kneeR'], an = P[s > 0 ? 'ankleL' : 'ankleR']
    return { s, kn: w(kn), an: w(an), dir: w(an).sub(w(kn)) }
  })
  const frontZ = surfaceZ(0, 1.27) + 0.044

  return (
    <group>
      {/* Capacete */}
      <mesh position={[head.x, head.y + 0.005, head.z]} material={mats.glass}>
        <sphereGeometry args={[0.188, 48, 32]} />
      </mesh>
      <mesh position={[head.x, head.y + 0.005, head.z]} rotation={[0, 0, 0]} material={mats.visor}>
        <sphereGeometry args={[0.196, 48, 28, Math.PI / 2 - 1.15, 2.3, Math.PI * 0.27, Math.PI * 0.46]} />
      </mesh>
      <mesh position={[head.x, head.y + 0.19, head.z + 0.02]} material={mats.dark}>
        <boxGeometry args={[0.07, 0.025, 0.05]} />
      </mesh>
      <Ring center={new THREE.Vector3(neck.x, neck.y + 0.012, neck.z)} dir={new THREE.Vector3(0, 1, 0)} radius={0.1} tube={0.019} material={mats.grey} />

      {/* Torso */}
      <mesh position={[0, 1.2, -0.262]} material={mats.white} geometry={pack} />
      <mesh position={[0, 0.95, -0.235]} material={mats.dark} geometry={lower} />
      <mesh position={[0, 1.275, frontZ]} material={mats.dark} geometry={chest} />
      <mesh position={[0, 1.285, frontZ + 0.027]} material={mats.screen}>
        <planeGeometry args={[0.1, 0.045]} />
      </mesh>
      <mesh position={[-0.078, 1.38, surfaceZ(-0.078, 1.38) + 0.042]} material={mats.plateSuit}>
        <planeGeometry args={[0.095, 0.03]} />
      </mesh>
      <Ring center={new THREE.Vector3(0, 1.04, 0)} dir={new THREE.Vector3(0, 1, 0)} radius={0.205} tube={0.014} material={mats.grey} squash={1} />

      {/* Braços */}
      {arms.map((a) => (
        <group key={a.s}>
          <Ring center={a.sh.clone().add(new THREE.Vector3(a.s * 0.01, -0.02, 0))} dir={a.upper} radius={0.082} tube={0.017} material={mats.grey} />
          <Ring center={a.sh.clone().lerp(a.el, 0.55)} dir={a.upper} radius={0.074} tube={0.011} material={mats.accent} />
          <Ring center={a.el} dir={a.upper} radius={0.066} tube={0.016} material={mats.grey} />
          <Ring center={a.wr.clone().add(new THREE.Vector3(0, 0.012, 0))} dir={a.fore} radius={0.05} tube={0.02} material={mats.grey} />
        </group>
      ))}

      {/* Pernas */}
      {legs.map((l) => (
        <group key={l.s}>
          <Ring center={new THREE.Vector3(l.kn.x, l.kn.y + 0.02, l.kn.z)} dir={new THREE.Vector3(0, 1, 0)} radius={0.093} tube={0.017} material={mats.grey} />
          <Ring center={new THREE.Vector3(l.an.x, l.an.y + 0.035, l.an.z)} dir={new THREE.Vector3(0, 1, 0)} radius={0.075} tube={0.017} material={mats.grey} />
        </group>
      ))}
    </group>
  )
}

// ---------- Acessórios do macacão ----------

function CoverAccessories({ mats, build, surfaceZ, onRadiation }: {
  mats: Mats; build: BodyVariant['build']; surfaceZ: (x: number, y: number) => number
  onRadiation: (e: ThreeEvent<PointerEvent | MouseEvent>, kind: 'move' | 'out' | 'click', priority?: boolean) => void
}) {
  const w = (x: number, y: number) => warp(new THREE.Vector3(x, y, 0), build)
  const pA = w(-0.078, 1.3)
  const pB = w(0.082, 1.3)
  const pD = w(0.222, 1.215)
  const dosiBox = useMemo(() => new RoundedBoxGeometry(0.05, 0.075, 0.02, 3, 0.006), [])
  const neck = warp(BODY_POINTS.neck.clone(), build)
  const wrists = [BODY_POINTS.wristL, BODY_POINTS.wristR].map((p) => warp(p.clone(), build))
  const armDir = useMemo(() => [new THREE.Vector3(0.1, -1, 0.1), new THREE.Vector3(-0.1, -1, 0.1)], [])
  return (
    <group>
      {/* Gola e punhos escondem a borda irregular das regiões */}
      <Ring center={new THREE.Vector3(neck.x, neck.y - 0.012, neck.z)} dir={new THREE.Vector3(0, 1, 0)} radius={0.083} tube={0.017} material={mats.trim} />
      {wrists.map((w2, i) => (
        <Ring key={i} center={new THREE.Vector3(w2.x + (i ? -0.004 : 0.004), w2.y + 0.034, w2.z)} dir={armDir[i]} radius={0.04} tube={0.011} material={mats.trim} />
      ))}
      <mesh position={[pA.x, 1.3, surfaceZ(pA.x, 1.3) + 0.019]} material={mats.plateCover}>
        <planeGeometry args={[0.092, 0.029]} />
      </mesh>
      <mesh position={[pB.x, 1.3, surfaceZ(pB.x, 1.3) + 0.019]} material={mats.patchCover}>
        <circleGeometry args={[0.026, 32]} />
      </mesh>
      {/* Dosímetro pessoal: toque para abrir a radiação */}
      <group
        position={[pD.x, 1.215, surfaceZ(pD.x, 1.215) + 0.028]}
        onPointerMove={(e) => onRadiation(e, 'move', true)}
        onPointerOut={(e) => onRadiation(e, 'out', true)}
        onClick={(e) => onRadiation(e, 'click', true)}
      >
        <mesh geometry={dosiBox} material={mats.dosi} />
        <mesh position={[0, 0.02, 0.0105]} material={mats.dosiScreen}>
          <planeGeometry args={[0.03, 0.02]} />
        </mesh>
        <mesh position={[0, -0.022, 0.0108]} material={mats.led}>
          <circleGeometry args={[0.006, 16]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------- Rig ----------

export interface RigProps {
  astro: Astronaut
  variant: BodyVariant
  statuses: Record<SystemId, Status>
  overall: Status
  selected: SystemId | null
  hoverSys: SystemId | null
  suit: boolean
  xray: boolean
  /** Dissolução geral (0 = presente, 1 = ausente) */
  fadeTarget: number
  /** Astronauta em foco: aceita clique por região */
  focused: boolean
  /** Modo lineup: o corpo todo é um botão */
  lineup: boolean
  hovered: boolean
  /** Posição x animada de cada astronauta (lineup → centro) */
  xs: React.MutableRefObject<Record<string, number>>
  heightScale: number
  widthScale: number
  bpm: number
  onHoverSys: (s: SystemId | null) => void
  onPickSys: (s: SystemId) => void
  onLineupHover: (hover: boolean) => void
  onLineupClick: () => void
  registerHead?: (id: string, obj: THREE.Object3D | null) => void
  /** Camadas internas, no mesmo espaço do modelo */
  children?: ReactNode
}

function bvhFor(geo: THREE.BufferGeometry) {
  const g = geo as THREE.BufferGeometry & { boundsTree?: MeshBVH }
  if (!g.boundsTree) g.boundsTree = new MeshBVH(g)
  return g
}

export function AstronautRig(p: RigProps) {
  const { astro, variant, statuses, selected } = p
  const look = astro.look
  const u = useMemo(() => makeBodyUniforms(), [])
  const mats = useMemo(() => makeMaterials(astro, u), [astro, u])
  const group = useRef<THREE.Group>(null)
  const headAnchor = useRef<THREE.Object3D>(null)
  const state = useRef({ suit: p.suit ? 1 : 0, sel: 0, reveal: 0, xray: 0, fade: p.fadeTarget, turn: 0, hoverScale: 1 })
  const pickRef = useRef<THREE.Mesh>(null)
  const auraMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uAlpha: { value: 0.2 }, uColor: { value: new THREE.Color(LIVE_HEX) }, uHot: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uAlpha; uniform vec3 uColor; uniform float uHot; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6); vec3 c = mix(uColor, vec3(1.0,0.45,0.35), uHot); gl_FragColor = vec4(c, f * uAlpha); }`,
      }),
    [],
  )

  // BVH para o clique por região
  useLayoutEffect(() => {
    bvhFor(variant.pick)
  }, [variant])

  // Status → uniformes
  useEffect(() => {
    SYSTEM_IDS.forEach((s) => {
      const i = SYS_INDEX[s]
      const st = statuses[s]
      u.uStat.value[i] = st === 'nominal' ? 0 : st === 'watch' ? 1 : 2
      u.uStatCol.value[i].set(st === 'nominal' ? '#ffffff' : STATUS_HEX[st])
    })
  }, [statuses, u])

  useEffect(() => {
    p.registerHead?.(astro.id, headAnchor.current)
    return () => p.registerHead?.(astro.id, null)
  }, [astro.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Altura da superfície (para colar plaquetas no peito)
  const surfaceZ = useMemo(() => {
    const ray = new THREE.Raycaster()
    ;(ray as THREE.Raycaster & { firstHitOnly: boolean }).firstHitOnly = true
    const mesh = new THREE.Mesh(bvhFor(variant.pick), new THREE.MeshBasicMaterial())
    return (x: number, y: number) => {
      ray.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1))
      const hit = ray.intersectObject(mesh, false)[0]
      return hit ? hit.point.z : 0.1
    }
  }, [variant])

  const eyes = useMemo(
    () => [BODY_POINTS.eyeL, BODY_POINTS.eyeR].map((e) => warp(e.clone(), look.build)),
    [look.build],
  )

  const sysAt = (e: ThreeEvent<PointerEvent | MouseEvent>): SystemId | null => {
    const fi = e.faceIndex
    if (fi === undefined || fi === null) return null
    // Olhos são pequenos: um raio generoso ao redor de cada globo facilita o clique
    if (pickRef.current) {
      const local = pickRef.current.worldToLocal(e.point.clone())
      if (local.z > 0.03 && eyes.some((c) => Math.hypot(local.x - c.x, local.y - c.y) < 0.024)) return 'neuro_ocular'
    }
    const geo = variant.pick
    const v = geo.index!.getX(fi * 3)
    return SYS_BY_INDEX[Math.round((geo.getAttribute('aSys') as THREE.BufferAttribute).getX(v))]
  }

  const setCursor = (c: string) => {
    document.body.style.cursor = c
  }

  const onBodyMove = (e: ThreeEvent<PointerEvent>) => {
    if (p.lineup) {
      e.stopPropagation()
      p.onLineupHover(true)
      setCursor('pointer')
      return
    }
    if (!p.focused) return
    e.stopPropagation()
    const s = sysAt(e)
    p.onHoverSys(s)
    setCursor(s ? 'pointer' : 'default')
  }
  const onBodyOut = () => {
    if (p.lineup) p.onLineupHover(false)
    else p.onHoverSys(null)
    setCursor('default')
  }
  const onBodyClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return
    if (p.lineup) {
      e.stopPropagation()
      p.onLineupClick()
      return
    }
    if (!p.focused) return
    e.stopPropagation()
    const s = sysAt(e)
    if (s) p.onPickSys(s)
  }
  const direct = (sys: SystemId) => ({
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (p.lineup) return onBodyMove(e)
      if (!p.focused) return
      e.stopPropagation()
      p.onHoverSys(sys)
      setCursor('pointer')
    },
    onPointerOut: onBodyOut,
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (p.lineup) return onBodyClick(e)
      if (e.delta > 6 || !p.focused) return
      e.stopPropagation()
      p.onPickSys(sys)
    },
  })
  const radiation = (e: ThreeEvent<PointerEvent | MouseEvent>, kind: 'move' | 'out' | 'click', priority = false) => {
    if (p.lineup || !p.focused) return
    if (kind === 'out') return onBodyOut()
    // O corpo tem prioridade sobre a aura: se o raio também atinge o corpo, deixa passar.
    // O dosímetro, que fica sobre o corpo, tem prioridade sobre o corpo.
    if (!priority && e.intersections.some((i) => i.object.userData.body)) return
    if (kind === 'click' && (e as ThreeEvent<MouseEvent>).delta > 6) return
    e.stopPropagation()
    if (kind === 'move') {
      p.onHoverSys('radiation')
      setCursor('pointer')
    } else p.onPickSys('radiation')
  }

  useFrame(({ clock, pointer }, dt) => {
    const st = state.current
    const t = clock.elapsedTime
    const k = (rate: number) => 1 - Math.exp(-dt * rate)
    u.uTime.value = t
    mats.led.emissiveIntensity = 1.1 + 0.7 * Math.sin(t * 3)

    // Traje: varredura de altura (veste e despe)
    const suitTarget = p.suit ? 1 : 0
    const step = dt / 1.7
    st.suit = suitTarget > st.suit ? Math.min(suitTarget, st.suit + step) : Math.max(suitTarget, st.suit - step)
    u.uSuitY.value = -0.1 + st.suit * 2.2 * p.heightScale

    // Dissolução da região selecionada
    const wantSel = selected && selected !== 'radiation' ? SYS_INDEX[selected] : 0
    const wantReveal = selected && selected !== 'radiation' && selected !== 'neuro_ocular' ? 1 : 0
    if (wantSel !== st.sel) {
      st.reveal += (0 - st.reveal) * k(10)
      if (st.reveal < 0.03) {
        st.sel = wantSel
        u.uSel.value = wantSel
        u.uRevealCol.value.set(wantSel && statuses[SYS_BY_INDEX[wantSel]!] !== 'nominal' ? STATUS_HEX[statuses[SYS_BY_INDEX[wantSel]!]] : '#7fd0ff')
      }
    } else {
      st.reveal += (wantReveal - st.reveal) * k(2.4)
    }
    u.uReveal.value = st.reveal
    st.xray += ((p.xray ? 1 : 0) - st.xray) * k(3)
    u.uXray.value = st.xray < 0.01 ? 0 : st.xray
    st.fade += (p.fadeTarget - st.fade) * k(3)
    u.uFade.value = st.fade < 0.01 ? 0 : st.fade
    u.uHover.value = p.focused && p.hoverSys ? SYS_INDEX[p.hoverSys] : 0
    u.uStatScale.value += ((p.lineup ? 0.45 : 0.6) - u.uStatScale.value) * k(4)

    // Vida: respiração, flutuação e giro suave em direção ao cursor
    if (group.current) {
      const still = calm()
      const x = p.xs.current[astro.id]
      const bob = still ? 0 : Math.sin(t * 0.8 + x) * 0.012
      group.current.position.set(x, bob, 0)
      group.current.visible = st.fade < 0.98
      const target = p.lineup ? -pointer.x * 0.18 + (p.hovered ? 0 : 0) : p.focused ? pointer.x * 0.22 : 0
      st.turn += (target - st.turn) * k(3)
      group.current.rotation.y = still ? 0 : st.turn + Math.sin(t * 0.35 + x) * 0.05
      const breathe = still ? 0 : Math.sin(t * 1.4) * 0.0035
      const hs = st.hoverScale + ((p.hovered ? 1.035 : 1) - st.hoverScale) * k(8)
      st.hoverScale = hs
      group.current.scale.set(p.widthScale * hs, p.heightScale * hs * (1 + breathe), p.widthScale * hs)
    }

    // Aura de radiação
    const rs = statuses.radiation
    const base = p.suit ? 0.34 : 0.16
    const pulse = rs === 'critical' && !calm() ? Math.sin(t * 4) * 0.12 : 0
    const dim = selected && selected !== 'radiation' ? 0.45 : 1
    auraMat.uniforms.uAlpha.value = (base * (rs === 'nominal' ? 1 : 1.6) + pulse + (p.hoverSys === 'radiation' && p.focused ? 0.2 : 0)) * dim * (p.lineup ? 0 : 1)
    auraMat.uniforms.uHot.value += ((rs === 'critical' ? 1 : p.suit ? 0.25 : 0) - auraMat.uniforms.uHot.value) * k(3)
  })

  const hairDirect = direct('behavior')
  const browDirect = direct('neuro_ocular')
  const eyeDirect = direct('neuro_ocular')

  return (
    <group ref={group} dispose={null}>
      <group scale={NORM_SCALE}>
        {/* Clique por região: corpo inteiro, invisível */}
        <mesh
          ref={pickRef}
          geometry={variant.pick}
          userData={{ body: true }}
          onPointerMove={onBodyMove}
          onPointerOut={onBodyOut}
          onClick={onBodyClick}
        >
          <meshBasicMaterial visible={false} />
        </mesh>

        <mesh geometry={variant.skin} material={mats.skin} frustumCulled={false} />
        <mesh geometry={variant.cover} material={mats.cover} frustumCulled={false} />
        <mesh geometry={variant.suit} material={mats.suit} frustumCulled={false} />
        <mesh geometry={variant.hair} material={mats.hair} frustumCulled={false} userData={{ body: true }} {...hairDirect} />
        <mesh geometry={variant.brows} material={mats.hair} frustumCulled={false} userData={{ body: true }} {...browDirect} />
        <mesh geometry={variant.lashes} material={mats.lash} frustumCulled={false} />

        {eyes.map((e, i) => (
          <mesh key={i} position={e} material={mats.eye} userData={{ body: true }} {...eyeDirect}>
            <sphereGeometry args={[BODY_POINTS.eyeRadius, 48, 32]} />
          </mesh>
        ))}

        <CoverAccessories mats={mats} build={look.build} surfaceZ={surfaceZ} onRadiation={radiation} />
        {p.children}
        <SuitParts mats={mats} build={look.build} surfaceZ={surfaceZ} />
      </group>

      {/* Aura: toque para abrir a radiação */}
      <mesh
        position={[0, 0.93, 0]}
        scale={[0.66, 1.1, 0.54]}
        material={auraMat}
        userData={{ aura: true }}
        onPointerMove={(e) => radiation(e, 'move')}
        onPointerOut={(e) => radiation(e, 'out')}
        onClick={(e) => radiation(e, 'click')}
      >
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>

      <object3D ref={headAnchor} position={[0, 2.0, 0]} />
    </group>
  )
}

export function Halo({ status, active, hot }: { status: Status; active: boolean; hot: boolean }) {
  const ring = useRef<THREE.MeshBasicMaterial>(null)
  const disc = useRef<THREE.MeshBasicMaterial>(null)
  const color = status === 'nominal' ? '#9fb6e6' : STATUS_HEX[status]
  useFrame(({ clock }) => {
    const pulse = status === 'critical' && !calm() ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4) : status === 'watch' ? 0.75 : 1
    if (ring.current) ring.current.opacity = (status === 'nominal' ? 0.4 : 0.9) * (0.65 + 0.35 * pulse) * (hot ? 1.15 : 1)
    if (disc.current) disc.current.opacity = (status === 'nominal' ? 0.16 : 0.42) * (0.55 + 0.45 * pulse)
  })
  return (
    <group position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.52, 0.56, 80]} />
        <meshBasicMaterial ref={ring} color={color} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.68, 0.69, 80]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.95, 64]} />
        <meshBasicMaterial ref={disc} map={glowTexture()} color={color} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.5, 64]} />
        <meshStandardMaterial color="#101624" roughness={0.4} metalness={0.7} transparent opacity={active ? 0.95 : 0.9} />
      </mesh>
    </group>
  )
}
