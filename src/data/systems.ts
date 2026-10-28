import type { MetricDef, SystemDef, SystemId } from '../types'
import { EXTRA_METRIC, EXTRA_SYSTEM } from './extras'
import { RULES } from './rules'

const INSTR = {
  astroskin: 'Bio-Monitor (Astroskin, CSA)',
  analyzer: 'Bio-Analyzer (CSA)',
  oct: 'OCT and fundoscope (ISS)',
  slammd: 'SLAMMD',
  ared: 'ARED / T2 / CEVIS',
  rad: 'Personal active dosimeter (ESA)',
  cognition: 'Cognition test battery',
  dxa: 'Pre-flight DXA scan + bone-loss model',
}

type BaseMetric = Omit<MetricDef, 'rule' | 'cadence' | 'heritage' | 'minutes' | 'plain'>
const BASE_METRICS: Record<string, BaseMetric> = {
  rhr: {
    id: 'rhr', system: 'cardiovascular', label: 'Resting heart rate', unit: 'bpm', decimals: 0, baseline: 58, typical: 60,
    provenance: 'CONTINUOUS', threshold: { kind: 'provisional', text: 'Provisional threshold 50–85 bpm', range: [50, 85] },
    instrument: INSTR.astroskin, how: 'Worn during sleep and rest. No action needed to collect it.',
    why: 'Resting heart rate rises when the heart is deconditioned or the body is under strain.',
  },
  sbp: {
    id: 'sbp', system: 'cardiovascular', label: 'Systolic blood pressure', unit: 'mmHg', decimals: 0, baseline: 118, typical: 121,
    provenance: 'CONTINUOUS', threshold: { kind: 'provisional', text: 'Provisional threshold < 130 mmHg', limit: 130 },
    instrument: INSTR.astroskin, how: 'Measured by the wearable sensor during the day.',
    why: 'Fluid shifts in microgravity change blood pressure, so the trend matters more than a single reading.',
  },
  vo2: {
    id: 'vo2', system: 'cardiovascular', label: 'Aerobic capacity', unit: '% of pre-flight', decimals: 0, baseline: 100, typical: 90,
    provenance: 'PERIODIC', threshold: { kind: 'nasa', id: 'V1 4003', text: 'NASA-STD-3001 [V1 4003] ≥ 80%', limit: 80 },
    instrument: INSTR.ared, how: 'Graded exercise test on the cycle ergometer, with the wearable on.',
    why: 'Aerobic capacity predicts how well you can work on arrival, when gravity returns.',
  },
  bmd: {
    id: 'bmd', system: 'skeletal', label: 'Hip + spine bone density', unit: '% of pre-flight', decimals: 1, baseline: 100, typical: 96.3,
    provenance: 'ESTIMATED', threshold: { kind: 'nasa', id: 'V1 4027', text: 'NASA-STD-3001 [V1 4027] ≥ 95%', limit: 95 },
    instrument: INSTR.dxa, how: 'Not measured on board. Estimated from the pre-flight DXA scan and the published loss rate.',
    why: 'Bone that carries no weight is rebuilt slowly, so density falls steadily without countermeasures.',
  },
  fn: {
    id: 'fn', system: 'skeletal', label: 'Femoral neck density', unit: '% of pre-flight', decimals: 1, baseline: 100, typical: 94.4,
    provenance: 'ESTIMATED', threshold: { kind: 'nasa', id: 'V1 4027', text: 'NASA-STD-3001 [V1 4027] ≥ 90%', limit: 90 },
    instrument: INSTR.dxa, how: 'Not measured on board. Estimated from the pre-flight DXA scan and the published loss rate.',
    why: 'The hip is the most fracture-prone site on return, which is why it has its own limit.',
  },
  strength: {
    id: 'strength', system: 'muscular', label: 'Musculoskeletal strength', unit: '% of pre-flight', decimals: 0, baseline: 100, typical: 92,
    provenance: 'PERIODIC', threshold: { kind: 'nasa', id: 'V1 4024', text: 'NASA-STD-3001 [V1 4024] ≥ 80%', limit: 80 },
    instrument: INSTR.ared, how: 'Strength test on the resistive device.',
    why: 'Strength shows whether the exercise plan is enough to keep muscle working without load.',
  },
  exercise: {
    id: 'exercise', system: 'muscular', label: 'Exercise, 7-day average', unit: 'min/day', decimals: 0, baseline: 120, typical: 116,
    provenance: 'LOGGED', threshold: { kind: 'provisional', text: 'Provisional threshold ≥ 90 min/day', limit: 90 },
    instrument: INSTR.ared, how: 'Logged when you finish a session on ARED, T2 or CEVIS.',
    why: 'Exercise minutes are the lever you control. Strength and bone follow them with a delay.',
  },
  disc: {
    id: 'disc', system: 'neuro_ocular', label: 'Optic disc edema (Frisén)', unit: 'grade 0–5', decimals: 0, baseline: 0, typical: 0,
    provenance: 'PERIODIC', threshold: { kind: 'provisional', text: 'Provisional threshold: grade ≥ 1 needs review', limit: 1 },
    instrument: INSTR.oct, how: 'Optical coherence tomography scan of the back of the eye.',
    why: 'Fluid shifting toward the head can swell the optic disc. The grade shows how far it has progressed.',
  },
  acuity: {
    id: 'acuity', system: 'neuro_ocular', label: 'Visual acuity', unit: 'decimal', decimals: 1, baseline: 1.0, typical: 1.0,
    provenance: 'LOGGED', threshold: { kind: 'provisional', text: 'Provisional threshold ≥ 0.8', limit: 0.8 },
    instrument: INSTR.oct, how: 'Read the chart at the set distance, one eye at a time, and log the line.',
    why: 'A drop in acuity is the symptom that matters most for mission work.',
  },
  wbc: {
    id: 'wbc', system: 'immune', label: 'Leukocytes', unit: '×10³/µL', decimals: 1, baseline: 6.2, typical: 6.6,
    provenance: 'PERIODIC', threshold: { kind: 'clinical', text: 'Terrestrial clinical range 4.5–11.0', range: [4.5, 11] },
    instrument: INSTR.analyzer, how: 'Finger-prick blood sample in the Bio-Analyzer. Result in 2–3 hours.',
    why: 'Total white cells show whether the immune system is under stress or fighting something.',
  },
  lymph: {
    id: 'lymph', system: 'immune', label: 'Lymphocytes', unit: '×10³/µL', decimals: 1, baseline: 2.0, typical: 1.9,
    provenance: 'PERIODIC', threshold: { kind: 'clinical', text: 'Terrestrial clinical range 1.0–4.8', range: [1, 4.8] },
    instrument: INSTR.analyzer, how: 'Same blood sample as leukocytes. No extra step.',
    why: 'Lymphocytes coordinate defense against viruses. Low counts are a flag, not a diagnosis.',
  },
  energy: {
    id: 'energy', system: 'nutrition', label: 'Energy intake', unit: '% of need', decimals: 0, baseline: 100, typical: 103,
    provenance: 'LOGGED', threshold: { kind: 'nasa', id: 'V1 4020', text: 'NASA-STD-3001 [V1 4020] 100%', limit: 100 },
    instrument: 'Food log', how: 'Log each meal from the onboard food system.',
    why: 'Eating less than you burn costs muscle and bone, whatever the exercise plan.',
  },
  mass: {
    id: 'mass', system: 'nutrition', label: 'Body mass', unit: 'kg', decimals: 1, baseline: 72, typical: 70.8,
    provenance: 'PERIODIC', threshold: { kind: 'provisional', text: 'Provisional threshold: within 5% of pre-flight mass' },
    instrument: INSTR.slammd, how: 'Step on the mass measurement device.',
    why: 'Mass trends show whether intake is matching expenditure over weeks.',
  },
  glucose: {
    id: 'glucose', system: 'nutrition', label: 'Fasting glucose', unit: 'mg/dL', decimals: 0, baseline: 88, typical: 91,
    provenance: 'PERIODIC', threshold: { kind: 'clinical', text: 'Terrestrial fasting range 70–99', range: [70, 99] },
    instrument: INSTR.analyzer, how: 'Finger-prick sample before the first meal.',
    why: 'Glucose is an early marker of how the body handles energy under stress and inactivity.',
  },
  sleep: {
    id: 'sleep', system: 'behavior', label: 'Sleep duration', unit: 'h', decimals: 1, baseline: 7.4, typical: 7.0,
    provenance: 'CONTINUOUS', threshold: { kind: 'provisional', text: 'Provisional threshold ≥ 6.5 h', limit: 6.5 },
    instrument: INSTR.astroskin, how: 'Worn during sleep. No action needed to collect it.',
    why: 'Short sleep slows reaction and judgment, and the debt compounds across days.',
  },
  cognition: {
    id: 'cognition', system: 'behavior', label: 'Cognitive performance', unit: '% of pre-flight', decimals: 0, baseline: 100, typical: 97,
    provenance: 'PERIODIC', threshold: { kind: 'provisional', text: 'Provisional threshold ≥ 90% of pre-flight', limit: 90 },
    instrument: INSTR.cognition, how: 'Short computer test battery.',
    why: 'Performance on standard tasks shows whether fatigue is already affecting work.',
  },
  mood: {
    id: 'mood', system: 'behavior', label: 'Mood (self-rated)', unit: 'score 1–5', decimals: 1, baseline: 4.1, typical: 3.9,
    provenance: 'LOGGED', threshold: { kind: 'provisional', text: 'Provisional threshold ≥ 3.0', limit: 3 },
    instrument: 'Daily check-in', how: 'Rate how you feel from 1 to 5 in the daily check-in.',
    why: 'Mood is the earliest signal of isolation and workload strain, and only you can report it.',
  },
  mission_dose: {
    id: 'mission_dose', system: 'radiation', label: 'Mission dose', unit: 'mSv', decimals: 1, baseline: 0, typical: 255.6,
    provenance: 'CONTINUOUS', threshold: { kind: 'provisional', text: 'Provisional threshold: cruise rate 1.8 mSv/day' },
    instrument: INSTR.rad, how: 'Worn dosimeter. No action needed to collect it.',
    why: 'Dose accumulates every day in deep space. The mission total feeds your career total.',
  },
  career_dose: {
    id: 'career_dose', system: 'radiation', label: 'Career dose', unit: 'mSv', decimals: 1, baseline: 150, typical: 405.6,
    provenance: 'CONTINUOUS', threshold: { kind: 'nasa', id: 'V1 4030', text: 'NASA-STD-3001 [V1 4030] < 600 mSv', limit: 600 },
    instrument: INSTR.rad, how: 'Pre-mission career dose plus the mission dose from your dosimeter.',
    why: 'The career limit caps lifetime cancer risk. What you spend now is not available on later missions.',
  },
  space_weather: {
    id: 'space_weather', system: 'radiation', label: 'Proton flux, >10 MeV', unit: 'pfu', decimals: 1, baseline: 0.1, typical: 0.4,
    provenance: 'SAMPLE', threshold: { kind: 'provisional', text: 'Provisional threshold: ≥ 10 pfu is a radiation storm', limit: 10 },
    instrument: 'NASA DONKI (CCMC) space weather feed', how: 'Pulled from the public feed. Shown as a sample when offline.',
    why: 'Solar storms can add a large dose within hours, so the live flux decides when to shelter.',
  },
}

type BaseSystem = Omit<SystemDef, 'region' | 'evidence' | 'hotspotOffset'>
const BASE_SYSTEMS: Record<SystemId, BaseSystem> = {
  cardiovascular: {
    id: 'cardiovascular', name: 'Cardiovascular',
    mechanism: 'Without gravity, fluid shifts toward the head and the heart works against less load. Regular aerobic exercise keeps the heart and vessels conditioned for the return to gravity.',
    summary: {
      nominal: 'Heart and vessels are holding steady against the pre-flight baseline.',
      watch: 'Cardiovascular readings are drifting from baseline; keep aerobic sessions on schedule.',
      critical: 'A cardiovascular reading breaches its limit. Act now.',
    },
    actions: ['EX-AER', 'EARTH-PACKET'], hotspot: [0.06, 1.3, 0.13],
    focus: { target: [0, 1.3, 0], distance: 2.6 }, metrics: ['rhr', 'sbp', 'vo2'],
  },
  skeletal: {
    id: 'skeletal', name: 'Skeletal',
    mechanism: 'Bone stops bearing weight in microgravity, so it is rebuilt more slowly than it is removed. Resistive exercise and vitamin D protect density. There is no densitometer on board, so density is estimated from the pre-flight scan.',
    summary: {
      nominal: 'Estimated bone density is on the expected curve for this point in the mission.',
      watch: 'Estimated bone density is close to its limit. Resistive exercise is the lever.',
      critical: 'Estimated bone density is below its limit. Act now.',
    },
    actions: ['EX-RES', 'EX-PLAN'], hotspot: [-0.13, 0.95, 0.11],
    focus: { target: [0, 0.9, 0], distance: 3.0 }, metrics: ['bmd', 'fn'],
  },
  muscular: {
    id: 'muscular', name: 'Muscular',
    mechanism: 'Muscles that no longer carry body weight shrink and weaken, especially in the legs and back. Daily resistive and aerobic sessions are the main countermeasure, so adherence to the plan matters.',
    summary: {
      nominal: 'Strength and exercise time are on plan.',
      watch: 'Exercise has slipped from plan and strength is starting to follow.',
      critical: 'Strength is below its limit. Act now.',
    },
    actions: ['EX-PLAN', 'EX-RES'], hotspot: [0.14, 0.72, 0.11],
    focus: { target: [0, 0.65, 0], distance: 3.0 }, metrics: ['strength', 'exercise'],
  },
  neuro_ocular: {
    id: 'neuro_ocular', name: 'Neuro-ocular',
    mechanism: 'Fluid shifting toward the head can swell the optic disc and change vision. Regular eye exams catch changes early, and the symptoms you log help the flight surgeon judge them.',
    summary: {
      nominal: 'Optic disc and vision are unchanged from baseline.',
      watch: 'Mild optic disc swelling is present. Repeat the exam and log any symptoms.',
      critical: 'Optic disc swelling or vision loss needs attention now.',
    },
    actions: ['OCU-EXAM', 'EARTH-PACKET'], hotspot: [0, 1.68, 0.11],
    focus: { target: [0, 1.68, 0], distance: 2.1 }, metrics: ['disc', 'acuity'],
  },
  immune: {
    id: 'immune', name: 'Immune',
    mechanism: 'Spaceflight stress and disrupted sleep change how immune cells behave. Blood counts show whether cell levels stay inside the usual terrestrial range.',
    summary: {
      nominal: 'Blood cell counts are inside the usual terrestrial range.',
      watch: 'A cell count is below the usual range. Collect a fresh blood sample.',
      critical: 'Blood counts are well outside range. Act now.',
    },
    actions: ['IMM-SAMPLE', 'EARTH-PACKET'], hotspot: [-0.2, 1.42, 0.08],
    focus: { target: [-0.05, 1.3, 0], distance: 2.7 }, metrics: ['wbc', 'lymph'],
  },
  nutrition: {
    id: 'nutrition', name: 'Nutrition',
    mechanism: 'Eating less than the body burns leads to muscle and bone loss. Intake, mass and glucose show whether energy and nutrients are keeping up.',
    summary: {
      nominal: 'Intake, mass and glucose are in line with need.',
      watch: 'Energy intake is falling short of need. Raise it before mass follows.',
      critical: 'Nutrition is well short of need. Act now.',
    },
    actions: ['NUT-CAL', 'NUT-D'], hotspot: [0.07, 1.1, 0.14],
    focus: { target: [0, 1.1, 0], distance: 2.7 }, metrics: ['energy', 'mass', 'glucose'],
  },
  behavior: {
    id: 'behavior', name: 'Sleep & behavior',
    mechanism: 'Sleep, workload and isolation shape mood and thinking. Short sleep slows reaction and judgment, so restoring a sleep window is the first lever.',
    summary: {
      nominal: 'Sleep, thinking and mood are close to baseline.',
      watch: 'Sleep and mood are slipping. Protect tonight’s sleep window.',
      critical: 'Sleep is far below plan and affecting work. Act now.',
    },
    actions: ['SLP-EXT', 'SLP-LIGHT'], hotspot: [-0.13, 1.75, 0.05],
    focus: { target: [0, 1.68, 0], distance: 2.1 }, metrics: ['sleep', 'cognition', 'mood'],
  },
  radiation: {
    id: 'radiation', name: 'Radiation',
    mechanism: 'Outside Earth’s magnetic field, cosmic rays and solar particles add dose every day. Career dose is tracked against a lifetime limit, and a solar storm can add a large dose within hours.',
    summary: {
      nominal: 'Dose is on budget and space weather is quiet.',
      watch: 'At the current rate, career dose reaches its limit soon. Review the remaining budget.',
      critical: 'A solar particle event is under way. Move to the storm shelter.',
    },
    actions: ['RAD-REVIEW', 'EARTH-PACKET'], hotspot: [0.4, 1.15, 0],
    focus: { target: [0, 0.95, 0], distance: 3.8 }, metrics: ['mission_dose', 'career_dose', 'space_weather'],
  },
}

export const METRICS: Record<string, MetricDef> = Object.fromEntries(
  Object.entries(BASE_METRICS).map(([id, m]) => [id, { ...m, ...RULES[id], ...EXTRA_METRIC[id] }]),
)

export const SYSTEMS = Object.fromEntries(
  Object.entries(BASE_SYSTEMS).map(([id, s]) => [id, { ...s, ...EXTRA_SYSTEM[id as SystemId] }]),
) as Record<SystemId, SystemDef>

export const SYSTEM_IDS = Object.keys(SYSTEMS) as SystemId[]

/** Desempate da ação prioritária (spec §6) */
export const PRIORITY_ORDER: SystemId[] = [
  'radiation', 'behavior', 'neuro_ocular', 'nutrition', 'skeletal', 'muscular', 'cardiovascular', 'immune',
]
