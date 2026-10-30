import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SYS_INDEX } from './bodyBuild'
import { HAIR_STYLE, SHELLS, buildEyes, buildScalp, closeLids, headSystemAt, measureEyes, prepareHeadGeometry, scalpWeights, taperNeckBase, trimBust } from './headModel'
import { HEAD_IN_HELMET, splitVisor } from './suitModel'

describe('cabeça fotográfica', () => {
  it('cada ponto da cabeça aponta para o sistema certo: olhos, cabeça e base do pescoço', () => {
    expect(headSystemAt(0.03, 1.595, 0.07)).toBe(SYS_INDEX.neuro_ocular + 0.25) // em volta da órbita
    expect(headSystemAt(-0.03, 1.595, 0.07)).toBe(SYS_INDEX.neuro_ocular + 0.25) // os dois lados
    expect(headSystemAt(0, 1.66, 0.09)).toBe(SYS_INDEX.behavior + 0.25) // testa
    expect(headSystemAt(0, 1.55, 0.1)).toBe(SYS_INDEX.behavior + 0.25) // nariz e boca
    expect(headSystemAt(0, 1.44, 0)).toBe(SYS_INDEX.immune + 0.25) // pescoço
  })

  it('a região "mole" não dissolve ao abrir a região: o fracionário é .25', () => {
    for (const p of [[0.03, 1.595, 0.07], [0, 1.66, 0.09], [0, 1.44, 0]]) {
      const s = headSystemAt(p[0], p[1], p[2])
      expect(s - Math.floor(s)).toBeCloseTo(0.25, 6)
    }
  })

  it('a geometria preparada traz todos os atributos que o shader do corpo espera', () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.6, 0.1, 0.01, 1.6, 0.1, 0, 1.61, 0.1], 3))
    g.setIndex([0, 1, 2])
    const out = prepareHeadGeometry(g, null)
    for (const name of ['aSys', 'aBase', 'aDir', 'aW', 'aAO', 'aCut']) expect(out.getAttribute(name), name).toBeTruthy()
    expect(out.getAttribute('aBase').count).toBe(3)
    expect((out.getAttribute('aAO') as THREE.BufferAttribute).getX(0)).toBe(1) // sem oclusão extra: a textura já tem sombra
    expect((out.getAttribute('aCut') as THREE.BufferAttribute).getX(0)).toBe(-1) // sem corte de gola
    // a original não é alterada
    expect(g.getAttribute('aSys')).toBeUndefined()
  })

  it('com um sistema fixo, todos os vértices ganham ele (olhos e cabelo)', () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.6, 0.1, 0.01, 1.2, 0.1, 0, 1.61, 0.1], 3))
    const out = prepareHeadGeometry(g, SYS_INDEX.neuro_ocular)
    const s = out.getAttribute('aSys') as THREE.BufferAttribute
    for (let i = 0; i < 3; i++) expect(s.getX(i)).toBe(SYS_INDEX.neuro_ocular)
  })
})

describe('olhos', () => {
  /** Dois globos de 12,5 mm de raio, no lugar dos olhos do corpo (x = ±31 mm, y = 1,59, z = 63,5 mm), como esferas grosseiras */
  function coarseEyes() {
    const parts = [0.031, -0.031].map((x) => {
      const s = new THREE.SphereGeometry(0.0125, 12, 8)
      s.translate(x, 1.591, 0.0635)
      return s
    })
    const pos = parts.flatMap((p) => Array.from(p.getAttribute('position').array))
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }

  it('cada olho vira uma esfera fina no mesmo centro e raio, deslocada um pouco para dentro da órbita', () => {
    const eyes = buildEyes(coarseEyes())
    const p = eyes.getAttribute('position') as THREE.BufferAttribute
    expect(p.count).toBe(2 * 49 * 33)
    for (const x of [0.031, -0.031]) {
      const v = new THREE.Vector3()
      let front = -Infinity
      const box = new THREE.Box3()
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i)
        if (Math.sign(v.x) !== Math.sign(x)) continue
        box.expandByPoint(v)
        front = Math.max(front, v.z)
      }
      const c = box.getCenter(new THREE.Vector3())
      expect(c.x).toBeCloseTo(x, 3)
      expect(c.y).toBeCloseTo(1.591, 3)
      expect(c.z).toBeLessThan(0.0635) // um pouco para dentro da órbita (a córnea sobe e puxa a caixa só uns 0,3 mm de volta)
      // o ponto da frente (córnea) fica um pouco além do raio, sem passar de 1,5 mm: nada sai das pálpebras
      expect(front - 0.0635).toBeGreaterThan(0.0125 - 0.0012)
      expect(front - 0.0635).toBeLessThan(0.0125 + 0.0015)
    }
  })

  it('traz UV de esfera (a íris em +z cai em u = 0,25, v = 0,5) e normais', () => {
    const eyes = buildEyes(coarseEyes())
    const uv = eyes.getAttribute('uv') as THREE.BufferAttribute
    const p = eyes.getAttribute('position') as THREE.BufferAttribute
    const c = new THREE.Vector3(0.031, 1.591, 0.0635 - 0.0012)
    let best = 0, bestZ = -Infinity
    for (let i = 0; i < p.count; i++) {
      if (p.getX(i) > 0 && p.getZ(i) > bestZ) { bestZ = p.getZ(i); best = i }
    }
    expect(uv.getX(best)).toBeCloseTo(0.25, 1)
    expect(uv.getY(best)).toBeCloseTo(0.5, 1)
    expect(eyes.getAttribute('normal')).toBeTruthy()
    expect(c.x).toBeGreaterThan(0)
  })
})

describe('busto e base do pescoço', () => {
  function mesh(tris: number[][][]) {
    const pos: number[] = []
    const idx: number[] = []
    tris.forEach((t) => {
      const base = pos.length / 3
      for (const p of t) pos.push(...p)
      idx.push(base, base + 1, base + 2)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    return g
  }

  it('trimBust tira só o que é largo e fica inteiro abaixo da linha do queixo: pescoço e mandíbula ficam', () => {
    const g = mesh([
      [[0.09, 1.4, 0], [0.1, 1.42, 0.01], [0.09, 1.43, 0.02]], // flange do ombro (largo, baixo)
      [[0.04, 1.4, 0], [0.05, 1.42, 0.01], [0.04, 1.43, 0.02]], // pescoço
      [[0.09, 1.46, 0], [0.1, 1.5, 0.01], [0.09, 1.48, 0.02]], // mandíbula: passa da linha do queixo, fica
      [[0.07, 1.4, 0], [0.075, 1.42, 0.01], [0.07, 1.43, 0.02]], // pescoço de avatar largo, ainda dentro do limite
    ])
    const out = trimBust(g)
    expect(out.index!.count / 3).toBe(3)
    const keep = Array.from(out.index!.array)
    expect(keep).not.toContain(0) // o primeiro triângulo (vértices 0, 1, 2) saiu
    expect(keep).toContain(3)
  })

  it('trimBust não mexe numa cabeça sem busto', () => {
    const g = mesh([[[0.04, 1.4, 0], [0.05, 1.42, 0.01], [0.04, 1.43, 0.02]], [[0, 1.5, 0.05], [0.03, 1.55, 0.09], [-0.03, 1.55, 0.09]]])
    const before = Array.from(g.index!.array)
    expect(Array.from(trimBust(g).index!.array)).toEqual(before)
  })

  it('taperNeckBase encolhe a base em direção ao eixo e deixa o pescoço de cima como está', () => {
    const g = mesh([
      [[0.08, 1.4, 0.0], [-0.08, 1.4, 0.0], [0.0, 1.4, 0.06]], // base
      [[0.06, 1.46, 0.0], [-0.06, 1.46, 0.0], [0.0, 1.46, 0.05]], // acima da zona afinada
      [[0.06, 1.47, 0.0], [-0.06, 1.47, 0.0], [0.0, 1.47, 0.05]], // o eixo é o centro destes vértices
    ])
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const top = [p.getX(3), p.getY(3), p.getZ(3)]
    taperNeckBase(g)
    expect(Math.abs(p.getX(0))).toBeLessThan(0.08 * 0.6) // a base ficou a ~55% da largura
    expect(Math.abs(p.getX(0))).toBeGreaterThan(0.08 * 0.5)
    expect(p.getX(3)).toBeCloseTo(top[0], 6) // acima de 1,448 nada muda
    expect(p.getY(3)).toBeCloseTo(top[1], 6)
    expect(p.getY(0)).toBeCloseTo(1.4, 5) // só a seção horizontal encolhe: a altura continua
  })

  it('taperNeckBase sem vértices na altura do eixo devolve a malha como está', () => {
    const g = mesh([[[0.08, 1.2, 0], [-0.08, 1.2, 0], [0, 1.2, 0.06]]])
    const before = Array.from((g.getAttribute('position') as THREE.BufferAttribute).array)
    taperNeckBase(g)
    expect(Array.from((g.getAttribute('position') as THREE.BufferAttribute).array)).toEqual(before)
  })

  it('closeLids desce a margem da pálpebra de cima, sobe a de baixo e nunca entra no globo', () => {
    const eyes = [{ c: new THREE.Vector3(0.031, 1.591, 0.0635), r: 0.0125 }]
    const up = [0.031, 1.591 + 0.011, 0.0635 + 0.011] // pálpebra de cima, perto do globo
    const low = [0.031, 1.591 - 0.011, 0.0635 + 0.011]
    const far = [0.2, 1.7, 0.1]
    const g = mesh([[up, low, far]])
    closeLids(g, eyes)
    const p = g.getAttribute('position') as THREE.BufferAttribute
    expect(p.getY(0)).toBeLessThan(up[1])
    expect(p.getY(1)).toBeGreaterThan(low[1])
    expect(p.getX(2)).toBeCloseTo(far[0], 6) // longe do olho, nada muda
    expect(p.getY(2)).toBeCloseTo(far[1], 6)
    for (const i of [0, 1]) {
      const d = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).distanceTo(eyes[0].c)
      expect(d).toBeGreaterThanOrEqual(0.0125 * 1.08 - 1e-6)
    }
  })

  it('measureEyes acha o centro e o raio de cada globo, e ignora os do lado oposto', () => {
    const parts = [0.031, -0.031].map((x) => {
      const s = new THREE.SphereGeometry(0.0125, 14, 10)
      s.translate(x, 1.591, 0.0635)
      return s
    })
    const pos = parts.flatMap((s) => Array.from(s.getAttribute('position').array))
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const e = measureEyes(g)
    expect(e).toHaveLength(2)
    const left = e.find((b) => b.c.x > 0)!
    expect(left.c.x).toBeCloseTo(0.031, 3)
    expect(left.c.y).toBeCloseTo(1.591, 3)
    expect(left.r).toBeCloseTo(0.0125, 3)
  })
})

describe('couro cabeludo e cabelo em camadas', () => {
  const pos = (pts: number[][]) => new THREE.Float32BufferAttribute(pts.flat(), 3)
  const uv = (n: number) => new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)

  it('só conta acima da linha do cabelo e atrás da cabeça: o rosto, o queixo e o pescoço ficam de fora', () => {
    const pts = [
      [0, 1.72, 0.0], // alto da cabeça
      [0, 1.67, 0.07], // testa, acima da linha do cabelo
      [0.0, 1.6, 0.09], // rosto
      [0, 1.55, 0.08], // boca
      [0, 1.52, -0.08], // nuca
      [0, 1.4, -0.05], // pescoço
      [0.08, 1.6, 0.0], // lateral da cabeça, acima da orelha
      [0.08, 1.52, 0.0], // orelha e bochecha: abaixo da linha das laterais
      [0.03, 1.62, 0.09], // sobrancelha: perto do centro do rosto
    ]
    const w = scalpWeights(pos(pts), uv(pts.length), null, [0.7, 0.5, 0.4])
    expect(w[0]).toBeGreaterThan(0.9)
    expect(w[1]).toBeGreaterThan(0.5)
    expect(w[2]).toBe(0)
    expect(w[3]).toBe(0)
    expect(w[4]).toBeGreaterThan(0.5)
    expect(w[5]).toBe(0)
    expect(w[6]).toBeGreaterThan(0.9)
    expect(w[7]).toBe(0)
    expect(w[8]).toBe(0)
  })

  it('monta o couro cabeludo com os triângulos cobertos e uma camada instanciada por fio de altura', () => {
    // uma grade de 12 x 12 vértices no alto da cabeça (y = 1,7), 242 triângulos
    const pts: number[][] = []
    const uvs: number[] = []
    for (let a = 0; a <= 11; a++) for (let b = 0; b <= 11; b++) { pts.push([-0.05 + a * 0.009, 1.7, -0.05 + b * 0.009]); uvs.push(a / 11, b / 11) }
    const idx: number[] = []
    for (let a = 0; a < 11; a++) for (let b = 0; b < 11; b++) { const i = a * 12 + b; idx.push(i, i + 1, i + 12, i + 1, i + 13, i + 12) }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', pos(pts))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(idx)
    const weights = scalpWeights(g.getAttribute('position') as THREE.BufferAttribute, g.getAttribute('uv') as THREE.BufferAttribute, null, [0.7, 0.5, 0.4])
    const out = buildScalp(g, weights, SHELLS)!
    expect(out).not.toBeNull()
    expect(out.geometry.index!.count / 3).toBe(242)
    const shell = out.geometry.getAttribute('aShell') as THREE.InstancedBufferAttribute
    expect(shell.count).toBe(SHELLS)
    expect(shell.getX(0)).toBeGreaterThan(0)
    expect(shell.getX(SHELLS - 1)).toBe(1)
    expect(out.geometry.getAttribute('aScalp')).toBeTruthy()
    // 1 unidade de UV por 0,099 m (11 passos de 9 mm): ~10 UV por metro
    expect(out.uvScale).toBeCloseTo(1 / 0.099, 0)
  })

  it('sem triângulos de cabelo suficientes não monta couro cabeludo', () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', pos([[0, 1.6, 0.09], [0.01, 1.6, 0.09], [0, 1.61, 0.09]]))
    g.setAttribute('uv', uv(3))
    g.setIndex([0, 1, 2])
    const w = scalpWeights(g.getAttribute('position') as THREE.BufferAttribute, g.getAttribute('uv') as THREE.BufferAttribute, null, [0.7, 0.5, 0.4])
    expect(buildScalp(g, w, SHELLS)).toBeNull()
  })

  it('cada astronauta tem um estilo; sem cartões onde o avatar não precisa deles', () => {
    for (const id of ['lena', 'aiko', 'rafael', 'daniel']) {
      const s = HAIR_STYLE[id]
      expect(s, id).toBeTruthy()
      expect(s.len).toBeGreaterThan(0.005)
      expect(s.len).toBeLessThan(0.05)
      expect(s.cover).toBeGreaterThan(0.5)
    }
    expect(HAIR_STYLE.rafael.cards).toBe(false) // as tiras do avatar apareciam como barras
    expect(HAIR_STYLE.daniel.cards).toBe(false)
    expect(HAIR_STYLE.lena.cards).toBe(true) // rabo de cavalo e franja
  })
})

describe('visor do capacete', () => {
  it('sem os mapas do arquivo (fora do navegador) nada é separado e o traje fica inteiro', () => {
    const idx = [0, 1, 2, 2, 3, 0]
    const P = new Float32Array(12)
    const uv = new THREE.BufferAttribute(new Float32Array(8), 2)
    const out = splitVisor(idx, P, uv, null, null)
    expect(Array.from(out.body)).toEqual(idx)
    expect(out.visor.length).toBe(0)
  })

  it('a cabeça sobe no capacete mas não avança (o queixo furava a frente do capacete)', () => {
    expect(HEAD_IN_HELMET.lift).toBeGreaterThan(0.08)
    expect(HEAD_IN_HELMET.lift).toBeLessThan(0.16)
    expect(HEAD_IN_HELMET.forward).toBe(0)
  })
})
