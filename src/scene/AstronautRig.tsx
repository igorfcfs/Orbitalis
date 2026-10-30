import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { SYSTEM_IDS } from '../data/systems'
import type { Physique } from '../lib/model'
import type { Astronaut, Status, SystemId } from '../types'
import { tex } from './assets'
import { BODY_POINTS, PONYTAIL_ROOT, SYS_BY_INDEX, SYS_INDEX, warp, type BodyVariant } from './bodyBuild'
import {
  makeBodyUniforms, makeGhostMaterial, patchBodyMaterial, patchPartMaterial, patchTailMaterial, type BodyUniforms, type CoverDecals, type Fabric,
} from './bodyShader'
import { buildCollar, DEFAULT_NECK } from './collar'
import { makeHairShells } from './hairShells'
import type { HeadModel } from './headModel'
import { HEAD_IN_HELMET, fitSuit, type SuitModel } from './suitModel'

/**
 * Canga dos ombros do macacão que se vê pelo visor do traje: meia elipsoide lisa, com o topo na base da gola, que desce para os
 * dois lados como os ombros e as costas. O macacão de verdade fica escondido (o tórax não pode atravessar o traje); esta peça
 * só existe com o traje fechado. Medidas em unidades do modelo (a mesma escala do corpo).
 */
const YOKE = { y: 1.418 - 0.04, z: -0.06, rx: 0.26, ry: 0.1, rz: 0.1 }
import { contactShadowTexture, eyeTexture, glowTexture, nameplateTexture, patchTexture } from './textures'

THREE.Mesh.prototype.raycast = acceleratedRaycast

const STATUS_HEX: Record<Status, string> = { nominal: '#3DDC97', watch: '#FFB547', critical: '#FF5D5D' }
const LIVE_HEX = '#5CC8FF'
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Escala do modelo em metros para 1.80 m (corpo com cabelo = 1.743 m) */
export const NORM_SCALE = 1.8 / 1.743

// ---------- Materiais ----------

function makeMaterials(astro: Astronaut, u: BodyUniforms) {
  const look = astro.look
  // Trama do tecido do macacão: tecido plano de macacão de voo (linho grosso, textura CC0 da Poly Haven). A malha de jérsei que havia
  // antes dava cara de moletom.
  const knit: Fabric = { nor: tex('weaveNor', { repeat: true }), rough: tex('weaveRough', { repeat: true }), scale: 7, strength: 1.1 }
  // Materiais padrão (os físicos com sheen e clearcoat custavam ~20% do quadro numa GPU integrada): o espalhamento de luz
  // da pele e o brilho de fibra do tecido e da penugem vêm do shader do corpo (`SKIN_LIGHTS` e o termo de Fresnel)
  // Dos dois lados: triângulos de lábios, narinas e pálpebras com o sentido invertido (herança do atlas) sumiam e deixavam furinhos claros
  const skin = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.6, metalness: 0, vertexColors: true, side: THREE.DoubleSide })
  patchBodyMaterial(skin, u, 'skin')
  const cover = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, metalness: 0, vertexColors: true, side: THREE.DoubleSide })
  const lastName = astro.name.split(' ').slice(-1)[0]
  // Plaqueta de nome (peito direito do astronauta) e emblema (esquerdo), acima das abas dos bolsos
  const decalAt = (x: number) => warp(new THREE.Vector3(x, 1.322, 0), look.build)
  const decals: CoverDecals = {
    plate: nameplateTexture(lastName, astro.role, look.accent, true),
    patch: patchTexture(look.accent),
    plateAt: [decalAt(-0.078).x, 1.322, 0.092, 0.029],
    patchAt: [decalAt(0.082).x, 1.322, 0.026],
  }
  patchBodyMaterial(cover, u, 'cover', knit, false, decals)
  const hair = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.42, metalness: 0, side: THREE.DoubleSide })
  patchBodyMaterial(hair, u, 'hair')
  // Sobrancelhas: pelo fosco, sem o brilho do cabelo
  const brow = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.hair).multiplyScalar(0.8), roughness: 0.9, metalness: 0, side: THREE.DoubleSide })
  patchBodyMaterial(brow, u, 'hair')
  // Rabo de cavalo: fios com brilho de cabelo (sheen) e leve oscilação
  const tail = new THREE.MeshPhysicalMaterial({
    color: look.hair, roughness: 0.5, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
    sheen: 0.4, sheenRoughness: 0.45, sheenColor: new THREE.Color(look.hair).multiplyScalar(1.25),
  })
  patchTailMaterial(tail, u, calm() ? 0 : 0.55)
  const ghostSkin = makeGhostMaterial(u, 'skin')
  const ghostCover = makeGhostMaterial(u, 'cover')
  const ghostSuit = makeGhostMaterial(u, 'suit')
  const lash = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.hair).lerp(new THREE.Color(look.skin), 0.35), roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false })
  patchBodyMaterial(lash, u, 'hair')

  // Com o traje vestido a cabeça fica por dentro do capacete: tudo abaixo da linha da varredura some
  const eye = new THREE.MeshPhysicalMaterial({
    map: eyeTexture(look.eyes), roughness: 0.2, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.06, envMapIntensity: 0.65,
  })
  patchPartMaterial(eye, u, 'cover')

  const part = (color: string, roughness: number, metalness: number, mode: 'suit' | 'cover' | 'fade') => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    patchPartMaterial(m, u, mode)
    return m
  }
  const plateSuit = new THREE.MeshStandardMaterial({ map: nameplateTexture(lastName, astro.role, look.accent, false), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })
  patchPartMaterial(plateSuit, u, 'suit')
  const patchSuit = new THREE.MeshStandardMaterial({ map: patchTexture(look.accent), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })
  patchPartMaterial(patchSuit, u, 'suit')
  const dosi = new THREE.MeshStandardMaterial({ color: '#202737', roughness: 0.45, metalness: 0.4 })
  patchPartMaterial(dosi, u, 'cover')
  const dosiScreen = new THREE.MeshStandardMaterial({ color: '#0b0f19', roughness: 0.3 })
  patchPartMaterial(dosiScreen, u, 'cover')
  const led = new THREE.MeshStandardMaterial({ color: '#0b0f19', emissive: new THREE.Color(LIVE_HEX), emissiveIntensity: 1.4, toneMapped: false })
  patchPartMaterial(led, u, 'cover')
  const tie = part(look.accent, 0.5, 0.1, 'cover')
  const mats = {
    skin, cover, hair, brow, tail, tie, lash, eye, plateSuit, patchSuit, dosi, dosiScreen, led,
    ghostSkin, ghostCover, ghostSuit,
  }
  // Plaquetas e peças pequenas ficam translúcidas no raio-X, sem sumir do lugar
  const chestParts = new Set<THREE.Material>([mats.plateSuit, mats.patchSuit])
  const parts: { m: THREE.Material; base: number; chest: boolean }[] = [
    mats.plateSuit, mats.patchSuit, mats.dosi, mats.dosiScreen, mats.led, mats.tie,
  ].map((m) => ({ m, base: m.opacity, chest: chestParts.has(m) }))
  return { ...mats, parts }
}

type Mats = ReturnType<typeof makeMaterials>

/**
 * Materiais da cabeça fotográfica (headModel.ts): pele com mapa de cor, normal e rugosidade do avatar, cabelo em cartões com
 * alfa e olhos com a córnea brilhante. Passam pelo mesmo shader do corpo (dissolução, raio-X, contorno de status), mas não
 * somem com a varredura do traje: o rosto fica visível dentro do capacete.
 */
function makeHeadMaterials(head: HeadModel, u: BodyUniforms, eyeColor: string) {
  const skin = new THREE.MeshStandardMaterial({
    map: head.color, normalMap: head.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: head.rough, roughness: 1, metalness: 0,
  })
  patchBodyMaterial(skin, u, 'head')
  let hair: THREE.MeshStandardMaterial | null = null
  if (head.hairMap) {
    hair = new THREE.MeshStandardMaterial({ map: head.hairMap, color: new THREE.Color().setScalar(head.hairTint), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 })
    patchBodyMaterial(hair, u, 'headhair')
  }
  // Olhos: esclera, íris e pupila procedurais na cor do astronauta; a córnea é um brilho pequeno e nítido, sem o espelho do
  // ambiente inteiro por cima da íris
  const eye = new THREE.MeshPhysicalMaterial({ map: eyeTexture(eyeColor), roughness: 0.32, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.08, envMapIntensity: 0.3 })
  patchPartMaterial(eye, u, 'fade')
  return { skin, hair, eye }
}

const noRaycast = () => {}

/**
 * Material do traje de EVA: o tecido do modelo (com brilho de tecido), com o shader do corpo (varredura, raio-X,
 * destaque por região). O mapa de especular do arquivo vira metal nos anéis e espelho dourado na viseira, e as
 * listras vermelhas do modelo ganham a cor do astronauta.
 */
function makeSuitMaterial(model: SuitModel, u: BodyUniforms, accent: string) {
  const m = new THREE.MeshPhysicalMaterial({
    map: model.map, bumpMap: model.bump, bumpScale: 1.6, roughness: 0.64, metalness: 0, side: THREE.DoubleSide,
    sheen: 0.5, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffffff'),
  })
  patchBodyMaterial(m, u, 'suit', undefined, true)
  const base = m.onBeforeCompile
  // As listras ficam saturadas mesmo quando o acento do astronauta é quase branco
  const stripe = new THREE.Color(accent)
  const hsl = { h: 0, s: 0, l: 0 }
  stripe.getHSL(hsl)
  stripe.setHSL(hsl.h, Math.max(hsl.s, 0.6), 0.42)
  m.onBeforeCompile = (shader, renderer) => {
    base.call(m, shader, renderer)
    shader.uniforms.uSpec = { value: model.spec }
    shader.uniforms.uAccent = { value: stripe }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uSpec; uniform vec3 uAccent;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 suitSpec = texture2D(uSpec, vMapUv).rgb;
        float suitGold = smoothstep(0.25, 0.6, suitSpec.r) * smoothstep(0.08, 0.35, suitSpec.r - suitSpec.b);
        float suitMetal = smoothstep(0.75, 0.92, min(suitSpec.r, min(suitSpec.g, suitSpec.b))) * (1.0 - suitGold);
        float suitRed = smoothstep(0.22, 0.45, diffuseColor.r - max(diffuseColor.g, diffuseColor.b));
        diffuseColor.rgb = mix(diffuseColor.rgb, uAccent * (0.45 + 1.7 * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), suitRed);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.74, 0.32), suitGold);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.82, 0.86), suitMetal);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = max(metalnessFactor, max(suitGold, suitMetal * 0.9));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.09, suitGold);
        roughnessFactor = mix(roughnessFactor, 0.34, suitMetal);`)
  }
  m.customProgramCacheKey = () => 'body-suit-pos-gear'
  return m
}

/**
 * Visor do capacete: vidro com camada de ouro, semitransparente. O rosto do astronauta aparece por trás, escurecido e dourado,
 * e o ambiente reflete na frente. Passa pelo shader do corpo (varredura, raio-X) como o resto do traje.
 */
function makeVisorMaterial(u: BodyUniforms) {
  const m = new THREE.MeshStandardMaterial({
    color: '#d8b25c', metalness: 0.78, roughness: 0.07, emissive: '#1f1505', emissiveIntensity: 1,
    transparent: true, opacity: 0.24, depthWrite: false, side: THREE.FrontSide, envMapIntensity: 1.7,
  })
  patchBodyMaterial(m, u, 'suit', undefined, true)
  const base = m.customProgramCacheKey
  m.customProgramCacheKey = () => `${base.call(m)}-visor`
  return m
}

// ---------- Peças soltas ----------

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

/** Plaqueta de nome e emblema da missão, colados no peito do traje, na direção da superfície. */
function SuitBadges({ model, mats }: { model: SuitModel; mats: Mats }) {
  const spots = useMemo(() => {
    const mesh = new THREE.Mesh(model.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    const ray = new THREE.Raycaster()
    ;(ray as THREE.Raycaster & { firstHitOnly: boolean }).firstHitOnly = true
    const at = (x: number, y: number) => {
      ray.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1))
      const hit = ray.intersectObject(mesh, false)[0]
      if (!hit || !hit.face) return null
      const n = hit.face.normal.clone().normalize()
      return { p: hit.point.clone().addScaledVector(n, 0.003), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n) }
    }
    return { name: at(-0.15, 1.27), patch: at(0.15, 1.27) }
  }, [model])
  return (
    <group>
      {spots.name && (
        <mesh position={spots.name.p} quaternion={spots.name.q} material={mats.plateSuit}>
          <planeGeometry args={[0.1, 0.031]} />
        </mesh>
      )}
      {spots.patch && (
        <mesh position={spots.patch.p} quaternion={spots.patch.q} material={mats.patchSuit}>
          <circleGeometry args={[0.03, 32]} />
        </mesh>
      )}
    </group>
  )
}

// ---------- Acessórios do macacão ----------

function CoverAccessories({ mats, build, surfaceZ, onRadiation }: {
  mats: Mats; build: BodyVariant['build']; surfaceZ: (x: number, y: number) => number
  onRadiation: (e: ThreeEvent<PointerEvent | MouseEvent>, kind: 'move' | 'out' | 'click') => void
}) {
  const w = (x: number, y: number) => warp(new THREE.Vector3(x, y, 0), build)
  const pD = w(0.222, 1.215)
  const dosiBox = useMemo(() => new RoundedBoxGeometry(0.05, 0.075, 0.02, 3, 0.006), [])
  return (
    <group>
      {/* Dosímetro pessoal: toque para abrir a radiação */}
      <group
        position={[pD.x, 1.215, surfaceZ(pD.x, 1.215) + 0.028]}
        onPointerMove={(e) => onRadiation(e, 'move')}
        onPointerOut={(e) => onRadiation(e, 'out')}
        onClick={(e) => onRadiation(e, 'click')}
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
  /** Físico atual: atrofia muscular, variação de massa e fadiga (vêm das métricas) */
  physique: Physique
  /** Traje de EVA (modelo da NASA); nulo enquanto carrega */
  suitModel: SuitModel | null
  /** Cabeça fotográfica deste astronauta; nula enquanto carrega (então vale a cabeça do atlas) */
  head: HeadModel | null
  /** Giro do corpo em torno do eixo vertical, em radianos: o usuário arrasta para ver o astronauta por todos os lados */
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
  const headMats = useMemo(() => (p.head ? makeHeadMaterials(p.head, u, look.eyes) : null), [p.head, u, look.eyes])
  const hairShells = useMemo(() => (p.head ? makeHairShells(p.head, u) : null), [p.head, u])
  // Gola do macacão: um funil que fecha em volta do pescoço deste astronauta
  const collarGeo = useMemo(() => (variant.collarLoop ? buildCollar(variant.collarLoop, p.head?.neck ?? DEFAULT_NECK, SYS_INDEX.immune) : null), [variant, p.head])
  // As mãos e os punhos do corpo combinam com o tom do rosto da textura
  useEffect(() => {
    if (p.head) mats.skin.color.copy(p.head.avgSkin).multiplyScalar(1.04)
  }, [p.head, mats])
  const group = useRef<THREE.Group>(null)
  const ghost = useRef<THREE.Group>(null)
  const coverMesh = useRef<THREE.Mesh>(null)
  const collarMesh = useRef<THREE.Mesh>(null)
  const yokeMesh = useRef<THREE.Mesh>(null)
  const yokeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#223452', roughness: 0.92, metalness: 0, side: THREE.DoubleSide }), [])
  const suitMesh = useRef<THREE.Mesh>(null)
  // O traje é ajustado a este corpo (pose, tamanho, feminino ou masculino) quando o modelo chega e o navegador está livre
  const [suitReady, setSuitReady] = useState(false)
  useEffect(() => {
    if (!p.suitModel) return
    if (p.suit) {
      setSuitReady(true)
      return
    }
    if ('requestIdleCallback' in window) {
      const h = window.requestIdleCallback(() => setSuitReady(true), { timeout: 4000 })
      return () => window.cancelIdleCallback(h)
    }
    const h = globalThis.setTimeout(() => setSuitReady(true), 1500)
    return () => globalThis.clearTimeout(h)
  }, [p.suitModel, p.suit])
  const suitFit = useMemo(() => (suitReady && p.suitModel ? fitSuit(p.suitModel, look.build) : null), [suitReady, p.suitModel, look.build])
  const suitMat = useMemo(() => (suitFit ? makeSuitMaterial(suitFit, u, look.accent) : null), [suitFit, u, look.accent])
  const visorMat = useMemo(() => (suitFit?.visor ? makeVisorMaterial(u) : null), [suitFit, u])
  const visorMesh = useRef<THREE.Mesh>(null)
  const headGroup = useRef<THREE.Group>(null)
  const headGhost = useRef<THREE.Group>(null)
  const headAnchor = useRef<THREE.Object3D>(null)
  const state = useRef({ suit: p.suit ? 1 : 0, sel: 0, reveal: 0, xray: 0, fade: p.fadeTarget, turn: 0, hoverScale: 1 })
  const pickRef = useRef<THREE.Mesh>(null)

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
  useEffect(() => {
    u.uEyeC.value.copy(eyes[0])
    // Sombra de barba só no rosto masculino, mais forte com cabelo escuro
    u.uBeard.value = look.build === 'male' ? 0.34 - 0.22 * new THREE.Color(look.hair).getHSL({ h: 0, s: 0, l: 0 }).l : 0
  }, [eyes, u, look.build, look.hair])
  const tailRoot = useMemo(() => warp(PONYTAIL_ROOT.clone(), look.build), [look.build])

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
    if (!p.focused || p.suit) return
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
    if (!p.focused || p.suit) return
    e.stopPropagation()
    const s = sysAt(e)
    if (s) p.onPickSys(s)
  }
  const direct = (sys: SystemId) => ({
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (p.lineup) return onBodyMove(e)
      if (!p.focused || p.suit) return
      e.stopPropagation()
      p.onHoverSys(sys)
      setCursor('pointer')
    },
    onPointerOut: onBodyOut,
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (p.lineup) return onBodyClick(e)
      if (e.delta > 6 || !p.focused || p.suit) return
      e.stopPropagation()
      p.onPickSys(sys)
    },
  })
  // Traje vestido: sem clique nem destaque por região (o corpo por dentro não acompanha o traje); só a visão padrão fica,
  // por isso os manipuladores do traje, do visor e do dosímetro ficam inertes enquanto `p.suit`.
  const suitSys = (e: ThreeEvent<PointerEvent | MouseEvent>): SystemId | null => {
    const geo = suitFit?.geometry
    if (!geo || e.faceIndex == null) return null
    const v = geo.index!.getX(e.faceIndex * 3)
    return SYS_BY_INDEX[Math.round((geo.getAttribute('aSys') as THREE.BufferAttribute).getX(v))]
  }
  // O vidro do visor fica sobre os olhos: abre neuro-ocular
  const onVisorMove = (e: ThreeEvent<PointerEvent>) => {
    if (p.suit || state.current.suit < 0.6 || p.lineup || !p.focused) return
    e.stopPropagation()
    p.onHoverSys('neuro_ocular')
    setCursor('pointer')
  }
  const onVisorClick = (e: ThreeEvent<MouseEvent>) => {
    if (p.suit || state.current.suit < 0.6 || e.delta > 6 || p.lineup || !p.focused) return
    e.stopPropagation()
    p.onPickSys('neuro_ocular')
  }
  const onSuitMove = (e: ThreeEvent<PointerEvent>) => {
    if (p.suit || state.current.suit < 0.6 || p.lineup || !p.focused) return
    e.stopPropagation()
    const s = suitSys(e)
    p.onHoverSys(s)
    setCursor(s ? 'pointer' : 'default')
  }
  const onSuitClick = (e: ThreeEvent<MouseEvent>) => {
    if (p.suit || state.current.suit < 0.6 || e.delta > 6 || p.lineup || !p.focused) return
    e.stopPropagation()
    const s = suitSys(e)
    if (s) p.onPickSys(s)
  }

  // O dosímetro do braço abre a radiação e tem prioridade sobre o corpo. O estado da radiação
  // também fica no botão "Radiation" do dock, já que não há mais aura em volta do corpo.
  const radiation = (e: ThreeEvent<PointerEvent | MouseEvent>, kind: 'move' | 'out' | 'click') => {
    if (p.lineup || !p.focused || p.suit) return
    if (kind === 'out') return onBodyOut()
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
    const suitTarget = p.suit && suitFit ? 1 : 0
    const step = dt / 1.7
    st.suit = suitTarget > st.suit ? Math.min(suitTarget, st.suit + step) : Math.max(suitTarget, st.suit - step)
    u.uSuitY.value = -0.1 + st.suit * 2.2 * p.heightScale
    // Só desenha a casca que aparece: o macacão some por baixo do traje e o traje some sem ele
    if (suitMesh.current) suitMesh.current.visible = st.suit > 0.001
    if (visorMesh.current) visorMesh.current.visible = st.suit > 0.001
    // Dentro do capacete a cabeça sobe e avança até ficar atrás do vidro; só depois da varredura passar pelo pescoço, para não
    // aparecer um pescoço esticado acima da gola
    if (headGroup.current) {
      // No raio-X ela volta ao lugar anatômico, onde está o crânio da anatomia
      const up = THREE.MathUtils.smoothstep(st.suit, 0.74, 1.0) * (1 - st.xray)
      headGroup.current.position.set(0, (HEAD_IN_HELMET.lift * up) / NORM_SCALE, (HEAD_IN_HELMET.forward * up) / NORM_SCALE)
    }
    // Com o traje fechado e fora do raio-X, a gola do macacão continua por dentro do capacete e sobe junto com a cabeça
    // (o pescoço mantém o comprimento normal); o resto do corpo fica escondido pelo traje
    const inner = st.suit > 0.999 && st.xray < 0.05
    u.uInner.value = inner ? 1 : 0
    const collarUp = inner ? HEAD_IN_HELMET.lift / NORM_SCALE : 0
    // O macacão some por baixo do traje (o tórax não pode atravessá-lo); ficam o funil da gola e a canga dos ombros
    if (coverMesh.current) coverMesh.current.visible = st.suit < 0.999
    if (yokeMesh.current) {
      yokeMesh.current.visible = inner
      yokeMesh.current.position.set(0, YOKE.y + collarUp, YOKE.z)
    }
    if (collarMesh.current) { collarMesh.current.visible = st.suit < 0.999 || inner; collarMesh.current.position.y = collarUp }

    // Dissolução da região selecionada
    // Com o traje vestido não há dissolução por região: só a visão padrão
    const sel = p.suit ? null : selected
    const wantSel = sel && sel !== 'radiation' ? SYS_INDEX[sel] : 0
    const wantReveal = sel && sel !== 'radiation' && sel !== 'neuro_ocular' ? 1 : 0
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
    if (ghost.current) ghost.current.visible = st.xray >= 0.01
    if (headGhost.current) headGhost.current.visible = st.xray >= 0.01
    // Peças duras do traje: translúcidas no raio-X
    const solid = 1 - 0.86 * st.xray
    // A plaqueta de nome e o emblema ficam no peito: somem junto com a região quando o peito se abre
    const chestOpen = st.sel === SYS_INDEX.cardiovascular ? st.reveal : 0
    for (const { m, base, chest } of mats.parts) {
      const k = chest ? solid * (1 - 0.98 * chestOpen) : solid
      m.opacity = base * k
      m.transparent = base < 1 || k < 0.995
      m.depthWrite = base >= 1 && k > 0.6
      m.visible = k > 0.01
    }
    // Físico: atrofia e massa mudam o corpo, a fadiga muda a pele
    u.uAtro.value += (p.physique.atrophy - u.uAtro.value) * k(2.2)
    u.uMassD.value += (THREE.MathUtils.clamp(p.physique.mass, -0.12, 0.12) - u.uMassD.value) * k(2.2)
    u.uFatigue.value += (p.physique.fatigue - u.uFatigue.value) * k(2.2)
    st.fade += (p.fadeTarget - st.fade) * k(3)
    u.uFade.value = st.fade < 0.01 ? 0 : st.fade
    u.uHover.value = p.focused && p.hoverSys ? SYS_INDEX[p.hoverSys] : 0
    u.uStatScale.value += ((p.lineup ? 0.45 : 0.6) - u.uStatScale.value) * k(4)

    // Vida: respiração, flutuação e giro suave em direção ao cursor
    if (group.current) {
      const still = calm()
      const x = p.xs.current[astro.id]
      // Pés plantados no piso: sem flutuar. O balanço de peso gira o corpo em torno dos pés e a respiração é feita no shader.
      group.current.position.set(x, 0, 0)
      group.current.visible = st.fade < 0.98
      // Na formação o corpo acompanha o cursor; em foco, parado (quem gira é a câmera)
      const target = p.lineup ? -pointer.x * 0.18 : 0
      st.turn += (target - st.turn) * k(3)
      group.current.rotation.y = (still ? 0 : st.turn + Math.sin(t * 0.35 + x) * 0.025)
      group.current.rotation.z = still ? 0 : Math.sin(t * 0.41 + x * 1.3) * 0.0045
      // Respiração: ~13 por minuto, cada astronauta em uma fase
      u.uBreath.value = still ? 0 : 0.5 - 0.5 * Math.cos((t / 4.6 + x * 0.37) * Math.PI * 2)
      const hs = st.hoverScale + ((p.hovered ? 1.035 : 1) - st.hoverScale) * k(8)
      st.hoverScale = hs
      group.current.scale.set(p.widthScale * hs, p.heightScale * hs, p.widthScale * hs)
    }
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
        {!p.head && <mesh geometry={variant.head} material={mats.skin} frustumCulled={false} />}
        <mesh ref={coverMesh} geometry={variant.cover} material={mats.cover} frustumCulled={false} />
        {collarGeo && <mesh ref={collarMesh} geometry={collarGeo} material={mats.cover} frustumCulled={false} />}
        <mesh ref={yokeMesh} material={yokeMat} scale={[YOKE.rx, YOKE.ry, YOKE.rz]} visible={false} frustumCulled={false} raycast={noRaycast}>
          <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* Fantasma do raio-X: o corpo sólido se dissolve e esta casca de luz fica no lugar */}
        <group ref={ghost} visible={false}>
          <mesh geometry={variant.skin} material={mats.ghostSkin} frustumCulled={false} renderOrder={6} />
          {!p.head && <mesh geometry={variant.head} material={mats.ghostSkin} frustumCulled={false} renderOrder={6} />}
          <mesh geometry={variant.cover} material={mats.ghostCover} frustumCulled={false} renderOrder={6} />
          <mesh geometry={variant.suit} material={mats.ghostSuit} frustumCulled={false} renderOrder={6} />
        </group>
        {p.head && headMats ? (
          <group ref={headGroup}>
            {/* O clique e o hover passam para a malha invisível do corpo (pick), que tem a mesma forma de cabeça */}
            <mesh geometry={p.head.skin} material={headMats.skin} frustumCulled={false} raycast={noRaycast} />
            <mesh geometry={p.head.eyes} material={headMats.eye} frustumCulled={false} raycast={noRaycast} />
            {hairShells && <primitive object={hairShells} />}
            {p.head.hair && headMats.hair && <mesh geometry={p.head.hair} material={headMats.hair} frustumCulled={false} raycast={noRaycast} />}
            <group ref={headGhost} visible={false}>
              <mesh geometry={p.head.skin} material={mats.ghostSkin} frustumCulled={false} renderOrder={6} />
            </group>
          </group>
        ) : (
          <>
          <mesh geometry={variant.hair} material={mats.hair} frustumCulled={false} userData={{ body: true }} {...hairDirect} />
          {variant.tail && (
            <>
              <mesh geometry={variant.tail} material={mats.tail} frustumCulled={false} userData={{ body: true }} {...hairDirect} />
              <Ring center={new THREE.Vector3(tailRoot.x, tailRoot.y + 0.002, tailRoot.z - 0.006)} dir={new THREE.Vector3(0, -0.45, -1)} radius={0.019} tube={0.0065} material={mats.tie} />
            </>
          )}
          <mesh geometry={variant.brows} material={mats.brow} frustumCulled={false} userData={{ body: true }} {...browDirect} />
          <mesh geometry={variant.lashes} material={mats.lash} frustumCulled={false} />

          {eyes.map((e, i) => (
            <mesh key={i} position={e} material={mats.eye} userData={{ body: true }} {...eyeDirect}>
              <sphereGeometry args={[BODY_POINTS.eyeRadius, 48, 32]} />
            </mesh>
          ))}
          </>
        )}

        <CoverAccessories mats={mats} build={look.build} surfaceZ={surfaceZ} onRadiation={radiation} />
        {p.children}
      </group>

      {/* Traje de EVA (Z-2, NASA): fora do grupo do corpo, em metros, pés no chão */}
      {suitFit && suitMat && (
        <>
          <mesh
            ref={suitMesh}
            geometry={suitFit.geometry}
            material={suitMat}
            frustumCulled={false}
            visible={false}
            userData={{ body: true }}
            onPointerMove={onSuitMove}
            onPointerOut={onBodyOut}
            onClick={onSuitClick}
          />
          {suitFit.visor && visorMat && (
            <mesh
              ref={visorMesh}
              geometry={suitFit.visor}
              material={visorMat}
              frustumCulled={false}
              visible={false}
              renderOrder={8}
              userData={{ body: true }}
              onPointerMove={onVisorMove}
              onPointerOut={onBodyOut}
              onClick={onVisorClick}
            />
          )}
          <SuitBadges model={suitFit} mats={mats} />
        </>
      )}

      <object3D ref={headAnchor} position={[0, 2.0, 0]} />
    </group>
  )
}

/**
 * Chão sob o astronauta: uma sombra de contato bem suave (ancora o corpo no convés) e, por cima, um brilho
 * quase imperceptível na cor do status. Sem anéis nem borda: nada que chame mais atenção que o astronauta.
 */
export function Halo({ status, active, hot }: { status: Status; active: boolean; hot: boolean }) {
  const wash = useRef<THREE.MeshBasicMaterial>(null)
  const color = status === 'nominal' ? '#b9c8e6' : STATUS_HEX[status]
  useFrame(({ clock }) => {
    const breathe = calm() ? 1 : 0.88 + 0.12 * Math.sin(clock.elapsedTime * 0.9)
    const base = status === 'nominal' ? 0.035 : 0.075
    if (wash.current) wash.current.opacity = base * breathe * (hot || active ? 1.25 : 1)
  })
  return (
    <group position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh renderOrder={1}>
        <circleGeometry args={[0.7, 48]} />
        <meshBasicMaterial map={contactShadowTexture()} color="#000000" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh renderOrder={2}>
        <circleGeometry args={[1.25, 48]} />
        <meshBasicMaterial ref={wash} map={glowTexture()} color={color} transparent opacity={0.04} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}
