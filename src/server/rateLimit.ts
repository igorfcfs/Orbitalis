// Limite de requisições por IP para a rota de IA (a chave é paga por chamada).
// Janela deslizante em memória: vale por instância. Numa função serverless cada instância tem a sua contagem,
// então o limite reduz o abuso, mas não o impede. O teto de gasto de verdade fica no painel do provedor da chave.
export interface Limiter {
  allow(key: string, now?: number): boolean
}

export function createLimiter(max = 20, windowMs = 10 * 60_000): Limiter {
  const hits = new Map<string, number[]>()
  return {
    allow(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
      if (recent.length >= max) {
        hits.set(key, recent)
        return false
      }
      recent.push(now)
      hits.set(key, recent)
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k)
      return true
    },
  }
}

/** Origem do pedido: o primeiro IP de x-forwarded-for (atrás do proxy da Vercel) ou um valor fixo. */
export const clientKey = (forwarded: string | string[] | null | undefined): string =>
  (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || 'unknown'
