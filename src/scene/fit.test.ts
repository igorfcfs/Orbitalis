import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { BODY_POINTS, buildWelds, coverCut, warp, weldedNormals } from './bodyBuild'
import { COLLAR_BASE, collarPlane } from './collar'
import { cavityAO } from './meshAO'
import { fitSuit, foreTaper, type SuitModel } from './suitModel'

describe('gola e punhos do macacão', () => {
  const cut = coverCut('male')

  it('o macacão não é cortado onde não há gola nem punho', () => {
    expect(cut('torso', 0.4, 1.3, 0.05)).toBeNull() // fora da faixa do pescoço e do ombro
    expect(cut('arm', 0.3, 1.1, 0)).toBeNull()
    expect(cut('leg', 0.1, 0.5, 0)).toBeNull()
  })

  it('o corte da gola é um plano limpo acima do ombro: abaixo fica, acima é removido', () => {
    expect(cut('neck', 0, COLLAR_BASE - 0.02, -0.02)!).toBeLessThan(0)
    expect(cut('neck', 0, COLLAR_BASE + 0.05, -0.02)!).toBeGreaterThan(0)
    // o topo do ombro também é "arm" no atlas: sem cortá-lo ficavam dentes em volta da gola
    for (const c of ['torso', 'arm'] as const) {
      expect(cut(c, 0.05, COLLAR_BASE + 0.01, 0)!).toBeGreaterThan(0)
      expect(cut(c, 0.05, COLLAR_BASE - 0.01, 0)!).toBeLessThan(0)
    }
  })

  it('o plano da gola é horizontal perto do pescoço: a altura do corte não depende de z', () => {
    expect(cut('neck', 0, 1.43, 0.06)).toBeCloseTo(cut('neck', 0, 1.43, -0.1)!, 9)
  })

  it('o plano sobe pelo ombro e passa do trapézio: o ombro natural fica inteiro (sem prateleira)', () => {
    expect(collarPlane(0)).toBe(COLLAR_BASE)
    expect(collarPlane(0.1)).toBe(COLLAR_BASE)
    expect(collarPlane(0.2)).toBeGreaterThan(COLLAR_BASE + 0.05)
    expect(collarPlane(-0.2)).toBe(collarPlane(0.2)) // o lado direito é o espelho
    // o topo do ombro do atlas, com a casca inflada, fica perto de 1,43 a 20 cm do centro: o plano já passou dele
    expect(collarPlane(0.2)).toBeGreaterThan(1.43)
    // fora da faixa de ombros o macacão não é cortado
    expect(cut('arm', 0.4, 1.5, 0)).toBeNull()
  })

  it('o punho termina logo depois do pulso, no eixo do antebraço', () => {
    const w = BODY_POINTS.wristL
    expect(cut('wrist', w.x, w.y, w.z)!).toBeLessThan(0) // o pulso está dentro do punho
    expect(cut('wrist', w.x + 0.05, w.y - 0.25, w.z)!).toBeGreaterThan(0) // a mão já passou do corte
  })

  it('o lado direito é o espelho do esquerdo', () => {
    const w = BODY_POINTS.wristL
    expect(cut('wrist', -w.x, w.y - 0.02, w.z)).toBeCloseTo(cut('wrist', w.x, w.y - 0.02, w.z)!, 6)
  })

  it('no corpo feminino o plano do punho acompanha o pulso deformado', () => {
    const f = coverCut('female')
    const w = warp(BODY_POINTS.wristL.clone(), 'female')
    expect(f('wrist', w.x, w.y, w.z)!).toBeLessThan(0)
  })
})

describe('normais da cabeça', () => {
  // Uma folha fina como os lábios do atlas: a face de fora e a de dentro dividem os mesmos três vértices
  const pos = new Float32Array([0.0, 1.55, 0.09, 0.01, 1.55, 0.09, 0.0, 1.56, 0.09])
  const outer = [0, 1, 2] // normal para +z (para fora da cabeça)
  const inner = [0, 2, 1] // normal para -z (para dentro)

  it('com o filtro, só a face de fora conta: a normal aponta para fora da cabeça', () => {
    const idx = Uint32Array.from([...outer, ...inner])
    const n = weldedNormals(pos, idx, buildWelds(pos, idx), true)
    expect(n[2]).toBeGreaterThan(0.99)
  })

  it('se o vértice só tem faces de dentro, usa elas (a normal não some)', () => {
    const idx = Uint32Array.from(inner)
    const n = weldedNormals(pos, idx, buildWelds(pos, idx), true)
    expect(n[2]).toBeLessThan(-0.99)
  })

  it('fora da cabeça (abaixo do pescoço) o filtro não muda nada', () => {
    const low = new Float32Array([0.0, 1.0, 0.09, 0.01, 1.0, 0.09, 0.0, 1.01, 0.09])
    const idx = Uint32Array.from([...outer, ...outer.map((k) => k)]) // duas faces iguais: só a contagem muda, não a direção
    const w = buildWelds(low, idx)
    const a = weldedNormals(low, idx, w, true)
    const b = weldedNormals(low, idx, w, false)
    for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i], 6)
  })
})

describe('oclusão ambiente por cavidade', () => {
  /** Grade de n×n em x/z com a altura dada por h(x, z); normais para cima. */
  function grid(n: number, h: (x: number, z: number) => number) {
    const pos = new Float32Array(n * n * 3)
    const nor = new Float32Array(n * n * 3)
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = (j * n + i) * 3
        const x = (i / (n - 1) - 0.5) * 0.4
        const z = (j / (n - 1) - 0.5) * 0.4
        pos.set([x, h(x, z), z], k)
        nor.set([0, 1, 0], k)
      }
    }
    const idx: number[] = []
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i
        idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1)
      }
    }
    return { pos, nor, idx: Uint32Array.from(idx), n }
  }

  it('uma superfície plana fica toda aberta (1)', () => {
    const g = grid(21, () => 0)
    const ao = cavityAO(g.pos, g.nor, buildWelds(g.pos, g.idx))
    for (const v of ao) expect(v).toBeGreaterThan(0.99)
  })

  it('o fundo de uma vala escurece e a borda fica aberta', () => {
    const g = grid(41, (x) => -0.03 * Math.exp(-(x * x) / (2 * 0.02 * 0.02)))
    const ao = cavityAO(g.pos, g.nor, buildWelds(g.pos, g.idx))
    const mid = Math.floor(g.n / 2)
    const bottom = ao[mid * g.n + mid]
    const far = ao[mid * g.n + 1]
    expect(bottom).toBeLessThan(0.85)
    expect(far).toBeGreaterThan(0.98)
  })

  it('uma saliência não escurece', () => {
    const g = grid(41, (x) => 0.03 * Math.exp(-(x * x) / (2 * 0.02 * 0.02)))
    const ao = cavityAO(g.pos, g.nor, buildWelds(g.pos, g.idx))
    const mid = Math.floor(g.n / 2)
    expect(ao[mid * g.n + mid]).toBeGreaterThan(0.97)
  })
})

describe('traje de EVA ajustado ao corpo', () => {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  /** Faixa de vértices entre dois pontos, com largura, ligados em triângulos (uma peça soldada). */
  function strip(a: THREE.Vector3, b: THREE.Vector3, width: number, rows = 30, cols = 20) {
    const pos: number[] = []
    const axis = b.clone().sub(a)
    const side = new THREE.Vector3(1, 0, 0).cross(axis).normalize().multiplyScalar(width)
    const side2 = axis.clone().cross(side).normalize().multiplyScalar(width)
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = r / rows
        const th = (c / cols) * Math.PI * 2
        const p = a.clone().lerp(b, t).addScaledVector(side, Math.cos(th)).addScaledVector(side2, Math.sin(th))
        pos.push(p.x, p.y, p.z)
      }
    }
    const idx: number[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i0 = r * cols + c
        const i1 = r * cols + ((c + 1) % cols)
        idx.push(i0, i0 + cols, i1, i1, i0 + cols, i1 + cols)
      }
    }
    return { pos, idx }
  }

  /**
   * Um Z-2 mínimo: o tronco, e dois braços de duas peças (braço e antebraço com luva) na pose do modelo, esticados à frente. O
   * antebraço segue o eixo medido no modelo de verdade (uns 12° para dentro do braço), de 40 cm até a ponta da luva.
   */
  function fakeZ2(): SuitModel {
    const parts = [
      strip(V(0, 1.1, 0.0), V(0, 1.45, 0.2), 0.16), // tronco
      strip(V(0.2925, 1.395, 0.2715), V(0.309, 1.2885, 0.4035), 0.07), // braço esquerdo
      strip(V(0.305, 1.27, 0.419), V(0.234, 1.085, 0.768), 0.06), // antebraço esquerdo
      strip(V(-0.2925, 1.395, 0.2715), V(-0.309, 1.2885, 0.4035), 0.07), // braço direito
      strip(V(-0.305, 1.27, 0.419), V(-0.234, 1.085, 0.768), 0.06), // antebraço direito
    ]
    const pos: number[] = []
    const idx: number[] = []
    for (const p of parts) {
      const base = pos.length / 3
      pos.push(...p.pos)
      for (const i of p.idx) idx.push(base + i)
    }
    const n = pos.length / 3
    const nor = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) nor.set([0, 0, 1], 3 * i)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2))
    g.setIndex(idx)
    return { geometry: g, visor: null, map: null, bump: null, spec: null }
  }

  const raw = fakeZ2()
  const male = fitSuit(raw, 'male')
  const female = fitSuit(raw, 'female')
  const posOf = (m: SuitModel) => m.geometry.getAttribute('position') as THREE.BufferAttribute
  const armOf = (m: SuitModel) => m.geometry.getAttribute('aArm') as THREE.BufferAttribute
  // Cada peça tem 31 anéis de 20 vértices, na ordem do fixture: 0 tronco, 1 braço e 2 antebraço (esquerdos), 3 e 4 (direitos)
  const PER_PIECE = 31 * 20
  const ring = (m: SuitModel, piece: number, r: number) => {
    const p = posOf(m)
    const c = new THREE.Vector3()
    for (let k = 0; k < 20; k++) c.add(new THREE.Vector3().fromBufferAttribute(p, piece * PER_PIECE + r * 20 + k))
    return c.divideScalar(20)
  }
  const ringRadius = (m: SuitModel, piece: number, r: number) => {
    const p = posOf(m)
    const c = ring(m, piece, r)
    let s = 0
    for (let k = 0; k < 20; k++) s += new THREE.Vector3().fromBufferAttribute(p, piece * PER_PIECE + r * 20 + k).distanceTo(c)
    return s / 20
  }

  it('reconhece os braços e deixa o tronco fixo', () => {
    const arm = armOf(male)
    let arms = 0
    let fixed = 0
    for (let i = 0; i < arm.count; i++) (arm.getX(i) > 0.5 ? arms++ : fixed++)
    expect(arms).toBeGreaterThan(0)
    expect(fixed).toBeGreaterThan(0)
    // 4 peças de braço e uma de tronco, todas com o mesmo número de vértices
    expect(arms).toBe(fixed * 4)
  })

  // A direção exata dos braços (ARM_UP e ARM_FORE em suitModel.ts) é ajuste manual do dono do produto e não é fixada aqui: estes
  // testes só garantem que a pose segue natural (braço desce do ombro, não cruza o corpo, não sobe, mão fora das coxas).
  it('os braços ficam numa pose natural: descem do ombro, sem cruzar o corpo nem subir, e a mão fica fora das coxas', () => {
    for (const m of [male, female]) {
      const S = ring(m, 1, 0) // anel do ombro, preso ao tronco
      const E = ring(m, 1, 30) // anel do cotovelo
      const T = ring(m, 2, 30) // ponta da luva
      const up = E.clone().sub(S).normalize()
      const fore = T.clone().sub(E).normalize()
      // o braço desce do ombro, reto ou para fora, e não vai para trás
      expect(up.y).toBeLessThan(-0.5)
      expect(up.x).toBeGreaterThan(0)
      expect(up.z).toBeGreaterThan(-0.3)
      // o antebraço também desce, e o cotovelo não dobra além de 80°
      expect(fore.y).toBeLessThan(-0.3)
      expect(THREE.MathUtils.radToDeg(up.angleTo(fore))).toBeLessThan(80)
      // a mão fica abaixo do ombro, não passa muito à frente dele e fica fora das coxas
      expect(T.y).toBeGreaterThan(0.7)
      expect(T.y).toBeLessThan(1.15)
      expect(T.z - S.z).toBeGreaterThan(-0.1)
      expect(T.z - S.z).toBeLessThan(0.8)
      expect(T.x).toBeGreaterThan(0.25)
    }
  })

  it('o braço tem proporções de braço: o cotovelo fica entre o peito e a cintura', () => {
    const E = ring(male, 1, 30)
    expect(E.y).toBeGreaterThan(1.0)
    expect(E.y).toBeLessThan(1.28)
  })

  it('o ombro continua preso ao tronco, onde o modelo o põe', () => {
    const want = new THREE.Vector3(0.2925, 1.395, 0.2715 - 0.135) // ombro do Z-2 e o recuo do tronco (corpo masculino: sem ajuste de largura)
    expect(ring(male, 1, 0).distanceTo(want)).toBeLessThan(0.02)
  })

  it('braço e antebraço continuam ligados no cotovelo (sem fresta) e o tubo do braço não murcha na dobra', () => {
    for (const m of [male, female]) {
      expect(ring(m, 1, 30).distanceTo(ring(m, 2, 0))).toBeLessThan(0.06)
      // cada ponto gira rigidamente, em vez de misturar duas posições: a seção do braço mantém o raio
      expect(ringRadius(m, 1, 30)).toBeGreaterThan(0.07 * 0.9)
      expect(ringRadius(m, 1, 15)).toBeCloseTo(0.07, 2)
    }
  })

  it('a manga afina como um antebraço: começa por dentro do braço, mais fina, sem murchar, e a luva não muda', () => {
    for (const m of [male, female]) {
      for (const k of [0, 3, 6, 10]) {
        expect(ringRadius(m, 2, k)).toBeLessThan(ringRadius(m, 1, 30))
        expect(ringRadius(m, 2, k)).toBeGreaterThan(0.06 * 0.7)
      }
      // depois do punho (a 21,5 cm do anel do cotovelo) a luva fica do tamanho do modelo (no corpo feminino, só o estreitamento do traje)
      expect(ringRadius(m, 2, 30)).toBeCloseTo(0.06, 2)
    }
    // a tabela: por dentro da bainha no anel, um pouco mais cheia no cotovelo, mais fina perto do punho, inteira na luva
    expect(foreTaper(0)).toBeLessThan(foreTaper(0.06))
    expect(foreTaper(0.18)).toBeLessThan(foreTaper(0.06))
    expect(foreTaper(0.3)).toBe(1)
  })

  it('o braço direito é o espelho do esquerdo', () => {
    for (const [l, r] of [[1, 3], [2, 4]]) {
      for (const k of [0, 10, 20, 30]) {
        const a = ring(male, l, k)
        const b = ring(male, r, k)
        expect(b.x).toBeCloseTo(-a.x, 4)
        expect(b.y).toBeCloseTo(a.y, 4)
        expect(b.z).toBeCloseTo(a.z, 4)
      }
    }
  })

  it('no corpo feminino o traje é mais estreito e as mãos ficam mais perto do corpo', () => {
    expect(ring(female, 2, 30).x).toBeLessThan(ring(male, 2, 30).x - 0.01)
  })

  it('o corpo feminino recebe um traje mais estreito que o masculino', () => {
    // largura na altura dos ombros (o estreitamento cresce do quadril para cima)
    const width = (m: SuitModel) => {
      const p = posOf(m)
      const arm = armOf(m)
      let w = 0
      for (let i = 0; i < p.count; i++) if (arm.getX(i) < 0.5 && p.getY(i) > 1.4) w = Math.max(w, Math.abs(p.getX(i)))
      return w
    }
    expect(width(female)).toBeLessThan(width(male) * 0.95)
  })

  it('o tronco do traje fica atrás do astronauta (o corpo entra pela frente)', () => {
    const src = posOf(raw)
    const out = posOf(male)
    let zSrc = 0
    let zOut = 0
    for (let i = 0; i < src.count; i++) {
      zSrc += src.getZ(i)
      zOut += out.getZ(i)
    }
    expect(zOut / out.count).toBeLessThan(zSrc / src.count)
  })

  it('o ajuste é guardado por corpo e a mesma chamada devolve o mesmo modelo', () => {
    expect(fitSuit(raw, 'male')).toBe(male)
    expect(fitSuit(raw, 'female')).toBe(female)
    expect(female).not.toBe(male)
  })

  it('traz os atributos do shader do corpo e a oclusão', () => {
    for (const name of ['aSys', 'aArm', 'aBase', 'aDir', 'aW', 'aAO', 'uv', 'normal']) {
      expect(male.geometry.getAttribute(name), name).toBeTruthy()
    }
    const ao = male.geometry.getAttribute('aAO') as THREE.BufferAttribute
    for (let i = 0; i < ao.count; i++) {
      expect(ao.getX(i)).toBeGreaterThan(0.29)
      expect(ao.getX(i)).toBeLessThanOrEqual(1)
    }
  })
})
