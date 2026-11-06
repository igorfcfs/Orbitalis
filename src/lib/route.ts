import { useSyncExternalStore } from 'react'
import { ASTRONAUTS } from '../data/astronauts'
import { METRICS, SYSTEMS } from '../data/systems'
import type { SystemId } from '../types'

export type BodyView = 'home' | 'queue' | 'diary' | 'packet' | 'emergency'

export type Route =
  | { level: 0; page?: 'sources' | 'timeline' }
  | { level: 1; id: string; view: BodyView }
  | { level: 2; id: string; system: SystemId }
  | { level: 3; id: string; system: SystemId; metric: string; log: boolean }

const VIEWS: BodyView[] = ['queue', 'diary', 'packet', 'emergency']

export function parseHash(hash: string): Route {
  const [, root, id, system, metric, extra] = hash.replace(/^#/, '').split('/')
  if (root === 'sources') return { level: 0, page: 'sources' }
  if (root === 'timeline') return { level: 0, page: 'timeline' }
  if (root !== 'body' || !ASTRONAUTS.some((a) => a.id === id)) return { level: 0 }
  if (VIEWS.includes(system as BodyView)) return { level: 1, id, view: system as BodyView }
  if (!system || !(system in SYSTEMS)) return { level: 1, id, view: 'home' }
  const sys = system as SystemId
  if (!metric || !SYSTEMS[sys].metrics.includes(metric) || !(metric in METRICS)) return { level: 2, id, system: sys }
  return { level: 3, id, system: sys, metric, log: extra === 'log' }
}

export function go(path: string) {
  window.location.hash = path
}

export const paths = {
  crew: '#/crew',
  sources: '#/sources',
  timeline: '#/timeline',
  body: (id: string) => `#/body/${id}`,
  view: (id: string, v: BodyView) => `#/body/${id}/${v}`,
  system: (id: string, s: string) => `#/body/${id}/${s}`,
  metric: (id: string, s: string, m: string) => `#/body/${id}/${s}/${m}`,
  log: (id: string, s: string, m: string) => `#/body/${id}/${s}/${m}/log`,
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

let cached: { hash: string; route: Route } | null = null
function snapshot(): Route {
  const hash = window.location.hash
  if (!cached || cached.hash !== hash) cached = { hash, route: parseHash(hash) }
  return cached.route
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot)
}

/** Nível acima do atual (Esc, botão voltar). */
export function parentPath(route: Route): string {
  if (route.level === 3) return route.log ? paths.metric(route.id, route.system, route.metric) : paths.system(route.id, route.system)
  if (route.level === 2) return paths.body(route.id)
  if (route.level === 1) return route.view === 'home' ? paths.crew : paths.body(route.id)
  return paths.crew
}
