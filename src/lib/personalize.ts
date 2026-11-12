import { FINDINGS, PROFILE_STUDIES, type Finding, type ProfileStudy } from '../data/profile'
import type { Astronaut, PreflightProfile, SystemId } from '../types'

// RF-34: personalizar é escolher e ordenar notas de um catálogo fechado. Funções puras; nada aqui é lido pelo motor.

/** Achados do astronauta que existem no catálogo, na ordem do perfil. Um ID desconhecido é ignorado, nunca vira texto. */
export function profileFindings(astro: Astronaut): Finding[] {
  return (astro.profile?.findings ?? []).flatMap((id) => (FINDINGS[id] ? [FINDINGS[id]] : []))
}

/** Notas que dão contexto a uma métrica, da mais ligada a ela para a menos ligada (empate: ordem do perfil). */
export function contextFor(astro: Astronaut, metricId: string): Finding[] {
  return profileFindings(astro)
    .filter((f) => f.metrics.includes(metricId))
    .map((f, i) => ({ f, i, rank: f.metrics.indexOf(metricId) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ f }) => f)
}

/** Notas ligadas a um sistema (nível 2, "How it works"). */
export function systemFindings(astro: Astronaut, system: SystemId): Finding[] {
  return profileFindings(astro).filter((f) => f.systems.includes(system))
}

export const studiesOf = (f: Finding): ProfileStudy[] => f.studies.map((s) => PROFILE_STUDIES[s])

export const doiUrl = (doi: string) => `https://doi.org/${doi}`

/** A fase da coleta: o perfil é de terra, antes do voo, e nunca é apresentado como medido em órbita. */
export function collectedText(p: PreflightProfile): string {
  return `Collected on the ground ${Math.abs(p.collectedDay)} days before launch. Not measured in orbit.`
}

/**
 * Linhas do pacote do flight surgeon: só os achados ligados aos sistemas que já estão no pacote
 * (minimização do dado genético). Sem perfil, ou sem ligação, a seção não aparece.
 */
export function profilePacketLines(astro: Astronaut, systems: SystemId[]): string[] {
  if (!astro.profile) return []
  const linked = profileFindings(astro).filter((f) => f.systems.some((s) => systems.includes(s)))
  if (!linked.length) return []
  return [
    'Pre-flight profile linked to the items above (synthetic; context only, it set no status)',
    `  ${collectedText(astro.profile)}`,
    ...linked.flatMap((f) => [
      `  ${f.label}`,
      `      ${f.note}`,
      `      ${studiesOf(f).map((s) => `${s.cite}, doi:${s.doi}`).join('; ')}`,
    ]),
  ]
}
