import * as THREE from 'three'

/** Texturas procedurais (canvas), geradas uma vez. Nenhuma imagem externa. */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d')! }
}

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function rng(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Ruído de valor 3D com hash inteiro: contínuo na esfera (sem costura).
function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  )
}
function fbm(x: number, y: number, z: number, oct = 5) {
  let s = 0, a = 0.5, f = 1
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f)
    f *= 2
    a *= 0.5
  }
  return s
}

let glow: THREE.CanvasTexture | null = null
export function glowTexture() {
  if (glow) return glow
  const { c, g } = canvas(128, 128)
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.3, 'rgba(255,255,255,0.4)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  glow = tex(c, false)
  return glow
}

let stars: THREE.CanvasTexture | null = null
export function starTexture() {
  if (stars) return stars
  const W = 2048, H = 1024
  const { c, g } = canvas(W, H)
  g.fillStyle = '#02030a'
  g.fillRect(0, 0, W, H)
  const r = rng(7)
  // Faixa da Via Láctea: manchas suaves ao longo de uma curva
  for (let i = 0; i < 520; i++) {
    const t = r()
    const x = t * W
    const y = H * (0.5 + 0.18 * Math.sin(t * 6.1 + 0.8) + (r() - 0.5) * 0.16)
    const rad = 40 + r() * 120
    const grad = g.createRadialGradient(x, y, 0, x, y, rad)
    const warm = r() > 0.6
    grad.addColorStop(0, warm ? 'rgba(120,90,150,0.07)' : 'rgba(80,110,190,0.06)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  for (let i = 0; i < 5200; i++) {
    const x = r() * W, y = r() * H
    const b = Math.pow(r(), 3)
    const a = 0.25 + b * 0.75
    const tint = r()
    g.fillStyle = tint > 0.85 ? `rgba(255,214,170,${a})` : tint < 0.15 ? `rgba(170,200,255,${a})` : `rgba(255,255,255,${a})`
    const s = 0.5 + b * 1.7
    g.fillRect(x, y, s, s)
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H
    const grad = g.createRadialGradient(x, y, 0, x, y, 7)
    grad.addColorStop(0, 'rgba(255,255,255,0.95)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(x - 7, y - 7, 14, 14)
  }
  stars = tex(c)
  stars.mapping = THREE.EquirectangularReflectionMapping
  return stars
}

let mars: THREE.CanvasTexture | null = null
export function marsTexture() {
  if (mars) return mars
  const W = 1024, H = 512
  const { c, g } = canvas(W, H)
  const img = g.createImageData(W, H)
  const pal = [
    [0x5a, 0x2e, 0x22], [0x7e, 0x43, 0x2c], [0xa5, 0x5d, 0x3a], [0xc7, 0x7f, 0x52], [0xdb, 0xa0, 0x78],
  ]
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI
    const cl = Math.cos(lat), sl = Math.sin(lat)
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2
      const px = cl * Math.cos(lon) * 2.2, py = sl * 2.2, pz = cl * Math.sin(lon) * 2.2
      const n = fbm(px + 3.1, py + 1.7, pz + 5.3, 6)
      const m = fbm(px * 0.7 + 9, py * 0.7 + 2, pz * 0.7 + 4, 4)
      let t = Math.min(0.999, Math.max(0, n * 1.25 - 0.1 + (m - 0.5) * 0.35))
      const k = t * (pal.length - 1)
      const i = Math.floor(k)
      const f = k - i
      let rr = pal[i][0] + (pal[i + 1][0] - pal[i][0]) * f
      let gg = pal[i][1] + (pal[i + 1][1] - pal[i][1]) * f
      let bb = pal[i][2] + (pal[i + 1][2] - pal[i][2]) * f
      // Regiões escuras (mares de basalto)
      const dark = Math.max(0, fbm(px * 1.3 + 20, py * 1.3, pz * 1.3 + 8, 4) - 0.56) * 3.2
      rr *= 1 - dark * 0.55
      gg *= 1 - dark * 0.5
      bb *= 1 - dark * 0.42
      // Calotas polares
      const cap = Math.max(0, Math.abs(lat) - 1.28 + (n - 0.5) * 0.2) * 7
      const w = Math.min(1, cap)
      rr += (236 - rr) * w
      gg += (226 - gg) * w
      bb += (222 - bb) * w
      const o = (y * W + x) * 4
      img.data[o] = rr
      img.data[o + 1] = gg
      img.data[o + 2] = bb
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  mars = tex(c)
  return mars
}

let panel: THREE.CanvasTexture | null = null
export function panelTexture() {
  if (panel) return panel
  const S = 1024
  const { c, g } = canvas(S, S)
  const r = rng(11)
  g.fillStyle = '#1a2233'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.035})`
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2)
  }
  const cell = 256
  for (let y = 0; y < S; y += cell) {
    for (let x = 0; x < S; x += cell) {
      g.fillStyle = `rgba(${40 + r() * 14},${52 + r() * 14},${74 + r() * 16},0.55)`
      g.fillRect(x + 6, y + 6, cell - 12, cell - 12)
      g.strokeStyle = 'rgba(190,205,235,0.18)'
      g.lineWidth = 2
      g.strokeRect(x + 6, y + 6, cell - 12, cell - 12)
      g.strokeStyle = 'rgba(0,0,0,0.5)'
      g.strokeRect(x + 9, y + 9, cell - 18, cell - 18)
      g.fillStyle = 'rgba(200,214,240,0.35)'
      for (const [dx, dy] of [[16, 16], [cell - 16, 16], [16, cell - 16], [cell - 16, cell - 16]]) {
        g.beginPath()
        g.arc(x + dx, y + dy, 3, 0, Math.PI * 2)
        g.fill()
      }
      if (r() > 0.45) {
        g.fillStyle = 'rgba(5,8,16,0.75)'
        for (let k = 0; k < 7; k++) g.fillRect(x + 60, y + 70 + k * 14, cell - 120, 6)
      } else if (r() > 0.5) {
        g.fillStyle = 'rgba(8,12,24,0.7)'
        g.fillRect(x + 56, y + 90, cell - 112, 70)
        g.fillStyle = 'rgba(200,214,240,0.5)'
        g.font = '600 20px "JetBrains Mono", monospace'
        g.fillText(`MB-${String(Math.floor(r() * 90 + 10))}`, x + 70, y + 132)
      }
    }
  }
  panel = tex(c)
  panel.wrapS = panel.wrapT = THREE.RepeatWrapping
  return panel
}

let grating: THREE.CanvasTexture | null = null
export function gratingTexture() {
  if (grating) return grating
  const S = 256
  const { c, g } = canvas(S, S)
  g.fillStyle = '#0b101b'
  g.fillRect(0, 0, S, S)
  g.strokeStyle = 'rgba(120,140,180,0.30)'
  g.lineWidth = 3
  for (let i = 0; i <= S; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke()
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke()
  }
  g.fillStyle = 'rgba(0,0,0,0.65)'
  for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) g.fillRect(x + 8, y + 8, 16, 16)
  grating = tex(c)
  grating.wrapS = grating.wrapT = THREE.RepeatWrapping
  return grating
}

const eyeCache = new Map<string, THREE.CanvasTexture>()
/** Globo ocular: esclera, íris com fibras e pupila. A íris fica no equador, em +z. */
export function eyeTexture(iris: string) {
  const hit = eyeCache.get(iris)
  if (hit) return hit
  const W = 1024, H = 512
  const { c, g } = canvas(W, H)
  g.fillStyle = '#ece6de'
  g.fillRect(0, 0, W, H)
  const r = rng(3)
  g.strokeStyle = 'rgba(196,92,84,0.22)'
  g.lineWidth = 1.2
  for (let i = 0; i < 60; i++) {
    const x = r() * W, y = H * (0.18 + r() * 0.64)
    g.beginPath()
    g.moveTo(x, y)
    g.bezierCurveTo(x + 20, y + (r() - 0.5) * 30, x + 40, y + (r() - 0.5) * 30, x + 60 + r() * 30, y + (r() - 0.5) * 20)
    g.stroke()
  }
  const cx = W * 0.25, cy = H * 0.5, R = 82
  const limbal = g.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.12)
  limbal.addColorStop(0, 'rgba(20,14,10,0.95)')
  limbal.addColorStop(1, 'rgba(20,14,10,0)')
  g.fillStyle = limbal
  g.beginPath(); g.arc(cx, cy, R * 1.12, 0, Math.PI * 2); g.fill()
  const col = new THREE.Color(iris)
  const base = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`
  const dark = `rgb(${Math.round(col.r * 120)},${Math.round(col.g * 120)},${Math.round(col.b * 120)})`
  const light = `rgb(${Math.min(255, Math.round(col.r * 255 * 1.6 + 25))},${Math.min(255, Math.round(col.g * 255 * 1.6 + 25))},${Math.min(255, Math.round(col.b * 255 * 1.6 + 25))})`
  const gi = g.createRadialGradient(cx, cy, R * 0.25, cx, cy, R)
  gi.addColorStop(0, light)
  gi.addColorStop(0.55, base)
  gi.addColorStop(1, dark)
  g.fillStyle = gi
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill()
  g.lineWidth = 1.2
  for (let i = 0; i < 220; i++) {
    const a = r() * Math.PI * 2
    g.strokeStyle = r() > 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.16)'
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * R * 0.34, cy + Math.sin(a) * R * 0.34)
    g.lineTo(cx + Math.cos(a) * R * (0.82 + r() * 0.16), cy + Math.sin(a) * R * (0.82 + r() * 0.16))
    g.stroke()
  }
  g.fillStyle = '#050305'
  g.beginPath(); g.arc(cx, cy, R * 0.36, 0, Math.PI * 2); g.fill()
  const t = tex(c)
  eyeCache.set(iris, t)
  return t
}

/** Plaqueta de nome para o peito. */
export function nameplateTexture(name: string, role: string, accent: string, dark: boolean) {
  const { c, g } = canvas(512, 160)
  g.fillStyle = dark ? '#0d1424' : '#e9edf4'
  g.beginPath()
  g.roundRect(0, 0, 512, 160, 18)
  g.fill()
  g.fillStyle = accent
  g.fillRect(0, 0, 14, 160)
  g.fillStyle = dark ? '#f3f6ff' : '#0d1424'
  g.font = '700 54px "Space Grotesk", "Inter", sans-serif'
  g.textBaseline = 'alphabetic'
  g.fillText(name.toUpperCase(), 40, 78)
  g.fillStyle = dark ? 'rgba(210,222,248,0.7)' : 'rgba(13,20,36,0.65)'
  g.font = '500 30px "Space Grotesk", "Inter", sans-serif'
  g.fillText(role.toUpperCase(), 40, 124)
  return tex(c)
}

/** Selo da missão: órbita e planeta. */
export function patchTexture(accent: string) {
  const { c, g } = canvas(256, 256)
  g.fillStyle = '#0d1424'
  g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill()
  g.strokeStyle = accent
  g.lineWidth = 8
  g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.stroke()
  const grad = g.createRadialGradient(100, 112, 6, 120, 128, 56)
  grad.addColorStop(0, '#e2a273')
  grad.addColorStop(1, '#7a3f28')
  g.fillStyle = grad
  g.beginPath(); g.arc(124, 128, 48, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#f2f5ff'
  g.lineWidth = 6
  g.save()
  g.translate(128, 128)
  g.rotate(-0.45)
  g.beginPath(); g.ellipse(0, 0, 96, 30, 0, 0, Math.PI * 2); g.stroke()
  g.restore()
  g.fillStyle = '#f2f5ff'
  g.beginPath(); g.arc(196, 98, 10, 0, Math.PI * 2); g.fill()
  return tex(c)
}

let solar: THREE.CanvasTexture | null = null
/** Painel solar: células azul-escuras com grade. */
export function solarTexture() {
  if (solar) return solar
  const { c, g } = canvas(512, 256)
  g.fillStyle = '#0c1a3a'
  g.fillRect(0, 0, 512, 256)
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 512; x += 32) {
      const l = 30 + ((x * 7 + y * 13) % 22)
      g.fillStyle = `rgb(${l * 0.55},${l * 0.9},${l * 2.1})`
      g.fillRect(x + 2, y + 2, 28, 28)
    }
  }
  g.strokeStyle = 'rgba(190,205,235,0.5)'
  g.lineWidth = 3
  g.strokeRect(2, 2, 508, 252)
  solar = tex(c)
  solar.wrapS = solar.wrapT = THREE.RepeatWrapping
  return solar
}
