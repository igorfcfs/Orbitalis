import type { Welds } from './bodyBuild'

/**
 * Oclusão ambiente por vértice, sem raios: um vértice dentro de uma concavidade (axila, virilha, base do pescoço,
 * órbita, dobra do tecido) fica abaixo da média dos vizinhos ao longo da normal. A diferença entre a posição
 * suavizada e a original, projetada na normal, é positiva nas concavidades e negativa nas saliências.
 * Duas escalas: dobras finas (poucas iterações) e cavidades largas (muitas). Resultado de 0 a 1 (1 = aberto).
 */
export function cavityAO(pos: ArrayLike<number>, nor: ArrayLike<number>, welds: Welds, opts?: { fine?: number; wide?: number; fineScale?: number; wideScale?: number }): Float32Array {
  const { gid, count: G, start, adj } = welds
  const n = gid.length
  const fine = opts?.fine ?? 3
  const wide = opts?.wide ?? 14
  const fs = opts?.fineScale ?? 0.0045
  const ws = opts?.wideScale ?? 0.018

  // Um ponto e uma normal por grupo soldado
  const gp = new Float32Array(G * 3)
  const gn = new Float32Array(G * 3)
  for (let i = 0; i < n; i++) {
    const k = gid[i]
    gp[3 * k] = pos[3 * i]
    gp[3 * k + 1] = pos[3 * i + 1]
    gp[3 * k + 2] = pos[3 * i + 2]
    gn[3 * k] += nor[3 * i]
    gn[3 * k + 1] += nor[3 * i + 1]
    gn[3 * k + 2] += nor[3 * i + 2]
  }
  for (let k = 0; k < G; k++) {
    const l = Math.hypot(gn[3 * k], gn[3 * k + 1], gn[3 * k + 2]) || 1
    gn[3 * k] /= l
    gn[3 * k + 1] /= l
    gn[3 * k + 2] /= l
  }

  const cur = new Float32Array(gp)
  const tmp = new Float32Array(G * 3)
  const relax = () => {
    for (let k = 0; k < G; k++) {
      const s = start[k], e = start[k + 1]
      if (e === s) {
        tmp[3 * k] = cur[3 * k]; tmp[3 * k + 1] = cur[3 * k + 1]; tmp[3 * k + 2] = cur[3 * k + 2]
        continue
      }
      let x = 0, y = 0, z = 0
      for (let j = s; j < e; j++) {
        const q = adj[j] * 3
        x += cur[q]; y += cur[q + 1]; z += cur[q + 2]
      }
      const m = e - s
      tmp[3 * k] = 0.5 * cur[3 * k] + 0.5 * (x / m)
      tmp[3 * k + 1] = 0.5 * cur[3 * k + 1] + 0.5 * (y / m)
      tmp[3 * k + 2] = 0.5 * cur[3 * k + 2] + 0.5 * (z / m)
    }
    cur.set(tmp)
  }
  const along = (k: number) =>
    (cur[3 * k] - gp[3 * k]) * gn[3 * k] + (cur[3 * k + 1] - gp[3 * k + 1]) * gn[3 * k + 1] + (cur[3 * k + 2] - gp[3 * k + 2]) * gn[3 * k + 2]

  const c1 = new Float32Array(G)
  for (let it = 0; it < wide; it++) {
    relax()
    if (it + 1 === fine) for (let k = 0; k < G; k++) c1[k] = along(k)
  }
  const ao = new Float32Array(G)
  for (let k = 0; k < G; k++) {
    const f = Math.min(1, Math.max(0, c1[k] / fs))
    const w = Math.min(1, Math.max(0, along(k) / ws))
    ao[k] = Math.max(0.3, 1 - 0.5 * f - 0.42 * w)
  }
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = ao[gid[i]]
  return out
}
