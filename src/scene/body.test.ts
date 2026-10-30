import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { classify } from './anatomy'
import { BODY_POINTS, warp } from './bodyBuild'
import { suitSystemAt } from './suitModel'

const at = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)

describe('proporções do corpo', () => {
  it('o corpo masculino é o do atlas, sem deformação', () => {
    const p = at(0.18, 1.3, 0.05)
    expect(warp(p.clone(), 'male').toArray()).toEqual(p.toArray())
  })

  it('o corpo feminino tem ombros mais estreitos que o masculino', () => {
    const shoulder = warp(at(0.2, 1.39), 'female')
    expect(shoulder.x).toBeLessThan(0.2 * 0.92)
  })

  it('o quadril feminino é mais largo em relação ao ombro, e a cintura é marcada', () => {
    const f = (x: number, y: number) => warp(at(x, y), 'female').x / x
    expect(f(0.1, 0.9)).toBeGreaterThan(1.05)
    expect(f(0.12, 1.08)).toBeLessThan(f(0.12, 0.9))
    expect(f(0.12, 1.08)).toBeLessThan(0.97)
  })

  it('a cabeça feminina é um pouco menor', () => {
    const top = warp(at(0, 1.74), 'female')
    expect(top.y).toBeLessThan(1.74)
    expect(top.y).toBeGreaterThan(1.71)
    const side = warp(at(0.08, 1.6), 'female')
    expect(side.x).toBeLessThan(0.08 * 0.95)
  })

  it('o busto avança na frente do tórax e os glúteos para trás', () => {
    expect(warp(at(0.085, 1.27, 0.1), 'female').z).toBeGreaterThan(0.1 + 0.02)
    expect(warp(at(0.05, 0.92, -0.1), 'female').z).toBeLessThan(-0.1 - 0.015)
  })

  it('pontos soltos (olhos, juntas) acompanham a mesma deformação', () => {
    const eye = warp(BODY_POINTS.eyeL.clone(), 'female')
    expect(eye.x).toBeLessThan(BODY_POINTS.eyeL.x)
    expect(Math.abs(eye.y - BODY_POINTS.eyeL.y)).toBeLessThan(0.02)
  })
})

describe('camadas do atlas por sistema', () => {
  it('esqueleto e músculos vão para os sistemas monitorados', () => {
    expect(classify('skeleton', 'Femur')).toBe('skeletal')
    expect(classify('muscles', 'Biceps brachii')).toBe('muscular')
  })

  it('nervos: o óptico é neuro-ocular, o cérebro é sono e comportamento, o resto fica neutro', () => {
    expect(classify('nerves', 'Optic nerve')).toBe('neuro_ocular')
    expect(classify('nerves', 'Cerebellum')).toBe('behavior')
    expect(classify('nerves', 'Femoral nerve')).toBe('rest')
  })

  it('órgãos: coração e intestino contam, o pulmão fica neutro', () => {
    expect(classify('organs', 'Left ventricle')).toBe('cardiovascular')
    expect(classify('organs', 'Stomach')).toBe('nutrition')
    expect(classify('organs', 'Right lung')).toBe('rest')
  })

  it('circulação: linfonodos são imunes, o resto é cardiovascular', () => {
    expect(classify('vessels', 'Axillary lymph node')).toBe('immune')
    expect(classify('vessels', 'Abdominal aorta')).toBe('cardiovascular')
  })
})

describe('traje de EVA', () => {
  it('cada região do traje aponta para o sistema do corpo que está por baixo', () => {
    expect(suitSystemAt(0, 1.8, -0.1)).toBe('behavior') // capacete, por trás
    expect(suitSystemAt(0, 1.7, 0.2)).toBe('neuro_ocular') // viseira
    expect(suitSystemAt(0, 1.5, 0)).toBe('immune') // anel do pescoço
    expect(suitSystemAt(0.1, 1.3, 0.2)).toBe('cardiovascular') // peito
    expect(suitSystemAt(0.4, 1.3, 0.1)).toBe('muscular') // braço
    expect(suitSystemAt(0, 1.1, 0.2)).toBe('nutrition') // abdômen
    expect(suitSystemAt(0, 0.9, 0)).toBe('skeletal') // bacia
    expect(suitSystemAt(0.3, 1.0, 0.3)).toBe('muscular') // mãos à frente, na altura da cintura
    expect(suitSystemAt(0.1, 0.4, 0)).toBe('muscular') // pernas
  })
})
