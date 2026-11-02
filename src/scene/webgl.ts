/**
 * Detecção de WebGL (RF-20): cria um contexto de teste e o devolve ao navegador na hora.
 * O parâmetro permite testar sem DOM. Qualquer exceção conta como "sem WebGL".
 */
export function webglAvailable(make: () => { getContext: (id: string) => unknown } = () => document.createElement('canvas')): boolean {
  try {
    const canvas = make()
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as { getExtension?: (n: string) => { loseContext?: () => void } | null } | null
    if (!gl) return false
    gl.getExtension?.('WEBGL_lose_context')?.loseContext?.()
    return true
  } catch {
    return false
  }
}
