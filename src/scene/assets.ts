import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

/**
 * Arquivos reais em /public/assets (ver public/assets/ATTRIBUTION.md):
 * mapa global de Marte e céu da Via Láctea (Solar System Scope, CC BY 4.0, dados NASA/ESA),
 * HDRI de estúdio e texturas PBR de tecido e metal pintado (Poly Haven, CC0).
 */
export const ASSET_URL = {
  hdri: '/assets/env/studio_2k.hdr',
  mars: '/assets/space/mars_4k.jpg',
  milkyway: '/assets/space/milkyway_4k.jpg',
  knitNor: '/assets/tex/knit_nor.jpg',
  knitRough: '/assets/tex/knit_rough.jpg',
  weaveNor: '/assets/tex/weave_nor.jpg',
  weaveRough: '/assets/tex/weave_rough.jpg',
  paintDiff: '/assets/tex/paint_diff.jpg',
  paintNor: '/assets/tex/paint_nor.jpg',
  paintRough: '/assets/tex/paint_rough.jpg',
} as const

export type AssetKey = Exclude<keyof typeof ASSET_URL, 'hdri'>

const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

/** Textura com cache. A imagem chega depois; o material se atualiza sozinho quando ela carrega. */
export function tex(key: AssetKey, opts: { srgb?: boolean; repeat?: boolean; anisotropy?: number } = {}): THREE.Texture {
  const id = `${key}:${opts.srgb ? 's' : 'l'}${opts.repeat ? 'r' : ''}`
  let t = cache.get(id)
  if (!t) {
    t = loader.load(ASSET_URL[key])
    t.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = opts.anisotropy ?? 8
    cache.set(id, t)
  }
  return t
}

/** Mapa de ambiente por HDRI. Devolve null se o arquivo faltar: a cena continua com luz própria. */
export async function loadEnvironment(renderer: THREE.WebGLRenderer): Promise<THREE.Texture | null> {
  try {
    const hdr = await new HDRLoader().loadAsync(ASSET_URL.hdri)
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const pm = new THREE.PMREMGenerator(renderer)
    const env = pm.fromEquirectangular(hdr).texture
    hdr.dispose()
    pm.dispose()
    return env
  } catch (e) {
    console.warn('[scene] HDRI unavailable, using room lighting', e)
    return null
  }
}
