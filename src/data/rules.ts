import type { Cadence, Rule } from '../types'

// Regras de status e cadência de coleta por métrica. Fonte única para o motor.
export const RULES: Record<string, { rule: Rule; cadence: Cadence }> = {
  rhr: {
    rule: { dir: 'range', range: [50, 85], critRange: [40, 100] },
    cadence: { mode: 'continuous', step: 2, plausible: [30, 220] },
  },
  sbp: {
    rule: { dir: 'max', watch: 130, crit: 140 },
    cadence: { mode: 'continuous', step: 2, plausible: [70, 220] },
  },
  vo2: {
    rule: { dir: 'min', official: true, limit: 80, margin: 5 },
    cadence: { mode: 'periodic', step: 28, plausible: [30, 130] },
  },
  bmd: {
    rule: { dir: 'min', official: true, limit: 95, margin: 1 },
    cadence: { mode: 'continuous', step: 7, plausible: [70, 105] },
  },
  fn: {
    rule: { dir: 'min', official: true, limit: 90, margin: 1 },
    cadence: { mode: 'continuous', step: 7, plausible: [70, 105] },
  },
  strength: {
    rule: { dir: 'min', official: true, limit: 80, margin: 5 },
    cadence: { mode: 'periodic', step: 28, plausible: [30, 130] },
  },
  exercise: {
    rule: { dir: 'min', watch: 90, crit: 60 },
    cadence: { mode: 'continuous', step: 2, plausible: [0, 300] },
  },
  disc: {
    rule: { dir: 'max', watch: 0, crit: 2 },
    cadence: { mode: 'periodic', step: 14, plausible: [0, 5] },
  },
  acuity: {
    rule: { dir: 'min', watch: 0.8, crit: 0.5 },
    cadence: { mode: 'periodic', step: 14, plausible: [0.1, 2] },
  },
  wbc: {
    rule: { dir: 'range', range: [4.5, 11], critRange: [3, 15] },
    cadence: { mode: 'periodic', step: 14, group: 'blood', plausible: [0.5, 40] },
  },
  lymph: {
    rule: { dir: 'range', range: [1, 4.8], critRange: [0.5, 8] },
    cadence: { mode: 'periodic', step: 14, group: 'blood', plausible: [0.1, 15] },
  },
  temp: {
    rule: { dir: 'range', range: [36, 37.5], critRange: [35, 38] },
    cadence: { mode: 'continuous', step: 2, plausible: [33, 43] },
  },
  energy: {
    rule: { dir: 'min', official: true, limit: 100, margin: 1.5 },
    cadence: { mode: 'continuous', step: 2, plausible: [20, 200] },
  },
  mass: {
    rule: { dir: 'rel', relWatch: 5, relCrit: 10 },
    cadence: { mode: 'periodic', step: 7, plausible: [30, 200] },
  },
  glucose: {
    rule: { dir: 'range', range: [70, 99], critRange: [54, 126] },
    cadence: { mode: 'periodic', step: 7, plausible: [30, 400] },
  },
  sleep: {
    rule: { dir: 'min', watch: 6.5, crit: 5.5 },
    cadence: { mode: 'continuous', step: 2, plausible: [0, 14] },
  },
  cognition: {
    rule: { dir: 'min', watch: 90, crit: 80 },
    cadence: { mode: 'periodic', step: 14, plausible: [20, 130] },
  },
  mood: {
    rule: { dir: 'min', watch: 3, crit: 2 },
    cadence: { mode: 'continuous', step: 2, plausible: [1, 5] },
  },
  mission_dose: {
    rule: { dir: 'none' },
    cadence: { mode: 'continuous', step: 2, plausible: [0, 2000] },
  },
  career_dose: {
    rule: { dir: 'max', official: true, limit: 600, margin: 30 },
    cadence: { mode: 'continuous', step: 2, plausible: [0, 3000] },
  },
  space_weather: {
    rule: { dir: 'max', watch: 10, crit: 1000 },
    cadence: { mode: 'continuous', step: 2, plausible: [0, 100000] },
  },
}

/** Amplitude absoluta do ruído sintético por métrica (unidade da métrica). Zero = série lisa. */
export const NOISE: Record<string, number> = {
  rhr: 1.2, sbp: 2.5, vo2: 1.2, bmd: 0, fn: 0, strength: 0.8, exercise: 6, disc: 0, acuity: 0.03,
  wbc: 0.4, lymph: 0.12, temp: 0.12, energy: 0.8, mass: 0.25, glucose: 2, sleep: 0.35, cognition: 1.2, mood: 0.25,
  mission_dose: 0, career_dose: 0, space_weather: 0,
}
