import type { Astronaut } from '../types'

// Tripulação 100% fictícia. O status de cada um nasce do motor, não de valores marcados à mão:
// os overrides só definem os valores do dia 142 e quando cada exame foi feito pela última vez.
export const ASTRONAUTS: Astronaut[] = [
  {
    id: 'lena', initials: 'LM', name: 'Lena Moreau', role: 'Commander', look: { skin: '#e8bfa3', hair: '#5a3524', eyes: '#4f7fa8', build: 'female', accent: '#4f8cff' }, heightM: 1.7, tempBaseline: 36.6, tempNow: 36.7,
    headline: {
      nominal: 'All systems on baseline.',
      watch: 'Career radiation dose is on course to reach its limit before arrival.',
      critical: 'A system breaches its limit.',
    },
    overrides: {
      career_dose: { baseline: 330, value: 585.6 },
      mass: { baseline: 64, value: 62.9 },
      disc: { lastTaken: 126 },
    },
  },
  {
    id: 'rafael', initials: 'RD', name: 'Rafael Duarte', role: 'Flight Engineer', look: { skin: '#c58b62', hair: '#17110e', eyes: '#7a5a2c', build: 'male', accent: '#a37bff' }, heightM: 1.82, tempBaseline: 36.5, tempNow: 36.5,
    headline: {
      nominal: 'All systems on baseline.',
      watch: 'Exercise has slipped from plan, and bone and muscle are starting to pay for it.',
      critical: 'A system breaches its limit.',
    },
    overrides: {
      bmd: { value: 95.6 },
      strength: { value: 84, lastTaken: 112 },
      exercise: { value: 72 },
      mass: { baseline: 82, value: 80.6 },
      career_dose: { baseline: 210, value: 465.6 },
    },
  },
  {
    id: 'aiko', initials: 'AS', name: 'Aiko Sato', role: 'Crew Medical Officer', isCMO: true, look: { skin: '#ecc9a8', hair: '#1d1513', eyes: '#3b2518', build: 'female', accent: '#dfe6f7' }, heightM: 1.62, tempBaseline: 36.6, tempNow: 36.8,
    headline: {
      nominal: 'All systems on baseline.',
      watch: 'Energy intake is drifting down toward the requirement.',
      critical: 'Sleep is far below plan. As medical officer, a backup CMO is the consult.',
    },
    overrides: {
      sleep: { value: 5.3 },
      energy: { value: 100.6, from: 104 },
      mass: { baseline: 58, value: 56.9, lastTaken: 133 },
      career_dose: { baseline: 180, value: 435.6 },
    },
  },
  {
    id: 'daniel', initials: 'DO', name: 'Daniel Osei', role: 'Mission Specialist', look: { skin: '#7b4d34', hair: '#0f0c0b', eyes: '#47290f', build: 'male', accent: '#6ec1e4' }, heightM: 1.78, tempBaseline: 36.7, tempNow: 36.7,
    headline: {
      nominal: 'All systems on baseline.',
      watch: 'Mild optic disc swelling, and lymphocytes are below the usual range.',
      critical: 'A system breaches its limit.',
    },
    overrides: {
      disc: { value: 1, lastTaken: 128 },
      lymph: { value: 0.9, lastTaken: 126 },
      wbc: { lastTaken: 126 },
      mass: { baseline: 78, value: 76.8 },
      career_dose: { baseline: 140, value: 395.6 },
    },
  },
]
