import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { COLLAR_BASE, DEFAULT_NECK, buildCollar, collarPlane, extractCollarLoop, measureNeck, type NeckFit } from './collar'

/** Um macacão mínimo: só os vértices da borda do corte da gola (em y = COLLAR_BASE), com os atributos que a gola lê. */
function fakeCover(radius: (a: number) => number, count = 140): THREE.BufferGeometry {
  const pos: number[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI + 0.013
    const r = radius(a)
    const x = Math.sin(a) * r
    pos.push(x, collarPlane(x), -0.02 + Math.cos(a) * r) // sobre o plano de corte, que sobe pelo ombro
  }
  const n = count
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [0, 1, 0]).flat(), 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [0.1, 0.2, 0.4]).flat(), 3))
  g.setAttribute('aBase', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('aW', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2))
  g.setAttribute('aAO', new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1))
  g.setAttribute('aCut', new THREE.Float32BufferAttribute(new Float32Array(n), 1)) // 0 = borda do corte
  return g
}

describe('laço do corte da gola', () => {
  it('reamostra a borda em ângulos uniformes, na altura do plano', () => {
    const loop = extractCollarLoop(fakeCover(() => 0.14))!
    expect(loop).not.toBeNull()
    expect(loop.count).toBeGreaterThanOrEqual(64)
    for (let i = 0; i < loop.count; i++) expect(loop.P[3 * i + 1]).toBeCloseTo(collarPlane(loop.P[3 * i]), 6)
    // ordem por ângulo, sem voltar atrás
    let prev = -Infinity
    for (let i = 0; i < loop.count; i++) {
      const a = Math.atan2(loop.P[3 * i], loop.P[3 * i + 2] + 0.02)
      expect(a).toBeGreaterThan(prev)
      prev = a
    }
  })

  it('suaviza a borda em zigue-zague e leva os vértices do macacão para o laço suavizado', () => {
    const cover = fakeCover((a) => 0.14 + 0.012 * Math.sin(a * 31))
    const before = (cover.getAttribute('position') as THREE.BufferAttribute).clone()
    const loop = extractCollarLoop(cover)!
    const spread = (xs: Float32Array, step: number) => {
      const r: number[] = []
      for (let i = 0; i < xs.length / step; i++) r.push(Math.hypot(xs[step * i], xs[step * i + 2] + 0.02))
      return Math.max(...r) - Math.min(...r)
    }
    expect(spread(loop.P, 3)).toBeLessThan(0.006)
    // os vértices do macacão acompanham: o raio deles também ficou liso
    const after = cover.getAttribute('position') as THREE.BufferAttribute
    const radii = (p: THREE.BufferAttribute) => Array.from({ length: p.count }, (_, i) => Math.hypot(p.getX(i), p.getZ(i) + 0.02))
    expect(Math.max(...radii(after)) - Math.min(...radii(after))).toBeLessThan(Math.max(...radii(before)) - Math.min(...radii(before)))
  })

  it('sem borda de corte suficiente não há gola', () => {
    const g = fakeCover(() => 0.14, 10)
    expect(extractCollarLoop(g)).toBeNull()
    const noCut = new THREE.BufferGeometry()
    noCut.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
    expect(extractCollarLoop(noCut)).toBeNull()
  })
})

describe('gola em funil em volta do pescoço', () => {
  const loop = extractCollarLoop(fakeCover(() => 0.16))!
  const neck: NeckFit = { cx: 0.004, cz: -0.012, ax: 0.07, az: 0.062 }
  const geo = buildCollar(loop, neck, 2.25)
  const P = geo.getAttribute('position') as THREE.BufferAttribute
  const N = geo.getAttribute('normal') as THREE.BufferAttribute
  const cut = geo.getAttribute('aCut') as THREE.BufferAttribute
  const n = loop.count
  const rings = P.count / n

  it('tem os atributos do shader do macacão', () => {
    for (const name of ['position', 'normal', 'color', 'aBase', 'aSys', 'aDir', 'aW', 'aAO', 'aCut']) expect(geo.getAttribute(name), name).toBeTruthy()
    expect(Number.isInteger(rings)).toBe(true)
    expect(rings).toBeGreaterThanOrEqual(8)
    expect((geo.getAttribute('aSys') as THREE.BufferAttribute).getX(0)).toBe(2.25)
  })

  it('a primeira fileira é o laço do macacão e as outras sobem e se fecham no pescoço', () => {
    for (let i = 0; i < n; i++) {
      expect(P.getX(i)).toBeCloseTo(loop.P[3 * i], 6)
      expect(P.getY(i)).toBeCloseTo(collarPlane(loop.P[3 * i]), 6)
    }
    // o raio ao centro do pescoço diminui da base para o topo da parede de fora
    const radius = (r: number, i: number) => Math.hypot((P.getX(r * n + i) - neck.cx) / neck.ax, (P.getZ(r * n + i) - neck.cz) / neck.az)
    for (let i = 0; i < n; i += 7) {
      expect(radius(0, i)).toBeGreaterThan(radius(2, i))
      expect(radius(2, i)).toBeGreaterThan(radius(4, i))
      expect(radius(4, i)).toBeCloseTo(1, 1) // a parede de pé fica no anel do pescoço
    }
  })

  it('a gola sobe uns 4 a 7 cm do plano e a frente é mais baixa que as costas', () => {
    const topY = (i: number) => P.getY(5 * n + i)
    const all = Array.from({ length: n }, (_, i) => i)
    const front = all.reduce((b, i) => (loop.P[3 * i + 2] > loop.P[3 * b + 2] ? i : b), 0)
    const back = all.reduce((b, i) => (loop.P[3 * i + 2] < loop.P[3 * b + 2] ? i : b), 0)
    expect(topY(front) - COLLAR_BASE).toBeGreaterThan(0.03)
    expect(topY(back) - COLLAR_BASE).toBeLessThan(0.07)
    expect(topY(back)).toBeGreaterThan(topY(front))
    // a borda de cima é quase nivelada: onde o laço sobe pelo ombro a gola só fica mais curta
    const tops = all.map(topY)
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(0.035)
    // (o anel de cima da parede fica 2,8 mm abaixo da borda enrolada)
    for (const i of all) expect(topY(i) - P.getY(i)).toBeGreaterThanOrEqual(0.029)
  })

  it('nenhum ponto entra no pescoço (o forro fica a pelo menos 5 mm dele)', () => {
    const inner = { ax: neck.ax - 0.016 + 0.005, az: neck.az - 0.016 + 0.005 }
    for (let r = 5; r < rings; r++) {
      for (let i = 0; i < n; i++) {
        const q = ((P.getX(r * n + i) - neck.cx) / inner.ax) ** 2 + ((P.getZ(r * n + i) - neck.cz) / inner.az) ** 2
        expect(q).toBeGreaterThan(1)
      }
    }
  })

  it('a distância à borda vale 0 no anel da borda e fica negativa nas outras fileiras', () => {
    let zeros = 0
    for (let r = 0; r < rings; r++) {
      for (let i = 0; i < n; i++) {
        const c = cut.getX(r * n + i)
        expect(c).toBeLessThanOrEqual(0)
        if (c === 0) zeros++
      }
    }
    expect(zeros).toBe(n) // uma fileira só (o anel de cima da borda enrolada)
  })

  it('o sentido dos triângulos concorda com as normais (a luz não fica virada)', () => {
    const idx = geo.index!.array
    let bad = 0
    for (let t = 0; t < idx.length; t += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(P, idx[t])
      const b = new THREE.Vector3().fromBufferAttribute(P, idx[t + 1])
      const c = new THREE.Vector3().fromBufferAttribute(P, idx[t + 2])
      const f = b.clone().sub(a).cross(c.clone().sub(a))
      const nv = new THREE.Vector3().fromBufferAttribute(N, idx[t])
      if (f.dot(nv) < 0) bad++
    }
    expect(bad).toBe(0)
  })
})

describe('anel do pescoço', () => {
  it('sai da caixa dos vértices do pescoço, com folga, e fica entre os limites', () => {
    const pos: number[] = []
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2
      pos.push(0.01 + Math.cos(a) * 0.05, 1.44, -0.03 + Math.sin(a) * 0.045)
    }
    const fit = measureNeck(new THREE.Float32BufferAttribute(pos, 3))
    expect(fit.cx).toBeCloseTo(0.01, 2)
    expect(fit.cz).toBeCloseTo(-0.03, 2)
    expect(fit.ax).toBeGreaterThanOrEqual(0.062)
    expect(fit.ax).toBeLessThan(0.07)
    expect(fit.az).toBeGreaterThan(0.056)
  })

  it('com o índice só conta os vértices que algum triângulo usa (o que o trimBust tirou não entra)', () => {
    const pos: number[] = []
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2
      pos.push(Math.cos(a) * 0.05, 1.44, -0.03 + Math.sin(a) * 0.045) // pescoço
    }
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2
      pos.push(Math.cos(a) * 0.1, 1.44, -0.03 + Math.sin(a) * 0.09) // flange do ombro, fora dos triângulos
    }
    const attr = new THREE.Float32BufferAttribute(pos, 3)
    const idx = Array.from({ length: 40 }, (_, k) => k)
    const all = measureNeck(attr)
    const used = measureNeck(attr, idx)
    expect(used.ax).toBeLessThan(all.ax)
    expect(used.ax).toBeCloseTo(0.05 + 0.016, 2)
  })

  it('sem vértices na faixa usa o anel padrão', () => {
    expect(measureNeck(new THREE.Float32BufferAttribute([0, 1.0, 0, 0, 1.1, 0], 3))).toEqual(DEFAULT_NECK)
  })
})
