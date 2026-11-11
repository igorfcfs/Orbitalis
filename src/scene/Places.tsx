import { useFrame } from '@react-three/fiber'
import { memo, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BlueEarth, Sun, type Scan } from './Environment'
import { SUPINE } from './legPose'
import { bagTexture, capsuleWallTexture, deckTextures, flightScreenTexture, glowTexture, noiseBump, padSkyTexture, regolithTexture, screenTexture } from './textures'

/**
 * Os dois lugares do RF-33 feitos do zero:
 * - a cabine do foguete de pé na plataforma de lançamento (Terra), no formato da Crew Dragon: quatro assentos lado a lado,
 *   onde a tripulação vai deitada de costas e presa, painel de voo acima das pernas, escotilhas lateral e de proa e janelas
 *   com o céu do dia;
 * - a base lunar em terra firme: uma cúpula com nervuras, piso de chapas com poeira de regolito, armários, bancada,
 *   câmara de ar e uma janela larga para o solo da Lua, o jipe, os painéis solares e a Terra no céu. Com o traje, o
 *   astronauta sai e fica de pé no regolito, com a cúpula atrás.
 * Tudo procedural: sem modelo nem imagem externa. As posições são do mundo (m); a tripulação fica em x = ±0,65 e ±1,95.
 */

const stillMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------- Foguete ----------

/**
 * Cápsula de pé na plataforma, no formato da Crew Dragon: o eixo da nave é o y do mundo, com o nariz para cima. Parede
 * lateral cônica a 15°, antepara de ré (o piso, sobre o escudo térmico) e antepara de proa (o teto, com o túnel da escotilha
 * de acoplamento). A tripulação vai deitada de costas (SUPINE, em legPose.ts), lado a lado, com o rosto para o painel.
 * Raio interno de 2,3 m no piso: a nave real tem uns 3,7 m por dentro e assentos a ~0,65 m; aqui eles ficam a 0,8 m.
 */
const CAP = { r0: 2.3, h: 3.05, slope: Math.tan((15 * Math.PI) / 180) }
const capR = (y: number) => CAP.r0 - CAP.slope * y
const CAP_TILT = Math.atan(CAP.slope)
const HY = SUPINE.hipY
const HZ = SUPINE.hipZ

const SEAT_MATS = {
  /** Almofada de tecido fosco */
  pad: new THREE.MeshStandardMaterial({ color: '#1c1e22', roughness: 0.93 }),
  /** Concha de fibra de carbono */
  shell: new THREE.MeshStandardMaterial({ color: '#2a2e34', roughness: 0.3, metalness: 0.3 }),
  /** Estrutura de alumínio e amortecedores */
  frame: new THREE.MeshStandardMaterial({ color: '#9aa1ab', roughness: 0.32, metalness: 0.85 }),
  dark: new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.5, metalness: 0.4 }),
}

/**
 * Assento da cápsula para quem vai deitado de costas: concha com encosto sob o tronco, apoio de cabeça com abas, apoios
 * laterais sob os braços, apoio de panturrilha sob as canelas e apoio dos pés, tudo sobre amortecedores presos ao piso.
 * Fica no grupo de cada astronauta (Stage), então acompanha quem vai para o centro e some junto com os outros.
 */
export function CrewSeat() {
  const m = SEAT_MATS
  const g = useMemo(
    () => ({
      back: new RoundedBoxGeometry(0.5, 0.07, 0.74, 3, 0.03),
      head: new RoundedBoxGeometry(0.3, 0.07, 0.32, 3, 0.03),
      wing: new RoundedBoxGeometry(0.06, 0.15, 0.26, 2, 0.025),
      tray: new RoundedBoxGeometry(0.6, 0.045, 1.16, 3, 0.02),
      side: new RoundedBoxGeometry(0.06, 0.15, 0.68, 2, 0.025),
      arm: new RoundedBoxGeometry(0.1, 0.04, 0.5, 2, 0.018),
      calf: new RoundedBoxGeometry(0.44, 0.06, 0.36, 3, 0.025),
      calfTray: new RoundedBoxGeometry(0.5, 0.035, 0.42, 2, 0.015),
      foot: new RoundedBoxGeometry(0.34, 0.2, 0.035, 2, 0.012),
      strut: new THREE.CylinderGeometry(0.022, 0.022, 1, 16),
      damper: new THREE.CylinderGeometry(0.04, 0.04, 0.22, 20),
      rail: new THREE.BoxGeometry(0.06, 0.04, 1.5),
    }),
    [],
  )
  // Pernas de apoio: do piso até a concha (encosto) e até o apoio de panturrilha
  const legs: { x: number; z: number; top: number }[] = []
  for (const x of [-0.2, 0.2]) {
    legs.push({ x, z: HZ - 0.62, top: HY - 0.24 }, { x, z: HZ + 0.26, top: HY + 0.3 })
  }
  return (
    <group>
      {/* Encosto sob o tronco (a almofada encosta nas costas) e apoio de cabeça */}
      <mesh geometry={g.back} material={m.pad} position={[0, HY - 0.16, HZ - 0.27]} />
      <mesh geometry={g.head} material={m.pad} position={[0, HY - 0.145, HZ - 0.8]} />
      {[-0.175, 0.175].map((x) => (
        <mesh key={x} geometry={g.wing} material={m.pad} position={[x, HY - 0.08, HZ - 0.8]} />
      ))}
      {/* Concha de carbono: bandeja, laterais e os apoios dos braços */}
      <mesh geometry={g.tray} material={m.shell} position={[0, HY - 0.215, HZ - 0.43]} />
      {[-0.32, 0.32].map((x) => (
        <group key={x}>
          <mesh geometry={g.side} material={m.shell} position={[x, HY - 0.16, HZ - 0.27]} />
          <mesh geometry={g.arm} material={m.pad} position={[x * 0.94, HY - 0.075, HZ - 0.22]} />
        </group>
      ))}
      {/* Apoio de panturrilha (as canelas ficam na horizontal) e apoio dos pés */}
      <mesh geometry={g.calf} material={m.pad} position={[0, HY + 0.37, HZ + 0.26]} />
      <mesh geometry={g.calfTray} material={m.shell} position={[0, HY + 0.323, HZ + 0.26]} />
      <mesh geometry={g.foot} material={m.shell} position={[0, HY + 0.46, HZ + 0.53]} />
      {/* Estrutura: pernas com amortecedores, presas ao trilho do piso */}
      {legs.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]}>
          <mesh geometry={g.strut} material={m.frame} position={[0, l.top / 2, 0]} scale={[1, l.top, 1]} />
          <mesh geometry={g.damper} material={m.dark} position={[0, l.top * 0.38, 0]} />
        </group>
      ))}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} geometry={g.rail} material={m.frame} position={[x, 0.02, HZ - 0.2]} />
      ))}
    </group>
  )
}

/**
 * Limites da câmera dentro da cabine: a cena do foguete é vista só de dentro, então a câmera nunca passa da parede, do teto
 * nem do piso (vale para a formação, para o foco e para o giro livre).
 */
const CABIN_MARGIN = { floor: 0.45, ceiling: 0.16, wall: 0.2 }
export function clampInCabin(p: THREE.Vector3) {
  p.y = THREE.MathUtils.clamp(p.y, CABIN_MARGIN.floor, CAP.h - CABIN_MARGIN.ceiling)
  const r = Math.hypot(p.x, p.z)
  const max = capR(p.y) - CABIN_MARGIN.wall
  if (r > max) {
    p.x *= max / r
    p.z *= max / r
  }
  return p
}

/**
 * Assenta uma geometria na parede cônica, seguindo a curva: no espaço local, x é o arco em volta do eixo (m), y sobe pela
 * geratriz inclinada e z entra na cabine pela normal da parede. Uma peça plana encostada numa parede curva fura a parede nas
 * bordas (a janela e a escotilha apareciam cortadas); assim cada vértice fica à mesma distância da parede.
 */
function wrapOnWall(geo: THREE.BufferGeometry, az: number, y0: number) {
  const p = geo.getAttribute('position')
  const c = Math.cos(CAP_TILT)
  const s = Math.sin(CAP_TILT)
  for (let i = 0; i < p.count; i++) {
    const y = y0 + p.getY(i) * c
    const r = capR(y)
    // x para a esquerda de quem olha a parede de dentro, para o sistema continuar destro (a face da frente fica para dentro)
    const a = az - p.getX(i) / r
    const n = p.getZ(i)
    const rr = r - n * c
    p.setXYZ(i, Math.sin(a) * rr, y - n * s, Math.cos(a) * rr)
  }
  p.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/** Orienta algo encostado na parede cônica, de frente para o eixo da nave */
function onWall(az: number, y: number, inset = 0.01) {
  const r = capR(y) - inset
  const o = new THREE.Object3D()
  o.position.set(Math.sin(az) * r, y, Math.cos(az) * r)
  o.lookAt(0, y, 0)
  o.rotateX(-CAP_TILT)
  return { position: o.position.clone(), quaternion: o.quaternion.clone() }
}

/** Peças de uma janela redonda (ou da janela da escotilha), já no espaço local da parede: vidro, poço, moldura e aro */
function windowParts(r: number, base: number) {
  const tube = new THREE.CylinderGeometry(r, r, 0.045, 48, 1, true).rotateX(Math.PI / 2).translate(0, 0, base + 0.0225)
  return {
    sky: new THREE.CircleGeometry(r, 48).translate(0, 0, base + 0.002),
    glass: new THREE.CircleGeometry(r, 48).translate(0, 0, base + 0.012),
    well: tube,
    flange: new THREE.RingGeometry(r, r + 0.11, 64, 2).translate(0, 0, base + 0.004),
    lip: new THREE.TorusGeometry(r + 0.01, 0.016, 12, 64).translate(0, 0, base + 0.045),
  }
}

/**
 * Janela na parede cônica, com o céu do dia lá fora: o vidro fica no fundo de um poço curto e a moldura em volta é um aro
 * saliente, como nas janelas da Crew Dragon. Tudo é assentado na curva da parede (wrapOnWall), sem bordas furando a parede.
 */
function CapsuleWindow({ az, y, mats }: { az: number; y: number; mats: Record<string, THREE.Material> }) {
  const g = useMemo(() => {
    const parts = windowParts(0.15, 0)
    for (const k of Object.keys(parts) as (keyof typeof parts)[]) wrapOnWall(parts[k], az, y)
    return parts
  }, [az, y])
  return (
    <group>
      <mesh geometry={g.sky} material={mats.sky} />
      <mesh geometry={g.glass} material={mats.glass} renderOrder={2} />
      <mesh geometry={g.well} material={mats.well} />
      <mesh geometry={g.flange} material={mats.trim} />
      <mesh geometry={g.lip} material={mats.frameLight} />
    </group>
  )
}

/** Escotilha lateral (a de entrada da tripulação), com a janela no meio e a alavanca, assentada na curva da parede */
function SideHatch({ mats }: { mats: Record<string, THREE.Material> }) {
  const g = useMemo(() => {
    const AZ = Math.PI
    const Y = 1.95
    const win = windowParts(0.12, 0.012)
    for (const k of Object.keys(win) as (keyof typeof win)[]) win[k].translate(0, 0.12, 0)
    const parts = {
      // Em anéis (não em leque): os triângulos longos do leque ficariam retos sobre a parede curva e cobririam a janela
      door: new THREE.RingGeometry(0.001, 0.5, 72, 12).translate(0, 0, 0.006),
      seam: new THREE.TorusGeometry(0.5, 0.012, 8, 96).translate(0, 0, 0.006),
      rim: new THREE.TorusGeometry(0.56, 0.035, 12, 96).translate(0, 0, 0.012),
      handle: new THREE.CapsuleGeometry(0.022, 0.24, 4, 12).rotateZ(Math.PI / 2).translate(0, -0.25, 0.07),
      posts: mergeGeos([-0.14, 0.14].map((x) => new THREE.BoxGeometry(0.03, 0.03, 0.06).translate(x, -0.25, 0.04))),
      ...win,
    }
    for (const k of Object.keys(parts) as (keyof typeof parts)[]) wrapOnWall(parts[k], AZ, Y)
    return parts
  }, [])
  return (
    <group>
      <mesh geometry={g.door} material={mats.hatch} />
      <mesh geometry={g.seam} material={mats.trim} />
      <mesh geometry={g.rim} material={mats.frameLight} />
      <mesh geometry={g.handle} material={mats.dark} />
      <mesh geometry={g.posts} material={mats.metal} />
      <mesh geometry={g.sky} material={mats.sky} />
      <mesh geometry={g.glass} material={mats.glass} renderOrder={2} />
      <mesh geometry={g.well} material={mats.well} />
      <mesh geometry={g.flange} material={mats.trim} />
      <mesh geometry={g.lip} material={mats.frameLight} />
    </group>
  )
}

/** Junta geometrias numa só (posições e normais; as normais são recalculadas por quem chama, se precisar) */
function mergeGeos(geos: THREE.BufferGeometry[]) {
  const parts = geos.map((b) => (b.index ? b.toNonIndexed() : b))
  const n = parts.reduce((s, b) => s + b.getAttribute('position').count, 0)
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  let o = 0
  for (const b of parts) {
    const a = b.getAttribute('position').array as Float32Array
    pos.set(a, o)
    const na = b.getAttribute('normal')?.array as Float32Array | undefined
    if (na) nor.set(na, o)
    o += a.length
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  return g
}

/**
 * Painel de voo: três telas lado a lado acima das pernas da tripulação, inclinadas para o rosto de quem está deitado (como
 * o painel da Crew Dragon), com uma fileira de botões físicos e a alça protegida do centro. Preso ao teto por dois braços.
 */
function FlightPanel({ mats }: { mats: Record<string, THREE.Material> }) {
  const screens = useMemo(() => (['nav', 'ascent', 'systems'] as const).map((k) => new THREE.MeshBasicMaterial({ map: flightScreenTexture(k), toneMapped: false, color: '#c9d3e0' })), [])
  const cy = HY + 0.92
  const cz = HZ + 0.8
  // Normal da tela voltada para os rostos (para baixo e para trás); o alto da tela fica do lado da cabeça
  const tilt = Math.PI - 0.62
  const housing = useMemo(() => new RoundedBoxGeometry(1.5, 0.42, 0.07, 3, 0.03), [])
  return (
    <group>
      <group position={[0, cy, cz]} rotation={[tilt, 0, Math.PI]}>
        <mesh material={mats.housing} geometry={housing} />
        {screens.map((s, i) => (
          <mesh key={i} material={s} position={[(i - 1) * 0.48, 0.035, 0.036]}>
            <planeGeometry args={[0.44, 0.28]} />
          </mesh>
        ))}
        {/* Botões físicos sob as telas e a alça protegida no centro */}
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} material={i % 4 === 0 ? mats.metal : mats.button} position={[-0.66 + i * 0.1 + (i >= 6 ? 0.1 : 0), -0.165, 0.037]}>
            <boxGeometry args={[0.07, 0.045, 0.02]} />
          </mesh>
        ))}
        <mesh material={mats.metal} position={[0.0, -0.165, 0.045]}>
          <boxGeometry args={[0.1, 0.07, 0.04]} />
        </mesh>
      </group>
      {/* Braços de fixação até a parede do lado dos pés (como o braço articulado do painel da Crew Dragon) */}
      {[-0.62, 0.62].map((x) => {
        const z1 = Math.sqrt(capR(cy + 0.05) ** 2 - x * x) - 0.02
        const len = z1 - cz
        return (
          <group key={x}>
            <mesh material={mats.metal} position={[x, cy + 0.05, cz + len / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.022, len, 12]} />
            </mesh>
            <mesh material={mats.dark} position={[x, cy + 0.05, z1 - 0.03]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.06, 20]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Luminárias planas na parede, logo abaixo do teto, assentadas na curva da parede, cada uma numa moldura escura */
function CabinLights({ mats }: { mats: Record<string, THREE.Material> }) {
  const g = useMemo(() => {
    const lamps: THREE.BufferGeometry[] = []
    const frames: THREE.BufferGeometry[] = []
    for (let i = 0; i < 10; i++) {
      const az = (i / 10) * Math.PI * 2 + 0.31
      lamps.push(wrapOnWall(new THREE.PlaneGeometry(0.62, 0.035, 24, 1).translate(0, 0, 0.008), az, CAP.h - 0.22))
      frames.push(wrapOnWall(new THREE.PlaneGeometry(0.68, 0.07, 24, 1).translate(0, 0, 0.004), az, CAP.h - 0.22))
    }
    return { lamps: mergeGeos(lamps), frames: mergeGeos(frames) }
  }, [])
  return (
    <>
      <mesh geometry={g.frames} material={mats.trim} />
      <mesh geometry={g.lamps} material={mats.led} />
    </>
  )
}

/** Bolsas de estiva claras presas na parte baixa da parede, atrás e dos lados */
function Stowage({ mats }: { mats: Record<string, THREE.Material> }) {
  const bags = useMemo(() => {
    const out: { p: THREE.Vector3; q: THREE.Quaternion; s: [number, number, number] }[] = []
    const azs = [Math.PI - 0.95, Math.PI - 0.55, Math.PI - 0.18, Math.PI + 0.18, Math.PI + 0.55, Math.PI + 0.95, Math.PI / 2 + 0.2, -Math.PI / 2 - 0.2]
    azs.forEach((az, i) => {
      const h = 0.32 + (i % 2) * 0.06
      const w = onWall(az, h / 2, 0.26)
      // de pé no piso: só gira em volta do eixo vertical
      const e = new THREE.Euler().setFromQuaternion(w.quaternion, 'YXZ')
      w.quaternion.setFromEuler(new THREE.Euler(0, e.y, 0, 'YXZ'))
      w.position.y = h / 2
      out.push({ p: w.position, q: w.quaternion, s: [0.52 + (i % 3) * 0.06, h, 0.42] })
    })
    return out
  }, [])
  const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 3, 0.08), [])
  return (
    <>
      {bags.map((b, i) => (
        <mesh key={i} geometry={geo} material={mats.bag} position={b.p} quaternion={b.q} scale={b.s} />
      ))}
    </>
  )
}

/**
 * Interior da cápsula, visto só de dentro (a câmera não sai da cabine: `clampInCabin`). `panel`: o painel de voo fica acima dos
 * pés da tripulação; com um astronauta aberto ele sai, para não esconder o corpo quando a câmera gira em volta dele.
 */
export const CapsuleInterior = memo(function CapsuleInterior({ panel }: { panel: boolean }) {
  const mats = useMemo(() => {
    const wallMap = capsuleWallTexture()
    const bagMap = bagTexture()
    const deck = deckTextures().bump
    deck.repeat.set(4, 4)
    return {
      wall: new THREE.MeshStandardMaterial({ map: wallMap, color: '#b3b8c0', roughness: 0.72, metalness: 0.02, side: THREE.BackSide }),
      bulkhead: new THREE.MeshStandardMaterial({ color: '#a6abb3', roughness: 0.7 }),
      floor: new THREE.MeshStandardMaterial({ color: '#8a9099', roughness: 0.78, metalness: 0.12, bumpMap: deck, bumpScale: 0.7 }),
      metal: new THREE.MeshStandardMaterial({ color: '#c3c9d2', roughness: 0.28, metalness: 0.9 }),
      tunnel: new THREE.MeshStandardMaterial({ color: '#c3c9d2', roughness: 0.28, metalness: 0.9, side: THREE.BackSide }),
      trim: new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.6 }),
      dark: SEAT_MATS.dark,
      hatch: new THREE.MeshStandardMaterial({ color: '#d2d5da', roughness: 0.55, metalness: 0.1 }),
      housing: new THREE.MeshStandardMaterial({ color: '#454a52', roughness: 0.6, metalness: 0.2 }),
      button: new THREE.MeshStandardMaterial({ color: '#e6e8ec', roughness: 0.5 }),
      bag: new THREE.MeshStandardMaterial({ map: bagMap, roughness: 0.9 }),
      sky: new THREE.MeshBasicMaterial({ map: padSkyTexture(), toneMapped: false, color: '#c8d2de' }),
      // Vidro da janela: quase transparente, só o reflexo da cabine
      glass: new THREE.MeshStandardMaterial({ color: '#dfe6f0', roughness: 0.04, metalness: 1, transparent: true, opacity: 0.16, depthWrite: false }),
      // Poço da janela: visto de dentro, os dois lados aparecem
      well: new THREE.MeshStandardMaterial({ color: '#3a3f47', roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide }),
      frameLight: new THREE.MeshStandardMaterial({ color: '#aab0b9', roughness: 0.45, metalness: 0.3 }),
      led: new THREE.MeshBasicMaterial({ color: '#f1f5ff', toneMapped: false }),
    }
  }, [])
  const wallGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(capR(CAP.h), CAP.r0, CAP.h, 128, 1, true)
    // A textura dá uma volta inteira; a parede mostra 16 painéis
    return g
  }, [])
  const tunnelR = 0.42
  return (
    <group>
      <mesh geometry={wallGeo} material={mats.wall} position={[0, CAP.h / 2, 0]} />
      <CabinLights mats={mats} />
      {/* Antepara de proa (o teto, visto só de dentro) e o túnel da escotilha de acoplamento */}
      <mesh position={[0, CAP.h, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.bulkhead}>
        <ringGeometry args={[tunnelR, capR(CAP.h), 96]} />
      </mesh>
      <mesh position={[0, CAP.h + 0.25, 0]} material={mats.tunnel}>
        <cylinderGeometry args={[tunnelR, tunnelR, 0.5, 48, 1, true]} />
      </mesh>
      <mesh position={[0, CAP.h + 0.49, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.hatch}>
        <circleGeometry args={[tunnelR, 48]} />
      </mesh>
      {/* Piso: a antepara de ré, sobre o escudo térmico */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.floor}>
        <circleGeometry args={[CAP.r0, 96]} />
      </mesh>
      {panel && <FlightPanel mats={mats} />}
      <SideHatch mats={mats} />
      <CapsuleWindow az={Math.PI + 0.85} y={1.75} mats={mats} />
      <CapsuleWindow az={Math.PI - 0.85} y={1.75} mats={mats} />
      <CapsuleWindow az={Math.PI / 2 + 0.1} y={2.15} mats={mats} />
      <CapsuleWindow az={-Math.PI / 2 - 0.1} y={2.15} mats={mats} />
      <Stowage mats={mats} />
    </group>
  )
})

// ---------- Base lunar ----------

const DOME_R = 7
/** Faixa da janela (rad): ângulo a partir do zênite e abertura em torno de −z */
const WIN = { t0: 1.08, t1: 1.47, half: 0.75 }

function useRegolith(repeat: number) {
  return useMemo(() => {
    const t = regolithTexture().clone()
    t.needsUpdate = true
    t.repeat.set(repeat, repeat)
    return t
  }, [repeat])
}

/** Solo da Lua lá fora, com morros baixos no horizonte, o jipe e os painéis solares */
function LunarSurface({ inside }: { inside: boolean }) {
  const map = useRegolith(60)
  const mats = useMemo(
    () => ({
      ground: new THREE.MeshStandardMaterial({ map, color: '#8d8a84', roughness: 1 }),
      hill: new THREE.MeshStandardMaterial({ color: '#5b5852', roughness: 1 }),
      body: new THREE.MeshStandardMaterial({ color: '#d8dbe0', roughness: 0.5, metalness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.7, metalness: 0.4 }),
      solar: new THREE.MeshStandardMaterial({ color: '#1d2b4a', roughness: 0.25, metalness: 0.8 }),
      gold: new THREE.MeshStandardMaterial({ color: '#c9a043', roughness: 0.35, metalness: 0.9 }),
    }),
    [map],
  )
  const hills = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: -110 + i * 28 + ((i * 37) % 13), r: 16 + ((i * 53) % 19), h: 0.05 + ((i * 29) % 7) / 90 })), [])
  // Dentro, o chão de fora começa atrás da parede da cúpula
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} material={mats.ground}>
        <circleGeometry args={[160, 72]} />
      </mesh>
      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, -0.5, -140]} scale={[h.r, h.r * h.h, h.r * 0.5]} material={mats.hill}>
          <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}
      {/* Jipe lunar */}
      <group position={inside ? [3.2, 0, -12] : [4.5, 0, -6]} rotation={[0, inside ? 0.5 : -0.4, 0]}>
        <mesh material={mats.body} position={[0, 0.62, 0]}>
          <boxGeometry args={[1.6, 0.32, 2.6]} />
        </mesh>
        <mesh material={mats.dark} position={[0, 0.92, -0.5]}>
          <boxGeometry args={[1.3, 0.28, 0.9]} />
        </mesh>
        <mesh material={mats.dark} position={[0.5, 1.5, 0.9]}>
          <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
        </mesh>
        <mesh material={mats.body} position={[0.5, 2.1, 0.9]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.32, 0.14, 24, 1, true]} />
        </mesh>
        {[[-0.85, -0.95], [0.85, -0.95], [-0.85, 0.95], [0.85, 0.95]].map(([x, z]) => (
          <mesh key={`${x}${z}`} material={mats.dark} position={[x, 0.36, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.36, 0.36, 0.22, 24]} />
          </mesh>
        ))}
      </group>
      {/* Painéis solares */}
      <group position={inside ? [-9, 0, -18] : [-10, 0, -14]}>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[i * 3.2, 0, 0]}>
            <mesh material={mats.dark} position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.4, 8]} />
            </mesh>
            <mesh material={mats.solar} position={[0, 2.4, 0]} rotation={[-0.9, 0.2, 0]}>
              <boxGeometry args={[2.8, 1.6, 0.05]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Módulo de pouso ao longe */}
      <group position={inside ? [-18, 0, -30] : [12, 0, -24]}>
        <mesh material={mats.gold} position={[0, 2.2, 0]}>
          <cylinderGeometry args={[1.6, 1.8, 2.2, 8]} />
        </mesh>
        <mesh material={mats.body} position={[0, 3.9, 0]}>
          <cylinderGeometry args={[1.0, 1.4, 1.4, 16]} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} material={mats.dark} position={[Math.cos((k * Math.PI) / 2 + 0.78) * 2.2, 0.8, Math.sin((k * Math.PI) / 2 + 0.78) * 2.2]} rotation={[Math.sin((k * Math.PI) / 2 + 0.78) * 0.5, 0, -Math.cos((k * Math.PI) / 2 + 0.78) * 0.5]}>
            <cylinderGeometry args={[0.06, 0.06, 2, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Peças da cúpula: a parede inteira menos a faixa da janela, que vira vidro */
function useDomeGeos(r: number) {
  return useMemo(() => {
    const phiC = Math.PI * 1.5 // direção −z na parametrização da esfera do three
    return {
      cap: new THREE.SphereGeometry(r, 96, 24, 0, Math.PI * 2, 0, WIN.t0),
      base: new THREE.SphereGeometry(r, 96, 8, 0, Math.PI * 2, WIN.t1, Math.PI / 2 - WIN.t1),
      side: new THREE.SphereGeometry(r, 80, 12, phiC + WIN.half, Math.PI * 2 - 2 * WIN.half, WIN.t0, WIN.t1 - WIN.t0),
      glass: new THREE.SphereGeometry(r - 0.02, 40, 12, phiC - WIN.half, 2 * WIN.half, WIN.t0, WIN.t1 - WIN.t0),
      full: new THREE.SphereGeometry(r, 96, 32, 0, Math.PI * 2, 0, Math.PI / 2),
    }
  }, [r])
}

export const LunarBase = memo(function LunarBase({ scan }: { scan: Scan }) {
  const geos = useDomeGeos(DOME_R)
  const dust = useRegolith(9)
  const bump = useMemo(() => {
    const t = noiseBump(23).clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(14, 6)
    return t
  }, [])
  const mats = useMemo(
    () => ({
      // Tecido da casca inflável, por dentro
      wall: new THREE.MeshStandardMaterial({ color: '#b8b3a9', roughness: 0.88, bumpMap: bump, bumpScale: 0.8, side: THREE.BackSide }),
      glass: new THREE.MeshStandardMaterial({ color: '#9fb4cc', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }),
      rib: new THREE.MeshStandardMaterial({ color: '#5d636d', roughness: 0.5, metalness: 0.6 }),
      floor: new THREE.MeshStandardMaterial({ map: dust, color: '#7b7b7d', roughness: 0.92, metalness: 0.15 }),
      plate: new THREE.MeshStandardMaterial({ color: '#2f343b', roughness: 0.6, metalness: 0.5 }),
      locker: new THREE.MeshStandardMaterial({ color: '#cfd3da', roughness: 0.5, metalness: 0.2 }),
      dark: new THREE.MeshStandardMaterial({ color: '#23272e', roughness: 0.55, metalness: 0.4 }),
      accent: new THREE.MeshStandardMaterial({ color: '#2f5aa8', roughness: 0.5, metalness: 0.3 }),
      led: new THREE.MeshBasicMaterial({ color: '#fff3e0', toneMapped: false }),
    }),
    [bump, dust],
  )
  const screens = useMemo(() => (['ecg', 'bars'] as const).map((k) => new THREE.MeshBasicMaterial({ map: screenTexture(k), toneMapped: false })), [])
  const ribs = useMemo(() => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI), [])
  const sunDir = useMemo(() => new THREE.Vector3(0.6, 0.35, 0.4), [])
  return (
    <group>
      {/* Lá fora, visto pela janela */}
      <LunarSurface inside />
      <BlueEarth position={[-7, 8, -72]} radius={3.6} light={sunDir} scan={scan} />
      {/* Cúpula: parede, faixa da janela e nervuras */}
      <group position={[0, 0, -0.5]}>
        <mesh geometry={geos.cap} material={mats.wall} />
        <mesh geometry={geos.base} material={mats.wall} />
        <mesh geometry={geos.side} material={mats.wall} />
        <mesh geometry={geos.glass} material={mats.glass} renderOrder={2} />
        {ribs.map((a) => (
          <mesh key={a} rotation={[0, a, 0]} material={mats.rib}>
            <torusGeometry args={[DOME_R - 0.06, 0.07, 10, 96, Math.PI]} />
          </mesh>
        ))}
        {/* Molduras de cima e de baixo da janela */}
        {[WIN.t0, WIN.t1].map((t) => (
          <mesh key={t} position={[0, Math.cos(t) * DOME_R, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.rib}>
            <torusGeometry args={[Math.sin(t) * DOME_R - 0.05, 0.06, 10, 128]} />
          </mesh>
        ))}
        {/* Anel de luz no alto */}
        <mesh position={[0, DOME_R * 0.86, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.led}>
          <torusGeometry args={[1.7, 0.04, 8, 96]} />
        </mesh>
      </group>
      {/* Piso de chapas, com poeira de regolito trazida pelas botas */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, -0.5]} material={mats.floor}>
        <circleGeometry args={[DOME_R, 96]} />
      </mesh>
      {[-2.6, 0, 2.6].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.004, 1.2]} material={mats.plate}>
          <planeGeometry args={[0.04, 6]} />
        </mesh>
      ))}
      {/* Armários à esquerda */}
      <group position={[-4.9, 0, -2.2]} rotation={[0, 0.75, 0]}>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[i * 0.95 - 0.95, 0, 0]}>
            <mesh material={mats.locker} position={[0, 0.95, 0]}>
              <boxGeometry args={[0.9, 1.9, 0.6]} />
            </mesh>
            <mesh material={mats.dark} position={[0, 1.2, 0.305]}>
              <boxGeometry args={[0.5, 0.04, 0.02]} />
            </mesh>
            <mesh material={mats.accent} position={[0, 1.75, 0.305]}>
              <planeGeometry args={[0.7, 0.12]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Bancada com telas à direita */}
      <group position={[4.8, 0, -2.4]} rotation={[0, -0.75, 0]}>
        <mesh material={mats.locker} position={[0, 0.85, 0]}>
          <boxGeometry args={[2.2, 0.08, 0.8]} />
        </mesh>
        {[-0.95, 0.95].map((x) => (
          <mesh key={x} material={mats.dark} position={[x, 0.42, 0]}>
            <boxGeometry args={[0.08, 0.84, 0.7]} />
          </mesh>
        ))}
        {screens.map((m, i) => (
          <group key={i} position={[(i - 0.5) * 1.0, 1.32, -0.25]} rotation={[-0.15, 0, 0]}>
            <mesh material={mats.dark}>
              <boxGeometry args={[0.92, 0.6, 0.05]} />
            </mesh>
            <mesh material={m} position={[0, 0, 0.03]}>
              <planeGeometry args={[0.84, 0.52]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Câmara de ar: escotilha redonda na parede da direita */}
      <group position={[6.1, 1.25, 1.6]} rotation={[0, -1.35, 0]}>
        <mesh material={mats.dark}>
          <cylinderGeometry args={[0.85, 0.85, 0.12, 48]} />
        </mesh>
        <mesh material={mats.rib} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <torusGeometry args={[0.85, 0.07, 12, 64]} />
        </mesh>
      </group>
    </group>
  )
})

/** Lado de fora da base: o astronauta de traje de pé no regolito, a cúpula atrás, o jipe, os painéis e a Terra */
const OUT_R = 4.4

export const LunarOutside = memo(function LunarOutside({ scan }: { scan: Scan }) {
  const geos = useDomeGeos(OUT_R)
  const map = useRegolith(5)
  const mats = useMemo(
    () => ({
      // Por fora a casca é coberta de sacos de regolito, como blindagem
      shell: new THREE.MeshStandardMaterial({ color: '#c9c4b8', roughness: 0.9 }),
      berm: new THREE.MeshStandardMaterial({ map, color: '#8d8a84', roughness: 1 }),
      glass: new THREE.MeshStandardMaterial({ color: '#0d1420', roughness: 0.08, metalness: 0.6 }),
      rib: new THREE.MeshStandardMaterial({ color: '#5d636d', roughness: 0.5, metalness: 0.6 }),
    }),
    [map],
  )
  const sunDir = useMemo(() => new THREE.Vector3(0.8, 0.42, 0.3), [])
  const halo = useRef<THREE.SpriteMaterial>(null)
  useFrame(({ clock }) => {
    if (halo.current && !stillMotion()) halo.current.opacity = 0.18 + 0.03 * Math.sin(clock.elapsedTime * 0.5)
  })
  return (
    <group>
      <LunarSurface inside={false} />
      <Sun position={[40, 22, -14]} scale={36} />
      <BlueEarth position={[-22, 12, -70]} radius={4.4} light={sunDir} scan={scan} />
      <group position={[-8.5, 0, -15]} rotation={[0, 0.5, 0]}>
        <mesh geometry={geos.cap} material={mats.shell} />
        <mesh geometry={geos.base} material={mats.shell} />
        <mesh geometry={geos.side} material={mats.shell} />
        <mesh geometry={geos.glass} material={mats.glass} />
        {/* Aterro de regolito em volta da base (blindagem) */}
        <mesh material={mats.berm} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]}>
          <torusGeometry args={[OUT_R, 0.9, 12, 64]} />
        </mesh>
        {/* Luz da janela, vista de fora */}
        <sprite position={[0, 1.6, -OUT_R]} scale={[4, 2, 1]}>
          <spriteMaterial ref={halo} map={glowTexture()} color="#ffe2b8" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        {/* Túnel da câmara de ar */}
        <mesh material={mats.rib} position={[OUT_R * 0.95, 1.0, OUT_R * 0.3]} rotation={[0, 0.3, Math.PI / 2]}>
          <cylinderGeometry args={[0.95, 0.95, 2.4, 32]} />
        </mesh>
      </group>
    </group>
  )
})

/** Luzes de cada lugar novo. Cada uma guarda a intensidade de base em `userData.base` (o raio-X escurece a sala). */
export function PlaceLights({ place, group }: { place: 'capsule' | 'lunar'; group: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={group}>
      {place === 'capsule' ? (
        <>
          <ambientLight intensity={0.14} color="#c9d6ef" userData={{ base: 0.14 }} />
          <directionalLight position={[-2.4, 4.2, 4.6]} intensity={1.25} color="#ffffff" userData={{ base: 1.25 }} />
          <directionalLight position={[3.2, 1.8, 3.6]} intensity={0.5} color="#a9c4ff" userData={{ base: 0.5 }} />
          <pointLight position={[0, 3.9, 0.6]} intensity={3} distance={9} decay={2} color="#eef4ff" userData={{ base: 3 }} />
        </>
      ) : (
        <>
          <ambientLight intensity={0.12} color="#d7cfc2" userData={{ base: 0.12 }} />
          <directionalLight position={[-2.6, 4.4, 4.4]} intensity={1.3} color="#fff1dc" userData={{ base: 1.5 }} />
          <directionalLight position={[2.5, 3, -6]} intensity={0.7} color="#dfe8ff" userData={{ base: 0.7 }} />
          <pointLight position={[0, 5.6, -0.5]} intensity={5} distance={12} decay={2} color="#ffe9cc" userData={{ base: 5 }} />
        </>
      )}
    </group>
  )
}
