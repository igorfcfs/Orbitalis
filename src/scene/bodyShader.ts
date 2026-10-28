import * as THREE from 'three'

/**
 * Injeções de shader nos materiais padrão do corpo. Tudo é por vértice (aSys) ou por altura:
 * - hover e brilho de status por sistema;
 * - dissolução do sistema selecionado (revela a anatomia por baixo) e raio-X geral;
 * - varredura de altura que veste e despe o traje;
 * - fade geral do astronauta (dissolve com ruído).
 */

export interface BodyUniforms {
  uHover: THREE.IUniform<number>
  uSel: THREE.IUniform<number>
  uReveal: THREE.IUniform<number>
  uXray: THREE.IUniform<number>
  uTime: THREE.IUniform<number>
  uSuitY: THREE.IUniform<number>
  uFade: THREE.IUniform<number>
  uStat: THREE.IUniform<number[]>
  uStatCol: THREE.IUniform<THREE.Color[]>
  uRevealCol: THREE.IUniform<THREE.Color>
  uHoverCol: THREE.IUniform<THREE.Color>
  /** Intensidade das listras de status (0 = discretas) */
  uStatScale: THREE.IUniform<number>
}

export function makeBodyUniforms(): BodyUniforms {
  return {
    uHover: { value: 0 },
    uSel: { value: 0 },
    uReveal: { value: 0 },
    uXray: { value: 0 },
    uTime: { value: 0 },
    uSuitY: { value: -1 },
    uFade: { value: 0 },
    uStat: { value: new Array(9).fill(0) },
    uStatCol: { value: Array.from({ length: 9 }, () => new THREE.Color('#ffffff')) },
    uRevealCol: { value: new THREE.Color('#7fd0ff') },
    uHoverCol: { value: new THREE.Color('#8fc4ff') },
    uStatScale: { value: 1 },
  }
}

const NOISE = /* glsl */ `
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`

export type ShellMode = 'skin' | 'cover' | 'suit' | 'hair'

/** Aplica o shader do corpo a um MeshStandardMaterial ou MeshPhysicalMaterial. */
export function patchBodyMaterial(mat: THREE.Material, u: BodyUniforms, mode: ShellMode) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uHover: u.uHover, uSel: u.uSel, uReveal: u.uReveal, uXray: u.uXray, uTime: u.uTime, uSuitY: u.uSuitY,
      uFade: u.uFade, uStat: u.uStat, uStatCol: u.uStatCol, uRevealCol: u.uRevealCol, uHoverCol: u.uHoverCol, uStatScale: u.uStatScale,
    })
    const define = `#define BODY_${mode.toUpperCase()}\n`
    shader.vertexShader = define + shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSys; attribute vec3 aBase;
        varying float vSys; varying vec3 vBase; varying float vWY;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSys = aSys; vBase = aBase;
        vWY = (modelMatrix * vec4(transformed, 1.0)).y;`)
    shader.fragmentShader = define + shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uHover; uniform float uSel; uniform float uReveal; uniform float uXray; uniform float uTime;
        uniform float uSuitY; uniform float uFade;
        uniform float uStat[9]; uniform vec3 uStatCol[9]; uniform vec3 uRevealCol; uniform vec3 uHoverCol; uniform float uStatScale;
        varying float vSys; varying vec3 vBase; varying float vWY;
        ${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float nz = vnoise(vBase * 34.0) * 0.65 + vnoise(vBase * 88.0) * 0.35;
        float gEdge = 0.0; float dEdge = 0.0; float fEdge = 0.0;
        #ifdef BODY_SUIT
          if (vWY > uSuitY) discard;
          gEdge = smoothstep(0.04, 0.0, uSuitY - vWY);
        #endif
        #ifdef BODY_COVER
          if (vWY < uSuitY) discard;
          gEdge = smoothstep(0.04, 0.0, vWY - uSuitY);
        #endif
        float rev = (uSel > 0.5 && abs(vSys - uSel) < 0.1) ? uReveal : 0.0;
        rev = max(rev, uXray);
        if (rev > 0.001) { float d = nz - rev * 1.2; if (d < 0.0) discard; dEdge = smoothstep(0.10, 0.0, d); }
        if (uFade > 0.001) { float d = nz - (uFade * 1.25 - 0.12); if (d < 0.0) discard; fEdge = smoothstep(0.08, 0.0, d); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
        #ifdef BODY_SKIN
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.42, 0.28) * 0.2 * fr;
        #endif
        int si = int(vSys + 0.5);
        float hov = (uHover > 0.5 && abs(vSys - uHover) < 0.5) ? 1.0 : 0.0;
        totalEmissiveRadiance += hov * (uHoverCol * 0.22 + uHoverCol * fr * 0.9);
        float st = uStat[si];
        if (st > 0.5) {
          float pulse = 0.5 + 0.5 * sin(uTime * (st > 1.5 ? 4.5 : 2.2));
          float scan = smoothstep(0.94, 1.0, 0.5 + 0.5 * sin(vBase.y * 150.0 - uTime * (st > 1.5 ? 4.0 : 2.4)));
          float faceDim = 1.0;
          #ifdef BODY_SKIN
            faceDim = 0.4;
          #endif
          totalEmissiveRadiance += faceDim * uStatScale * uStatCol[si] * (0.015 + scan * (0.42 + 0.3 * pulse) + 0.03 * pulse) * (0.3 + fr * 1.6);
        }
        if (uSel > 0.5 && abs(vSys - uSel) < 0.5) totalEmissiveRadiance += uRevealCol * (0.16 + 0.12 * sin(uTime * 3.0)) * (0.35 + fr * 1.6);
        totalEmissiveRadiance += uRevealCol * dEdge * 2.4 + vec3(0.45, 0.85, 1.0) * gEdge * 3.2 + vec3(0.6, 0.85, 1.0) * fEdge * 2.0;`)
  }
  mat.customProgramCacheKey = () => `body-${mode}`
}

/** Peças soltas (capacete, mochila, anéis, plaquetas): varredura de altura e fade, como o corpo. */
export function patchPartMaterial(mat: THREE.Material, u: Pick<BodyUniforms, 'uSuitY' | 'uFade'>, mode: 'suit' | 'cover' | 'fade') {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSuitY = u.uSuitY
    shader.uniforms.uFade = u.uFade
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorld;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    const sweep =
      mode === 'suit'
        ? 'if (vWorld.y > uSuitY) discard; pEdge = smoothstep(0.04, 0.0, uSuitY - vWorld.y);'
        : mode === 'cover'
          ? 'if (vWorld.y < uSuitY) discard; pEdge = smoothstep(0.04, 0.0, vWorld.y - uSuitY);'
          : ''
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uSuitY; uniform float uFade; varying vec3 vWorld;
        ${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float pEdge = 0.0; float qEdge = 0.0;
        ${sweep}
        if (uFade > 0.001) { float nzp = vnoise(vWorld * 40.0); float d = nzp - (uFade * 1.25 - 0.12); if (d < 0.0) discard; qEdge = smoothstep(0.08, 0.0, d); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.45, 0.85, 1.0) * pEdge * 3.2 + vec3(0.6, 0.85, 1.0) * qEdge * 2.0;`)
  }
  mat.customProgramCacheKey = () => `part-${mode}`
}
