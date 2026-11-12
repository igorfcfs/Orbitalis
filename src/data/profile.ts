import type { SystemId } from '../types'

// RF-34: perfil pré-voo de cada astronauta (genótipo, metilação do DNA, sorologia e histórico), 100% sintético.
// Catálogo FECHADO: só entram achados com estudo publicado que os ligue a um risco do voo (decisão do dono, 12/11/2026).
// Nada de doença genética sem ligação com o voo, nem prontuário (CLAUDE.md §14). O perfil nunca chega ao motor:
// status, limiar, projeção e ação são os mesmos com e sem ele (teste em lib/personalize.test.ts).

export type FindingKind = 'genotype' | 'epigenetic' | 'serology' | 'history'

export const KIND_LABEL: Record<FindingKind, string> = {
  genotype: 'Genotype',
  epigenetic: 'DNA methylation',
  serology: 'Serology',
  history: 'Pre-flight history',
}

export interface ProfileStudy {
  cite: string
  doi: string
  /** Quem foi estudado: deixa claro se a evidência vem de astronautas, de uma pessoa ou da Terra */
  who: string
}

/** Estudos conferidos em 12/11/2026 (DOI, revista e amostra). Nenhum outro pode ser citado por uma nota. */
export const PROFILE_STUDIES = {
  zwart2016: { cite: 'Zwart et al., 2016, FASEB Journal', doi: '10.1096/fj.15-278457', who: '49 astronauts' },
  mehta2017: { cite: 'Mehta et al., 2017, npj Microgravity', doi: '10.1038/s41526-017-0015-y', who: '23 astronauts on the ISS' },
  crucian2016: { cite: 'Crucian et al., 2016, International Journal of General Medicine', doi: '10.2147/IJGM.S114188', who: '46 ISS crew members, from medical records' },
  viola2007: { cite: 'Viola et al., 2007, Current Biology', doi: '10.1016/j.cub.2007.01.073', who: '24 people on Earth' },
  barger2014: { cite: 'Barger et al., 2014, Lancet Neurology', doi: '10.1016/S1474-4422(14)70122-X', who: '85 Shuttle and ISS astronauts' },
  garrett2019: { cite: 'Garrett-Bakelman et al., 2019, Science (NASA Twins Study)', doi: '10.1126/science.aau8650', who: 'One astronaut, with his twin on Earth as control' },
} satisfies Record<string, ProfileStudy>

export type StudyId = keyof typeof PROFILE_STUDIES

export interface Finding {
  id: string
  kind: FindingKind
  label: string
  systems: SystemId[]
  /** Métricas a que a nota dá contexto, da mais ligada para a menos ligada (decide a ordem no nível 3) */
  metrics: string[]
  /** O que o achado significa no voo. Sem diagnóstico, medicamento nem número que não venha do estudo. */
  note: string
  studies: StudyId[]
}

export const FINDINGS: Record<string, Finding> = {
  'sans-onecarbon': {
    id: 'sans-onecarbon', kind: 'genotype', label: 'One-carbon pathway alleles MTRR 66 G and SHMT1 1420 C',
    systems: ['neuro_ocular'], metrics: ['disc', 'acuity'], studies: ['zwart2016'],
    note: 'Astronauts who carried these alleles were more likely to show eye changes after flight. It gives your eye exams more weight. Your grade is still judged by the same threshold.',
  },
  'latent-herpes': {
    id: 'latent-herpes', kind: 'serology', label: 'Latent herpesviruses: antibodies to varicella-zoster and Epstein–Barr',
    systems: ['immune'], metrics: ['lymph', 'temp', 'wbc'], studies: ['mehta2017'],
    note: 'Viruses already in the body reactivated more often on long ISS flights, as stress hormones changed. A fall in lymphocytes or a rise in temperature has more context in your case. The limits do not change.',
  },
  atopy: {
    id: 'atopy', kind: 'history', label: 'Known atopic sensitivity of skin and airways',
    systems: ['immune'], metrics: ['temp', 'wbc'], studies: ['crucian2016'],
    note: 'Rashes and allergy-like reactions were the most common symptoms reported on long ISS flights. A known sensitivity makes them likelier for you. It changes no limit and no action.',
  },
  'per3-long': {
    id: 'per3-long', kind: 'genotype', label: 'Clock gene PER3, two long alleles (5/5)',
    systems: ['behavior'], metrics: ['sleep', 'cognition'], studies: ['viola2007', 'barger2014'],
    note: 'On Earth, people with this genotype lost more performance after a short night; that study did not involve astronauts. Astronauts do sleep less in flight, but no study links this genotype to sleep in orbit. Sleep is judged by the same threshold.',
  },
  'oxstress-methylation': {
    id: 'oxstress-methylation', kind: 'epigenetic', label: 'Oxidative-stress and immune genes: methylation above the ground reference',
    systems: ['radiation', 'immune'], metrics: ['career_dose', 'mission_dose'], studies: ['garrett2019'],
    note: 'In the NASA Twins Study, a year in orbit shifted methylation in these same pathways and raised chromosome damage. Your pre-flight baseline is the reference for any change. One astronaut was studied, so it explains and does not predict.',
  },
}
