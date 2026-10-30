# Cabeças da tripulação

As quatro cabeças em `public/models/heads/*.glb` vêm da biblioteca **Microsoft Rocketbox** (licença MIT,
https://github.com/microsoft/Microsoft-Rocketbox): avatares genéricos "que não existem na realidade", feitos por escultura com fotos de
referência muito misturadas (Gonzalez-Franco et al., 2020, *Frontiers in Virtual Reality*). Os GLB são derivados: os arquivos originais
(FBX e texturas TGA de 2048 px) não ficam no repositório.

| Astronauta | Avatar Rocketbox | Textura | Ajustes |
|---|---|---|---|
| Lena Moreau | `Female_Adult_09` | `f009_*` | íris `#6a8aa4` |
| Aiko Sato | `Female_Adult_03` | `f003_*` | íris original |
| Rafael Duarte | `Male_Adult_02` | `m003_*` | íris `#835629`, tom de pele `--tone 0.9,0.80,0.70` |
| Daniel Osei | `Male_Adult_12` | `m007_*` | íris original |

## Como foram gerados

1. Baixe `Assets/Avatars/Adults/<Avatar>/Export/<Avatar>.fbx` e `Textures/<prefixo>_head_{color,normal,specular}.tga` (e
   `<prefixo>_opacity_color.tga`, o cabelo em cartões, quando existir).
2. Coloque o FBX em `public/tmp_rb/`, rode `npm run dev` e abra um Chrome com `--remote-debugging-port=9333`. Então:
   `node tools/heads/fbx_export.mjs <Avatar> <saida>.json 128` lê o FBX com o `FBXLoader` do three e exporta os triângulos da
   cabeça (materiais de cabeça e cabelo, acima de 128 cm) em metros e com Y para cima.
3. `python tools/heads/build_head.py --json <saida>.json --build female|male --color ... --normal ... --spec ... [--opacity ...]
   [--eye-color "#rrggbb"] [--tone r,g,b] --out public/models/heads/<id>.glb` escala e posiciona a cabeça no corpo do atlas (olhos nos
   olhos, pescoço no pescoço, com a mesma deformação feminina de `warp()` em `bodyBuild.ts`), troca o V da textura para a convenção do
   glTF, acha os globos oculares pela geometria, recolore a íris, calcula o tom médio da bochecha (para as mãos) e grava um GLB com
   texturas WebP.

Requer Python 3 com `numpy` e `Pillow`.

## O que o aplicativo faz depois (`src/scene/headModel.ts`)

O GLB não é o resultado final: ao carregar, `loadHead` troca os globos oculares por esferas finas com a íris de `look.eyes` (a íris
recolorida aqui só vale como reserva), desce um pouco as pálpebras, tira o busto (o avatar da Aiko traz ombros e peito junto com o
pescoço) e afina a base do pescoço, e monta o couro cabeludo para o cabelo em camadas de fios. O estilo de cada cabelo
(`HAIR_STYLE`) diz se os cartões do avatar ficam (Lena e Aiko) ou só os fios (Rafael e Daniel). Ao trocar um avatar, olhe-o de
frente, de lado e de costas numa câmera próxima e ajuste `HAIR_STYLE` e as constantes `BUST_*` e `TAPER_*`.
