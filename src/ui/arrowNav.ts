import type { KeyboardEvent } from 'react'

/** Próximo índice de uma lista de links: setas movem, Home e End vão às pontas, sem dar a volta. null = tecla ignorada. */
export function nextIndex(i: number, n: number, key: string): number | null {
  if (n <= 0) return null
  if (key === 'ArrowDown' || key === 'ArrowRight') return Math.min(n - 1, i + 1)
  if (key === 'ArrowUp' || key === 'ArrowLeft') return Math.max(0, i - 1)
  if (key === 'Home') return 0
  if (key === 'End') return n - 1
  return null
}

/** Navegação por setas entre os links de uma lista (Tab entra, setas percorrem, Enter abre pelo próprio link). */
export function onArrowKeys(e: KeyboardEvent<HTMLElement>) {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  const links = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]'))
  const at = links.indexOf(document.activeElement as HTMLAnchorElement)
  if (at < 0) return
  const to = nextIndex(at, links.length, e.key)
  if (to === null) return
  e.preventDefault()
  links[to]?.focus()
}
