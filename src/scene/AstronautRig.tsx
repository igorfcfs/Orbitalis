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
import { buildCollar, DEFAULT_NECK, NECK_AXIS, scaleLoop } from './collar'
import { makeHairShells } from './hairShells'
import { createTether } from './tether'
import type { HeadModel } from './headModel'
import { HEAD_IN_HELMET, fitSuit, type SuitModel } from './suitModel'
import { LegPoseContext, SEAT_HIP, SEAT_KNEE, ensureLegWeights, legJoints, reclineFrame, seatedPick } from './legPose'
import type { Posture } from '../data/scenarios'

/**
 * Com o traje fechado o próprio macacão do astronauta (ombros, peito, costas) aparece pelo visor, mas encolhido em torno do
 * eixo do pescoço (`INNER_FIT`) e elevado com a cabeça: assim cabe dentro do traje sem atravessá-lo. A gola dessa versão sai de
 * um laço também encolhido, com o anel do pescoço na medida da pele.
 */
const INNER_FIT = 0.7
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
  // Piscar e olhar: a pálpebra de cima desce sobre o globo (a abertura passa a ter a cor da pele) e a íris desliza pela esfera
  // (deslocamento do UV: a textura é mapeada como a SphereGeometry, uma volta = 2π em U e π em V). O globo é uma esfera fina,
  // então o deslocamento lê como o olho girando dentro da órbita.
  if (!head.eyes.boundingBox) head.eyes.computeBoundingBox()
  const box = head.eyes.boundingBox!
  const blink = { uBlink: { value: 0 }, uGaze: { value: new THREE.Vector2() }, uLid: { value: head.avgSkin.clone().multiplyScalar(0.72) }, uEyeY: { value: new THREE.Vector2(box.min.y, box.max.y) } }
  const base = eye.onBeforeCompile
  eye.onBeforeCompile = (shader, renderer) => {
    base.call(eye, shader, renderer)
    Object.assign(shader.uniforms, blink)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vEyeY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyeY = position.y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBlink; uniform vec2 uGaze; uniform vec3 uLid; uniform vec2 uEyeY; varying float vEyeY;')
      .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('vMapUv )', 'vMapUv - vec2(uGaze.x * 0.159, uGaze.y * 0.318) )') + `
        float lidEdge = mix(uEyeY.y + 0.003, uEyeY.x - 0.001, uBlink);
        diffuseColor.rgb = mix(diffuseColor.rgb, uLid, smoothstep(lidEdge - 0.0015, lidEdge + 0.0015, vEyeY));`)
  }
  eye.customProgramCacheKey = () => 'head-eye-blink'
  return { skin, hair, eye, blink }
}

const noRaycast = () => {}

/** Semente estável por astronauta e ruído determinístico em [0, 1): cada um pisca, olha e balança em tempos próprios */
/**
 * Passos lentos e saltos em 1/6 g, num ciclo de 11 s: um passo com cada perna (a coxa sobe e a canela volta), uma pausa e um
 * salto pequeno. O salto é uma parábola de verdade com a gravidade lunar (1,62 m/s²): 18 cm de altura ficam 0,94 s no ar,
 * contra 0,38 s na Terra. Os braços sobem um pouco no ar (`arms`, rad; negativo = para a frente). `crouch` é quanto o quadril desce no agachamento (unidades do atlas), `lift` a altura do salto (m).
 */
const G_MOON = 1.62
const HOP_H = 0.18
const HOP_V = Math.sqrt(2 * G_MOON * HOP_H)
const HOP_T = (2 * HOP_V) / G_MOON
const THIGH = 0.472
const SHIN = 0.443
export function lunarGait(t: number) {
  const tau = ((t % 11) + 11) % 11
  const out = { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, lift: 0, crouch: 0, roll: 0, arms: 0 }
  const step = (a: number) => (a > 0 && a < 1.8 ? Math.sin((Math.PI * a) / 1.8) : 0)
  const eL = step(tau - 0.5)
  const eR = step(tau - 2.7)
  out.hipL = 0.48 * eL
  out.kneeL = 0.9 * eL
  out.hipR = 0.48 * eR
  out.kneeR = 0.9 * eR
  // O peso passa para a perna de apoio
  out.roll = 0.018 * (eR - eL)
  const a = tau - 6.5
  let c = 0
  if (a > 0 && a < 0.4) c = Math.sin((Math.PI / 2) * (a / 0.4))
  else if (a >= 0.4 && a < 0.4 + HOP_T) {
    const f = a - 0.4
    out.lift = HOP_V * f - 0.5 * G_MOON * f * f
    c = Math.max(0, 1 - f / 0.12) * 0.6 + 0.12
  } else if (a >= 0.4 + HOP_T && a < 0.9 + HOP_T) c = 0.75 * Math.sin((Math.PI * (a - 0.4 - HOP_T)) / 0.5)
  const ah = 0.38 * c
  const ak = 0.8 * c
  out.hipL += ah
  out.hipR += ah
  out.kneeL += ak
  out.kneeR += ak
  out.crouch = THIGH * (1 - Math.cos(ah)) + SHIN * (1 - Math.cos(ak - ah))
  out.arms = -1.1 * out.lift - 0.08 * c
  return out
}

function seedOf(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return h
}
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const tmpV = new THREE.Vector3()
const bodyE = new THREE.Euler()
const tetherStart = new THREE.Vector3()
const headQ = new THREE.Quaternion()
const headE = new THREE.Euler()
const headP = new THREE.Vector3()
const headR = new THREE.Vector3()

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
  /** Fora do casco, no vácuo: só aqui o astronauta flutua e o cabo de segurança aparece (dentro da estação os pés ficam no piso) */
  space: boolean
  /** Postura do lugar (RF-33): deitado de costas no assento da cápsula, de pé na estação ou de pé em 1/6 g na Lua */
  posture: Posture
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
  /** Deita o corpo de costas no assento do foguete (gira em torno do quadril) */
  const recline = useRef<THREE.Group>(null)
  const ghost = useRef<THREE.Group>(null)
  const coverMesh = useRef<THREE.Mesh>(null)
  const collarMesh = useRef<THREE.Mesh>(null)
  const collarInnerGeo = useMemo(
    () => (variant.collarLoop ? buildCollar(scaleLoop(variant.collarLoop, INNER_FIT), p.head?.neck ?? DEFAULT_NECK, SYS_INDEX.immune) : null),
    [variant, p.head],
  )
  const collarInnerMesh = useRef<THREE.Mesh>(null)
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
  const state = useRef({
    suit: p.suit ? 1 : 0, sel: 0, reveal: 0, xray: 0, fade: p.fadeTarget, turn: 0, hoverScale: 1,
    // vida: cabeça (giro e inclinação), olhar, piscar e troca de peso
    yaw: 0, pitch: 0, gx: 0, gv: 0, blinkT: -1, nextBlink: 1.5, shift: 0, space: 0, tether: 0,
    seat: p.posture === 'supine' ? 1 : 0, lunar: p.posture === 'lunar' ? 1 : 0,
  })
  // Cabo de segurança: corda simulada entre um ponto do cinto do traje e o casco
  const tether = useMemo(() => createTether(new THREE.MeshStandardMaterial({ color: '#d9dfec', roughness: 0.55, transparent: true, opacity: 0 })), [])
  useEffect(() => () => tether.dispose(), [tether])
  const tetherAnchor = useRef<THREE.Object3D>(null)
  const seed = useMemo(() => seedOf(astro.id), [astro.id])
  const pickRef = useRef<THREE.Mesh>(null)
  // Pernas: pesos por vértice (uma vez por geometria) e as juntas deste corpo
  useMemo(() => {
    for (const g of [variant.skin, variant.cover, variant.suit, variant.pick]) ensureLegWeights(g, look.build)
  }, [variant, look.build])
  const hipJ = useMemo(() => legJoints(look.build).hip, [look.build])
  useEffect(() => {
    const j = legJoints(look.build)
    u.uHipJ.value.copy(j.hip)
    u.uKneeJ.value.copy(j.knee)
  }, [u, look.build])
  // Deitado no assento, o clique vai para uma cópia da malha invisível com as pernas já dobradas (o giro do corpo vem do grupo)
  const seated = p.posture === 'supine'
  const pickGeo = useMemo(() => (seated ? seatedPick(variant.pick, look.build) : variant.pick), [seated, variant, look.build])

  // BVH para o clique por região
  useLayoutEffect(() => {
    bvhFor(pickGeo)
  }, [pickGeo])

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
    const geo = pickGeo
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
  // fica na lista de sistemas ao lado do corpo, como o dos outros sistemas (não há aura em volta do corpo).
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

  useFrame(({ clock, pointer, camera }, dt) => {
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
    const still = calm()
    // A anatomia por baixo não se mexe: com o raio-X ou uma região aberta o astronauta fica quieto para a pele e os órgãos coincidirem
    const live = still ? 0 : 1 - Math.max(st.xray, st.reveal)
    if (headGroup.current) {
      // No raio-X ela volta ao lugar anatômico, onde está o crânio da anatomia
      const up = THREE.MathUtils.smoothstep(st.suit, 0.74, 1.0) * (1 - st.xray)
      // Vida na cabeça: gira no pescoço, olha para a câmera, troca o olhar de vez em quando e respira junto com o tórax. Dentro do
      // capacete a amplitude cai pela metade (o vidro e a gola limitam).
      const amp = live * (1 - 0.5 * st.suit)
      const ep = Math.floor(t / 4.7 + seed * 0.13)
      const glance = rnd(ep * 7.7 + seed) > 0.4 ? 1 : 0
      const gy = (rnd(ep * 3.1 + seed) - 0.5) * 0.5 * glance
      const gp = (rnd(ep * 5.3 + seed) - 0.5) * 0.18 * glance
      const cam = group.current ? group.current.worldToLocal(tmpV.copy(camera.position)) : tmpV.set(0, 1.6, 4)
      const camYaw = Math.atan2(cam.x, cam.z)
      const toCam = THREE.MathUtils.smoothstep(Math.abs(camYaw), 1.9, 1.2)
      const camPitch = -Math.atan2(cam.y - 1.65, Math.hypot(cam.x, cam.z))
      const wantYaw = (camYaw * 0.4 * toCam + gy) * amp + 0.03 * Math.sin(t * 0.37 + seed) * amp
      const wantPitch = (camPitch * 0.3 * toCam + gp) * amp + 0.02 * Math.sin(t * 0.23 + seed * 2) * amp
      const lim = 0.35 * (1 - 0.35 * st.suit)
      st.yaw += (THREE.MathUtils.clamp(wantYaw, -lim, lim) - st.yaw) * k(2.6)
      st.pitch += (THREE.MathUtils.clamp(wantPitch, -0.2, 0.2) - st.pitch) * k(2.6)
      // Os olhos chegam antes da cabeça: o que falta para a cabeça alcançar o alvo vira o olhar, mais um tremor de sacada
      const sac = Math.floor(t * 1.15 + seed)
      const gx = THREE.MathUtils.clamp((wantYaw - st.yaw) * 1.6, -0.2, 0.2) + (rnd(sac * 2.3 + seed) - 0.5) * 0.06 * amp
      const gv = THREE.MathUtils.clamp((wantPitch - st.pitch) * 1.6, -0.12, 0.12) + (rnd(sac * 4.1 + seed) - 0.5) * 0.04 * amp
      st.gx += (gx - st.gx) * k(14)
      st.gv += (gv - st.gv) * k(14)
      const breath = u.uBreath.value
      headQ.setFromEuler(headE.set(st.pitch - 0.012 * breath * live, st.yaw, -0.005 * st.shift * live, 'YXZ'))
      const neck = p.head?.neck ?? DEFAULT_NECK
      headP.set(neck.cx, 1.49, neck.cz)
      headR.copy(headP).applyQuaternion(headQ)
      headGroup.current.quaternion.copy(headQ)
      headGroup.current.position.set(
        headP.x - headR.x,
        headP.y - headR.y + (HEAD_IN_HELMET.lift * up) / NORM_SCALE + 0.0035 * breath * live,
        headP.z - headR.z + (HEAD_IN_HELMET.forward * up) / NORM_SCALE,
      )
      if (headMats) {
        // Piscar: ~15 por minuto, de vez em quando duas seguidas; uns 170 ms
        let b = 0
        if (!still) {
          if (st.blinkT < 0 && t > st.nextBlink) st.blinkT = t
          if (st.blinkT >= 0) {
            const e = (t - st.blinkT) / 0.17
            if (e >= 1) {
              st.blinkT = -1
              st.nextBlink = t + (rnd(t * 13.7 + seed) < 0.2 ? 0.2 : 2.4 + rnd(t * 3.3 + seed) * 4.6)
            } else {
              b = e < 0.4 ? e / 0.4 : 1 - (e - 0.4) / 0.6
              b = b * b * (3 - 2 * b)
            }
          }
        }
        headMats.blink.uBlink.value = b
        headMats.blink.uGaze.value.set(st.gx, st.gv)
      }
    }
    // Com o traje fechado e fora do raio-X, a gola do macacão continua por dentro do capacete e sobe junto com a cabeça
    // (o pescoço mantém o comprimento normal); o resto do corpo fica escondido pelo traje
    const inner = st.suit > 0.999 && st.xray < 0.05
    u.uInner.value = inner ? 1 : 0
    const collarUp = inner ? HEAD_IN_HELMET.lift / NORM_SCALE : 0
    // Dentro do traje o macacão encolhe em torno do pescoço e sobe com a cabeça, com a gola encolhida junto
    if (coverMesh.current) {
      coverMesh.current.visible = st.suit < 0.999 || inner
      coverMesh.current.scale.set(inner ? INNER_FIT : 1, 1, inner ? INNER_FIT : 1)
      coverMesh.current.position.set(inner ? NECK_AXIS.x * (1 - INNER_FIT) : 0, collarUp, inner ? NECK_AXIS.z * (1 - INNER_FIT) : 0)
    }
    if (collarMesh.current) collarMesh.current.visible = st.suit < 0.999
    if (collarInnerMesh.current) collarInnerMesh.current.visible = inner && st.suit > 0.999
    if (collarInnerMesh.current) collarInnerMesh.current.position.y = collarUp

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
      const x = p.xs.current[astro.id]
      // Troca de peso: a cada ~9 s o corpo passa o peso para o outro pé (inclina uns 0,7° e a cabeça compensa)
      const wep = Math.floor(t / 9 + seed * 0.07)
      st.shift += (Math.round((rnd(wep * 2.9 + seed) - 0.5) * 2) - st.shift) * k(0.8)
      // Braços soltos balançam com a respiração e com a troca de peso, defasados; a mão é o que mais se mexe
      // Com o traje, fora do casco: microgravidade. O corpo inteiro flutua e gira devagar em torno do centro de massa, os braços
      // sobem à frente (ângulo negativo = braço para cima) e derivam, e as pernas pendem soltas e se abrem.
      st.space += ((p.space && p.suit && suitFit ? 1 : 0) - st.space) * k(1.1)
      const fl = st.space * live
      // Postura do lugar: deitado de costas no assento (foguete) ou os passos lentos e saltos de 1/6 g (Lua). Com o raio-X ou
      // uma região aberta, a pose deitada fica (a anatomia gira junto) e o passo lunar para.
      // A troca de lugar acontece por trás do véu: a postura muda de uma vez, sem o corpo levantar ou deitar na frente do usuário
      st.seat = p.posture === 'supine' ? 1 : 0
      st.lunar = p.posture === 'lunar' ? 1 : 0
      const gait = lunarGait(t + seed * 3.1)
      const lw = st.lunar * live
      const sitH = SEAT_HIP * st.seat
      const sitK = SEAT_KNEE * st.seat
      u.uLegPose.value.set(sitH + lw * gait.hipL, sitH + lw * gait.hipR, sitK + lw * gait.kneeL, sitK + lw * gait.kneeR)
      const lunarArms = lw * gait.arms
      const sw = (o: number) =>
        (0.03 * Math.sin(t * 0.71 + seed + o) + 0.014 * Math.sin(t * 1.9 + seed * 1.3 + o * 2) + 0.018 * u.uBreath.value + 0.02 * st.shift) * live +
        fl * (-0.16 + 0.14 * Math.sin(t * 0.43 + seed + o) + 0.06 * Math.sin(t * 0.97 + seed * 2 + o))
      const lie = 1 - 0.85 * st.seat
      u.uSway.value.set(sw(0) * lie, sw(2.4) * lie)
      if (lunarArms) u.uSway.value.addScalar(lunarArms)
      u.uLegs.value.set(
        fl * (0.1 + 0.11 * Math.sin(t * 0.39 + seed * 1.1) + 0.04 * Math.sin(t * 0.88 + seed)) - lw * gait.hipL,
        fl * (0.1 + 0.11 * Math.sin(t * 0.39 + seed * 1.1 + 2.1) + 0.04 * Math.sin(t * 0.88 + seed + 1.3)) - lw * gait.hipR,
        0,
      )
      // Cada perna se abre para o lado e dobra o joelho no seu próprio ritmo (como a pose relaxada de quem flutua)
      u.uLegs2.value.set(
        fl * (0.14 + 0.12 * Math.sin(t * 0.33 + seed * 0.9)),
        fl * (0.14 + 0.12 * Math.sin(t * 0.33 + seed * 0.9 + 2.4)),
        fl * (0.22 + 0.2 * Math.sin(t * 0.47 + seed * 1.4 + 1)) + lw * gait.kneeL,
        fl * (0.22 + 0.2 * Math.sin(t * 0.47 + seed * 1.4 + 3.3)) + lw * gait.kneeR,
      )
      group.current.visible = st.fade < 0.98
      // Na formação o corpo acompanha o cursor; em foco, parado (quem gira é a câmera)
      // Deitado, o corpo não gira no assento
      const target = p.lineup ? -pointer.x * 0.18 * (1 - st.seat) : 0
      st.turn += (target - st.turn) * k(3)
      group.current.rotation.x = fl * (0.09 * Math.sin(t * 0.27 + seed) + 0.03 * Math.sin(t * 0.71 + seed * 2))
      group.current.rotation.y = (still ? 0 : st.turn + Math.sin(t * 0.35 + x) * 0.025 * (1 - st.seat)) + fl * 0.16 * Math.sin(t * 0.17 + seed)
      group.current.rotation.z = (still ? 0 : Math.sin(t * 0.41 + x * 1.3) * 0.0045 + 0.012 * st.shift * live * (1 - st.seat) + fl * 0.07 * Math.sin(t * 0.21 + seed * 1.3)) + lw * gait.roll
      // Pés plantados no piso na baia (o balanço de peso gira o corpo em torno dos pés); em microgravidade a rotação é em torno da
      // cintura e o corpo sobe e deriva, como se estivesse preso só pelo cabo
      bodyE.copy(group.current.rotation)
      tmpV.set(0, 0.95, 0).applyEuler(bodyE)
      const c = Math.min(1, fl * 8)
      // Na Lua o corpo sobe no salto (m) e desce no agachamento
      const unit = NORM_SCALE * p.heightScale
      group.current.position.set(
        x + fl * 0.05 * Math.sin(t * 0.23 + seed * 1.7) - c * tmpV.x,
        fl * (0.02 + 0.07 * Math.sin(t * 0.37 + seed) + 0.03 * Math.sin(t * 0.93 + seed * 2)) + c * (0.95 - tmpV.y)
          + lw * (gait.lift - gait.crouch * unit),
        fl * 0.04 * Math.sin(t * 0.19 + seed * 0.6) - c * tmpV.z,
      )
      // No foguete o corpo inteiro deita de costas, girando em torno do quadril até o ponto do assento
      if (recline.current) {
        const rf = reclineFrame(st.seat, hipJ.y * unit, hipJ.z * NORM_SCALE * p.widthScale)
        recline.current.rotation.x = rf.rotX
        recline.current.position.set(0, rf.y, rf.z)
      }
      // O cabo acompanha o cinto do traje, já na posição deste quadro
      // O cabo só existe com o traje vestido no vácuo: ao tirar o traje (ou na baia) ele some primeiro, num esmaecer rápido, sem
      // esperar a flutuação terminar de assentar
      const wantTether = p.space && p.suit && suitFit && st.fade < 0.98
      st.tether += ((wantTether ? 1 : 0) - st.tether) * k(wantTether ? 3 : 18)
      ;(tether.mesh.material as THREE.MeshStandardMaterial).opacity = st.tether
      tether.mesh.visible = st.tether > 0.02
      if (!tether.mesh.visible && !wantTether) tether.reset()
      if (tether.mesh.visible && tetherAnchor.current) {
        group.current.updateMatrixWorld(true)
        tetherAnchor.current.getWorldPosition(tetherStart)
        tether.step(tetherStart, dt, t, still)
      }
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
    <>
    <group ref={recline}>
    <group ref={group} dispose={null}>
      <group scale={NORM_SCALE}>
        {/* Clique por região: corpo inteiro, invisível */}
        <mesh
          ref={pickRef}
          geometry={pickGeo}
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
        {collarInnerGeo && <mesh ref={collarInnerMesh} geometry={collarInnerGeo} material={mats.cover} visible={false} frustumCulled={false} raycast={noRaycast} />}
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
        <LegPoseContext.Provider value={u.uLegPose}>{p.children}</LegPoseContext.Provider>
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
      {/* Ponto do cinto onde o cabo prende (m, no espaço do traje) */}
      <object3D ref={tetherAnchor} position={[0.16, 1.04, -0.22]} />
    </group>
    </group>
    <primitive object={tether.mesh} />
    </>
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
