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

let contact: THREE.CanvasTexture | null = null
/** Sombra de contato: mancha escura que some devagar até a borda, sem contorno (curva gaussiana). */
export function contactShadowTexture() {
  if (contact) return contact
  const { c, g } = canvas(128, 128)
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    grad.addColorStop(t, `rgba(255,255,255,${Math.exp(-t * t * 5.2).toFixed(4)})`)
  }
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  contact = tex(c, false)
  return contact
}

let stars: THREE.CanvasTexture | null = null
export function starTexture() {
  if (stars) return stars
  const W = 2048, H = 1024
  const { c, g } = canvas(W, H)
  // Só estrelas nítidas, por cima da imagem real da Via Láctea (a faixa vem do mapa, não daqui)
  g.clearRect(0, 0, W, H)
  const r = rng(7)
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
  g.fillStyle = '#ebe7e2'
  g.fillRect(0, 0, W, H)
  const r = rng(3)
  g.strokeStyle = 'rgba(196,92,84,0.12)'
  g.lineWidth = 1.2
  for (let i = 0; i < 60; i++) {
    const x = r() * W, y = H * (0.18 + r() * 0.64)
    g.beginPath()
    g.moveTo(x, y)
    g.bezierCurveTo(x + 20, y + (r() - 0.5) * 30, x + 40, y + (r() - 0.5) * 30, x + 60 + r() * 30, y + (r() - 0.5) * 20)
    g.stroke()
  }
  const cx = W * 0.25, cy = H * 0.5, R = 96
  const limbal = g.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.12)
  limbal.addColorStop(0, 'rgba(20,14,10,0.95)')
  limbal.addColorStop(1, 'rgba(20,14,10,0)')
  g.fillStyle = limbal
  g.beginPath(); g.arc(cx, cy, R * 1.12, 0, Math.PI * 2); g.fill()
  // A cor vem em sRGB (a textura também): usar os valores lineares do THREE.Color escurecia e saturava a íris
  const hex = new THREE.Color(iris).getHex(THREE.SRGBColorSpace)
  const cr = (hex >> 16) & 255, cg = (hex >> 8) & 255, cb = hex & 255
  const base = `rgb(${cr},${cg},${cb})`
  const dark = `rgb(${Math.round(cr * 0.5)},${Math.round(cg * 0.5)},${Math.round(cb * 0.5)})`
  const light = `rgb(${Math.min(255, Math.round(cr * 1.28 + 14))},${Math.min(255, Math.round(cg * 1.28 + 14))},${Math.min(255, Math.round(cb * 1.28 + 14))})`
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
  // Sombra das pálpebras e dos cantos: o globo fica dentro da órbita, não colado por cima do rosto
  const shade = 'rgba(32,18,14,'
  const up = g.createLinearGradient(0, H * 0.3, 0, H * 0.5)
  up.addColorStop(0, shade + '0.8)'); up.addColorStop(0.6, shade + '0.34)'); up.addColorStop(1, shade + '0)')
  g.fillStyle = up
  g.fillRect(0, H * 0.3, W, H * 0.2)
  g.fillStyle = shade + '0.85)'
  g.fillRect(0, 0, W, H * 0.3)
  const dn = g.createLinearGradient(0, H * 0.5, 0, H * 0.68)
  dn.addColorStop(0, shade + '0)'); dn.addColorStop(1, shade + '0.5)')
  g.fillStyle = dn
  g.fillRect(0, H * 0.5, W, H * 0.18)
  g.fillStyle = shade + '0.7)'
  g.fillRect(0, H * 0.68, W, H * 0.32)
  for (const s of [1, -1]) {
    const cg = g.createLinearGradient(cx + s * W * 0.075, 0, cx + s * W * 0.16, 0)
    cg.addColorStop(0, shade + '0)'); cg.addColorStop(1, shade + '0.62)')
    g.fillStyle = cg
    g.fillRect(s > 0 ? cx + W * 0.075 : cx - W * 0.16, 0, W * 0.085, H)
  }
  g.fillStyle = shade + '0.8)'
  g.fillRect(cx + W * 0.16, 0, W, H)
  g.fillRect(0, 0, cx - W * 0.16, H)
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

// ---------- Detalhes de superfície do ambiente ----------

/** Ruído em tons de cinza para bump de tinta e borracha. */
export function noiseBump(seed = 5, size = 256) {
  const { c, g } = canvas(size, size)
  const img = g.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = fbm(x / 22 + seed, y / 22, seed * 0.37, 4) * 0.7 + hash3(x, y, seed) * 0.3
      const o = (y * size + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.round(v * 255)
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = tex(c, false)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Folha de isolamento térmico dourada: dobras irregulares. */
export function crinkleBump() {
  const size = 256
  const { c, g } = canvas(size, size)
  const img = g.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = fbm(x / 9, y / 9, 1.3, 4)
      const b = Math.abs(fbm(x / 26 + 8, y / 26, 4.1, 3) - 0.5) * 2
      const v = Math.min(1, a * 0.65 + b * 0.5)
      const o = (y * size + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.round(v * 255)
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = tex(c, false)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Casco pintado de branco com painéis, costuras e rebites. */
export function hullTexture() {
  const S = 1024
  const { c, g } = canvas(S, S)
  const r = rng(21)
  g.fillStyle = '#d9dde4'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 14000; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '40,50,70'},${r() * 0.035})`
    g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3)
  }
  const cw = 256
  const ch = 341
  for (let y = 0; y < S; y += ch) {
    for (let x = 0; x < S; x += cw) {
      const tone = 214 + Math.round(r() * 14)
      g.fillStyle = `rgb(${tone},${tone + 2},${tone + 7})`
      g.fillRect(x + 3, y + 3, cw - 6, ch - 6)
      g.strokeStyle = 'rgba(60,70,95,0.55)'
      g.lineWidth = 2
      g.strokeRect(x + 1, y + 1, cw - 2, ch - 2)
      g.fillStyle = 'rgba(90,100,125,0.7)'
      for (let k = 0; k < 9; k++) {
        g.beginPath(); g.arc(x + 12 + k * ((cw - 24) / 8), y + 10, 2.2, 0, 7); g.fill()
        g.beginPath(); g.arc(x + 12 + k * ((cw - 24) / 8), y + ch - 10, 2.2, 0, 7); g.fill()
      }
      if (r() > 0.55) {
        g.fillStyle = 'rgba(25,30,45,0.7)'
        g.font = '600 15px "JetBrains Mono", monospace'
        g.fillText(['ORBITALIS', 'NO STEP', 'VENT', 'MED BAY'][Math.floor(r() * 4)], x + 24, y + 56)
      }
    }
  }
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Tela decorativa de parede: só formas de onda e barras, sem números. */
export function screenTexture(kind: 'ecg' | 'bars' | 'radar') {
  const W = 512, H = 320
  const { c, g } = canvas(W, H)
  const r = rng(kind === 'ecg' ? 3 : kind === 'bars' ? 9 : 14)
  g.fillStyle = '#04101f'
  g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(110,190,255,0.12)'
  g.lineWidth = 1
  for (let x = 0; x <= W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
  for (let y = 0; y <= H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
  g.shadowColor = '#7fd8ff'
  g.shadowBlur = 10
  g.strokeStyle = '#9fe2ff'
  g.lineWidth = 3
  if (kind === 'ecg') {
    g.beginPath()
    for (let x = 0; x < W; x += 2) {
      const p = (x % 128) / 128
      let y = 170
      if (p > 0.18 && p < 0.22) y -= 20
      else if (p > 0.3 && p < 0.33) y += 22
      else if (p > 0.33 && p < 0.37) y -= 96
      else if (p > 0.37 && p < 0.4) y += 40
      else if (p > 0.55 && p < 0.65) y -= 22 * Math.sin(((p - 0.55) / 0.1) * Math.PI)
      y += (r() - 0.5) * 2
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.stroke()
  } else if (kind === 'bars') {
    for (let i = 0; i < 18; i++) {
      const h = 40 + r() * 190
      g.fillStyle = i % 5 === 0 ? '#cfe9ff' : '#6fb7ee'
      g.fillRect(24 + i * 26, H - 30 - h, 16, h)
    }
  } else {
    g.beginPath(); g.arc(256, 160, 110, 0, 7); g.stroke()
    g.beginPath(); g.arc(256, 160, 60, 0, 7); g.stroke()
    g.beginPath(); g.moveTo(256, 160); g.lineTo(350, 100); g.stroke()
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(150 + r() * 220, 80 + r() * 160, 3, 0, 7); g.fill() }
  }
  g.shadowBlur = 0
  g.fillStyle = 'rgba(190,225,255,0.8)'
  g.font = '600 15px "JetBrains Mono", monospace'
  g.fillText(kind === 'ecg' ? 'BIO-MONITOR' : kind === 'bars' ? 'CABIN SYSTEMS' : 'SPACE WEATHER', 20, 28)
  return tex(c)
}

/**
 * Piso de convés: placas de 1 m com juntas, rebites e uma trama antiderrapante.
 * Devolve a cor e um mapa de relevo (cinza) que combinam.
 */
export function deckTextures() {
  const S = 1024
  const make = (relief: boolean) => {
    const { c, g } = canvas(S, S)
    const r = rng(relief ? 52 : 52)
    g.fillStyle = relief ? '#9a9a9a' : '#2b313d'
    g.fillRect(0, 0, S, S)
    const half = S / 2
    for (let py = 0; py < 2; py++) {
      for (let px = 0; px < 2; px++) {
        const x = px * half
        const y = py * half
        // trama antiderrapante em losangos
        g.save()
        g.beginPath()
        g.rect(x + 10, y + 10, half - 20, half - 20)
        g.clip()
        g.strokeStyle = relief ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.055)'
        g.lineWidth = 3
        for (let k = -half; k < half * 2; k += 14) {
          g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + half, y + half); g.stroke()
          g.beginPath(); g.moveTo(x + k + half, y); g.lineTo(x + k, y + half); g.stroke()
        }
        g.restore()
        // junta e moldura da placa
        g.strokeStyle = relief ? '#000000' : 'rgba(0,0,0,0.85)'
        g.lineWidth = 8
        g.strokeRect(x + 4, y + 4, half - 8, half - 8)
        g.strokeStyle = relief ? 'rgba(255,255,255,0.7)' : 'rgba(190,205,235,0.18)'
        g.lineWidth = 3
        g.strokeRect(x + 12, y + 12, half - 24, half - 24)
        // rebites
        for (const [dx, dy] of [[26, 26], [half - 26, 26], [26, half - 26], [half - 26, half - 26], [half / 2, 26], [half / 2, half - 26]]) {
          g.fillStyle = relief ? '#ffffff' : 'rgba(170,185,215,0.55)'
          g.beginPath(); g.arc(x + dx, y + dy, 6, 0, 7); g.fill()
        }
      }
    }
    // marcas de uso
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = relief ? `rgba(0,0,0,${r() * 0.25})` : `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.06})`
      g.lineWidth = 1 + r() * 2
      const x = r() * S, y = r() * S
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60); g.stroke()
    }
    const t = tex(c, !relief)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 16
    return t
  }
  return { map: make(false), bump: make(true) }
}

// ---------- Interior da estação: painéis de rack e bolsas de estiva ----------

/**
 * Atlas de 4×4 tiles com detalhes de rack de estação: travas de quarto de volta, grades, plaquetas com texto,
 * conectores, interruptores e fitas de velcro. Fundo transparente (vai por cima da tinta do painel). Só cinza,
 * azul e branco, sem verde, âmbar ou vermelho. O relevo sai da luminância da própria imagem.
 */
export function rackAtlas() {
  const T = 512
  const { c, g } = canvas(T * 4, T * 4)
  const r = rng(63)
  const mono = '600 20px "JetBrains Mono", ui-monospace, monospace'
  const latch = (x: number, y: number, rad = 22) => {
    const grad = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 2, x, y, rad)
    grad.addColorStop(0, '#f1f3f7')
    grad.addColorStop(1, '#8b93a3')
    g.fillStyle = 'rgba(20,24,34,0.55)'
    g.beginPath(); g.arc(x + 2, y + 3, rad + 3, 0, 7); g.fill()
    g.fillStyle = grad
    g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill()
    g.strokeStyle = 'rgba(20,24,34,0.9)'
    g.lineWidth = 6
    g.beginPath(); g.moveTo(x - rad * 0.62, y); g.lineTo(x + rad * 0.62, y); g.stroke()
  }
  const screw = (x: number, y: number) => {
    g.fillStyle = '#aab2c2'
    g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill()
    g.strokeStyle = 'rgba(25,30,42,0.85)'
    g.lineWidth = 2
    g.beginPath(); g.moveTo(x - 5, y - 2); g.lineTo(x + 5, y + 2); g.stroke()
  }
  const plate = (x: number, y: number, w: number, h: number, lines: string[]) => {
    g.fillStyle = '#eceef2'
    g.fillRect(x, y, w, h)
    g.strokeStyle = 'rgba(40,46,60,0.7)'
    g.lineWidth = 3
    g.strokeRect(x, y, w, h)
    g.fillStyle = '#1a1f2c'
    g.font = mono
    lines.forEach((t, i) => g.fillText(t, x + 12, y + 28 + i * 26))
  }
  const barcode = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = '#10141d'
    for (let k = 0; k < w; k += 5) if (r() > 0.45) g.fillRect(x + k, y, 2 + (r() > 0.7 ? 2 : 0), h)
  }
  const aoEdge = (ox: number, oy: number) => {
    for (const [x0, y0, x1, y1] of [[0, 0, 0, 34], [0, T, 0, T - 34], [0, 0, 34, 0], [T, 0, T - 34, 0]] as const) {
      const grad = g.createLinearGradient(ox + x0, oy + y0, ox + x1, oy + y1)
      grad.addColorStop(0, 'rgba(8,10,18,0.34)')
      grad.addColorStop(1, 'rgba(8,10,18,0)')
      g.fillStyle = grad
      g.fillRect(ox, oy, T, T)
    }
  }
  const tiles: ((ox: number, oy: number) => void)[] = [
    // 0: porta de acesso com quatro travas e plaqueta
    (ox, oy) => {
      for (const [x, y] of [[54, 54], [458, 54], [54, 458], [458, 458]]) latch(ox + x, oy + y)
      plate(ox + 138, oy + 196, 236, 100, ['ACCESS 14', 'STOW  LOCKER', 'NO STEP'])
    },
    // 1: grade de ventilação
    (ox, oy) => {
      g.fillStyle = 'rgba(14,17,26,0.9)'
      g.fillRect(ox + 70, oy + 86, 372, 220)
      for (let y = 100; y < 300; y += 22) {
        g.fillStyle = '#c9ceda'
        g.fillRect(ox + 78, oy + y, 356, 10)
      }
      for (const [x, y] of [[54, 54], [458, 54], [54, 340], [458, 340]]) screw(ox + x, oy + y)
      plate(ox + 150, oy + 380, 212, 54, ['AIRFLOW  OUT'])
    },
    // 2: alça embutida e duas travas
    (ox, oy) => {
      latch(ox + 70, oy + 70); latch(ox + 442, oy + 70)
      g.fillStyle = 'rgba(14,17,26,0.85)'
      g.beginPath(); g.roundRect(ox + 150, oy + 220, 212, 70, 18); g.fill()
      g.fillStyle = '#b6bdcb'
      g.beginPath(); g.roundRect(ox + 166, oy + 232, 180, 22, 11); g.fill()
      plate(ox + 160, oy + 340, 192, 52, ['PULL TO OPEN'])
    },
    // 3: conectores
    (ox, oy) => {
      for (let k = 0; k < 3; k++) {
        const x = ox + 120 + k * 136
        g.fillStyle = 'rgba(14,17,26,0.95)'
        g.beginPath(); g.arc(x, oy + 220, 46, 0, 7); g.fill()
        g.strokeStyle = '#98a1b3'
        g.lineWidth = 8
        g.beginPath(); g.arc(x, oy + 220, 46, 0, 7); g.stroke()
        g.fillStyle = '#6c7487'
        for (let j = 0; j < 6; j++) { g.beginPath(); g.arc(x + Math.cos(j) * 18, oy + 220 + Math.sin(j) * 18, 4, 0, 7); g.fill() }
      }
      plate(ox + 100, oy + 320, 312, 60, ['PORT A   PORT B   PORT C'])
      screw(ox + 40, oy + 40); screw(ox + 472, oy + 40)
    },
    // 4: liso, só parafusos e uma emenda
    (ox, oy) => {
      for (let k = 0; k < 6; k++) { screw(ox + 50 + k * 82, oy + 36); screw(ox + 50 + k * 82, oy + 476) }
      g.fillStyle = 'rgba(10,12,20,0.5)'
      g.fillRect(ox, oy + 250, T, 4)
    },
    // 5: plaqueta grande com código de barras
    (ox, oy) => {
      plate(ox + 90, oy + 130, 332, 200, ['RACK  LAB1D6', 'POWER 28 VDC', 'LOCKER 02 / STOWAGE'])
      barcode(ox + 110, oy + 262, 292, 46)
      latch(ox + 60, oy + 440); latch(ox + 452, oy + 440)
    },
    // 6: interruptores e luzes
    (ox, oy) => {
      for (let k = 0; k < 4; k++) {
        const x = ox + 100 + k * 96
        g.fillStyle = 'rgba(14,17,26,0.9)'
        g.fillRect(x - 20, oy + 170, 40, 90)
        g.fillStyle = '#c4cad6'
        g.fillRect(x - 8, oy + 180 + (k % 2) * 36, 16, 44)
      }
      for (let k = 0; k < 3; k++) {
        g.fillStyle = k === 1 ? '#9bd0ff' : '#e6ecf7'
        g.beginPath(); g.arc(ox + 150 + k * 100, oy + 110, 11, 0, 7); g.fill()
      }
      plate(ox + 120, oy + 320, 272, 54, ['SYS 1   SYS 2   SYS 3'])
    },
    // 7: fitas de velcro e uma trava
    (ox, oy) => {
      for (const y of [120, 300]) {
        g.fillStyle = 'rgba(96,102,116,0.95)'
        g.fillRect(ox + 60, oy + y, 392, 46)
        g.fillStyle = 'rgba(40,44,56,0.35)'
        for (let k = 0; k < 392; k += 6) g.fillRect(ox + 60 + k, oy + y, 2, 46)
      }
      latch(ox + 256, oy + 440)
    },
  ]
  for (let i = 0; i < 16; i++) {
    const ox = (i % 4) * T
    const oy = Math.floor(i / 4) * T
    tiles[i % tiles.length](ox, oy)
    aoEdge(ox, oy)
  }
  const map = tex(c)
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping
  map.anisotropy = 8

  // relevo: cinza médio por baixo, e a luminância do desenho por cima
  const b = canvas(T * 4, T * 4)
  b.g.fillStyle = '#808080'
  b.g.fillRect(0, 0, T * 4, T * 4)
  b.g.filter = 'grayscale(1) contrast(1.4)'
  b.g.drawImage(c, 0, 0)
  const bump = tex(b.c, false)
  bump.anisotropy = 8
  return { map, bump, tiles: 4 }
}

/** Bolsa de estiva (tecido claro, costuras, duas tiras e uma etiqueta). */
export function bagTexture() {
  const { c, g } = canvas(512, 384)
  const r = rng(77)
  g.fillStyle = '#d9d6cb'
  g.fillRect(0, 0, 512, 384)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '70,70,60'},${r() * 0.05})`
    g.fillRect(r() * 512, r() * 384, 1 + r() * 2, 1 + r() * 2)
  }
  g.strokeStyle = 'rgba(70,68,58,0.55)'
  g.setLineDash([8, 6])
  g.lineWidth = 2
  g.strokeRect(14, 14, 484, 356)
  g.setLineDash([])
  for (const x of [150, 362]) {
    g.fillStyle = 'rgba(86,92,108,0.9)'
    g.fillRect(x - 16, 0, 32, 384)
    g.fillStyle = 'rgba(30,34,46,0.5)'
    g.fillRect(x - 16, 180, 32, 10)
  }
  g.fillStyle = '#eef0f4'
  g.fillRect(196, 120, 120, 70)
  g.fillStyle = '#151a26'
  g.font = '600 15px "JetBrains Mono", monospace'
  g.fillText('STOW  B-07', 204, 148)
  g.fillText('LAB  AFT', 204, 170)
  g.fillStyle = 'rgba(96,102,116,0.95)'
  g.fillRect(40, 300, 110, 34)
  const t = tex(c)
  t.anisotropy = 8
  return t
}

// ---------- Terra e solo lunar (RF-33): procedurais, sem imagem externa ----------

let earth: THREE.CanvasTexture | null = null
/** Terra: oceano, continentes, gelo nos polos e nuvens, a partir de ruído contínuo na esfera. */
export function earthTexture() {
  if (earth) return earth
  const W = 1024, H = 512
  const { c, g } = canvas(W, H)
  const img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI
    const cl = Math.cos(lat), sl = Math.sin(lat)
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2
      const px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon)
      const land = fbm(px * 1.9 + 11, py * 1.9 + 4, pz * 1.9 + 7, 6)
      const shore = land - 0.53
      let r: number, gg: number, b: number
      if (shore < 0) {
        const deep = Math.min(1, -shore * 5)
        r = 10 + (1 - deep) * 26; gg = 44 + (1 - deep) * 62; b = 98 + (1 - deep) * 64
      } else {
        const dry = fbm(px * 3 + 2, py * 3 + 9, pz * 3 + 5, 4)
        const t = Math.min(1, shore * 5)
        r = 52 + dry * 120 * t + (1 - t) * 40; gg = 84 + dry * 60 - t * 12; b = 44 + dry * 30
      }
      const cloud = Math.max(0, fbm(px * 3.4 + 40, py * 3.4 + 3, pz * 3.4 + 21, 5) - 0.5) * 3.2
      const ice = Math.min(1, Math.max(0, Math.abs(lat) - 1.18 + (land - 0.5) * 0.3) * 7)
      const w = Math.min(1, Math.max(cloud * 0.9, ice))
      r += (244 - r) * w; gg += (246 - gg) * w; b += (250 - b) * w
      const o = (y * W + x) * 4
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  earth = tex(c)
  return earth
}

let regolith: THREE.CanvasTexture | null = null
/** Solo lunar ladrilhável, para o chão do cenário. */
export function regolithTexture() {
  if (regolith) return regolith
  const S = 512
  const { c, g } = canvas(S, S)
  const img = g.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Ruído periódico: as bordas casam, sem costura ao repetir
      const a = (x / S) * Math.PI * 2, b = (y / S) * Math.PI * 2
      const n = fbm(Math.cos(a) * 2.2 + 3, Math.sin(a) * 2.2 + Math.cos(b) * 2.2, Math.sin(b) * 2.2 + 1, 6)
      const L = 70 + n * 110
      const o = (y * S + x) * 4
      img.data[o] = L; img.data[o + 1] = L * 0.98; img.data[o + 2] = L * 0.94; img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  regolith = tex(c)
  regolith.wrapS = regolith.wrapT = THREE.RepeatWrapping
  return regolith
}

let skyGrad: THREE.CanvasTexture | null = null
/** Céu do dia visto pelas janelas da cápsula na plataforma: azul no alto, claro e quente no horizonte. */
export function padSkyTexture() {
  if (skyGrad) return skyGrad
  const { c, g } = canvas(8, 512)
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#0f2a5c')
  grad.addColorStop(0.42, '#3f73b8')
  grad.addColorStop(0.62, '#8fb2d8')
  grad.addColorStop(0.72, '#f0c9a0')
  grad.addColorStop(0.74, '#6a6f78')
  grad.addColorStop(1, '#2b2f36')
  g.fillStyle = grad
  g.fillRect(0, 0, 8, 512)
  skyGrad = tex(c)
  return skyGrad
}

let capWall: THREE.CanvasTexture | null = null
/**
 * Parede interna da cápsula: painéis de acabamento cinza-claros (como os de uma Crew Dragon), com juntas finas, prendedores,
 * remendos de velcro e algumas plaquetas pequenas, sem marca nem número. Uma volta da parede = a largura da textura.
 */
export function capsuleWallTexture() {
  if (capWall) return capWall
  const W = 2048, H = 512
  const { c, g } = canvas(W, H)
  const r = rng(31)
  g.fillStyle = '#c3c7cd'
  g.fillRect(0, 0, W, H)
  // Granulação leve do acabamento
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '60,64,72'},${r() * 0.035})`
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2)
  }
  // 16 painéis na volta e 3 faixas na altura, com juntas finas e sombreamento suave na borda
  const cols = 16
  const rows = [0, 150, 360, 512]
  for (let i = 0; i < cols; i++) {
    const x0 = (i * W) / cols
    const x1 = ((i + 1) * W) / cols
    for (let k = 0; k < rows.length - 1; k++) {
      const y0 = rows[k], y1 = rows[k + 1]
      const tone = 196 + Math.floor(r() * 10)
      g.fillStyle = `rgb(${tone - 2},${tone + 1},${tone + 5})`
      g.fillRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6)
      const grad = g.createLinearGradient(0, y0, 0, y1)
      grad.addColorStop(0, 'rgba(255,255,255,0.08)')
      grad.addColorStop(1, 'rgba(0,0,0,0.07)')
      g.fillStyle = grad
      g.fillRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6)
      g.strokeStyle = 'rgba(70,76,86,0.55)'
      g.lineWidth = 2
      g.strokeRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4)
      // Prendedores nos cantos
      g.fillStyle = 'rgba(120,126,136,0.9)'
      for (const [dx, dy] of [[12, 12], [x1 - x0 - 12, 12], [12, y1 - y0 - 12], [x1 - x0 - 12, y1 - y0 - 12]]) {
        g.beginPath()
        g.arc(x0 + dx, y0 + dy, 3.2, 0, Math.PI * 2)
        g.fill()
      }
      // Velcro (tiras um pouco mais escuras e foscas) e, às vezes, uma plaqueta pequena
      if (r() > 0.45) {
        g.fillStyle = 'rgba(150,154,160,0.7)'
        g.fillRect(x0 + 20 + r() * 40, y0 + 30 + r() * (y1 - y0 - 80), 38, 14)
      }
      if (r() > 0.72) {
        const px = x0 + 26 + r() * 30, py = y0 + 24 + r() * (y1 - y0 - 70)
        g.fillStyle = '#e9ecf0'
        g.fillRect(px, py, 58, 22)
        g.fillStyle = 'rgba(30,36,48,0.85)'
        for (let l = 0; l < 3; l++) g.fillRect(px + 6, py + 5 + l * 5, 22 + r() * 24, 2)
      }
    }
  }
  capWall = tex(c)
  capWall.wrapS = THREE.RepeatWrapping
  return capWall
}

/** Tela de voo da cápsula: fundo escuro, trajetória de subida e barras de sistemas, sem números (como as outras telas). */
export function flightScreenTexture(kind: 'ascent' | 'systems' | 'nav') {
  const W = 640, H = 384
  const { c, g } = canvas(W, H)
  const r = rng(kind === 'ascent' ? 41 : kind === 'systems' ? 43 : 47)
  g.fillStyle = '#060b14'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#0d1828'
  g.fillRect(0, 0, W, 34)
  g.fillStyle = 'rgba(205,225,250,0.85)'
  g.font = '600 16px "JetBrains Mono", monospace'
  g.fillText(kind === 'ascent' ? 'ASCENT' : kind === 'systems' ? 'CABIN' : 'NAV', 18, 23)
  g.strokeStyle = 'rgba(150,190,240,0.14)'
  g.lineWidth = 1
  for (let x = 0; x <= W; x += 40) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x, H); g.stroke() }
  for (let y = 34; y <= H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
  g.lineWidth = 3
  if (kind === 'ascent') {
    // Curva de subida e o ponto de agora, ainda na plataforma
    g.strokeStyle = 'rgba(170,210,255,0.55)'
    g.setLineDash([10, 8])
    g.beginPath()
    g.moveTo(40, H - 40)
    g.bezierCurveTo(140, H - 60, 260, 120, W - 40, 70)
    g.stroke()
    g.setLineDash([])
    g.fillStyle = '#eaf4ff'
    g.beginPath(); g.arc(40, H - 40, 7, 0, 7); g.fill()
  } else if (kind === 'systems') {
    for (let i = 0; i < 6; i++) {
      const y = 62 + i * 50
      g.fillStyle = 'rgba(120,140,170,0.35)'
      g.fillRect(150, y, W - 200, 14)
      g.fillStyle = '#b9d4f5'
      g.fillRect(150, y, (W - 200) * (0.45 + r() * 0.5), 14)
      g.fillStyle = 'rgba(205,225,250,0.75)'
      g.fillRect(24, y + 2, 90, 9)
    }
  } else {
    // Esfera de atitude simplificada
    g.save()
    g.beginPath(); g.arc(W / 2, H / 2 + 16, 130, 0, 7); g.clip()
    g.fillStyle = '#1d3a63'; g.fillRect(0, 0, W, H / 2 + 16)
    g.fillStyle = '#3a2c22'; g.fillRect(0, H / 2 + 16, W, H)
    g.restore()
    g.strokeStyle = '#eaf4ff'
    g.beginPath(); g.arc(W / 2, H / 2 + 16, 130, 0, 7); g.stroke()
    g.beginPath(); g.moveTo(W / 2 - 60, H / 2 + 16); g.lineTo(W / 2 + 60, H / 2 + 16); g.stroke()
  }
  return tex(c)
}
