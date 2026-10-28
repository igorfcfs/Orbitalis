import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { glowTexture, gratingTexture, marsTexture, panelTexture, solarTexture, starTexture } from './textures'

/**
 * Cenário: a baia médica de um módulo da nave, com uma janela para o espaço profundo,
 * e o lado de fora do casco para a atividade extraveicular (EVA).
 */

// ---------- Céu ----------

export function Stars() {
  const map = useMemo(() => starTexture(), [])
  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[160, 48, 32]} />
      <meshBasicMaterial map={map} side={THREE.BackSide} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
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
  uniform sampler2D uMap; uniform vec3 uLight; uniform vec3 uAtmo;
  varying vec3 vNW; varying vec3 vV; varying vec2 vUv;
  void main(){
    vec3 N = normalize(vNW);
    vec3 V = normalize(vV);
    float ndl = dot(N, normalize(uLight));
    float day = smoothstep(-0.14, 0.38, ndl);
    vec3 tex = texture2D(uMap, vUv).rgb;
    vec3 col = tex * (0.035 + 1.15 * day);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    col += uAtmo * rim * (0.12 + 1.0 * day);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

export function Mars({ position, radius, light }: { position: [number, number, number]; radius: number; light: THREE.Vector3 }) {
  const map = useMemo(() => marsTexture(), [])
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: map }, uLight: { value: light.clone().normalize() }, uAtmo: { value: new THREE.Color('#ff9a6a') } },
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
      }),
    [map, light],
  )
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.012
  })
  return (
    <mesh ref={ref} position={position} scale={radius} material={mat} frustumCulled={false}>
      <sphereGeometry args={[1, 96, 64]} />
    </mesh>
  )
}

export function Earth({ position, scale }: { position: [number, number, number]; scale: number }) {
  return (
    <group position={position}>
      <mesh scale={scale * 0.5}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#7fb2ff" toneMapped={false} />
      </mesh>
      <sprite scale={[scale * 4.5, scale * 4.5, 1]}>
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
      <sprite scale={[scale * 0.28, scale * 0.28, 1]}>
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
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, new THREE.Vector3(0, 0, -1), n))
  return { i, c, n, w, q }
})

export const WINDOW = { x: 0, y: 2.2, r: 1.75 }

export function Habitat() {
  const mats = useMemo(
    () =>
      WALLS.map((w) => {
        const floor = w.i === 0
        const t = (floor ? gratingTexture() : panelTexture()).clone()
        t.needsUpdate = true
        t.repeat.set(floor ? w.w / 0.5 : w.w / 2, floor ? LEN / 0.5 : LEN / 2)
        return new THREE.MeshStandardMaterial({ map: t, roughness: floor ? 0.38 : 0.6, metalness: floor ? 0.6 : 0.35, envMapIntensity: 0.5 })
      }),
    [],
  )
  const ribZ = [-3.5, -1.7, 0.1, 1.9, 3.7, 5.5, 7.3]

  const backShape = useMemo(() => {
    const s = new THREE.Shape()
    POLY.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, CY + y) : s.lineTo(x, CY + y)))
    s.closePath()
    const hole = new THREE.Path()
    hole.absarc(WINDOW.x, WINDOW.y, WINDOW.r, 0, Math.PI * 2, true)
    s.holes.push(hole)
    return s
  }, [])
  const backTex = useMemo(() => {
    const t = panelTexture().clone()
    t.needsUpdate = true
    t.repeat.set(0.6, 0.6)
    return t
  }, [])
  const bolts = useMemo(() => Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2), [])

  return (
    <group>
      {WALLS.map((w) => (
        <group key={w.i}>
          <mesh position={w.c} quaternion={w.q} material={mats[w.i]}>
            <planeGeometry args={[w.w + 0.02, LEN]} />
          </mesh>
          {w.i !== 0 && ribZ.map((z) => (
            <mesh key={z} position={[w.c.x + w.n.x * 0.07, w.c.y + w.n.y * 0.07, z]} quaternion={w.q}>
              <boxGeometry args={[w.w + 0.04, 0.16, 0.14]} />
              <meshStandardMaterial color="#222c42" roughness={0.5} metalness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Faixas de luz quente no teto e nos chanfros superiores */}
      {[4, 3, 5].map((i) => {
        const w = WALLS[i]
        const offs = i === 4 ? [-1.9, 1.9] : [0]
        return offs.map((o) => (
          <mesh key={`${i}-${o}`} position={[w.c.x + w.n.x * 0.03 + (i === 4 ? o : 0), w.c.y + w.n.y * 0.03, ZC]} quaternion={w.q}>
            <boxGeometry args={[i === 4 ? 0.4 : 0.26, LEN, 0.04]} />
            <meshBasicMaterial color="#fff1d9" toneMapped={false} />
          </mesh>
        ))
      })}
      {/* Faixas frias nos chanfros inferiores */}
      {[1, 7].map((i) => {
        const w = WALLS[i]
        return (
          <mesh key={`b${i}`} position={[w.c.x + w.n.x * 0.03, w.c.y + w.n.y * 0.03, ZC]} quaternion={w.q}>
            <boxGeometry args={[0.14, LEN, 0.04]} />
            <meshBasicMaterial color="#6aa6ff" toneMapped={false} />
          </mesh>
        )
      })}

      {/* Parede do fundo com a janela */}
      <mesh position={[0, 0, Z0]}>
        <shapeGeometry args={[backShape, 48]} />
        <meshStandardMaterial map={backTex} roughness={0.55} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[WINDOW.x, WINDOW.y, Z0 + 0.04]}>
        <torusGeometry args={[WINDOW.r + 0.07, 0.12, 20, 120]} />
        <meshStandardMaterial color="#2a3550" roughness={0.35} metalness={0.9} />
      </mesh>
      <mesh position={[WINDOW.x, WINDOW.y, Z0 + 0.1]}>
        <torusGeometry args={[WINDOW.r - 0.05, 0.035, 12, 120]} />
        <meshBasicMaterial color="#8fb4ff" toneMapped={false} />
      </mesh>
      {bolts.map((b, i) => (
        <mesh key={i} position={[WINDOW.x + Math.cos(b) * (WINDOW.r + 0.07), WINDOW.y + Math.sin(b) * (WINDOW.r + 0.07), Z0 + 0.16]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.07, 8]} />
          <meshStandardMaterial color="#8d9ab4" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- Fora do casco ----------

export function EvaWorld() {
  const hullTex = useMemo(() => {
    const t = panelTexture().clone()
    t.needsUpdate = true
    t.repeat.set(4, 2)
    return t
  }, [])
  const solar = useMemo(() => {
    const t = solarTexture().clone()
    t.needsUpdate = true
    t.repeat.set(4, 2)
    return t
  }, [])
  const tether = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.1, 1.15, -0.3),
      new THREE.Vector3(-0.6, 0.55, -1.8),
      new THREE.Vector3(-1.8, 0.35, -4.5),
      new THREE.Vector3(-3.2, 0.8, -7.2),
      new THREE.Vector3(-4.2, 1.2, -9.4),
    ])
    return new THREE.TubeGeometry(curve, 64, 0.012, 6, false)
  }, [])
  return (
    <group>
      {/* Casco da nave */}
      <group position={[-7.5, 0.4, -12]} rotation={[0, 0.25, 0.04]}>
        <mesh>
          <boxGeometry args={[5.2, 3.6, 26]} />
          <meshStandardMaterial map={hullTex} color="#c9d2e3" roughness={0.45} metalness={0.55} />
        </mesh>
        <mesh position={[2.7, 0, -4]}>
          <cylinderGeometry args={[0.9, 0.9, 0.5, 32]} />
          <meshStandardMaterial color="#9aa6bd" roughness={0.4} metalness={0.8} />
        </mesh>
        {/* Painéis solares */}
        {[-6, 3, 11].map((z) => (
          <group key={z} position={[-3.1, 3.2, z]}>
            <mesh rotation={[0.1, 0, 0.12]}>
              <boxGeometry args={[0.1, 6.5, 5]} />
              <meshStandardMaterial map={solar} roughness={0.35} metalness={0.7} />
            </mesh>
          </group>
        ))}
        {/* Antena */}
        <mesh position={[0, 2.6, 6]} rotation={[0.6, 0, 0]}>
          <coneGeometry args={[1.1, 0.5, 32, 1, true]} />
          <meshStandardMaterial color="#dfe5f1" roughness={0.3} metalness={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh geometry={tether}>
        <meshStandardMaterial color="#cfd6e6" roughness={0.6} />
      </mesh>
    </group>
  )
}

// ---------- Luzes ----------

export function SceneLights({ eva }: { eva: boolean }) {
  return eva ? (
    <>
      <ambientLight intensity={0.18} color="#4c6bb0" />
      <directionalLight position={[6, 5, 4]} intensity={3.3} color="#fff4e3" />
      <directionalLight position={[-4, -2, 3]} intensity={0.55} color="#5b86ff" />
      <pointLight position={[2, -1.5, -3]} intensity={5} distance={9} decay={2} color="#ff8a5a" />
    </>
  ) : (
    <>
      <ambientLight intensity={0.28} color="#5a73b0" />
      <directionalLight position={[-2.8, 4.2, 4.6]} intensity={1.55} color="#fff0dd" />
      <directionalLight position={[3.4, 1.6, 3.4]} intensity={0.8} color="#8fb0ff" />
      <pointLight position={[0.6, 2.4, -3.4]} intensity={16} distance={9} decay={2} color="#ff9a62" />
      <pointLight position={[0, 4.2, 1.2]} intensity={4} distance={8} decay={2} color="#fff3de" />
    </>
  )
}
