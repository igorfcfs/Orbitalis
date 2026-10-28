import type { Point } from '../types'

export interface Regression {
  slope: number
  intercept: number
}

/** Regressão linear por mínimos quadrados. Menos de 2 pontos → inclinação zero. */
export function regress(points: Point[]): Regression {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.value ?? 0 }
  const mx = points.reduce((s, p) => s + p.day, 0) / n
  const my = points.reduce((s, p) => s + p.value, 0) / n
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.day - mx) * (p.value - my)
    den += (p.day - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  return { slope, intercept: my - slope * mx }
}

/**
 * Janela de projeção (spec §6): últimos 14 dias para métricas diárias,
 * últimas 3 amostras para as periódicas.
 */
export function projectionWindow(points: Point[], mode: 'continuous' | 'periodic'): Point[] {
  if (points.length === 0) return []
  if (mode === 'periodic') return points.slice(-3)
  const last = points[points.length - 1].day
  return points.filter((p) => p.day >= last - 14)
}

export const HORIZON_DAYS = 30

/** Valor projetado `HORIZON_DAYS` dias após o último ponto. */
export function project(points: Point[], mode: 'continuous' | 'periodic', fromDay: number) {
  const window = projectionWindow(points, mode)
  const r = regress(window)
  const lastValue = points[points.length - 1]?.value ?? 0
  return { slope: r.slope, projected: lastValue + r.slope * (HORIZON_DAYS + (fromDay - (points[points.length - 1]?.day ?? fromDay))) }
}

/** Dias até cruzar `limit`, ou null se a tendência não cruza. */
export function daysToCross(value: number, slope: number, limit: number, dir: 'min' | 'max'): number | null {
  if (slope === 0) return null
  const days = (limit - value) / slope
  if (days < 0) return null
  if (dir === 'min' && slope >= 0) return null
  if (dir === 'max' && slope <= 0) return null
  return days
}
