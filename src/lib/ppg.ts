/**
 * Frequência cardíaca pela câmera (RF-24): fotopletismografia de ponta de dedo.
 * Com o dedo cobrindo a lente, o brilho do canal vermelho oscila a cada batida. A estimativa vem da
 * autocorrelação do sinal sem tendência, no intervalo de 40 a 180 bpm. Tudo local: nenhum quadro sai do aparelho.
 */

export interface PpgResult {
  bpm: number
  /** 0 a 1: quão periódico é o sinal. Abaixo de MIN_QUALITY a leitura não é aceita */
  quality: number
}

export const MIN_QUALITY = 0.35
export const MIN_SECONDS = 8

/** Remove a tendência lenta (média móvel de ~1,5 s), deixando só a oscilação do pulso. */
export function detrend(x: number[], fps: number): number[] {
  const w = Math.max(3, Math.round(fps * 1.5))
  const out: number[] = []
  let sum = 0
  const q: number[] = []
  for (const v of x) {
    q.push(v)
    sum += v
    if (q.length > w) sum -= q.shift()!
    out.push(v - sum / q.length)
  }
  return out
}

export function estimateBpm(samples: number[], fps: number): PpgResult | null {
  if (!Number.isFinite(fps) || fps < 5 || samples.length < fps * MIN_SECONDS) return null
  const s = detrend(samples, fps)
  const n = s.length
  const mean = s.reduce((a, b) => a + b, 0) / n
  const z = s.map((v) => v - mean)
  const energy = z.reduce((a, b) => a + b * b, 0)
  if (energy < 1e-9) return null
  const lagMin = Math.max(2, Math.floor((fps * 60) / 180))
  const lagMax = Math.min(n - 2, Math.ceil((fps * 60) / 40))
  const ac: number[] = []
  for (let lag = 0; lag <= lagMax + 1; lag++) {
    let c = 0
    for (let i = 0; i + lag < n; i++) c += z[i] * z[i + lag]
    ac.push(c / energy)
  }
  // Primeiro máximo local forte: evita escolher o dobro do período (harmônico)
  let best = -1
  for (let lag = lagMin; lag <= lagMax; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1] && ac[lag] > 0.5 * Math.max(...ac.slice(lagMin, lagMax + 1))) {
      best = lag
      break
    }
  }
  if (best < 0) return null
  // Refino parabólico do pico
  const a = ac[best - 1]
  const b = ac[best]
  const c = ac[best + 1]
  const denom = a - 2 * b + c
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0
  const period = best + Math.max(-1, Math.min(1, shift))
  return { bpm: (60 * fps) / period, quality: Math.max(0, Math.min(1, b)) }
}
