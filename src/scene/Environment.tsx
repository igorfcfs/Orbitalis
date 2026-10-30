import { useFrame } from '@react-three/fiber'
import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { tex } from './assets'
import { bagTexture, crinkleBump, deckTextures, glowTexture, hullTexture, noiseBump, rackAtlas, screenTexture, solarTexture, starTexture } from './textures'

/**
 * Cenário: a baia médica de um módulo da nave (racks, dutos, luminárias, escotilha, telas)
 * com uma janela para Marte, e o lado de fora do casco para a atividade extraveicular (EVA).
 * Marte e a Via Láctea vêm de imagens reais (ver public/assets/ATTRIBUTION.md).
 */

const stillMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const rand = (seed: number) => {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- Céu ----------

const SKY_GAIN = new THREE.Color(2.6, 2.6, 2.9)

/** `scan` (0–1) escurece a janela quando o raio-X está ligado, para a anatomia aparecer mais. */
export type Scan = { current: number }

export function Stars({ scan }: { scan: Scan }) {
  const milky = useMemo(() => tex('milkyway', { srgb: true, anisotropy: 8 }), [])
  const sharp = useMemo(() => starTexture(), [])
  const sky = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => sky.current?.color.copy(SKY_GAIN).multiplyScalar(1 - 0.6 * scan.current))
  return (
    <group rotation={[0.38, 2.5, 0.55]}>
      <mesh renderOrder={-101} frustumCulled={false}>
        <sphereGeometry args={[170, 64, 32]} />
        <meshBasicMaterial ref={sky} map={milky} color={SKY_GAIN} side={THREE.BackSide} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <mesh renderOrder={-100} frustumCulled={false}>
        <sphereGeometry args={[165, 48, 24]} />
        <meshBasicMaterial map={sharp} side={THREE.BackSide} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} opacity={0.9} />
      </mesh>
    </group>
  )
}

const planetVertex = /* glsl */ `
  varying vec3 vNW; varying vec3 vV; varying vec2 vUv;
  void main(){
    vUv = uv;
    vNW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`
const planetFragment = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uLight; uniform float uDim;
  varying vec3 vNW; varying vec3 vV; varying vec2 vUv;
  void main(){
    vec3 N = normalize(vNW);
    vec3 V = normalize(vV);
    float ndl = dot(N, normalize(uLight));
    float day = smoothstep(-0.06, 0.42, ndl);
    vec3 alb = texture2D(uMap, vUv).rgb;
    float ndv = max(dot(N, V), 0.0);
    // Só o escurecimento do limbo: o disco tem borda nítida, sem halo
    float limb = mix(0.74, 1.0, pow(ndv, 0.42));
    vec3 col = alb * (0.012 + 1.55 * day) * limb;
    gl_FragColor = vec4(col * uDim, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`
export function Mars({ position, radius, light, scan }: { position: [number, number, number]; radius: number; light: THREE.Vector3; scan: Scan }) {
  const map = useMemo(() => tex('mars', { srgb: true, anisotropy: 16 }), [])
  const ref = useRef<THREE.Mesh>(null)
  const mats = useMemo(() => {
    const L = light.clone().normalize()
    return {
      body: new THREE.ShaderMaterial({ uniforms: { uMap: { value: map }, uLight: { value: L }, uDim: { value: 1 } }, vertexShader: planetVertex, fragmentShader: planetFragment }),
    }
  }, [map, light])
  useFrame((_, dt) => {
    if (ref.current && !stillMotion()) ref.current.rotation.y += dt * 0.008
    const d = 1 - 0.62 * scan.current
    mats.body.uniforms.uDim.value = d
  })
  return (
    <group position={position} scale={radius}>
      <mesh ref={ref} material={mats.body} frustumCulled={false}>
        <sphereGeometry args={[1, 160, 112]} />
      </mesh>
    </group>
  )
}

export function Earth({ position, scale }: { position: [number, number, number]; scale: number }) {
  return (
    <group position={position}>
      <mesh scale={scale * 0.5}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color="#8db8ff" toneMapped={false} />
      </mesh>
      <sprite scale={[scale * 4.2, scale * 4.2, 1]}>
        <spriteMaterial map={glowTexture()} color="#6aa6ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  )
}

export function Sun({ position, scale }: { position: [number, number, number]; scale: number }) {
  return (
    <group position={position}>
      <sprite scale={[scale, scale, 1]}>
        <spriteMaterial map={glowTexture()} color="#fff1d6" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite scale={[scale * 0.3, scale * 0.3, 1]}>
        <spriteMaterial map={glowTexture()} color="#ffffff" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  )
}

// ---------- Módulo ----------

// Baia médica: seção retangular chanfrada, larga o bastante para a tripulação em fila.
const HALF_W = 4.1
const HALF_H = 2.1
const CH = 1.05
const CY = 2.1 // centro vertical (piso em y = 0)
const Z0 = -4.2
const Z1 = 9.8
const LEN = Z1 - Z0
const ZC = (Z0 + Z1) / 2
const POLY: [number, number][] = [
  [-HALF_W + CH, -HALF_H], [HALF_W - CH, -HALF_H], [HALF_W, -HALF_H + CH], [HALF_W, HALF_H - CH],
  [HALF_W - CH, HALF_H], [-HALF_W + CH, HALF_H], [-HALF_W, HALF_H - CH], [-HALF_W, -HALF_H + CH],
]

interface Wall { i: number; c: THREE.Vector3; n: THREE.Vector3; w: number; q: THREE.Quaternion }
const WALLS: Wall[] = POLY.map((v, i) => {
  const u = POLY[(i + 1) % POLY.length]
  const t = new THREE.Vector3(u[0] - v[0], u[1] - v[1], 0)
  const w = t.length()
  t.normalize()
  const n = new THREE.Vector3(-t.y, t.x, 0) // normal para dentro (polígono anti-horário)
  const c = new THREE.Vector3((v[0] + u[0]) / 2, CY + (v[1] + u[1]) / 2, ZC)
  // eixos locais: x = tangente da parede, y = ao longo do módulo (−z do mundo), z = para dentro
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, new THREE.Vector3(0, 0, -1), n))
  return { i, c, n, w, q }
})

export const WINDOW = { x: 0, y: 2.2, r: 1.75 }

// Costelas estruturais a cada 1,8 m; cada vão leva dois painéis de rack, alinhados às costelas.
const RIB_W = 0.16
const RIB_Z = Array.from({ length: 8 }, (_, i) => -3.5 + i * 1.8)
const SLOTS = (() => {
  const out: { z: number; len: number }[] = []
  for (let k = 0; k < RIB_Z.length - 1; k++) {
    const zc = (RIB_Z[k] + RIB_Z[k + 1]) / 2
    const len = (RIB_Z[k + 1] - RIB_Z[k] - RIB_W - 0.03) / 2
    for (const s of [-1, 1]) out.push({ z: zc + s * (len / 2 + 0.015), len })
  }
  return out
})()

/**
 * Decalque de rack: um quadrado do atlas (travas, grades, plaquetas, conectores) por painel, por cima da tinta.
 * Cada instância escolhe o seu tile pelo atributo `aTile`.
 */
function useDecalMaterial() {
  return useMemo(() => {
    const atlas = rackAtlas()
    const m = new THREE.MeshStandardMaterial({
      map: atlas.map, bumpMap: atlas.bump, bumpScale: 1.6, roughness: 0.5, metalness: 0.2,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aTile;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          #ifdef USE_MAP
            vMapUv = vMapUv * 0.25 + aTile;
          #endif
          #ifdef USE_BUMPMAP
            vBumpMapUv = vBumpMapUv * 0.25 + aTile;
          #endif`)
    }
    m.customProgramCacheKey = () => 'rack-decal'
    return m
  }, [])
}

/** Escolhe um tile do atlas (4×4) por instância. */
function tileAttribute(count: number, seed: number) {
  const r = rand(seed)
  const a = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    a[2 * i] = Math.floor(r() * 4) / 4
    a[2 * i + 1] = Math.floor(r() * 4) / 4
  }
  return new THREE.InstancedBufferAttribute(a, 2)
}

/** Painéis de rack sobre uma parede: grade com folga, decalques, alças e luzes de indicação frias. */
const PanelWall = memo(function PanelWall({ wall, rows, paint, decal, handle, led, bag, cables, seed }: {
  wall: Wall; rows: number; paint: THREE.Material; decal: THREE.Material; handle: THREE.Material; led: THREE.Material
  bag: THREE.Material; cables: THREE.Material[]; seed: number
}) {
  const gap = 0.03
  const ph = (wall.w - 0.14) / rows - gap
  const pl = SLOTS[0].len
  const geo = useMemo(() => new RoundedBoxGeometry(ph, pl, 0.07, 2, 0.012), [ph, pl])
  const handleGeo = useMemo(() => new RoundedBoxGeometry(0.15, 0.024, 0.028, 2, 0.008), [])
  const ledGeo = useMemo(() => new THREE.BoxGeometry(0.022, 0.022, 0.01), [])
  const count = rows * SLOTS.length
  const decalGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(ph - 0.012, pl - 0.012)
    g.setAttribute('aTile', tileAttribute(count, seed + 5))
    return g
  }, [ph, pl, count, seed])
  // Bolsas de estiva e cabos só onde a pessoa alcança: paredes laterais e chanfros de baixo
  const low = wall.i === 1 || wall.i === 2 || wall.i === 6 || wall.i === 7
  const bagGeo = useMemo(() => new RoundedBoxGeometry(ph * 0.82, pl * 0.86, 0.13, 3, 0.04), [ph, pl])
  const cableGeos = useMemo(() => {
    if (!low) return []
    const r = rand(seed + 9)
    return [0, 1, 2].map((k) => {
      const x = -wall.w / 2 + 0.07 + (k + 0.5) * ((wall.w - 0.14) / 3) + (r() - 0.5) * 0.06
      const pts: THREE.Vector3[] = []
      for (let j = 0; j <= 14; j++) {
        const y = -LEN / 2 + 0.3 + (j / 14) * (LEN - 0.6)
        pts.push(new THREE.Vector3(x + Math.sin(j * 0.9 + k) * 0.012, y, 0.1 + 0.012 * Math.sin(j * 1.7 + seed)))
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.011 + k * 0.004, 8, false)
    })
  }, [low, wall.w, seed])
  const bagCount = low ? Math.round(count * 0.3) : 0
  const bRef = useRef<THREE.InstancedMesh>(null)
  const ref = useRef<THREE.InstancedMesh>(null)
  const dRef = useRef<THREE.InstancedMesh>(null)
  const hRef = useRef<THREE.InstancedMesh>(null)
  const lRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const r = rand(seed)
    const m = new THREE.Matrix4()
    const tint = new THREE.Color()
    let k = 0
    let leds = 0
    for (let row = 0; row < rows; row++) {
      const x = -wall.w / 2 + 0.07 + gap / 2 + ph / 2 + row * (ph + gap)
      for (const s of SLOTS) {
        const y = ZC - s.z
        const proud = r() > 0.8 ? 0.012 : 0
        m.makeTranslation(x, y, 0.035 + proud)
        ref.current!.setMatrixAt(k, m)
        m.makeTranslation(x, y, 0.0715 + proud)
        dRef.current!.setMatrixAt(k, m)
        m.makeTranslation(x, y, 0.035 + proud)
        tint.setScalar(0.88 + r() * 0.12)
        ref.current!.setColorAt(k, tint)
        m.makeTranslation(x, y - pl / 2 + 0.13, 0.082 + proud)
        hRef.current!.setMatrixAt(k, m)
        if (r() > 0.55) {
          m.makeTranslation(x + ph / 2 - 0.07, y + pl / 2 - 0.08, 0.076 + proud)
          lRef.current!.setMatrixAt(leds++, m)
        }
        k++
      }
    }
    lRef.current!.count = leds
    // Bolsas: em alguns vãos, ligeiramente tortas, presas por velcro
    if (bRef.current) {
      const rb = rand(seed + 3)
      const q = new THREE.Quaternion()
      const used = new Set<number>()
      let nb = 0
      while (nb < bagCount && used.size < count) {
        const slot = Math.floor(rb() * count)
        if (used.has(slot)) continue
        used.add(slot)
        const row = Math.floor(slot / SLOTS.length)
        const x = -wall.w / 2 + 0.07 + gap / 2 + ph / 2 + row * (ph + gap) + (rb() - 0.5) * 0.03
        const y = ZC - SLOTS[slot % SLOTS.length].z + (rb() - 0.5) * 0.04
        q.setFromEuler(new THREE.Euler(0, 0, (rb() - 0.5) * 0.07))
        m.compose(new THREE.Vector3(x, y, 0.07 + 0.065 + 0.012), q, new THREE.Vector3(1, 1, 1))
        bRef.current.setMatrixAt(nb++, m)
      }
      bRef.current.count = nb
      bRef.current.instanceMatrix.needsUpdate = true
    }
    for (const im of [ref.current!, dRef.current!, hRef.current!, lRef.current!]) im.instanceMatrix.needsUpdate = true
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
  }, [rows, ph, pl, seed, wall.w])

  return (
    <group position={wall.c} quaternion={wall.q}>
      <instancedMesh ref={ref} args={[geo, paint, count]} />
      <instancedMesh ref={dRef} args={[decalGeo, decal, count]} />
      <instancedMesh ref={hRef} args={[handleGeo, handle, count]} />
      <instancedMesh ref={lRef} args={[ledGeo, led, count]} />
      {low && <instancedMesh ref={bRef} args={[bagGeo, bag, Math.max(bagCount, 1)]} />}
      {cableGeos.map((g, k) => (
        <mesh key={k} geometry={g} material={cables[k % cables.length]} />
      ))}
    </group>
  )
})

interface Mats {
  backing: THREE.MeshStandardMaterial
  paint: THREE.MeshStandardMaterial
  trim: THREE.MeshStandardMaterial
  handle: THREE.MeshStandardMaterial
  floor: THREE.MeshStandardMaterial
  blue: THREE.MeshStandardMaterial
  rail: THREE.MeshStandardMaterial
  steel: THREE.MeshStandardMaterial
  bag: THREE.MeshStandardMaterial
  cables: THREE.MeshStandardMaterial[]
  glow: THREE.MeshBasicMaterial
  warm: THREE.MeshBasicMaterial
  cool: THREE.MeshBasicMaterial
}

function useMats(): Mats {
  return useMemo(() => {
    const bump = noiseBump(5)
    bump.repeat.set(5, 5)
    const deck = deckTextures()
    for (const t of [deck.map, deck.bump]) t.repeat.set(3.05, 7)
    const paintDiff = tex('paintDiff', { srgb: true, repeat: true })
    const paintNor = tex('paintNor', { repeat: true })
    const paintRough = tex('paintRough', { repeat: true })
    for (const t of [paintDiff, paintNor, paintRough]) t.repeat.set(1, 1)
    return {
      backing: new THREE.MeshStandardMaterial({ color: '#0f141d', roughness: 0.6, metalness: 0.55 }),
      paint: new THREE.MeshStandardMaterial({ color: '#cdcfd0', roughness: 0.5, metalness: 0.06, bumpMap: bump, bumpScale: 0.35 }),
      trim: new THREE.MeshStandardMaterial({ color: '#2b3344', roughness: 0.34, metalness: 0.85 }),
      handle: new THREE.MeshStandardMaterial({ color: '#1a202c', roughness: 0.4, metalness: 0.65 }),
      floor: new THREE.MeshStandardMaterial({ map: deck.map, bumpMap: deck.bump, bumpScale: 1.4, roughness: 0.5, metalness: 0.55 }),
      blue: new THREE.MeshStandardMaterial({ map: paintDiff, normalMap: paintNor, roughnessMap: paintRough, roughness: 1, metalness: 0.45 }),
      rail: new THREE.MeshStandardMaterial({ color: '#2a4a86', roughness: 0.32, metalness: 0.7 }),
      steel: new THREE.MeshStandardMaterial({ color: '#aeb7c8', roughness: 0.28, metalness: 0.95 }),
      bag: new THREE.MeshStandardMaterial({ map: bagTexture(), roughness: 0.94, metalness: 0, bumpMap: noiseBump(3), bumpScale: 0.9 }),
      cables: [
        new THREE.MeshStandardMaterial({ color: '#15181f', roughness: 0.55, metalness: 0.05 }),
        new THREE.MeshStandardMaterial({ color: '#8d93a1', roughness: 0.5, metalness: 0.05 }),
        new THREE.MeshStandardMaterial({ color: '#2d3b5c', roughness: 0.5, metalness: 0.05 }),
      ],
      glow: new THREE.MeshBasicMaterial({ color: '#fffaf0', toneMapped: false }),
      warm: new THREE.MeshBasicMaterial({ color: '#ffe6bd', toneMapped: false }),
      cool: new THREE.MeshBasicMaterial({ color: '#8fc0ff', toneMapped: false }),
    }
  }, [])
}

function WallScreen({ pos, rotY, kind }: { pos: [number, number, number]; rotY: number; kind: 'ecg' | 'bars' | 'radar' }) {
  const map = useMemo(() => screenTexture(kind), [kind])
  const frame = useMemo(() => new RoundedBoxGeometry(1.1, 0.7, 0.07, 3, 0.02), [])
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh geometry={frame}>
        <meshStandardMaterial color="#121824" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.037]}>
        <planeGeometry args={[1.0, 0.6]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Painéis do fundo: mosaico ao redor da janela, só onde cabem dentro do octógono. */
function backWallPanels() {
  const out: [number, number][] = []
  const pw = 0.86
  const phh = 0.74
  const frameR = WINDOW.r + 0.3
  for (let c = -4; c <= 4; c++) {
    for (let r = 0; r < 5; r++) {
      const x = c * 0.9
      const y = 0.46 + r * 0.78
      let ok = true
      for (const dx of [-pw / 2, pw / 2]) {
        for (const dy of [-phh / 2, phh / 2]) {
          if (Math.abs(x + dx) > HALF_W - 0.06) ok = false
          if (Math.abs(x + dx) + Math.abs(y + dy - CY) > HALF_W + HALF_H - CH - 0.08) ok = false
          if (y + dy < 0.03 || y + dy > 2 * HALF_H - 0.03) ok = false
        }
      }
      const nx = Math.max(Math.abs(x - WINDOW.x) - pw / 2, 0)
      const ny = Math.max(Math.abs(y - WINDOW.y) - phh / 2, 0)
      if (Math.hypot(nx, ny) < frameR) ok = false
      if (ok) out.push([x, y])
    }
  }
  return out
}

const HATCH_Z = 2.8
const TRAY_X = 1.45

export const Habitat = memo(function Habitat() {
  const mats = useMats()
  const decal = useDecalMaterial()
  const backShape = useMemo(() => {
    const s = new THREE.Shape()
    POLY.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, CY + y) : s.lineTo(x, CY + y)))
    s.closePath()
    const hole = new THREE.Path()
    hole.absarc(WINDOW.x, WINDOW.y, WINDOW.r, 0, Math.PI * 2, true)
    s.holes.push(hole)
    return s
  }, [])
  const endShape = useMemo(() => {
    const s = new THREE.Shape()
    POLY.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, CY + y) : s.lineTo(x, CY + y)))
    s.closePath()
    return s
  }, [])
  const backPanelGeo = useMemo(() => new RoundedBoxGeometry(0.86, 0.74, 0.07, 2, 0.012), [])
  const backPanelsRef = useRef<THREE.InstancedMesh>(null)
  const backDecalRef = useRef<THREE.InstancedMesh>(null)
  const backHandlesRef = useRef<THREE.InstancedMesh>(null)
  const backLedsRef = useRef<THREE.InstancedMesh>(null)
  const backHandleGeo = useMemo(() => new RoundedBoxGeometry(0.2, 0.026, 0.03, 2, 0.008), [])
  const backLedGeo = useMemo(() => new THREE.BoxGeometry(0.024, 0.024, 0.01), [])
  const backPanels = useMemo(backWallPanels, [])
  const backDecalGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.85, 0.73)
    g.setAttribute('aTile', tileAttribute(backPanels.length, 91))
    return g
  }, [backPanels])
  useLayoutEffect(() => {
    const r = rand(41)
    const m = new THREE.Matrix4()
    const tint = new THREE.Color()
    let leds = 0
    backPanels.forEach(([x, y], i) => {
      const proud = r() > 0.8 ? 0.012 : 0
      m.makeTranslation(x, y, Z0 + 0.035 + proud)
      backPanelsRef.current!.setMatrixAt(i, m)
      m.makeTranslation(x, y, Z0 + 0.0715 + proud)
      backDecalRef.current!.setMatrixAt(i, m)
      m.makeTranslation(x, y, Z0 + 0.035 + proud)
      tint.setScalar(0.88 + r() * 0.12)
      backPanelsRef.current!.setColorAt(i, tint)
      m.makeTranslation(x, y - 0.24, Z0 + 0.082 + proud)
      backHandlesRef.current!.setMatrixAt(i, m)
      if (r() > 0.5) {
        m.makeTranslation(x + 0.34, y + 0.29, Z0 + 0.076 + proud)
        backLedsRef.current!.setMatrixAt(leds++, m)
      }
    })
    backLedsRef.current!.count = leds
    for (const im of [backPanelsRef.current!, backDecalRef.current!, backHandlesRef.current!, backLedsRef.current!]) im.instanceMatrix.needsUpdate = true
    if (backPanelsRef.current!.instanceColor) backPanelsRef.current!.instanceColor.needsUpdate = true
  }, [backPanels])

  const bolts = useMemo(() => Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2), [])
  const lampZ = useMemo(() => [-2.6, -0.8, 1.0, 2.8, 4.6, 6.4], [])
  const lampGeo = useMemo(() => new RoundedBoxGeometry(2.2, 0.07, 0.62, 3, 0.02), [])
  const clampZ = useMemo(() => Array.from({ length: 9 }, (_, i) => Z0 + 0.8 + i * 1.6), [])
  const rackSeeds = [11, 17, 23, 29, 31, 37]

  return (
    <group>
      {/* Parede-base de cada face, costelas estruturais e painéis */}
      {WALLS.map((w) => (
        <group key={w.i}>
          <mesh position={w.c} quaternion={w.q} material={w.i === 0 ? mats.floor : mats.backing}>
            <planeGeometry args={[w.w + 0.02, LEN]} />
          </mesh>
          {w.i !== 0 &&
            RIB_Z.map((z) => (
              <mesh key={z} position={[w.c.x + w.n.x * 0.06, w.c.y + w.n.y * 0.06, z]} quaternion={w.q} material={mats.trim}>
                <boxGeometry args={[w.w + 0.04, RIB_W, 0.14]} />
              </mesh>
            ))}
        </group>
      ))}
      {[1, 2, 3, 5, 6, 7].map((i, k) => (
        <PanelWall
          key={i} wall={WALLS[i]} rows={i === 2 || i === 6 ? 3 : 2} paint={mats.paint} decal={decal} handle={mats.handle} led={mats.cool}
          bag={mats.bag} cables={mats.cables} seed={rackSeeds[k]}
        />
      ))}

      {/* Teto: luminárias, dutos e eletrocalhas */}
      {lampZ.map((z) => (
        <group key={z} position={[0, CY + HALF_H - 0.035, z]}>
          <mesh geometry={lampGeo} material={mats.trim} />
          <mesh position={[0, -0.037, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.glow}>
            <planeGeometry args={[2.0, 0.46]} />
          </mesh>
        </group>
      ))}
      {[-2.35, 2.35].map((x) => (
        <group key={x} position={[x, CY + HALF_H - 0.34, ZC]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.17, LEN, 36, 1, true]} />
            <meshStandardMaterial color="#cdd2dc" roughness={0.36} metalness={0.72} side={THREE.DoubleSide} />
          </mesh>
          {clampZ.map((z) => (
            <mesh key={z} position={[0, 0, z - ZC]} material={mats.trim}>
              <torusGeometry args={[0.18, 0.022, 10, 40]} />
            </mesh>
          ))}
        </group>
      ))}
      {[-TRAY_X, TRAY_X].map((x) => (
        <group key={x} position={[x, CY + HALF_H - 0.04, ZC]}>
          <mesh material={mats.trim}>
            <boxGeometry args={[0.34, 0.05, LEN]} />
          </mesh>
          {[-0.07, 0.07].map((dx, k) => (
            <mesh key={dx} position={[dx, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.02, 0.02, LEN - 0.4, 12]} />
              <meshStandardMaterial color={k === 0 ? '#27407a' : '#10151f'} roughness={0.5} metalness={0.1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Faixas de luz nos chanfros */}
      {[3, 5].map((i) => {
        const w = WALLS[i]
        return (
          <mesh key={`l${i}`} position={[w.c.x + w.n.x * 0.145, w.c.y + w.n.y * 0.145, ZC]} quaternion={w.q} material={mats.warm}>
            <boxGeometry args={[0.14, LEN, 0.02]} />
          </mesh>
        )
      })}
      {[1, 7].map((i) => {
        const w = WALLS[i]
        return (
          <mesh key={`b${i}`} position={[w.c.x + w.n.x * 0.145, w.c.y + w.n.y * 0.145, ZC]} quaternion={w.q} material={mats.cool}>
            <boxGeometry args={[0.07, LEN, 0.02]} />
          </mesh>
        )
      })}

      {/* Corrimãos azuis nas paredes laterais, com apoios saindo das costelas */}
      {[-1, 1].map((s) =>
        [1.15, 2.0].map((y) => (
          <group key={`${s}${y}`}>
            <mesh position={[s * (HALF_W - 0.21), y, ZC]} rotation={[Math.PI / 2, 0, 0]} material={mats.rail}>
              <cylinderGeometry args={[0.024, 0.024, LEN - 0.4, 18]} />
            </mesh>
            {RIB_Z.map((z) => (
              <mesh key={z} position={[s * (HALF_W - 0.17), y, z]} material={mats.trim}>
                <boxGeometry args={[0.1, 0.05, 0.05]} />
              </mesh>
            ))}
          </group>
        )),
      )}

      {/* Escotilha e telas */}
      <group position={[HALF_W - 0.06, 1.5, HATCH_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.blue}>
          <cylinderGeometry args={[0.62, 0.62, 0.08, 56]} />
        </mesh>
        <mesh position={[0, 0, 0.03]} material={mats.steel}>
          <torusGeometry args={[0.66, 0.05, 16, 72]} />
        </mesh>
        <mesh position={[0, 0, 0.1]} material={mats.steel}>
          <torusGeometry args={[0.2, 0.024, 12, 40]} />
        </mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[0, 0, 0.1]} rotation={[0, 0, (k * Math.PI) / 3]} material={mats.steel}>
            <boxGeometry args={[0.42, 0.03, 0.03]} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.07]} material={mats.steel}>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 12]} />
        </mesh>
      </group>
      <WallScreen pos={[-(HALF_W - 0.1), 1.65, -0.6]} rotY={Math.PI / 2} kind="ecg" />
      <WallScreen pos={[-(HALF_W - 0.1), 1.65, 1.0]} rotY={Math.PI / 2} kind="bars" />
      <WallScreen pos={[HALF_W - 0.1, 1.65, -0.8]} rotY={-Math.PI / 2} kind="radar" />

      {/* Parede do fundo com a janela */}
      <mesh position={[0, 0, Z0]} material={mats.backing}>
        <shapeGeometry args={[backShape, 48]} />
      </mesh>
      <instancedMesh ref={backPanelsRef} args={[backPanelGeo, mats.paint, backPanels.length]} />
      <instancedMesh ref={backDecalRef} args={[backDecalGeo, decal, backPanels.length]} />
      <instancedMesh ref={backHandlesRef} args={[backHandleGeo, mats.handle, backPanels.length]} />
      <instancedMesh ref={backLedsRef} args={[backLedGeo, mats.cool, backPanels.length]} />
      <mesh position={[WINDOW.x, WINDOW.y, Z0 + 0.05]} material={mats.trim}>
        <torusGeometry args={[WINDOW.r + 0.12, 0.14, 24, 128]} />
      </mesh>
      <mesh position={[WINDOW.x, WINDOW.y, Z0 + 0.1]}>
        <torusGeometry args={[WINDOW.r + 0.01, 0.055, 16, 128]} />
        <meshStandardMaterial color="#05070b" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[WINDOW.x, WINDOW.y, Z0 + 0.1]} material={mats.cool}>
        <torusGeometry args={[WINDOW.r - 0.07, 0.013, 12, 128]} />
      </mesh>
      {bolts.map((b, i) => (
        <mesh
          key={i}
          position={[WINDOW.x + Math.cos(b) * (WINDOW.r + 0.12), WINDOW.y + Math.sin(b) * (WINDOW.r + 0.12), Z0 + 0.2]}
          rotation={[Math.PI / 2, 0, 0]}
          material={mats.steel}
        >
          <cylinderGeometry args={[0.034, 0.034, 0.07, 6]} />
        </mesh>
      ))}
      {/* Vidro: só um reflexo leve */}
      <mesh position={[WINDOW.x, WINDOW.y, Z0 + 0.14]} renderOrder={5}>
        <circleGeometry args={[WINDOW.r, 96]} />
        <meshPhysicalMaterial color="#9fb6d8" roughness={0.03} metalness={0} transparent opacity={0.06} envMapIntensity={1.6} depthWrite={false} />
      </mesh>
      {/* Parede da outra ponta: fecha a baia, sem janela */}
      <group position={[0, 0, Z1]} rotation={[0, Math.PI, 0]}>
        <mesh material={mats.backing}>
          <shapeGeometry args={[endShape, 48]} />
        </mesh>
        {backPanels.map(([x, y], i) => (
          <mesh key={i} position={[-x, y, 0.035]} geometry={backPanelGeo} material={mats.paint} />
        ))}
        <mesh position={[0, 1.5, 0.06]} material={mats.steel}>
          <torusGeometry args={[0.7, 0.05, 16, 72]} />
        </mesh>
        <mesh position={[0, 1.5, 0.04]} material={mats.blue}>
          <circleGeometry args={[0.66, 56]} />
        </mesh>
      </group>
      <DustMotes />
    </group>
  )
})

/** Poeira flutuando no ar: sem gravidade nada cai, e a luz pega os grãos. */
function DustMotes() {
  const ref = useRef<THREE.Points>(null)
  const still = useMemo(stillMotion, [])
  const data = useMemo(() => {
    const r = rand(77)
    const N = 200
    const base = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      base[3 * i] = (r() - 0.5) * 7.5
      base[3 * i + 1] = 0.3 + r() * 3.6
      base[3 * i + 2] = -3.5 + r() * 12
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base), 3))
    return { base, geo, N }
  }, [])
  useFrame(({ clock }) => {
    if (!ref.current || still) return
    const t = clock.elapsedTime
    const P = data.geo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < data.N; i++) {
      P.setXYZ(
        i,
        data.base[3 * i] + Math.sin(t * 0.07 + i) * 0.35,
        data.base[3 * i + 1] + Math.sin(t * 0.05 + i * 1.7) * 0.25,
        data.base[3 * i + 2] + Math.cos(t * 0.06 + i * 0.6) * 0.35,
      )
    }
    P.needsUpdate = true
  })
  // Os grãos somem perto da câmera: num close do rosto eles viravam pontinhos brancos sobre a pele
  const material = useMemo(() => {
    const m = new THREE.PointsMaterial({
      size: 0.02, map: glowTexture(), color: '#fff4e0', transparent: true, opacity: 0.4, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false,
    })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
        varying float vNear;`)
        .replace('#include <project_vertex>', `#include <project_vertex>
        vNear = smoothstep(1.8, 3.4, -mvPosition.z);`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
        varying float vNear;`)
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        gl_FragColor.a *= vNear;`)
    }
    m.customProgramCacheKey = () => 'dust-near-fade'
    return m
  }, [])
  return <points ref={ref} geometry={data.geo} material={material} frustumCulled={false} />
}

// ---------- Fora do casco ----------

// Eixo da nave no grupo interno = Y local; o grupo é girado para o eixo cair em z do mundo.
// Ângulo phi medido de +x (lado do astronauta) para +y (cima).
const R_HULL = 2.3
const radial = (phi: number, r: number, h: number): [number, number, number] => [r * Math.cos(phi), h, -r * Math.sin(phi)]

function HullShell({ phi0, phi1, h0, h1, r, material }: { phi0: number; phi1: number; h0: number; h1: number; r: number; material: THREE.Material }) {
  const geo = useMemo(() => new THREE.CylinderGeometry(r, r, h1 - h0, 40, 6, true, phi0 + Math.PI / 2, phi1 - phi0), [phi0, phi1, h0, h1, r])
  return <mesh geometry={geo} material={material} position={[0, (h0 + h1) / 2, 0]} />
}

export const EvaWorld = memo(function EvaWorld() {
  const hullMap = useMemo(() => {
    const t = hullTexture().clone()
    t.needsUpdate = true
    t.repeat.set(4, 7)
    return t
  }, [])
  const hullBump = useMemo(() => {
    const t = noiseBump(31).clone()
    t.needsUpdate = true
    t.repeat.set(8, 20)
    return t
  }, [])
  const foilBump = useMemo(() => {
    const t = crinkleBump().clone()
    t.needsUpdate = true
    t.repeat.set(3, 3)
    return t
  }, [])
  const solarMap = useMemo(() => {
    const t = solarTexture().clone()
    t.needsUpdate = true
    t.repeat.set(4, 2)
    return t
  }, [])
  const mats = useMemo(
    () => ({
      hull: new THREE.MeshStandardMaterial({ map: hullMap, bumpMap: hullBump, bumpScale: 0.5, roughness: 0.46, metalness: 0.28 }),
      dome: new THREE.MeshStandardMaterial({ color: '#d6dae1', bumpMap: hullBump, bumpScale: 0.4, roughness: 0.48, metalness: 0.28 }),
      foil: new THREE.MeshStandardMaterial({ color: '#c99a3b', roughness: 0.34, metalness: 1, bumpMap: foilBump, bumpScale: 2.4, side: THREE.DoubleSide }),
      steel: new THREE.MeshStandardMaterial({ color: '#b3bccc', roughness: 0.28, metalness: 0.92 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d3a640', roughness: 0.3, metalness: 0.9 }),
      blue: new THREE.MeshStandardMaterial({ map: tex('paintDiff', { srgb: true, repeat: true }), normalMap: tex('paintNor', { repeat: true }), roughness: 0.6, metalness: 0.4 }),
      solar: new THREE.MeshStandardMaterial({ map: solarMap, roughness: 0.2, metalness: 0.8 }),
      dish: new THREE.MeshStandardMaterial({ color: '#e7ebf3', roughness: 0.26, metalness: 0.75, side: THREE.DoubleSide }),
    }),
    [hullMap, hullBump, foilBump, solarMap],
  )
  const rings = useMemo(() => [-9, -4.5, 0, 4.5, 9], [])
  const posts = useMemo(() => Array.from({ length: 9 }, (_, i) => -9 + i * 2.25), [])
  const phiRails = useMemo(() => [Math.PI * 0.16, Math.PI * 0.34], [])

  return (
    <group>
      <group position={[-7.5, 0.4, -12]} rotation={[0, 0.25, 0.04]}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={mats.hull}>
            <cylinderGeometry args={[R_HULL, R_HULL, 24, 96, 1, true]} />
          </mesh>
          {/* Pontas fechadas por cúpulas rasas, com adaptador de atracação */}
          {[-12, 12].map((h) => (
            <group key={h} position={[0, h, 0]} rotation={[h > 0 ? 0 : Math.PI, 0, 0]}>
              <mesh material={mats.dome} scale={[1, 0.4, 1]}>
                <sphereGeometry args={[R_HULL, 96, 28, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
              <mesh position={[0, 0.9, 0]} material={mats.steel}>
                <cylinderGeometry args={[0.95, 1.05, 0.34, 48]} />
              </mesh>
              <mesh position={[0, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.steel}>
                <torusGeometry args={[0.9, 0.07, 14, 64]} />
              </mesh>
              <mesh position={[0, 1.11, 0]} material={mats.blue}>
                <cylinderGeometry args={[0.7, 0.7, 0.06, 48]} />
              </mesh>
              {Array.from({ length: 12 }, (_, k) => (
                <mesh key={k} position={[Math.cos((k / 12) * Math.PI * 2) * 0.98, 1.1, Math.sin((k / 12) * Math.PI * 2) * 0.98]} material={mats.gold}>
                  <cylinderGeometry args={[0.035, 0.035, 0.1, 8]} />
                </mesh>
              ))}
            </group>
          ))}
          {/* Cintas de reforço */}
          {rings.map((h) => (
            <mesh key={h} position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.steel}>
              <torusGeometry args={[R_HULL + 0.02, 0.09, 14, 96]} />
            </mesh>
          ))}
          {/* Mantas térmicas douradas */}
          <HullShell phi0={-0.2} phi1={0.5} h0={-6.6} h1={-3.4} r={R_HULL + 0.035} material={mats.foil} />
          <HullShell phi0={0.15} phi1={0.95} h0={4.7} h1={8.6} r={R_HULL + 0.035} material={mats.foil} />
          <HullShell phi0={-0.45} phi1={0.1} h0={1.2} h1={3.3} r={R_HULL + 0.035} material={mats.foil} />
          {/* Corrimãos de EVA com apoios */}
          {phiRails.map((phi) => {
            const [x, , z] = radial(phi, R_HULL + 0.17, 0)
            return (
              <group key={phi}>
                <mesh position={[x, 0, z]} material={mats.gold}>
                  <cylinderGeometry args={[0.024, 0.024, 21, 12]} />
                </mesh>
                {posts.map((h) => (
                  <mesh key={h} position={radial(phi, R_HULL + 0.085, h)} rotation={[0, phi + Math.PI / 2, 0]} material={mats.steel}>
                    <boxGeometry args={[0.035, 0.035, 0.17]} />
                  </mesh>
                ))}
              </group>
            )
          })}
          {/* Escotilha de acesso */}
          <group position={[R_HULL + 0.02, 1.0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={mats.blue}>
              <cylinderGeometry args={[0.62, 0.62, 0.08, 56]} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]} material={mats.steel}>
              <torusGeometry args={[0.66, 0.05, 16, 72]} />
            </mesh>
            <mesh position={[0.09, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.steel}>
              <torusGeometry args={[0.2, 0.024, 12, 40]} />
            </mesh>
          </group>
        </group>

        {/* Painéis solares */}
        {[-7, 2, 10].map((z) => (
          <group key={z} position={[-3.6, 3.4, z]} rotation={[0, 0, 0.14]}>
            <mesh material={mats.solar}>
              <boxGeometry args={[0.08, 7.4, 5.2]} />
            </mesh>
            <mesh position={[0.1, -3.9, 0]} material={mats.steel}>
              <cylinderGeometry args={[0.07, 0.07, 1.4, 12]} />
            </mesh>
          </group>
        ))}
        {/* Antena parabólica */}
        <group position={[0, 2.75, 6]} rotation={[0.55, 0, 0]}>
          <mesh material={mats.dish}>
            <coneGeometry args={[1.2, 0.5, 48, 1, true]} />
          </mesh>
          <mesh position={[0, 0.5, 0]} material={mats.steel}>
            <cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />
          </mesh>
        </group>
      </group>
    </group>
  )
})

// ---------- Luzes ----------

/**
 * Luzes da cena. Cada uma guarda a intensidade de base em `userData.base`: o Stage as escurece
 * quando o raio-X está ligado (modo de varredura), para o holograma aparecer contra a sala.
 */
export function SceneLights({ eva, group }: { eva: boolean; group: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={group}>
      {eva ? (
        <>
          <ambientLight intensity={0.06} color="#4c6bb0" userData={{ base: 0.06 }} />
          <directionalLight position={[6, 5, 4]} intensity={3.1} color="#fff4e3" userData={{ base: 3.1 }} />
          <directionalLight position={[-4, -2, 3]} intensity={0.45} color="#5b86ff" userData={{ base: 0.45 }} />
          <pointLight position={[2, -1.5, -3]} intensity={4} distance={9} decay={2} color="#ff8a5a" userData={{ base: 4 }} />
        </>
      ) : (
        <>
          <ambientLight intensity={0.1} color="#5a73b0" userData={{ base: 0.1 }} />
          <directionalLight position={[-2.8, 4.2, 4.6]} intensity={1.7} color="#fff0dd" userData={{ base: 1.7 }} />
          <directionalLight position={[3.4, 1.6, 3.4]} intensity={0.55} color="#8fb0ff" userData={{ base: 0.55 }} />
          <pointLight position={[0.6, 2.4, -3.4]} intensity={14} distance={9} decay={2} color="#ff9a62" userData={{ base: 14 }} />
          <pointLight position={[0, 3.9, 1.2]} intensity={3} distance={8} decay={2} color="#fff3de" userData={{ base: 3 }} />
        </>
      )}
    </group>
  )
}
