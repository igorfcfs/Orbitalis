import * as THREE from 'three'
import { LEG_POSE_GLSL } from './legPose'
import { COLLAR_SLOPE, COLLAR_Y } from './bodyBuild'

/**
 * Injeções de shader nos materiais padrão do corpo. Tudo é por vértice (aSys) ou por altura:
 * - hover e contorno de status por sistema;
 * - dissolução do sistema selecionado (revela a anatomia por baixo) e raio-X geral;
 * - varredura de altura que veste e despe o traje;
 * - fade geral do astronauta (dissolve com ruído);
 * - físico que muda com a saúde (atrofia, massa) e sinais de fadiga na pele;
 * - trama do tecido (normal e rugosidade triplanares) no macacão e no traje;
 * - fantasma de raio-X: o macacão e o traje viram uma casca translúcida que deixa ver a anatomia.
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
  /** Intensidade do contorno de status (0 = nenhum) */
  uStatScale: THREE.IUniform<number>
  /** Atrofia muscular (0–1) e variação relativa de massa (−0,12…+0,12) */
  uAtro: THREE.IUniform<number>
  uMassD: THREE.IUniform<number>
  /** Fadiga (0–1): olheiras e palidez */
  uFatigue: THREE.IUniform<number>
  /** Centro do olho esquerdo no espaço do modelo, já deformado */
  uEyeC: THREE.IUniform<THREE.Vector3>
  /** Sombra de barba no rosto (0 = nenhuma) */
  uBeard: THREE.IUniform<number>
  /** Respiração (0 = expirado, 1 = inspirado): o tórax e o abdômen avançam alguns milímetros */
  uBreath: THREE.IUniform<number>
  /** 1 com o traje fechado: a gola do macacão e o pescoço continuam visíveis por dentro do visor */
  uInner: THREE.IUniform<number>
  /** Balanço dos braços (rad, pêndulo para a frente e para trás em torno do ombro): x = braço esquerdo (+x), y = direito */
  uSway: THREE.IUniform<THREE.Vector2>
  /** Pernas do traje em microgravidade (rad): x = esquerda, y = direita (pêndulo em torno do quadril), z = abertura lateral */
  uLegs: THREE.IUniform<THREE.Vector3>
  /** Pernas do traje: abertura lateral esquerda e direita (rad, x e y), dobra do joelho esquerdo e direito (rad, z e w) */
  uLegs2: THREE.IUniform<THREE.Vector4>
  /** Postura das pernas (RF-33): flexão do quadril E e D e do joelho E e D (rad), e as juntas da perna esquerda (legPose.ts) */
  uLegPose: THREE.IUniform<THREE.Vector4>
  uHipJ: THREE.IUniform<THREE.Vector3>
  uKneeJ: THREE.IUniform<THREE.Vector3>
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
    uAtro: { value: 0 },
    uMassD: { value: 0 },
    uFatigue: { value: 0 },
    uEyeC: { value: new THREE.Vector3(0.031, 1.591, 0.0635) },
    uBeard: { value: 0 },
    uBreath: { value: 0 },
    uInner: { value: 0 },
    uSway: { value: new THREE.Vector2() },
    uLegs: { value: new THREE.Vector3() },
    uLegs2: { value: new THREE.Vector4() },
    uLegPose: { value: new THREE.Vector4() },
    uHipJ: { value: new THREE.Vector3(0.088, 0.915, 0) },
    uKneeJ: { value: new THREE.Vector3(0.082, 0.443, 0.006) },
  }
}

/** Região do corpo por baixo de um ponto do traje, no fragmento: bordas nítidas mesmo com triângulos grandes. Espelha suitSystemAt. */
const SUIT_SYS = /* glsl */ `
float suitSys(vec3 p) {
  float ax = abs(p.x);
  if (p.y >= 1.56) return (p.z > 0.12 && p.y < 1.8) ? 4.0 : 7.0;
  if (p.y >= 1.46) return 5.0;
  if (p.y >= 1.2) return ax <= 0.25 ? 1.0 : 3.0;
  if (p.y >= 1.0) return ax <= 0.24 ? 6.0 : 3.0;
  if (p.y >= 0.82) return ax <= 0.24 ? 2.0 : 3.0;
  return 3.0;
}
`

const NOISE = /* glsl */ `
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
// distância ao ponto de grade mais próximo (ruído celular): poros e folículos
float cellN(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); float d = 1.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(hash13(i + g), hash13(i + g + 17.0), hash13(i + g + 41.0));
    d = min(d, length(g + o - f));
  }
  return d;
}
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`

/**
 * Respiração: o tórax avança e sobe, o abdômen avança e os ombros sobem um pouco; os braços não acompanham.
 * Função só da posição de repouso, igual na pele, no macacão e no fantasma do raio-X.
 */
const BREATH_GLSL = /* glsl */ `
uniform float uBreath;
uniform vec2 uSway;
uniform vec3 uLegs;
uniform vec4 uLegs2;
// Braços soltos: pêndulo em torno do ombro (rotação pequena, linearizada) com um leve afastamento lateral. O peso cresce com a
// distância ao ombro, então a articulação não se move e a mão é o que mais balança; o tronco e as pernas (|x| menor) ficam parados.
vec3 armSway(vec3 b) {
  float s = b.x >= 0.0 ? 1.0 : -1.0;
  float a = b.x >= 0.0 ? uSway.x : uSway.y;
  float arm = smoothstep(0.22, 0.3, abs(b.x)) * (1.0 - smoothstep(1.36, 1.44, b.y)) * smoothstep(0.55, 0.65, b.y);
  vec3 d = vec3(b.x - s * 0.17, b.y - 1.4, b.z);
  float w = arm * smoothstep(0.0, 0.3, -d.y);
  return w * (a * vec3(0.0, -d.z, d.y) + a * 0.35 * s * vec3(-d.y, 0.0, 0.0));
}
vec3 breathDisp(vec3 b) {
  float torso = 1.0 - smoothstep(0.19, 0.27, abs(b.x));
  float chest = exp(-pow((b.y - 1.29) / 0.105, 2.0));
  float belly = exp(-pow((b.y - 1.06) / 0.095, 2.0));
  vec2 r = vec2(b.x, b.z + 0.01);
  vec2 dir = r / max(length(r), 0.06);
  float front = 0.5 + 0.5 * smoothstep(-0.06, 0.07, b.z);
  float amp = 0.0135 * chest + 0.0085 * belly;
  vec3 d = vec3(dir.x * amp * 0.55, 0.006 * chest, dir.y * amp * front);
  d.y += 0.006 * smoothstep(1.3, 1.38, b.y) * (1.0 - smoothstep(1.42, 1.5, b.y)) * smoothstep(0.08, 0.17, abs(b.x));
  return d * torso * uBreath + armSway(b);
}

// Mangas do traje de EVA (posição final do traje, m): o braço inteiro gira como pêndulo em torno do ombro; o tronco rígido não se mexe
vec3 suitSway(vec3 p, float arm) {
  float s = p.x >= 0.0 ? 1.0 : -1.0;
  float a = p.x >= 0.0 ? uSway.x : uSway.y;
  vec3 d = p - vec3(s * 0.29, 1.395, 0.14);
  float w = arm * smoothstep(0.02, 0.24, length(d));
  // Pernas soltas: giram em torno do quadril e se abrem um pouco; o peso cresce até a bota
  float la = p.x >= 0.0 ? uLegs.x : uLegs.y;
  float sp = p.x >= 0.0 ? uLegs2.x : uLegs2.y;
  float kn = p.x >= 0.0 ? uLegs2.z : uLegs2.w;
  vec3 h = p - vec3(s * 0.1, 0.92, 0.0);
  float legMask = (1.0 - arm) * (1.0 - smoothstep(0.84, 0.98, p.y));
  float wl = legMask * smoothstep(0.0, 0.4, -h.y);
  vec3 disp = w * a * vec3(0.0, -d.z, d.y) + wl * (la * vec3(0.0, -h.z, h.y) + sp * s * vec3(-h.y, 0.0, 0.0));
  // Joelho (y ~ 0,5): a canela dobra para trás e acompanha o giro da coxa
  vec3 k = h - vec3(0.0, -0.42, 0.0);
  float wk = legMask * smoothstep(0.08, -0.08, k.y);
  disp += wk * kn * vec3(0.0, -k.z, k.y);
  return disp;
}
`

/** Deslocamento do físico: a mesma conta no corpo e no fantasma, para os dois coincidirem. */
const MORPH_VERT_DECL = /* glsl */ `
  attribute vec3 aDir; attribute vec2 aW; uniform float uAtro; uniform float uMassD;
`
const MORPH_VERT = /* glsl */ `
  transformed += aDir * (aW.x * uAtro + aW.y * uMassD);
`

/** Normal triplanar (UDN) de uma trama, em espaço do objeto, e a rugosidade média. */
const FABRIC_FRAG_DECL = /* glsl */ `
  uniform sampler2D uFabNor; uniform sampler2D uFabRough; uniform float uFabScale; uniform float uFabStrength;
  uniform mat3 normalMatrix;
  vec3 fabricNormal(vec3 p, vec3 n, out float rough) {
    vec3 w = pow(abs(n), vec3(5.0)); w /= (w.x + w.y + w.z + 1e-5);
    vec2 uvx = p.zy; vec2 uvy = p.xz; vec2 uvz = p.xy;
    vec3 tx = texture2D(uFabNor, uvx).xyz * 2.0 - 1.0;
    vec3 ty = texture2D(uFabNor, uvy).xyz * 2.0 - 1.0;
    vec3 tz = texture2D(uFabNor, uvz).xyz * 2.0 - 1.0;
    tx.xy *= uFabStrength; ty.xy *= uFabStrength; tz.xy *= uFabStrength;
    vec3 nx = vec3(n.x, n.y + tx.y, n.z + tx.x);
    vec3 ny = vec3(n.x + ty.x, n.y, n.z + ty.y);
    vec3 nz = vec3(n.x + tz.x, n.y + tz.y, n.z);
    rough = dot(w, vec3(texture2D(uFabRough, uvx).g, texture2D(uFabRough, uvy).g, texture2D(uFabRough, uvz).g));
    return normalize(nx * w.x + ny * w.y + nz * w.z);
  }
`

/**
 * Detalhes do macacão desenhados na própria superfície, na posição de repouso (m): costuras laterais, zíper,
 * bolsos do peito e da coxa, cinto com fivela, reforço dos joelhos e vincos nas juntas.
 * Devolvem cor, altura (para o relevo) e rugosidade; o relevo sai das derivadas de tela.
 */
const COVER_DETAIL = /* glsl */ `
#ifdef BODY_DECALS
uniform sampler2D uPlateTex; uniform sampler2D uPatchTex; uniform vec4 uPlateBox; uniform vec3 uPatchBox;
#endif
float boxD(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; return max(d.x, d.y); }
float thread(float d) { return smoothstep(0.0015, 0.0005, abs(d)); }
void coverDetails(vec3 p, vec3 n, float cut, inout vec3 col, inout float h, inout float r) {
  float ax = abs(p.x);
  float front = smoothstep(0.1, 0.4, n.z);
  // tecido de lã misturada: manchas largas de tom e uma granulação fina, para a cor não ser chapada
  col *= 0.94 + 0.11 * vnoise(p * 48.0) + 0.05 * (vnoise(p * 380.0) - 0.5);
  // caimento: dobras longas e suaves na vertical, mais fortes onde o tecido se acumula (cintura, braços)
  {
    float drape = vnoise(vec3(p.x * 15.0, p.y * 4.2, p.z * 15.0));
    float drape2 = vnoise(vec3(p.x * 34.0 + 7.0, p.y * 9.0, p.z * 34.0));
    h += (drape - 0.5) * 3.4 + (drape2 - 0.5) * 1.1;
    col *= 1.0 - 0.09 * smoothstep(0.52, 0.86, drape);
  }
  // costuras do lado: onde a superfície olha de lado, com pontos
  float seam = smoothstep(0.014, 0.003, abs(n.z)) * (1.0 - smoothstep(1.34, 1.38, p.y)); // sem costura lateral no ombro e na gola
  float dash = step(0.5, fract(p.y * 240.0));
  col *= 1.0 - 0.34 * seam * (0.55 + 0.45 * dash);
  h -= 0.45 * seam;
  // zíper frontal, da gola à virilha
  float zone = step(0.835, p.y) * step(p.y, 1.478) * front;
  float zip = zone * smoothstep(0.0048, 0.0036, ax);
  float teeth = step(0.5, fract(p.y * 340.0));
  col = mix(col, mix(vec3(0.02), vec3(0.55, 0.57, 0.6), teeth), zip);
  h += zip * (0.3 + 0.9 * teeth);
  r = mix(r, 0.3, zip);
  col *= 1.0 - 0.06 * zone * smoothstep(0.017, 0.012, ax) * (1.0 - zip);
  // bolsos do peito: contorno costurado e a linha da aba
  float d1 = boxD(vec2(ax, p.y), vec2(0.084, 1.252), vec2(0.045, 0.034));
  float pk = front * step(0.0, p.z) * (1.0 - step(0.0, d1 - 0.004));
  float o1 = pk * thread(d1) + pk * thread(p.y - 1.262) * step(d1, 0.0);
  col *= 1.0 - 0.36 * o1;
  h -= 0.7 * o1;
  // bolsos da coxa, com a pala e um botão
  float d2 = boxD(vec2(ax, p.y), vec2(0.098, 0.7), vec2(0.05, 0.085));
  float tk = front * (1.0 - step(0.0, d2 - 0.004)) * step(0.05, ax);
  float o2 = tk * thread(d2) + tk * thread(p.y - 0.757) * step(d2, 0.0);
  col *= 1.0 - 0.36 * o2;
  h -= 0.7 * o2;
  float btn = tk * smoothstep(0.0075, 0.005, length(vec2(ax - 0.098, p.y - 0.748)));
  col = mix(col, vec3(0.5, 0.52, 0.56), btn);
#ifdef BODY_DECALS
  {
    // Plaqueta de nome e emblema da missão: desenhados no próprio tecido, na posição de repouso, então seguem a superfície
    // (respiração, físico, dissolução) em vez de flutuarem ou afundarem no peito como peças soltas
    float onFront = front * step(0.0, p.z);
    vec2 pq = (p.xy - uPlateBox.xy) / uPlateBox.zw + 0.5;
    float inP = step(0.0, pq.x) * step(pq.x, 1.0) * step(0.0, pq.y) * step(pq.y, 1.0) * onFront;
    vec4 tp = texture2D(uPlateTex, pq);
    col = mix(col, tp.rgb, tp.a * inP);
    float sP = thread(boxD(p.xy, uPlateBox.xy, uPlateBox.zw * 0.5 - 0.0018)) * onFront * step(0.5, tp.a);
    col *= 1.0 - 0.38 * sP;
    h += inP * tp.a * 0.5 - 0.5 * sP;
    r = mix(r, 0.72, inP * tp.a);
    vec2 cq = (p.xy - uPatchBox.xy) / (2.0 * uPatchBox.z) + 0.5;
    float dC = length(p.xy - uPatchBox.xy);
    float inC = step(dC, uPatchBox.z) * onFront;
    vec4 tc = texture2D(uPatchTex, cq);
    col = mix(col, tc.rgb, tc.a * inC);
    float sC = thread(dC - (uPatchBox.z - 0.0018)) * onFront * step(dC, uPatchBox.z);
    col *= 1.0 - 0.38 * sC;
    h += inC * tc.a * 0.5 - 0.5 * sC;
    r = mix(r, 0.72, inC * tc.a);
  }
#endif
  // cinto com fivela
  float belt = smoothstep(0.022, 0.016, abs(p.y - 1.04));
  col *= 1.0 - 0.14 * belt;
  float bl = thread(abs(p.y - 1.04) - 0.019);
  col *= 1.0 - 0.3 * bl;
  h -= 0.5 * bl;
  // fivela de metal escuro e fosco, menor, com a borda um pouco acima do cinto (antes era um bloco branco)
  float bk = front * step(boxD(vec2(p.x, p.y), vec2(0.0, 1.04), vec2(0.021, 0.015)), 0.0);
  float bkIn = front * step(boxD(vec2(p.x, p.y), vec2(0.0, 1.04), vec2(0.016, 0.01)), 0.0);
  col = mix(col, vec3(0.17, 0.18, 0.2), bk);
  col = mix(col, vec3(0.05, 0.055, 0.065), bkIn);
  r = mix(r, 0.42, bk);
  h += 0.8 * bk - 0.5 * bkIn;
  // reforço nos joelhos
  float d3 = boxD(vec2(ax, p.y), vec2(0.085, 0.452), vec2(0.046, 0.062));
  float kn = front * (1.0 - step(0.0, d3)) * step(0.03, ax);
  col *= 1.0 - 0.1 * kn;
  float o3 = front * thread(d3) * step(0.03, ax);
  col *= 1.0 - 0.34 * o3;
  h -= 0.6 * o3;
  // vincos nas juntas: cotovelo, joelho, cintura e quadril
  // o vinco do cotovelo só vale nas mangas: no tronco ele aparecia como as linhas de um abdômen em "tanquinho" por cima do tecido
  float jm = max(max(exp(-pow((p.y - 1.125) / 0.05, 2.0)) * smoothstep(0.2, 0.26, ax), exp(-pow((p.y - 0.443) / 0.07, 2.0))),
                 max(exp(-pow((p.y - 1.03) / 0.05, 2.0)) * 0.7, exp(-pow((p.y - 0.9) / 0.05, 2.0)) * 0.5));
  float wr = sin((p.y + 0.012 * vnoise(p * 22.0)) * 210.0 + 3.0 * vnoise(p * 40.0));
  float wd = sin((p.y * 0.7 + p.x * 0.7 * sign(p.x) + 0.01 * vnoise(p * 30.0)) * 150.0 + 1.7);
  h += jm * (wr * 1.3 + wd * 0.7);
  col *= 1.0 - 0.1 * jm * (0.5 + 0.35 * wr + 0.15 * wd);
  // gola e punhos: borda enrolada, costura a ~9 mm e uma faixa um pouco mais escura nos últimos 3 cm
  float e = -cut; // metros até a borda do corte (>= 0 dentro); grande onde não há corte
  float inside = step(0.0, e);
  col *= 1.0 - 0.1 * smoothstep(0.034, 0.026, e) * inside;
  float roll = smoothstep(0.0045, 0.0, e) * inside;
  col *= 1.0 - 0.28 * roll;
  float stitch = thread(e - 0.0095) * step(0.5, fract((p.x + p.z + p.y) * 330.0)) * inside;
  col *= 1.0 - 0.45 * stitch;
}
`

/**
 * Luz que atravessa a pele (espalhamento sob a superfície, aproximado): o difuso "dá a volta" no terminador e ganha
 * um tom avermelhado, como a luz que sai da carne ao lado da sombra. Troca só a linha do difuso direto de three.
 */
const SKIN_LIGHTS = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
  `float nlS = dot( geometryNormal, directLight.direction );
	vec3 sssAdd = directLight.color * ( saturate( ( nlS + 0.42 ) / 1.42 ) - dotNL ) * vec3( 1.0, 0.52, 0.36 ) * 0.9;
	reflectedLight.directDiffuse += ( irradiance + sssAdd ) * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );`,
)
if (SKIN_LIGHTS === THREE.ShaderChunk.lights_physical_pars_fragment) console.warn('[body] skin scattering patch did not apply: three changed its lighting chunk')

/** `head` e `headhair` são a cabeça fotográfica e os cartões de cabelo (headModel.ts): herdam a dissolução, o raio-X e o contorno de status, mas não somem com a varredura do traje (o rosto fica visível dentro do capacete). */
export type ShellMode = 'skin' | 'cover' | 'suit' | 'hair' | 'head' | 'headhair'

export interface Fabric {
  nor: THREE.Texture
  rough: THREE.Texture
  /** Repetições por metro */
  scale: number
  strength: number
}

/** Aplica o shader do corpo a um MeshStandardMaterial ou MeshPhysicalMaterial. */
/** Plaqueta de nome e emblema da missão desenhados no macacão (posição de repouso, m): centro e tamanho da plaqueta; centro e raio do emblema. */
export interface CoverDecals {
  plate: THREE.Texture
  patch: THREE.Texture
  plateAt: [number, number, number, number]
  patchAt: [number, number, number]
}

export function patchBodyMaterial(mat: THREE.Material, u: BodyUniforms, mode: ShellMode, fabric?: Fabric, sysFromPos = false, decals?: CoverDecals) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uHover: u.uHover, uSel: u.uSel, uReveal: u.uReveal, uXray: u.uXray, uTime: u.uTime, uSuitY: u.uSuitY,
      uFade: u.uFade, uStat: u.uStat, uStatCol: u.uStatCol, uRevealCol: u.uRevealCol, uHoverCol: u.uHoverCol, uStatScale: u.uStatScale,
      uAtro: u.uAtro, uMassD: u.uMassD, uFatigue: u.uFatigue, uEyeC: u.uEyeC, uBeard: u.uBeard, uBreath: u.uBreath,
      uInner: u.uInner, uSway: u.uSway, uLegs: u.uLegs, uLegs2: u.uLegs2, uLegPose: u.uLegPose, uHipJ: u.uHipJ, uKneeJ: u.uKneeJ,
    })
    if (decals) {
      Object.assign(shader.uniforms, {
        uPlateTex: { value: decals.plate }, uPatchTex: { value: decals.patch },
        uPlateBox: { value: new THREE.Vector4(...decals.plateAt) }, uPatchBox: { value: new THREE.Vector3(...decals.patchAt) },
      })
    }
    if (fabric) {
      Object.assign(shader.uniforms, {
        uFabNor: { value: fabric.nor }, uFabRough: { value: fabric.rough },
        uFabScale: { value: fabric.scale }, uFabStrength: { value: fabric.strength },
      })
    }
    const define = `#define BODY_${mode.toUpperCase()}\n${fabric ? '#define BODY_FABRIC\n' : ''}${sysFromPos ? '#define BODY_SYSPOS\n' : ''}#if defined(BODY_SKIN) || defined(BODY_COVER) || defined(BODY_SUIT) || defined(BODY_HEAD) || defined(BODY_HEADHAIR)\n#define BODY_MORPH\n#endif\n`
    const defineAll = decals ? define + '#define BODY_DECALS' + String.fromCharCode(10) : define
    if (mode === 'skin' || mode === 'head') shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', SKIN_LIGHTS)
    shader.vertexShader = defineAll + shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSys; attribute vec3 aBase;
        varying float vSys; varying vec3 vBase; varying float vWY; varying vec3 vObjN;
        #ifdef BODY_COVER
        attribute float aCut; varying float vCut;
        #endif
        #ifdef BODY_SYSPOS
        attribute float aArm; varying float vArm;
        #endif
        #ifdef BODY_HEAD
        attribute float aScalp; varying float vScalpW;
        #endif
        #ifdef BODY_MORPH
        ${MORPH_VERT_DECL}
        attribute float aAO; varying float vAO;
        #endif
        #if defined(BODY_SKIN) || defined(BODY_COVER) || defined(BODY_SUIT)
        ${BREATH_GLSL}
        #endif
        #if defined(BODY_SKIN) || defined(BODY_COVER)
        attribute float aLeg;
        ${LEG_POSE_GLSL}
        #endif`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        #if defined(BODY_SKIN) || defined(BODY_COVER)
        objectNormal = legDir(aBase, aLeg, objectNormal);
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef BODY_MORPH
        ${MORPH_VERT}
        vAO = aAO;
        #endif
        #if defined(BODY_SKIN) || defined(BODY_COVER)
        transformed += breathDisp(aBase);
        transformed = legPos(aBase, aLeg, transformed);
        #endif
        #if defined(BODY_SUIT) && defined(BODY_SYSPOS)
        transformed += suitSway(aBase, aArm);
        #endif
        #ifdef BODY_COVER
        vCut = aCut;
        #endif
        #ifdef BODY_SYSPOS
        vArm = aArm;
        #endif
        #ifdef BODY_HEAD
        vScalpW = aScalp;
        #endif
        vSys = aSys; vBase = aBase; vObjN = objectNormal;
        vWY = (modelMatrix * vec4(transformed, 1.0)).y;`)
    shader.fragmentShader = defineAll + shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uHover; uniform float uSel; uniform float uReveal; uniform float uXray; uniform float uTime;
        uniform float uSuitY; uniform float uFade; uniform float uFatigue; uniform vec3 uEyeC; uniform float uBeard; uniform float uInner;
        uniform float uStat[9]; uniform vec3 uStatCol[9]; uniform vec3 uRevealCol; uniform vec3 uHoverCol; uniform float uStatScale;
        varying float vSys; varying vec3 vBase; varying float vWY; varying vec3 vObjN;
        #ifdef BODY_COVER
        varying float vCut;
        #endif
        #ifdef BODY_FABRIC
        ${FABRIC_FRAG_DECL}
        #endif
        #ifdef BODY_SYSPOS
        varying float vArm;
        ${SUIT_SYS}
        #endif
        #ifdef BODY_HEAD
        varying float vScalpW;
        #endif
        #ifdef BODY_MORPH
        varying float vAO;
        #endif
        ${NOISE}
        #ifdef BODY_COVER
        ${COVER_DETAIL}
        #endif`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float sysV = vSys;
        #ifdef BODY_SYSPOS
          // Braços do traje: sempre musculares (índice 3); o resto segue a posição, fragmento a fragmento
          // O limite entre regiões ganha uma borda irregular (±1,8 cm), em vez de um retângulo reto
          vec3 wob = vec3(vnoise(vBase * 13.0), vnoise(vBase * 13.0 + 11.7), vnoise(vBase * 13.0 + 23.1)) - 0.5;
          sysV = vArm > 0.5 ? 3.0 : suitSys(vBase + wob * 0.036);
        #endif
        // Gola e punhos terminam num corte limpo (plano), não na borda irregular das regiões do atlas. O descarte vem no fim:
        // com ele aqui no começo, as derivadas de tela do relevo liam fragmentos já descartados e riscavam a borda de claro.
        bool cutKill = false;
        #ifdef BODY_COVER
          cutKill = vCut > 0.0;
        #endif
        float nz = 0.0;
        float skinInner = 0.0;
        float gEdge = 0.0; float dEdge = 0.0; float fEdge = 0.0;
        #ifdef BODY_SUIT
          if (vWY > uSuitY) discard;
          gEdge = smoothstep(0.04, 0.0, uSuitY - vWY);
        #endif
        #if defined(BODY_COVER) || defined(BODY_SKIN) || defined(BODY_HAIR)
          bool innerKeep = false;
          #ifdef BODY_COVER
            // Com o traje fechado a parte de cima do macacão (peito, ombros, costas) fica por dentro do traje, visível pelo visor
            innerKeep = uInner > 0.5 && vBase.y > 1.22;
          #endif
          if (vWY < uSuitY && !innerKeep) discard;
          gEdge = innerKeep ? 0.0 : smoothstep(0.04, 0.0, vWY - uSuitY);
        #endif
        #ifdef BODY_SKIN
          // A pele da base do pescoço fica por baixo da gola: sem ela, as pontas das clavículas e dos tendões furavam o tecido em dentes
          // de pele. Corta no mesmo plano da gola (o macacão a cobre dali para baixo).
          if (vBase.y > 1.38 && vBase.y < 1.52 && abs(vBase.x) < 0.16 && vBase.y < clamp(${COLLAR_Y.toFixed(3)} - ${COLLAR_SLOPE.toFixed(2)} * (vBase.z + 0.02), 1.455, 1.5) - 0.002) discard;
        #endif
        float rev = (uSel > 0.5 && abs(sysV - uSel) < 0.1) ? uReveal : 0.0;
        rev = max(rev, uXray);
        if (rev > 0.001 || uFade > 0.001) nz = vnoise(vBase * 34.0) * 0.65 + vnoise(vBase * 88.0) * 0.35;
        if (rev > 0.001) { float d = nz - rev * 1.2; if (d < 0.0) discard; dEdge = smoothstep(0.10, 0.0, d); }
        if (uFade > 0.001) { float d = nz - (uFade * 1.25 - 0.12); if (d < 0.0) discard; fEdge = smoothstep(0.08, 0.0, d); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        #ifdef BODY_SUIT
          // O lado de dentro do traje (visto pelo visor) é o macacão do astronauta, não o tecido branco do modelo vazio
          if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.045, 0.085, 0.17);
        #endif
        #ifdef BODY_HEAD
          if (uFatigue > 0.001) {
            vec2 q = vec2(abs(vBase.x) - uEyeC.x, vBase.y - (uEyeC.y - 0.017)) / vec2(0.02, 0.0105);
            float bag = exp(-dot(q, q)) * smoothstep(0.03, 0.06, vBase.z);
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.62, 0.74), bag * uFatigue);
            float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(1.0, 0.97, 1.02), 0.22 * uFatigue);
          }
        #endif
        #ifdef BODY_SKIN
          if (uFatigue > 0.001) {
            // Olheiras: elipse sob cada olho, só na frente do rosto; e um pouco de palidez
            vec2 q = vec2(abs(vBase.x) - uEyeC.x, vBase.y - (uEyeC.y - 0.017)) / vec2(0.02, 0.0105);
            float bag = exp(-dot(q, q)) * smoothstep(0.03, 0.06, vBase.z);
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.62, 0.74), bag * uFatigue);
            float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(1.0, 0.97, 1.02), 0.22 * uFatigue);
          }
          // Dentro da boca, das narinas e das pálpebras (superfícies que olham para dentro da cabeça): escuro e avermelhado,
          // como a sombra real de uma abertura. Sem isto, a parede interna dos lábios aparecia como pontinhos claros.
          if (vBase.y > 1.49) {
            vec3 rr = vec3(vBase.x, clamp(vBase.y - 1.585, -0.04, 0.04), vBase.z + 0.005);
            float facing = dot(normalize(vObjN), normalize(rr));
            skinInner = smoothstep(0.12, -0.2, facing);
            // Só onde há uma abertura de verdade (boca, narinas, olhos, orelhas): nas bochechas e no queixo, lascas minúsculas do
            // atlas viravam riscos escuros
            vec3 ab = vec3(abs(vBase.x), vBase.y, vBase.z);
            float mouthZ = step(abs(vBase.x), 0.034) * step(1.498, vBase.y) * step(vBase.y, 1.556) * step(0.055, vBase.z);
            float noseZ = step(abs(vBase.x), 0.022) * step(1.54, vBase.y) * step(vBase.y, 1.575) * step(0.065, vBase.z);
            float eyeZ = step(0.012, ab.x) * step(ab.x, 0.056) * step(1.572, ab.y) * step(ab.y, 1.62) * step(0.045, ab.z);
            float earZ = step(0.056, ab.x) * step(ab.z, 0.02) * step(1.5, ab.y) * step(ab.y, 1.66);
            skinInner *= clamp(mouthZ + noseZ + eyeZ + earZ, 0.0, 1.0);
          }
          // sombra da própria pele (mais escura e um pouco mais quente), não uma cor de sangue
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.34, 0.24, 0.22), skinInner);
          // A pele não é uma cor chapada: manchas suaves de tom e rubor nas bochechas
          float tone = vnoise(vBase * 24.0) * 0.6 + vnoise(vBase * 70.0) * 0.4;
          diffuseColor.rgb *= 0.965 + 0.07 * tone;
          // Cavidades do rosto, medidas a partir dos olhos: prega acima deles, narinas, linha da boca e sombra sob o lábio
          {
            float fs = uEyeC.x / 0.031;
            float ex = abs(vBase.x) / fs;
            float fy = vBase.y - uEyeC.y;
            float fz = vBase.z;
            float ao = 1.0;
            ao *= 1.0 - 0.14 * exp(-pow((ex - 0.031) / 0.02, 2.0) - pow((fy - 0.0165) / 0.007, 2.0));
            ao *= 1.0 - 0.55 * exp(-pow((ex - 0.0085) / 0.0055, 2.0) - pow((fy + 0.038) / 0.006, 2.0)) * step(0.085, fz);
            ao *= 1.0 - 0.34 * exp(-pow(ex / 0.026, 2.0) - pow((fy + 0.0645) / 0.0016, 2.0)) * step(0.08, fz);
            ao *= 1.0 - 0.12 * exp(-pow(ex / 0.022, 2.0) - pow((fy + 0.086) / 0.006, 2.0)) * step(0.07, fz);
            diffuseColor.rgb *= ao;
          }
          vec2 bq = vec2((abs(vBase.x) - 0.045) / 0.03, (vBase.y - 1.555) / 0.028);
          float blush = exp(-dot(bq, bq)) * smoothstep(0.03, 0.07, vBase.z);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.09, 0.88, 0.86), 0.45 * blush);
          {
            float fs2 = uEyeC.x / 0.031;
            float ex2 = abs(vBase.x) / fs2;
            float fy2 = vBase.y - uEyeC.y;
            float front = smoothstep(0.03, 0.075, vBase.z);
            // lábios: faixa em torno da linha da boca, mais rosada
            float lip = exp(-pow(ex2 / 0.026, 2.0) - pow((fy2 + 0.0645) / 0.0112, 2.0)) * smoothstep(0.07, 0.09, vBase.z);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.16, 0.68, 0.7), 0.55 * lip);
            // nariz e orelhas um pouco mais avermelhados
            float nose = exp(-pow(ex2 / 0.014, 2.0) - pow((fy2 + 0.034) / 0.02, 2.0)) * smoothstep(0.085, 0.1, vBase.z);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.07, 0.9, 0.88), 0.4 * nose);
            // sombra de barba: bochechas baixas, queixo e buço, com folículos
            float jaw = smoothstep(-0.04, -0.07, fy2) * (1.0 - smoothstep(0.07, 0.11, ex2)) * front;
            float lipCut = 1.0 - 0.7 * lip;
            float fol = 1.0 - smoothstep(0.12, 0.34, cellN(vBase * 620.0));
            diffuseColor.rgb *= 1.0 - uBeard * jaw * lipCut * (0.1 + 0.22 * fol);
            // poros: pontinhos levemente mais escuros e avermelhados, só de perto (a distância os apaga)
            float nearP = smoothstep(3.3, 1.2, length(vViewPosition));
            float pc = cellN(vBase * 430.0);
            float pore = exp(-pc * pc * 10.0) * nearP;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.84, 0.74, 0.7), 0.2 * pore);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.95, 1.06), uBeard * jaw * lipCut * 0.35);
          }
        #endif
        #if defined(BODY_HEADHAIR) && !defined(HAIR_SHELL)
          // Cartões de cabelo: as áreas opacas do cartão vêm da textura com listras esticadas (aspecto de placa). Fios finos ao longo
          // do cartão (v da textura) quebram a placa, e a raiz fica mais escura que a ponta
          float strandA = vnoise(vec3(vMapUv.x * 1100.0, vMapUv.y * 34.0, 3.0));
          float strandB = vnoise(vec3(vMapUv.x * 420.0, vMapUv.y * 12.0, 9.0));
          diffuseColor.rgb *= 0.5 + 0.62 * strandA + 0.3 * strandB;
          // e vãos finos entre as mechas no miolo opaco do cartão (mais perto da ponta do que da raiz), para a placa virar fios
          diffuseColor.a *= smoothstep(0.17, 0.34, strandA + 0.12 * strandB + 0.18 * (1.0 - vMapUv.y));
        #endif
        #ifdef BODY_HAIR
          // Fios: veios finos na vertical e raiz mais escura que a ponta
          diffuseColor.rgb *= (0.8 + 0.45 * vnoise(vBase * vec3(420.0, 60.0, 420.0))) * (0.88 + 0.22 * smoothstep(1.6, 1.74, vBase.y));
        #endif
        #ifdef BODY_COVER
          float coverH = 0.0;
          float coverR = 0.0;
          coverDetails(vBase, normalize(vObjN), vCut, diffuseColor.rgb, coverH, coverR);
        #endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        #ifdef BODY_HEAD
          // Couro cabeludo pintado: cabelo não tem o brilho oleoso da pele (sem isso as têmporas ficavam com um verniz cinza)
          roughnessFactor = mix(roughnessFactor, 0.94, smoothstep(0.12, 0.5, vScalpW));
        #endif
        #ifdef BODY_SKIN
        {
          float fs3 = uEyeC.x / 0.031;
          float ex3 = abs(vBase.x) / fs3;
          float fy3 = vBase.y - uEyeC.y;
          float tz = exp(-pow(ex3 / 0.032, 2.0)) * smoothstep(-0.075, -0.02, fy3) * smoothstep(0.075, 0.035, fy3) * step(0.05, vBase.z);
          roughnessFactor = clamp(roughnessFactor * (1.0 - 0.2 * tz), 0.22, 1.0);
          float lipW = exp(-pow(ex3 / 0.026, 2.0) - pow((fy3 + 0.0645) / 0.0112, 2.0)) * smoothstep(0.07, 0.09, vBase.z);
          roughnessFactor = mix(roughnessFactor, 0.3, lipW);
        }
        #endif
        #ifdef BODY_FABRIC
          float fabRough = 0.5;
          vec3 fabN = fabricNormal(vBase * uFabScale, normalize(vObjN), fabRough);
          roughnessFactor = clamp(roughnessFactor * (0.78 + 0.5 * fabRough), 0.2, 1.0);
          #ifdef BODY_COVER
            if (coverR > 0.0) roughnessFactor = coverR;
          #endif
        #endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef BODY_FABRIC
          normal = normalize(normalMatrix * fabN) * faceDirection;
        #endif
        #ifdef BODY_COVER
          {
            // Costuras, zíper, bolsos e vincos: relevo de ~1 mm pelas derivadas de tela
            vec3 sX = dFdx(-vViewPosition); vec3 sY = dFdy(-vViewPosition);
            vec3 R1 = cross(sY, normal); vec3 R2 = cross(normal, sX);
            float det = dot(sX, R1);
            vec3 grad = sign(det) * (dFdx(coverH) * R1 + dFdy(coverH) * R2);
            normal = normalize(abs(det) * normal - 0.0011 * grad);
          }
        #endif
        #ifdef BODY_SKIN
          // A pele é desenhada dos dois lados e as normais dos vértices já apontam para fora: um triângulo de sentido invertido
          // (comum nas dobras do atlas) é sombreado como o resto, e não com a normal virada
          normal *= faceDirection;
          {
            // Poros: pequenas covas em células irregulares e uma granulação fina, pelo método das derivadas de tela.
            // Só aparecem de perto: a distância os apaga, para não virarem ruído.
            float near = smoothstep(3.3, 1.2, length(vViewPosition));
            float hP = vnoise(vBase * 240.0) * near;
            vec3 sX = dFdx(-vViewPosition); vec3 sY = dFdy(-vViewPosition);
            vec3 R1 = cross(sY, normal); vec3 R2 = cross(normal, sX);
            float det = dot(sX, R1);
            vec3 grad = sign(det) * (dFdx(hP) * R1 + dFdy(hP) * R2);
            normal = normalize(abs(det) * normal - 0.00005 * grad);
          }
        #endif`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        #ifdef BODY_MORPH
          // Oclusão das concavidades da malha: escurece a luz ambiente por inteiro e um pouco da luz direta
          reflectedLight.indirectDiffuse *= vAO;
          reflectedLight.indirectSpecular *= mix(1.0, vAO, 0.7);
          reflectedLight.directDiffuse *= mix(1.0, vAO, 0.45);
        #endif
        #ifdef BODY_COVER
          // Tecido: o reflexo largo do ambiente (as janelas do HDRI) é fraco, sem cara de cetim
          reflectedLight.indirectSpecular *= 0.5;
          reflectedLight.directSpecular *= 0.75;
        #endif
        #ifdef BODY_SKIN
          // Brilho largo e discreto: a pele tem uma camada oleosa fina, não um espelho
          reflectedLight.directSpecular *= 0.72;
          reflectedLight.indirectSpecular *= 0.85;
        #endif
        #ifdef BODY_HEAD
          reflectedLight.directSpecular *= 0.85 * mix(1.0, 0.35, smoothstep(0.12, 0.5, vScalpW));
          reflectedLight.indirectSpecular *= 0.8 * mix(1.0, 0.2, smoothstep(0.12, 0.5, vScalpW));
        #endif
        #ifdef BODY_HEADHAIR
          // Cartões de cabelo: planos refletem o ambiente como placas, então o brilho vem quase só da luz direta
          reflectedLight.indirectSpecular *= 0.12;
          reflectedLight.directSpecular *= 0.55;
        #endif
        #ifdef BODY_HAIR
          // Cabelo escuro e fosco: o reflexo do ambiente (as janelas e luminárias do HDRI) aparecia em manchas claras
          reflectedLight.indirectSpecular *= 0.22;
          reflectedLight.directSpecular *= 0.6;
        #endif`)
      .replace('#include <opaque_fragment>', `if (cutKill) discard;
        #include <opaque_fragment>`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
        #if defined(BODY_SKIN) || defined(BODY_HEAD)
          // Penugem e luz que sai da pele em ângulo rasante
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.5, 0.36) * 0.12 * fr * (1.0 - skinInner);
        #endif
        #ifdef BODY_COVER
          // Brilho de fibra do tecido nas bordas (no lugar do sheen físico, que era caro): discreto e da cor do pano, não o halo
          // azulado que dava cara de plástico
          totalEmissiveRadiance += (diffuseColor.rgb * 0.5 + vec3(0.010, 0.012, 0.018)) * fr;
        #endif
        #if defined(BODY_HAIR) && NUM_DIR_LIGHTS > 0
        {
          // Brilho de fio (Kajiya-Kay): a faixa clara corre perpendicular à direção do fio, que desce pela cabeça
          vec3 Lh = directionalLights[0].direction;
          vec3 Nh = normalize(normal);
          vec3 Vh = normalize(vViewPosition);
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          vec3 Th = normalize(upV - Nh * dot(upV, Nh));
          float TH = dot(Th, normalize(Lh + Vh));
          float sinTH = sqrt(max(0.0, 1.0 - TH * TH));
          float sp1 = pow(sinTH, 60.0);
          float sp2 = pow(clamp(sinTH - 0.1, 0.0, 1.0), 22.0);
          float lit = smoothstep(-0.1, 0.6, dot(Nh, Lh));
          totalEmissiveRadiance += directionalLights[0].color * (sp1 * 0.03 + sp2 * diffuseColor.rgb * 0.14) * lit;
        }
        #endif
        int si = int(sysV + 0.5);
        float hov = (uHover > 0.5 && abs(sysV - uHover) < 0.5) ? 1.0 : 0.0;
        totalEmissiveRadiance += hov * (uHoverCol * 0.1 + uHoverCol * fr * 0.9);
        // Status no corpo: só um contorno suave na cor do status, sem listras nem varredura sobre a roupa
        float st = uStat[si];
        #ifdef BODY_HEADHAIR
          st = 0.0; // nos cartões de cabelo o Fresnel pegaria faixas inteiras: o status fica no rosto e nos olhos
        #endif
        if (st > 0.5) {
          float breathe = 0.5 + 0.5 * sin(uTime * (st > 1.5 ? 2.2 : 1.1));
          float faceDim = 1.0;
          #if defined(BODY_SKIN) || defined(BODY_HEAD)
            faceDim = 0.35;
          #endif
          totalEmissiveRadiance += faceDim * uStatScale * uStatCol[si] * fr * (0.22 + 0.12 * breathe);
        }
        // Região aberta: contorno de luz azulado e neutro (a cor de status fica no HUD e na borda de dissolução)
        #if !defined(BODY_HAIR) && !defined(BODY_HEADHAIR)
        if (uSel > 0.5 && abs(sysV - uSel) < 0.5) totalEmissiveRadiance += vec3(0.5, 0.78, 1.0) * fr * (0.28 + 0.1 * sin(uTime * 2.4));
        #endif
        totalEmissiveRadiance += uRevealCol * dEdge * 2.4 + vec3(0.45, 0.85, 1.0) * gEdge * 3.2 + vec3(0.6, 0.85, 1.0) * fEdge * 2.0;`)
  }
  mat.customProgramCacheKey = () => `body-${mode}-${fabric ? 'fab' : 'plain'}${sysFromPos ? '-pos' : ''}${decals ? '-dec' : ''}`
}

/**
 * Casca fantasma do raio-X. Mesma geometria do macacão, do traje ou da pele, com o mesmo físico,
 * desenhada por soma de luz (a ordem entre camadas não importa): só um contorno por Fresnel e uma
 * varredura fraca, para não competir com a anatomia por dentro. Aparece à medida que o corpo sólido se dissolve.
 */
export function makeGhostMaterial(u: BodyUniforms, mode: 'skin' | 'cover' | 'suit') {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uXray: u.uXray, uTime: u.uTime, uSuitY: u.uSuitY, uFade: u.uFade, uAtro: u.uAtro, uMassD: u.uMassD, uBreath: u.uBreath, uSway: u.uSway, uLegs: u.uLegs, uLegs2: u.uLegs2,
      uLegPose: u.uLegPose, uHipJ: u.uHipJ, uKneeJ: u.uKneeJ,
      uTint: { value: new THREE.Color(mode === 'suit' ? '#cfe8ff' : '#a9c8e8') },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aBase; attribute vec3 aDir; attribute vec2 aW; attribute float aLeg;
      uniform float uAtro; uniform float uMassD;
      ${LEG_POSE_GLSL}
      ${mode === 'suit' ? 'uniform float uBreath; vec3 breathDisp(vec3 b) { return vec3(0.0); }' : BREATH_GLSL}
      varying vec3 vN; varying vec3 vV; varying vec3 vBase; varying float vWY;
      void main(){
        vec3 transformed = position;
        transformed += aDir * (aW.x * uAtro + aW.y * uMassD);
        transformed += breathDisp(aBase);
        transformed = legPos(aBase, aLeg, transformed);
        vBase = aBase;
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        vN = normalize(normalMatrix * legDir(aBase, aLeg, normal));
        vV = -mv.xyz;
        vWY = (modelMatrix * vec4(transformed, 1.0)).y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uXray; uniform float uTime; uniform float uSuitY; uniform float uFade; uniform vec3 uTint;
      varying vec3 vN; varying vec3 vV; varying vec3 vBase; varying float vWY;
      void main(){
        if (uXray < 0.004 || uFade > 0.98) discard;
        ${mode === 'suit' ? 'if (vWY > uSuitY) discard;' : ''}
        ${mode === 'cover' ? 'if (vWY < uSuitY) discard;' : ''}
        // Só o contorno e uma varredura lenta: a anatomia por dentro é o que deve aparecer
        float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
        float scan = smoothstep(0.95, 1.0, 0.5 + 0.5 * sin(vBase.y * 90.0 - uTime * 0.9));
        float a = (0.006 + fr * 0.22 + scan * 0.04) * uXray * (1.0 - uFade);
        gl_FragColor = vec4(mix(uTint, vec3(0.85, 0.97, 1.0), fr), a);
      }`,
  })
  m.customProgramCacheKey = () => `ghost-${mode}`
  return m
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

/**
 * Rabo de cavalo: cada fio oscila mais perto da ponta (sem gravidade, o cabelo flutua) e some
 * com o corpo no raio-X e no fade da formação.
 */
export function patchTailMaterial(mat: THREE.Material, u: Pick<BodyUniforms, 'uFade' | 'uXray' | 'uTime' | 'uSuitY'>, sway: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFade = u.uFade
    shader.uniforms.uXray = u.uXray
    shader.uniforms.uTime = u.uTime
    shader.uniforms.uSuitY = u.uSuitY
    shader.uniforms.uSway = { value: sway }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aT; attribute float aPh; uniform float uTime; uniform float uSway; varying vec3 vWorld;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float kk = aT * aT * uSway;
        transformed.y += (sin(uTime * 0.9 + aPh) * 0.02 + sin(uTime * 0.53 + aPh * 2.0) * 0.01) * kk;
        transformed.x += (sin(uTime * 0.7 + aPh * 1.7) * 0.018 + sin(uTime * 0.4 + aPh) * 0.008) * kk;
        transformed.z += sin(uTime * 0.6 + aPh) * 0.012 * kk;
        vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uFade; uniform float uXray; uniform float uSuitY; varying vec3 vWorld;
        ${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vWorld.y < uSuitY) discard;
        float tEdge = 0.0;
        { float nzp = vnoise(vWorld * 40.0); float gone = max(uFade, uXray);
          if (gone > 0.001) { float d = nzp - (gone * 1.25 - 0.12); if (d < 0.0) discard; tEdge = smoothstep(0.08, 0.0, d); } }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.6, 0.85, 1.0) * tEdge * 2.0;`)
  }
  mat.customProgramCacheKey = () => 'tail'
}
