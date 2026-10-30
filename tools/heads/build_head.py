"""Monta a cabeça de um avatar do Microsoft Rocketbox (MIT) num GLB compacto, já no espaço do corpo do atlas.

Entrada: os triângulos da cabeça exportados do FBX (JSON, metros, Y para cima) e as texturas TGA do avatar.
Saída: um GLB com três malhas (pele com boca e peças de cabelo, olhos, cabelo e cílios em cartões com alfa),
texturas WebP e um bloco `extras` com os pontos que o aplicativo usa (olhos, pescoço, cor média da pele).
"""
import io, json, struct, sys, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--json', required=True)
ap.add_argument('--build', choices=['male', 'female'], required=True)
ap.add_argument('--color', required=True)
ap.add_argument('--normal', required=True)
ap.add_argument('--spec', required=True)
ap.add_argument('--opacity')
ap.add_argument('--out', required=True)
ap.add_argument('--tone', default='1,1,1', help='multiplicador RGB da textura de cor (tom de pele)')
ap.add_argument('--eye-color', default='', help='cor da íris (#rrggbb); vazio = mantém a do avatar')
ap.add_argument('--drop-islands', default='', help='ilhas de UV a remover, como "u,v;u,v" (centroide, V para baixo)')
ap.add_argument('--tex', type=int, default=1024)
ap.add_argument('--dz', type=float, default=0.0, help='ajuste manual de z (m)')
ap.add_argument('--dy', type=float, default=0.0, help='ajuste manual de y (m)')
args = ap.parse_args()

# ---------------- alvo no corpo do atlas ----------------
def smooth(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def bump(x, c, w):
    return float(np.exp(-((x - c) ** 2) / (2 * w * w)))

def warp_female(p):
    x, y, z = p
    ax = abs(x)
    head = smooth(1.4, 1.46, y)
    body = 1 - 0.13 * smooth(1.18, 1.4, y) - 0.075 * bump(y, 1.08, 0.065) + 0.115 * bump(y, 0.9, 0.085) * (1 - smooth(0.14, 0.21, ax))
    neck = 1 - 0.08 * bump(y, 1.47, 0.04)
    x2 = x * (body + (0.93 - body) * head) * neck
    hb = smooth(1.44, 1.52, y)
    y2 = 1.5 + (y - 1.5) * (1 - 0.045 * hb)
    z2 = -0.02 + (z + 0.02) * (1 - 0.06 * smooth(1.4, 1.5, y))
    return np.array([x2, y2, z2])

EYE_L = np.array([0.031, 1.591, 0.0635])
EYE_R = np.array([-0.031, 1.591, 0.0635])
EYE_R_RADIUS = 0.0128
NECK = np.array([0.0, 1.474, -0.02])
if args.build == 'female':
    tgt_l, tgt_r, tgt_neck = warp_female(EYE_L), warp_female(EYE_R), warp_female(NECK)
else:
    tgt_l, tgt_r, tgt_neck = EYE_L, EYE_R, NECK
tgt_ipd = tgt_l[0] - tgt_r[0]
tgt_mid = (tgt_l + tgt_r) / 2
tgt_apex_z = tgt_mid[2] + EYE_R_RADIUS

# ---------------- triângulos ----------------
d = json.load(open(args.json))
t = np.array(d['tris'], dtype=np.float64)
mat = t[:, 0].astype(int)
body = t[:, 1:].reshape(-1, 3, 8)   # px py pz nx ny nz u v
n = len(mat)

# ilhas de UV
keys = {}
ids = np.zeros((n, 3), dtype=int)
for i in range(n):
    for k in range(3):
        q = (mat[i], int(round(body[i, k, 6] * 1e4)), int(round(body[i, k, 7] * 1e4)))
        ids[i, k] = keys.setdefault(q, len(keys))
par = list(range(len(keys)))
def find(a):
    while par[a] != a:
        par[a] = par[par[a]]
        a = par[a]
    return a
for i in range(n):
    a, b, c = ids[i]
    for x, y in ((a, b), (b, c)):
        rx, ry = find(x), find(y)
        if rx != ry:
            par[rx] = ry
isl = np.array([find(ids[i, 0]) for i in range(n)])

uvc = body[:, :, 6:8].mean(axis=1)
U, V = uvc[:, 0], 1 - uvc[:, 1]

# componentes conexos por POSIÇÃO: os globos oculares são dois componentes isolados de ~126 triângulos
pk = {}
pid = np.zeros((n, 3), dtype=int)
for i in range(n):
    for k in range(3):
        pid[i, k] = pk.setdefault((mat[i],) + tuple(np.round(body[i, k, 0:3] * 1e4).astype(int)), len(pk))
ppar = list(range(len(pk)))
def pfind(a):
    while ppar[a] != a:
        ppar[a] = ppar[ppar[a]]
        a = ppar[a]
    return a
for i in range(n):
    a, b, c = pid[i]
    for x, y in ((a, b), (b, c)):
        rx, ry = pfind(x), pfind(y)
        if rx != ry:
            ppar[rx] = ry
pcomp = np.array([pfind(pid[i, 0]) for i in range(n)])
region = np.zeros(n, dtype=int)   # 0 pele, 1 olhos, 2 cabelo (cartões), -1 descartado
for c in np.unique(pcomp):
    sel = pcomp == c
    if mat[sel][0] != 1 or not (90 <= sel.sum() <= 150):
        continue
    P = body[sel][:, :, 0:3].reshape(-1, 3)
    size = P.max(0) - P.min(0)
    cen = (P.max(0) + P.min(0)) / 2
    if size.max() < 0.045 and 1.5 < cen[1] < 1.8 and 0.015 < abs(cen[0]) < 0.05:
        region[sel] = 1
region[mat == 2] = 2
for spec_ in [q for q in args.drop_islands.split(';') if q.strip()]:
    du, dv = [float(x) for x in spec_.split(',')]
    for c in np.unique(isl):
        sel = isl == c
        uu = body[sel][:, :, 6:8].reshape(-1, 2)
        if abs(uu[:, 0].mean() - du) < 0.03 and abs((1 - uu[:, 1].mean()) - dv) < 0.03:
            region[sel] = -1
print('pele', (region == 0).sum(), 'olhos', (region == 1).sum(), 'cabelo', (region == 2).sum(), 'descartados', (region == -1).sum())

# ---------------- transformação para o espaço do atlas ----------------
eye_tris = body[region == 1]
Pe = eye_tris[:, :, 0:3].reshape(-1, 3)
cl = Pe[Pe[:, 0] > 0]
cr = Pe[Pe[:, 0] < 0]
def dome(q):
    mn, mx = q.min(0), q.max(0)
    return np.array([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mx[2]])  # centro em x,y e o ápice em z
dl, dr = dome(cl), dome(cr)
ipd = dl[0] - dr[0]
s = tgt_ipd / ipd
mid = (dl + dr) / 2
print(f'IPD avatar {ipd:.4f}, alvo {tgt_ipd:.4f}, escala {s:.4f}')

def xf(P, dz=0.0, dy=0.0):
    out = (P - mid) * s
    out[..., 0] += tgt_mid[0]
    out[..., 1] += tgt_mid[1] + dy
    out[..., 2] += tgt_apex_z + dz
    return out

# pescoço: o centro do corte no plano da gola precisa ficar concêntrico com o pescoço do atlas
skin_pos = xf(body[region == 0][:, :, 0:3].reshape(-1, 3), 0, args.dy)
slab = skin_pos[np.abs(skin_pos[:, 1] - 1.474) < 0.004]
if len(slab):
    nc = np.array([(slab[:, 0].min() + slab[:, 0].max()) / 2, 0, (slab[:, 2].min() + slab[:, 2].max()) / 2])
    print(f'centro do pescoço no plano da gola: x={nc[0]:.4f} z={nc[2]:.4f} (alvo z={tgt_neck[2]:.4f}); largura {slab[:,0].max()-slab[:,0].min():.4f}, profundidade {slab[:,2].max()-slab[:,2].min():.4f}')
    dz_auto = float(np.clip(tgt_neck[2] - nc[2], -0.014, 0.014))
else:
    dz_auto = 0.0
dz = dz_auto + args.dz
print(f'dz automático {dz_auto:.4f}, final {dz:.4f}')

# ---------------- soldagem e índices por malha ----------------
def build_mesh(sel):
    tri = body[sel]
    P = xf(tri[:, :, 0:3].reshape(-1, 3), dz, args.dy)
    N = tri[:, :, 3:6].reshape(-1, 3)
    UV = tri[:, :, 6:8].reshape(-1, 2).copy()
    UV[:, 1] = 1.0 - UV[:, 1]   # FBX/three: V para cima; glTF: V para baixo
    key = {}
    pos, nor, uvs, idx = [], [], [], []
    for i in range(len(P)):
        k = (tuple(np.round(P[i] * 1e5).astype(int)), tuple(np.round(N[i] * 100).astype(int)), tuple(np.round(UV[i] * 1e4).astype(int)))
        j = key.get(k)
        if j is None:
            j = len(pos)
            key[k] = j
            pos.append(P[i]); nor.append(N[i]); uvs.append(UV[i])
        idx.append(j)
    return np.array(pos, np.float32), np.array(nor, np.float32), np.array(uvs, np.float32), np.array(idx, np.uint32)

meshes = {}
for name, r in (('skin', 0), ('eyes', 1), ('hair', 2)):
    sel = region == r
    if not sel.any():
        continue
    meshes[name] = build_mesh(sel)
    p, nn, uu, ii = meshes[name]
    print(f'{name}: {len(p)} vértices, {len(ii)//3} triângulos')

# ---------------- texturas ----------------
S = args.tex
tone = np.array([float(x) for x in args.tone.split(',')])
color = Image.open(args.color).convert('RGB')
carr = np.asarray(color, dtype=np.float32) / 255
# tom de pele médio da bochecha (para as mãos e o pescoço do corpo)
h, w, _ = carr.shape
cheek = np.concatenate([carr[int(h * 0.33):int(h * 0.40), int(w * 0.31):int(w * 0.40)].reshape(-1, 3), carr[int(h * 0.33):int(h * 0.40), int(w * 0.60):int(w * 0.69)].reshape(-1, 3)])
avg = cheek.mean(0) * tone
carr = np.clip(carr * tone, 0, 1)
# íris: recoloração para a cor de olhos do astronauta, só no disco da íris (a esclera branca e a pupila escura ficam)
if args.eye_color:
    import colorsys
    eu = body[region == 1][:, :, 6:8].reshape(-1, 2)
    cx = int((eu[:, 0].min() + eu[:, 0].max()) / 2 * w)
    cy = int((1 - (eu[:, 1].min() + eu[:, 1].max()) / 2) * h)
    R = int((eu[:, 0].max() - eu[:, 0].min()) * w * 0.34)
    tr, tg, tb = [int(args.eye_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    target = np.array([tr, tg, tb])
    yy, xx = np.mgrid[cy - R:cy + R, cx - R:cx + R]
    mask = ((yy - cy) ** 2 + (xx - cx) ** 2) < R * R
    patch = carr[cy - R:cy + R, cx - R:cx + R].copy()
    flat = patch.reshape(-1, 3)
    mx_ = flat.max(1)
    mn_ = flat.min(1)
    sat_ = (mx_ - mn_) / np.maximum(mx_, 1e-4)
    # íris = onde há alguma cor e não é nem pupila (muito escuro) nem esclera (muito claro e sem cor)
    iris = (mx_ > 0.16) & ~((mx_ > 0.78) & (sat_ < 0.14))
    vmean = float(mx_[iris].mean()) if iris.any() else 0.5
    out = flat.copy()
    # a cor-alvo vezes a luminância relativa do pixel (fibras e sombra da íris ficam), sem estourar a saturação
    rel = np.clip(mx_ / vmean, 0.45, 1.12) ** 0.9
    out[iris] = np.clip(target[None, :] * 0.86 * rel[iris, None], 0, 1)
    patch2 = out.reshape(patch.shape)
    carr[cy - R:cy + R, cx - R:cx + R] = np.where(mask[..., None], patch2, patch)
    print(f'íris recolorida em ({cx},{cy}) raio {R} para {args.eye_color}')
color_img = Image.fromarray((carr * 255 + 0.5).astype(np.uint8), 'RGB').resize((S, S), Image.LANCZOS)

normal_img = Image.open(args.normal).convert('RGB').resize((S, S), Image.LANCZOS)
spec = np.asarray(Image.open(args.spec).convert('L'), dtype=np.float32) / 255
rough = np.clip(0.74 - 1.15 * spec, 0.16, 0.74)
mr = np.zeros((spec.shape[0], spec.shape[1], 3), dtype=np.float32)
mr[..., 1] = rough          # G = rugosidade
mr[..., 2] = 0.0            # B = metalicidade
mr_img = Image.fromarray((mr * 255 + 0.5).astype(np.uint8), 'RGB').resize((S // 2, S // 2), Image.LANCZOS)
opacity_img = None
if args.opacity:
    opacity_img = Image.open(args.opacity).convert('RGBA').resize((S, S), Image.LANCZOS)

def webp(img, q, lossless=False):
    b = io.BytesIO()
    img.save(b, 'WEBP', quality=q, method=6, lossless=lossless)
    return b.getvalue()

images = [('color', webp(color_img, 88)), ('normal', webp(normal_img, 92)), ('mr', webp(mr_img, 80))]
if opacity_img is not None:
    images.append(('opacity', webp(opacity_img, 85)))
print('imagens', [(n_, round(len(b) / 1024)) for n_, b in images], 'KB')

# ---------------- GLB ----------------
bin_chunks = bytearray()
views, accessors = [], []
def add_view(data, target=None):
    while len(bin_chunks) % 4:
        bin_chunks.append(0)
    off = len(bin_chunks)
    bin_chunks.extend(data)
    v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
    if target:
        v['target'] = target
    views.append(v)
    return len(views) - 1

def add_acc(arr, ctype, atype, target=None, minmax=False):
    vi = add_view(arr.tobytes(), target)
    a = {'bufferView': vi, 'componentType': ctype, 'count': int(len(arr)) if arr.ndim == 1 else int(arr.shape[0]), 'type': atype}
    if minmax:
        a['min'] = [float(x) for x in arr.min(0)]
        a['max'] = [float(x) for x in arr.max(0)]
    accessors.append(a)
    return len(accessors) - 1

img_defs, tex_defs = [], []
for name_, data in images:
    vi = add_view(data)
    img_defs.append({'bufferView': vi, 'mimeType': 'image/webp', 'name': name_})
    tex_defs.append({'source': len(img_defs) - 1, 'extensions': {'EXT_texture_webp': {'source': len(img_defs) - 1}}, 'name': name_})
tex_index = {n_: i for i, (n_, _) in enumerate(images)}

materials = [
    {'name': 'skin', 'pbrMetallicRoughness': {'baseColorTexture': {'index': tex_index['color']}, 'metallicRoughnessTexture': {'index': tex_index['mr']}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0},
     'normalTexture': {'index': tex_index['normal']}},
    {'name': 'eyes', 'pbrMetallicRoughness': {'baseColorTexture': {'index': tex_index['color']}, 'metallicRoughnessTexture': {'index': tex_index['mr']}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0}},
]
if opacity_img is not None:
    materials.append({'name': 'hair', 'alphaMode': 'MASK', 'alphaCutoff': 0.5, 'doubleSided': True,
                      'pbrMetallicRoughness': {'baseColorTexture': {'index': tex_index['opacity']}, 'metallicFactor': 0.0, 'roughnessFactor': 0.55}})

mesh_defs, nodes = [], []
mat_of = {'skin': 0, 'eyes': 1, 'hair': 2}
for name, (p, nn, uu, ii) in meshes.items():
    if name == 'hair' and opacity_img is None:
        continue
    a_pos = add_acc(p, 5126, 'VEC3', 34962, True)
    a_nor = add_acc(nn, 5126, 'VEC3', 34962)
    a_uv = add_acc(uu, 5126, 'VEC2', 34962)
    ii16 = ii.astype(np.uint16) if ii.max() < 65535 else ii
    a_idx = add_acc(ii16, 5123 if ii16.dtype == np.uint16 else 5125, 'SCALAR', 34963)
    mesh_defs.append({'name': name, 'primitives': [{'attributes': {'POSITION': a_pos, 'NORMAL': a_nor, 'TEXCOORD_0': a_uv}, 'indices': a_idx, 'material': mat_of[name]}]})
    nodes.append({'mesh': len(mesh_defs) - 1, 'name': name})

# pontos úteis para o aplicativo (já no espaço do atlas)
eye_c_l = xf(dl[None], dz, args.dy)[0]
eye_c_r = xf(dr[None], dz, args.dy)[0]
skin_p = meshes['skin'][0]
chin = skin_p[(skin_p[:, 2] > 0.02) & (np.abs(skin_p[:, 0]) < 0.02)]
extras = {
    'avgSkin': [float(x) for x in avg],
    'eyeApexL': [float(x) for x in eye_c_l], 'eyeApexR': [float(x) for x in eye_c_r],
    'chinY': float(chin[:, 1].min()), 'scale': float(s), 'dz': float(dz),
    'topY': float(skin_p[:, 1].max()),
    'source': 'Microsoft Rocketbox, MIT',
}
gltf = {
    'asset': {'version': '2.0', 'generator': 'orbitalis build_head.py'},
    'extensionsUsed': ['EXT_texture_webp'], 'extensionsRequired': ['EXT_texture_webp'],
    'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': mesh_defs,
    'materials': materials, 'textures': tex_defs, 'images': img_defs,
    'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_chunks)}],
    'extras': extras,
}
jb = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
while len(jb) % 4:
    jb += b' '
while len(bin_chunks) % 4:
    bin_chunks.append(0)
total = 12 + 8 + len(jb) + 8 + len(bin_chunks)
glb = struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<II', len(jb), 0x4E4F534A) + jb + struct.pack('<II', len(bin_chunks), 0x004E4942) + bytes(bin_chunks)
open(args.out, 'wb').write(glb)
print(f'GLB {round(len(glb) / 1024)} KB -> {args.out}')
print('extras', json.dumps({k: (np.round(v, 4).tolist() if isinstance(v, list) else round(v, 4) if isinstance(v, float) else v) for k, v in extras.items()}))
