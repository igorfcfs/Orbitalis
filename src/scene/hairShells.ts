import * as THREE from 'three'
import { patchBodyMaterial, type BodyUniforms } from './bodyShader'
import { SHELLS, type HeadModel } from './headModel'

/**
 * Cabelo em camadas de fios (shells): o couro cabeludo da cabeça é desenhado `SHELLS` vezes, cada cópia um pouco mais afastada ao
 * longo da normal e inclinada pelo caimento do cabelo (para trás, para o lado e para baixo, conforme o estilo). Em cada camada
 * só sobram os pontos que caem dentro de um fio: células jitteradas no espaço da textura, com raio que afina até a ponta, e
 * comprimentos diferentes por fio. A cor vem da própria textura de pele (o cabelo pintado), escurecida na raiz e um pouco mais
 * clara na ponta, então o fio continua o desenho que já existe por baixo, em vez de uma peça solta por cima.
 * Em distância as células ficam menores que um pixel e os fios somem (sobra a textura pintada), sem cintilar.
 */
export function makeHairShells(head: HeadModel, u: BodyUniforms): THREE.InstancedMesh | null {
  const g = head.scalp
  if (!g) return null
  const st = head.style
  const mat = new THREE.MeshStandardMaterial({ map: head.color, roughness: 0.6, metalness: 0, envMapIntensity: 0.7 })
  patchBodyMaterial(mat, u, 'headhair')
  const base = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    base.call(mat, shader, renderer)
    Object.assign(shader.uniforms, {
      uHairLen: { value: st.len }, uSlick: { value: st.slick }, uSweep: { value: st.sweep },
      uCell: { value: st.cell * head.uvScale }, uCover: { value: st.cover },
    })
    // Os cartões de cabelo (BODY_HEADHAIR sem esta marca) ganham fios no shader do corpo; nas camadas os fios já são geometria
    shader.fragmentShader = `#define HAIR_SHELL
${shader.fragmentShader}`
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aShell; attribute float aScalp;
        varying float vShell; varying float vScalpW;
        uniform float uHairLen; uniform float uSlick; uniform float uSweep;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 nn = normalize(objectNormal);
          // no alto da cabeça o cabelo cai para trás ou para fora (estilo); nas laterais e na nuca ele desce
          float top = smoothstep(0.15, 0.85, nn.y);
          vec3 radial = vec3(position.x, 0.0, position.z + 0.02);
          radial /= max(length(radial), 0.03);
          vec3 flow = vec3(0.0, -1.0, 0.0) * (1.0 - 0.55 * top)
                    + vec3(0.0, 0.0, -1.0) * (uSlick * top * 0.9)
                    + radial * ((1.0 - uSlick) * top * 0.6)
                    + vec3(uSweep * top, 0.0, 0.0);
          flow = normalize(flow);
          transformed += nn * (uHairLen * aShell) + flow * (uHairLen * 0.6 * aShell * aShell);
          vShell = aShell; vScalpW = aScalp;
        }`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vShell; varying float vScalpW; uniform float uCell; uniform float uCover;
        float hh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 huv = vMapUv / uCell;
          vec2 cl = floor(huv);
          vec2 fp = fract(huv) - 0.5;
          float h1 = hh(cl), h2 = hh(cl + 31.7), h3 = hh(cl + 7.3), h4 = hh(cl + 17.9);
          vec2 jit = (vec2(h3, h4) - 0.5) * 0.4;
          float len = mix(0.45, 1.0, h2);
          float kk = clamp(vShell / len, 0.0, 1.0);
          float rad = 0.4 * (1.0 - 0.78 * pow(kk, 1.4));
          // células menores que ~1,5 px somem: de longe o cabelo é a textura pintada, sem moiré
          float cw = fwidth(huv.x) + fwidth(huv.y);
          float seen = clamp(0.9 / max(cw, 1e-4) - 0.35, 0.0, 1.0);
          float cover = uCover * smoothstep(0.45, 0.9, vScalpW) * seen;
          float ok = step(length(fp - jit), rad) * step(vShell, len) * step(h1, cover);
          if (ok < 0.5) discard;
          diffuseColor.rgb *= mix(0.42, 1.2, kk) * (0.8 + 0.4 * h4);
        }`)
  }
  mat.customProgramCacheKey = () => 'body-headhair-shells'
  const mesh = new THREE.InstancedMesh(g, mat, SHELLS)
  const id = new THREE.Matrix4()
  for (let i = 0; i < SHELLS; i++) mesh.setMatrixAt(i, id)
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  mesh.raycast = () => {}
  return mesh
}
