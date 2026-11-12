# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ORBITALIS

Contexto para agentes de IA que trabalham neste repositório.
Equipe AstroCoders · NASA Space Apps Challenge 2026 · 14–15/11/2026.

---

## 0. Estado atual do repositório

- Stack: Vite + React 19 + TypeScript + `@react-three/fiber`/`drei` + `@react-three/postprocessing` + zustand + vitest. Repositório git: os dois primeiros commits guardam a versão com painéis holográficos e o redesenho cinematográfico.
- Comandos: `npm run dev` (http://localhost:5173; `/api/space-weather` é um middleware do Vite que busca o DONKI) · `npm run build` (typecheck + build) · `npm run typecheck` · `npm test` (um teste: `npx vitest run -t "nome"`).
- Parâmetros de URL para demonstrar e depurar: `?suit=1&xray=1&solar=1&day=200&link=blackout&layers=muscles,skeleton,organs,vessels,nerves` (lidos em `urlFlags()` de `src/state/store.ts`; `day` vai de 10 a 250 e mostra o físico mudando).
- Documentos em `docs/`: a spec (o esperado), o status dos requisitos, a viabilidade e os riscos, as diretrizes da NASA já verificadas, a análise de UI/UX e o rascunho do catálogo de emergência. A skill `orbitalis-viability` (`.claude/skills/orbitalis-viability/`) reavalia o projeto contra o esperado, aponta o que pode dar problema segundo as diretrizes da NASA e atualiza `docs/`: rode `/orbitalis-viability` ao concluir uma entrega que mude funcionalidade, regra, dados ou docs, e sempre que perguntarem se dá tempo, o que falta ou quais os riscos. Ela só escreve em `docs/` e nunca commita; no modo `audit fix` (acha as contradições entre CLAUDE.md, docs, código e regras do evento e as corrige) ela também edita o resto do repositório, mas só depois que o dono decide o que é dele, e nunca edita a spec.
- Funcional: RF-01 a RF-15. Telas: Crew (formação 3D da tripulação), Body, System, Metric, mais Log de medição, Today's queue, Decision diary, Flight surgeon packet e Sources (as quatro últimas e a simulação ficam no Menu).
- **Decisão de design de 28/10/2026, do dono do produto:** o design anterior (painéis densos, holograma cinza, hotspots flutuantes) foi descartado. Agora é uma cena 3D cinematográfica com personagem realista (pele colorida, cabelo, olhos, macacão), clique direto nas regiões do corpo, traje de EVA vestível que muda a radiação, e UI mínima em vidro. Isso **substitui** o "holograma clínico", os tokens antigos e o descarte de "cor de olhos e cabelo" da spec. Menos informação por tela é requisito, não preferência (revisto em 30/10: o problema era a hierarquia escondida, não o volume; veja a rodada de UI/UX dos dados).
- **Segunda rodada de 28/10/2026 (revisão do dono do produto), já implementada:** (1) há astronautas femininas de verdade (Lena e Aiko: proporções, busto, quadril, cabeça menor, sobrancelha fina, rabo de cavalo que flutua); (2) os corpos deixaram de ser de halterofilista e o **físico muda com a saúde** (`physique()` em `lib/model.ts`); (3) o raio-X funcionava com o traje de EVA (casca fantasma; **revogado em 10/11**: desde então o raio-X não existe com o traje vestido, `xrayAllowed`, veja o RF-33); (4) o **painel de camadas do atlas** voltou (músculos, esqueleto, órgãos, circulação, nervos); (5) base e Marte ficaram fotorrealistas (imagens reais de Marte e da Via Láctea, luz por HDRI, texturas PBR, profundidade de campo).
- **Terceira rodada de 28/10/2026 (revisão do dono do produto), já implementada:** (1) a **aura de radiação foi removida** (turvava o corpo e atrapalhava o raio-X). Isso **substitui** a "aura em volta do corpo" da spec: o estado da radiação fica no botão **Radiation** do dock (desde 30/10, numa linha da lista de sistemas), com forma e palavra (`▲ WATCH`), e o dosímetro do braço continua abrindo a radiação; (2) o raio-X mostra **todos os sistemas do atlas de uma vez**, cada um num tom próprio, com a sala escurecida e a câmera mais perto, e o painel **Anatomy** liga, desliga e isola cada sistema (desde 30/10, uma fileira acima do dock, só com o raio-X ligado).
- **Quarta rodada de 28/10/2026 (revisão do dono do produto), já implementada:** (1) o **traje de EVA agora é um modelo real da NASA** (Z-2, traje planetário, domínio público) em vez de peças procedurais; (2) o interior da estação ganhou racks com travas, grades, plaquetas e conectores, bolsas de estiva e cabos; (3) o macacão ganhou zíper, bolsos, costuras, cinto e vincos; (4) com músculos e esqueleto juntos o músculo aparece nítido por cima; (5) o astronauta gira **360°** ao arrastar; (6) Marte sem halo e o casco da nave sem buraco.
- **Quinta rodada de 29/10/2026 (revisão do dono do produto), já implementada:** (1) as **listras laranja de status sobre o corpo foram removidas** (pareciam tinta): o status por região é só um contorno suave na cor do status, e a região aberta ganha um contorno azulado neutro; (2) **sem argola no pescoço nem nos punhos**: o macacão cobre a base do pescoço e o punho e termina num corte reto (`coverCut`: os triângulos são recortados no plano em `extract`, e o atributo `aCut` guarda a distância à borda para a costura e a borda enrolada do shader); (3) o **círculo no chão** virou uma sombra de contato bem suave (`Halo`), sem anéis; (4) o **traje de EVA agora é ajustado a cada astronauta** (`fitSuit`, em `suitModel.ts`): refaz a pose dos braços do Z-2 em A, estreita tronco, capacete e pernas no corpo feminino, alinha o tronco ao corpo, e usa o mapa de especular do arquivo (viseira dourada espelhada, anéis metálicos); a textura de cor foi limpa da sujeira "assada" no tecido, e as listras vermelhas ficam na cor do astronauta; (5) pele com espalhamento sob a superfície, poros (só de perto), lábios, barba, narinas fechadas por tampões escuros, suavização leve da geometria do rosto e do pescoço (o atlas vem de voxels e tinha relevo de casca de laranja), cabelo com normais suaves e sem reflexo manchado, rabo de cavalo em mechas, oclusão ambiente por cavidade (`meshAO.ts`) e tecido com brilho de fibra (feito no shader: os materiais físicos com sheen e clearcoat custavam ~20% do quadro). Os tons de pele de Lena, Aiko e Daniel foram ajustados (estavam estourados pela luz da sala).
- **Sexta rodada de 29/10/2026 (revisão do dono do produto), já implementada:** (1) **sem os pontos pretos no nariz** (eram tampões que eu tinha posto nas narinas): o atlas modela lábios e narinas como folhas fechadas, e as paredes de dentro furavam a pele em pontinhos claros; agora essas paredes saem (`dropInnerFaces`), as normais da cabeça só contam faces voltadas para fora (`weldedNormals(..., outward)`), os furinhos de 1–2 vértices são fechados (`fillSmallHoles`) e o interior de boca, narinas, olhos e orelhas fica escuro como sombra da própria pele (`skinInner`, só nessas aberturas); (2) **postura natural** (`pose.ts`): braços relaxados ao lado do corpo, antebraço um pouco flexionado, palma voltada para a coxa e dedos soltos, curvos; a mesma deformação vale para a pele, o macacão, o fantasma do raio-X e a anatomia por dentro (`anatomy.ts`); (3) **respiração** (`BREATH_GLSL` em `bodyShader.ts`, uniforme `uBreath`): tórax, abdômen e ombros sobem e descem uns 13 mm a ~13 respirações por minuto, cada astronauta em uma fase, com um balanço de peso mínimo e os pés plantados no piso (sem flutuar); com `prefers-reduced-motion` fica parado; a anatomia por dentro não respira (só a casca e o fantasma do raio-X); (4) o **rabo de cavalo pende** pelas costas, preso na superfície do cabelo, em vez de flutuar; (5) os **braços do traje de EVA** agora descem ao lado do corpo (braço esticado 55% para o cotovelo ficar na altura da cintura, antebraço e luva para baixo): antes a pose pendurada subia o cotovelo ao peito e eles pareciam quebrados; (6) a **gola** é recortada no plano triângulo a triângulo (`extract`), sem dentes, e a pele da base do pescoço some abaixo do mesmo plano.
- **Sétima rodada de 29/10/2026 (revisão do dono do produto), já implementada:** (1) **as cabeças foram trocadas** por avatares da biblioteca Microsoft Rocketbox (MIT), um por astronauta, em `public/models/heads/*.glb` (gerados por `tools/heads`, veja o README de lá): rosto com textura de cor, normal e rugosidade, cílios, sobrancelhas, olhos com íris recolorida e cabelo em cartões com alfa (o cabelo da Lena e da Aiko vem preso na própria cabeça, sem nada flutuando); a cabeça do atlas virou reserva (`variant.head`) e continua sendo a forma do clique (`pick`); (2) o **traje de EVA mostra o rosto**: a calota dourada do capacete e a casca escura que ficava atrás dela saem do traje e viram uma malha de vidro semitransparente (`splitVisor`, `suit.visor`), a cabeça sobe 12 cm dentro do capacete quando o traje fecha (`HEAD_IN_HELMET`) e volta ao lugar no raio-X, onde está o crânio; clicar no vidro abre neuro-ocular; (3) o **tecido do traje** perdeu a granulação de pelúcia (relevo 1,6 → 0,55, albedo 0,86, sheen menor); (4) a gola do macacão desceu 2 cm para aparecer pescoço; (5) a cena espera as cabeças carregarem junto com o corpo (`useHeads`), para ninguém trocar de rosto na frente do usuário. **Sobre a regra 11:** os autores do Rocketbox descrevem os avatares como personagens genéricos "que não existem na realidade", feitos por escultura com fotos de referência de pessoas reais muito misturadas e modificadas; a licença é MIT. Não há nome, fotografia nem retrato de uma pessoa identificável, mas as texturas não são 100% sintéticas, e isso deve ser dito na submissão.
- **Oitava rodada de 30/10/2026 (revisão do dono do produto), já implementada** (o dono apontou: cabelo com partes detalhadas e partes só de textura, olhos amarelados, corpo pouco fotorrealista, plaqueta afundando no peito, ligação do pescoço com a cabeça mostrando as imperfeições; e, no traje de EVA, os braços "quebrados"): (1) **cabelo**: o couro cabeludo de cada cabeça ganha **camadas de fios** (`hairShells.ts`: 14 cópias do couro cabeludo, afastadas pela normal e inclinadas pelo caimento do estilo, onde só sobram os pontos dentro de um fio; `HAIR_STYLE` em `headModel.ts` dá comprimento, penteado e se mantém ou não os cartões do avatar). A máscara do couro cabeludo (`scalpWeights`: testa, laterais acima das orelhas e atrás da cabeça, só onde a textura é escura) faz o cabelo pintado ficar fosco, sem o brilho de pele que formava placas cinzas. Rafael e Daniel ficaram só com os fios; Lena e Aiko mantêm os cartões do avatar (rabo e franja), agora com fios finos e vãos no shader (`BODY_HEADHAIR`) e mais escuros; (2) **olhos**: os globos do avatar (esferas de 60 vértices com a íris pintada na pele) foram trocados por esferas finas com a íris procedural na cor do astronauta (`buildEyes`, `eyeTexture`, agora com a cor em sRGB certa) e as pálpebras descem um pouco (`closeLids`): sem o tom amarelado nem o olhar arregalado; (3) **pescoço e gola**: o corte do macacão é um plano que sobe pelo ombro (`collarPlane`), sem a prateleira nos ombros, e a gola é um **funil à parte** (`collar.ts`) que fecha em volta do pescoço de cada astronauta (medido na cabeça), com borda enrolada, forro escuro e costura; `trimBust` e `taperNeckBase` tiram o busto que o avatar da Aiko traz junto com o pescoço e afinam a base do pescoço, que furava o ombro em lascas de pele; (4) a **plaqueta de nome e o emblema** são desenhados no próprio tecido (`CoverDecals` em `bodyShader.ts`): respiram e se dissolvem com ele, em vez de peças coladas que afundavam no peito; (5) **macacão**: tecido plano (linho, Poly Haven) no lugar da malha de jérsei, sem o halo azul de borda, fivela escura, e o vinco do cotovelo só nas mangas (no tronco virava um abdômen em "tanquinho" por cima do pano); (6) **traje de EVA**: os braços são alinhados pelos eixos medidos dos dois tubos (`Z2.upper`, `Z2.fore`), não mais pela ponta da luva, com a dobra do cotovelo contínua; (7) não deu certo e foi tirado: suavizar a forma ou só as normais do tronco do macacão (as normais originais já eram lisas e a suavização criou sulcos nas costas).
- **Nona rodada de 30/10/2026 (revisão do dono do produto), substituída pela décima** (o dono apontou que os braços do traje de EVA continuavam com cara de não anatômicos e pediu uma pose natural, para a frente, sem precisar ser esticada, já que o modelo de origem tem os braços à frente): (1) os **braços do traje agora ficam para a frente** (`ARM_UP` e `ARM_FORE` em `suitModel.ts`): braço pendendo uns 26° para a frente e 8° para fora, cotovelo flexionado uns 52°, antebraço e luva uns 10° abaixo da horizontal e as mãos diante do quadril. Isso **substitui** a pose de braços caídos ao lado do corpo da sexta e da oitava rodadas (as mangas do Z-2 são tubos grossos e, retos ao lado do corpo, pareciam quebradas); (2) a deformação deixou de misturar duas posições e passou a ser uma **rotação rígida por ponto, interpolada de forma esférica** (`slerp`) em torno do ombro e do cotovelo: o tubo não murcha na dobra e a flexão sai arredondada; (3) a anatomia por baixo e o fantasma do raio-X **continuam na postura de repouso do corpo** (braços caídos): com o traje vestido só a casca visível tem os braços à frente (ao abrir a região muscular do traje, os braços do corpo aparecem ao lado do tronco; no raio-X o traje se dissolve inteiro e sobra o fantasma do corpo).
- **Décima rodada de 30/10/2026 (revisão do dono do produto), já implementada** (os braços para a frente também ficaram tortos e irreais, "parecem quebrados"): o defeito não era só o ângulo, era a forma da manga. Medida de perto, a manga do Z-2 é uma sanfona inteira, com pregas de 9 cm de raio, 1,5 cm mais grossa que o braço e com a borda saltada no anel do cotovelo, e a dobra ficava nesse anel: o antebraço lia como um gesso preso ao braço. Agora (1) a manga **afina como um antebraço** (`foreTaper` em `suitModel.ts`, tabela tirada do contorno medido): começa por dentro da bainha do braço, incha um pouco no cotovelo e afina até o punho, com as pregas menores, e a luva não muda; (2) **a dobra fica no meio da sanfona** (`ELBOW_AT`), onde fica o cotovelo; (3) o tubo do braço e a manga alongam (`UPPER_STRETCH` 1,3 e `FORE_STRETCH` 1,6) para o braço ter as proporções de um corpo de 1,80 m (cotovelo na cintura, luva no meio da coxa); (4) a pose que eu tinha posto (braços caídos e relaxados) **foi trocada pelo próprio dono, à mão, no mesmo dia**: `ARM_UP` = (0,2; -0,985; 1) e `ARM_FORE` = (0,06; -0,86; 1) em `suitModel.ts`, ou seja, braços para a frente e para baixo (uns 45° da vertical), quase retos. **Esses dois vetores estão aprovados pelo dono e não devem mais ser alterados** (nem pela IA, nem em limpezas); a manga afinada, o alongamento e a dobra no meio da sanfona ficam como estão. Os testes de `fit.test.ts` não fixam essa direção, só que a pose segue natural. Como o corpo por baixo (anatomia, fantasma do raio-X, região aberta) fica na postura de repouso com os braços caídos, com o traje vestido eles não coincidem com as mangas; só aparece ao abrir a região muscular do traje.
- **Animação dos avatares (30/10/2026), já implementada:** os corpos não têm esqueleto, então a vida vem de três camadas em `AstronautRig.tsx` e `bodyShader.ts`, todas paradas com `prefers-reduced-motion`, com o raio-X ligado ou com uma região aberta (a anatomia por baixo não se mexe): (1) **cabeça**: gira e inclina em torno da base do pescoço (`head.neck`, y 1,49), olha para a câmera (40% do ângulo, só se ela estiver à frente), troca o olhar a cada ~4,7 s, acompanha a respiração; dentro do capacete a amplitude cai pela metade; (2) **olhos**: piscar (~15/min, às vezes duplo) e olhar que chega antes da cabeça com micro-sacadas, ambos no material do olho (`uBlink`, `uGaze`, `uLid` em `makeHeadMaterials`: pálpebra de cima vira a cor da pele e a íris desliza pelo UV da esfera); (3) **corpo**: troca de peso a cada ~9 s e braços que balançam como pêndulo em torno do ombro (`uSway`; `armSway` na pele e no macacão, `suitSway` nas mangas do Z-2 pelo atributo `aArm`; os vetores `ARM_UP` e `ARM_FORE` não mudam). Cada astronauta tem fase própria (`seedOf`). Não há teste automatizado: a conferência foi por captura em Chrome headless.
- **Rodada de UI/UX dos dados (30/10/2026, decisão do dono do produto), já implementada** (o dono apontou que os dados estavam organizados de forma confusa e que o app parecia focar mais na animação do que nos dados; a análise completa, com a aderência ao enunciado da NASA, está em `docs/ORBITALIS — Análise de UI e UX.md`). O princípio agora é **o corpo é o mapa, a lista é o índice**: (1) **lista dos 8 sistemas à esquerda** (`SystemsRail` em `ui/Hud.tsx`), da cabeça aos pés (`BODY_ORDER` em `data/systems.ts`), cada um com forma, cor e palavra do status e, fora do nominal, a métrica que o causa (`systemDrivers`); passar o cursor numa linha realça a região no corpo (`railSys` no store, que a cena usa antes de `hoverSys`) e passar o cursor no corpo marca a linha; é também a navegação por teclado (o trilho oculto `SystemRail` saiu); (2) o **nível 1 mostra os seis indicadores do enunciado** (frequência cardíaca, pressão sistólica, glicemia, temperatura, sono e humor) numa tabela com as colunas Now, Pre-flight e Source e o motivo nas linhas fora do nominal, depois a ação do dia compacta e até 2 medições pendentes com o atalho para registrar, sem rolagem a 1440×800. Isso **substitui** o "nenhum outro número" do §3; (3) **nível 2**: cada medidor tem minigráfico da missão (`Sparkline`), o motivo do status e o chip do limite (ID NASA ou Provisional); o cabeçalho tem trilha de navegação (`Crumbs`), a função do sistema (`role`) e os riscos do HRP (`hazards`, `HAZARD_LABEL`); o `Gauge` (marcas sem rótulo) e o `TrendCompare` saíram; "Add to packet" (`EARTH-PACKET`) põe de fato no pacote as métricas fora do nominal do sistema; (4) **nível 3**: o chip do limite fica logo abaixo do valor, o gráfico tem rótulos diretos (Pre-flight, Limit, Range, Today) e eixos de 11 px, e "About this number" vem aberto; (5) a **temperatura corporal** virou métrica do motor (`temp`, 3ª métrica do imune, CONTINUOUS, faixa provisória 36,0–37,5 °C, crítica fora de 35,0–38,0), e `tempBaseline`/`tempNow` saíram de `Astronaut` e viraram `overrides.temp`; (6) **Crew**: cada placa traz os sistemas fora do nominal (`attentionSystems`) e o subtítulo nomeia quem está em watch; (7) as **camadas do atlas** viram a fileira "Anatomy layers" acima do dock, só com o raio-X ligado (o botão "All" no lugar de "All systems", para não competir com a lista), e o **botão Radiation saiu do dock**: a radiação é uma linha da lista, como os outros sistemas. Isso **substitui** o painel Anatomy fixo à esquerda (2ª e 3ª rodadas) e o estado da radiação no dock (3ª rodada); (8) painel de 440 px e lista de 232 px com vidro mais opaco (`--glass-data`), e a câmera centraliza o corpo entre os dois (`PANEL_PX`, `RAIL_PX` em `Stage.tsx`); abaixo de 1024 px a lista vira uma faixa horizontal sob a barra superior.
- **RF-33, três lugares (06/11/2026, refeito no mesmo dia pela revisão do dono), já implementado:** (1) **foguete** (refeito em 10/11 pela revisão do dono: "nenhum foguete é assim, os astronautas ficam na vertical"): o foguete fica de pé na plataforma e a tripulação vai **deitada de costas**, presa nos quatro assentos lado a lado, com quadril e joelhos a ~90°, as canelas sobre o apoio de panturrilha e o rosto para o nariz da nave, como na Crew Dragon e na Soyuz. A cabine segue a Crew Dragon (`CapsuleInterior` e `CrewSeat` em `scene/Places.tsx`): parede cônica a 15° com painéis cinza-claros, piso sobre o escudo térmico, túnel da escotilha de proa, escotilha lateral com janela, janelas com o céu do dia, luminárias planas, bolsas de estiva e um painel de voo de três telas acima das pernas, virado para os rostos. Janelas, escotilha lateral e luminárias são assentadas na curva da parede (`wrapOnWall` em `Places.tsx`): peças planas encostadas na parede cônica furavam a parede nas bordas (o dono apontou em 11/11 as janelas "atravessando as extremidades da cabine"). **O foguete é visto só de dentro** (decisão do dono, 11/11): a câmera nunca sai da cabine (`clampInCabin`, na formação, no foco e no giro livre), com lente de 52° só ali (`CABIN_FOV`; no resto do app, 32°) e pulando para o lugar novo por trás do véu. O painel de voo fica acima dos pés, fora do quadro da formação, e sai com um astronauta aberto. Os assentos ficam a 0,8 m (`CAPSULE_X` em `Stage.tsx`; na nave real, ~0,65 m) e o assento vai com o astronauta para o centro. 1 g, sem traje de EVA, **com raio-X** (veja abaixo); (2) **estação espacial**: o cenário original do cruzeiro a Marte, com Marte na janela; **o espaço profundo não é outro lugar, é a EVA da estação** (traje vestido → flutuando preso pelo cabo; tirou o traje, volta); (3) **base lunar**: cúpula em terra firme na Lua (`LunarBase`), 1/6 g; com o traje o astronauta sai e fica de pé no regolito, sem cabo, com a cúpula atrás (`LunarOutside`). Transições só pelas arestas do perfil (`advance` no store): foguete → estação (missão a Marte) ou foguete → base lunar, com um véu de 0,65 s; cada lugar reinicia o relógio no dia 1. `data/scenarios.ts` guarda o perfil (`world`, `posture`, gravidade, dose com grandeza e fonte, link, evacuação, EVA, avisos de ação); o padrão é a estação, dia 142 (`?scenario=launch|station|lunar`; `deep` vira `station`). **Postura** (`scene/legPose.ts`): o corpo não tem esqueleto, então a perna gira rigidamente no quadril e no joelho por `uLegPose` no shader (pele, macacão, fantasma do raio-X e camadas da anatomia, pelo `LegPoseContext`); o atributo `aLeg` separa a perna da mão pendurada ao lado da coxa; no foguete as pernas dobram com `SEAT_HIP`/`SEAT_KNEE` e o grupo inteiro gira −90° em x em torno do quadril até o ponto do assento (`reclineFrame` e `SUPINE`), o clique usa uma cópia da malha com as pernas dobradas (`seatedPick`) e a câmera mira as regiões já deitadas (`supinePoint`). A câmera da formação fica perto do teto, do lado dos pés e da direita, e olha de três quartos para a fileira (`CABIN_EYE`, `CABIN_LOOK` em `Stage.tsx`): de frente e de cima a tripulação parecia sentada. Ao abrir um astronauta a câmera começa de cima (`SUPINE_FRONT`), também pelo link direto. Deitado, o corpo não gira no assento e os braços quase não balançam; a postura muda de uma vez, por trás do véu. Na Lua, `lunarGait` (em `AstronautRig.tsx`) dá um passo lento com cada perna e um salto em parábola com g = 1,62 m/s² (18 cm, ~0,94 s no ar) num ciclo de 11 s; tudo parado com `prefers-reduced-motion`, raio-X ou região aberta. **Raio-X (decisão do dono, 10/11, revista em 11/11):** não existe com o traje de EVA vestido, em nenhum lugar (`xrayAllowed(suit)` no store: o botão some, `setXray`, `setAllLayers`, `toggleLayer` e `?xray=1` não ligam, e vestir o traje desliga). No foguete ele vale: a anatomia acompanha o corpo deitado e as pernas dobradas. Suposições declaradas: a fisiologia sintética é a mesma nos três lugares (não há taxa publicada a 1/6 g). Terra e solo lunar são procedurais. Testes em `data/scenarios.test.ts` e `scene/legPose.test.ts`.
- **RF-34, perfil pré-voo (12/11/2026, decisões do dono), já implementado:** premissa: cada astronauta tem o exame genômico e epigenético pré-voo completo. O perfil é **100% sintético** e nunca se apresenta como exame oficial da NASA nem como dado de astronauta real (regra 11, R-N17). Três decisões do dono: (1) **só riscos ligados ao voo**: entram só achados com estudo publicado que os ligue a um risco do HRP, de um catálogo fechado (`FINDINGS` e `PROFILE_STUDIES` em `data/profile.ts`, com DOI conferido): alelos do ciclo de um carbono e SANS (Zwart 2016), sorologia de herpesvírus latentes (Mehta 2017), sensibilidade atópica conhecida (Crucian 2016), PER3 5/5 e sono (Viola 2007 liga o genótipo ao desempenho depois de uma noite curta, na Terra; Barger 2014 só dá o contexto de que astronautas dormem pouco, sem ligar ao genótipo, e a nota diz isso) e metilação de genes de estresse oxidativo (Twins Study, Garrett-Bakelman 2019). Doença genética sem ligação com o voo e prontuário continuam fora (§14); (2) **nunca muda o status**: o motor não lê `astro.profile`, e `lib/personalize.test.ts` prova que status, limiar, projeção e ação são idênticos com e sem perfil; (3) **só o próprio astronauta e o pacote**: as notas aparecem no nível 3 (em "About this number"), no nível 2 (marca "pre-flight profile note" no medidor e a lista em "How it works") e no pacote do flight surgeon, só os achados dos sistemas que já estão nele; nunca na Crew, nas placas, no nível 1 nem na entrada da IA (`buildExplainInput`). `lib/personalize.ts` (`contextFor`, `systemFindings`, `profilePacketLines`) só escolhe e ordena. O selo é PERIODIC com a fase "Collected on the ground N days before launch. Not measured in orbit." Os estudos citam DOI, não o OSDR (não confirmei um acesso do OSDR com dado epigenético humano). Não há exame epigenético na fila: nenhum instrumento a bordo o faz.
- **RF-35 e RF-36 (12/11/2026), propostos, NÃO implementados e ainda sem aprovação do dono:** (RF-35) uma **frase de consequência** por métrica fora do nominal, de um catálogo fechado (`data/consequences.ts`, com `CONSEQUENCE_SOURCES`), escrita por pessoas a partir da justificativa dos requisitos da NASA-STD-3001 e do HRP, até 25 palavras, sem dígitos; sempre no nível 3 e, no nível 2, só quando a métrica não está NOMINAL; a IA não a escreve nem a recebe. (RF-36) **registro de sintomas** em lista fechada de 10, com gravidade e início (`SymptomEntry`, separado de `DecisionEntry`; `lib/symptoms.ts`), janela de 7 dias filtrada pelo lugar (`world`) e pelo dia simulado, com o texto "Logged by crew. Not a diagnosis.". Sintoma nunca muda status, limiar, projeção nem ação. **Em aberto, decisão do dono:** se um sintoma grave aciona `CMO-CONSULT` (recomendação: não), e quem valida a lista de sintomas. Detalhes e riscos (R-N18, R-N19) em `docs/ORBITALIS — Status dos Requisitos.md` e `Viabilidade e Riscos.md`.
- Motor de status de verdade: `src/engine/status.ts` + `projection.ts`, regras por métrica em `src/data/rules.ts`. Os status NÃO são marcados à mão: a matriz do dia 142 sai do motor e é testada em `src/engine/status.test.ts`. Para mudar o cenário de um astronauta, altere só valores em `src/data/astronauts.ts` (`overrides`).
- Séries sintéticas determinísticas por (astronauta, métrica, dia) em `src/lib/model.ts` (`resolveMetric` é memoizado). Métricas periódicas só ganham ponto novo quando o astronauta registra uma medição.
- **Suposição declarada:** `SUIT_SHIELD_FACTOR = 2` (`src/lib/model.ts`). Fora do casco só o traje blinda, então a taxa de dose sobe ×2 sobre os 1,8 mSv/dia medidos pelo RAD. O fator não tem fonte publicada; trocar pela dosimetria real. A UI avisa disso. O traje muda taxa, projeção, dias até o limite e o status por regra, nunca o que já foi absorvido.
- **Entregue em 02/11 (antes listado como fora do escopo):** camada de IA e servidor de explicação (RF-18, com texto de reserva `Offline explanation`), camada molecular do OSDR (RF-26), entrada por câmera (`ui/CameraCheck.tsx`, `lib/ppg.ts`) e a degradação sem WebGL (`scene/webgl.ts`, `SafeStage.tsx`). **Hospedagem (12/11, decisão do dono):** as três rotas `/api` (clima espacial, OSDR, explicação) rodam como middleware do Vite no desenvolvimento e como funções da Vercel em `api/` (mesma lógica em `src/server/`); a rota de IA tem limite por IP, por instância (`src/server/rateLimit.ts`), e o teto de gasto fica no painel do provedor da chave. Licença MIT (`LICENSE`), `README.md` e declaração de IA em `docs/`. Limitações que continuam: o corpo-base do atlas é masculino; Lena e Aiko usam uma deformação de proporções (`warp` em `bodyBuild.ts`), não um modelo feminino de verdade (e a UI declara isso). Os testes (`npm test`) cobrem motor de status (com a temperatura corporal, a ordem da lista de sistemas, a métrica que causa cada status e os sistemas fora do nominal das placas da Crew), físico (`physique.test.ts`) proporções e camadas do corpo (`scene/body.test.ts`), e o corte da gola e dos punhos, as normais da cabeça, a oclusão por cavidade e o ajuste do traje ao corpo, com a pose e a forma dos braços (cotovelo, mão, proporções, manga afinada, espelho, tubo sem murchar) (`scene/fit.test.ts`), a postura do braço (`scene/pose.test.ts`) a região e os atributos da cabeça fotográfica, os olhos, o corte do busto e a base do pescoço, o couro cabeludo, a separação do visor e a subida da cabeça no capacete (`scene/head.test.ts`) e a gola em funil (`scene/collar.test.ts`).

---

## 1. O que é o projeto

**ORBITALIS é um mapa corporal interativo, um por astronauta, que mostra em que sistema do corpo a missão está cobrando seu preço, de onde vem cada número, e qual é a única coisa a fazer hoje.**

Desafio: *Create Health Monitoring Software for Astronauts on Space Missions*.
Cenário: cruzeiro Terra → Marte, dia 142 de ~250, sem contato com a Terra.
Usuário: **o próprio astronauta** — não um médico, não um pesquisador.

As três cláusulas do enunciado que o produto precisa cumprir:

| Enunciado | Implementação |
|---|---|
| *gathers* health indicators | Agregação de 7 sistemas + radiação, de instrumentos que já voaram e de medições registradas pelo astronauta |
| enables astronauts to *evaluate* | Cada métrica com baseline pré-voo, limiar e proveniência |
| enables astronauts to *act* | Toda tela termina numa ação de catálogo fechado |

---

## 2. Regras inegociáveis

Estas regras valem para todo código gerado. Violar qualquer uma delas destrói o diferencial do projeto.

1. **O status é calculado por código determinístico.** A IA NUNCA calcula, altera ou sugere status.
2. **A IA nunca inventa números.** Só usa valores presentes na entrada.
3. **A IA nunca sugere medicamento, dose, diagnóstico ou procedimento fora do catálogo.** Escolhe ações apenas por ID. Frases de consequência (RF-35, ainda não implementado) só saem de `data/consequences.ts`; a IA não as escreve nem as recebe.
4. **Todo número exibido tem três companheiros:** unidade, baseline pré-voo e selo de proveniência. Número sozinho é proibido.
5. **Cor significa status e nada mais.** Verde, âmbar e vermelho nunca são decoração.
6. **Status nunca é comunicado só por cor:** sempre forma + palavra — `● NOMINAL`, `▲ WATCH`, `◆ CRITICAL`.
7. **Limite oficial aparece com o ID** (`NASA-STD-3001 [V1 4027] ≥ 95%`). Limite nosso aparece como `Provisional threshold`.
8. **O app abre direto na tela Crew.** Sem landing page, tour, onboarding ou modo apresentação. O título da Crew é a resposta à pergunta ("quem precisa de atenção?"), não uma hero de marketing.
9. **Todo texto de interface em INGLÊS.** Comentários de código e documentação podem ser em português.
10. **Chamadas a LLM e a APIs externas só em rotas de servidor.** Chave de API nunca no cliente.
11. **Tripulação 100% fictícia.** Sem fotos nem pessoas identificáveis. Os rostos são avatares genéricos do Microsoft Rocketbox (MIT), que não retratam ninguém; os autores dizem que o material de referência foi misturado e modificado até não restar uma pessoa reconhecível (atribuição em `public/models/ATTRIBUTION.md`, nos créditos e em Sources).

---

## 3. Arquitetura de informação — o orçamento por tela

Cada nível responde a UMA pergunta. Se algo não cabe no orçamento, não entra. Menos é requisito.

| Nível | Tela | Pergunta | Teto |
|---|---|---|---|
| 0 | `Crew` | Quem precisa de atenção? | Formação 3D, **uma frase** de título e uma placa por astronauta: nome, status e os sistemas fora do nominal (forma e nome). Zero números além do dia e do link |
| 1 | `Body` | O que acontece comigo e o que faço hoje? | Veredito + os **6** indicadores do enunciado (unidade, pré-voo e selo) + **1** ação + até 2 medições pendentes, sem rolagem. Ao lado, a lista dos 8 sistemas (o índice) e o corpo 3D (o mapa), ligados pelo hover |
| 2 | `System` | Como está este sistema e por quê? | Máx. **3** medidores (cada um com minigráfico, motivo do status e limite), **2** ações. Função do sistema e riscos do HRP no cabeçalho. Explicação recolhida. Radiação soma o cartão de exposição (Habitat × traje de EVA) |
| 3 | `Metric` | De onde vem este número? | Valor grande com o limite logo abaixo, 1 gráfico com projeção e rótulos diretos, 1 frase "Why", 1 ação. Fonte e explicação em "About this number" (aberto) |

A fila do dia completa, o pacote para o flight surgeon, o diário, as fontes, a simulação e os créditos ficam no **Menu** (ícone no canto); a tela do astronauta mostra só as até 2 medições pendentes, com o atalho para registrar. A lista de sistemas fica sempre à esquerda nos níveis 1 a 3.

Navegação por hash: `#/crew` · `#/sources` · `#/timeline` · `#/body/{id}` · `#/body/{id}/{queue|diary|packet|emergency}` · `#/body/{id}/{system}` · `#/body/{id}/{system}/{metric}` · `#/body/{id}/{system}/{metric}/log`. `Esc` sobe um nível.

Se o RF-35 entrar, o nível 3 ganha **uma** frase de consequência além do "Why", e o nível 2 só a mostra fora do nominal; a Crew e o nível 1 não a mostram.

Há **um** `<Canvas>` para o app inteiro (`src/scene/Stage.tsx`). Ele não desmonta ao trocar de tela: a formação da Crew vira o corpo focado e os outros três astronautas se dissolvem.

---

## 4. Selos de proveniência

Este é o diferencial central do projeto. Sempre visível, sempre no mesmo lugar.

| Selo | Significado |
|---|---|
| `CONTINUOUS` | Sensor vestível, leitura contínua |
| `PERIODIC` | Exame ou amostra coletada a bordo em intervalos |
| `ESTIMATED` | Calculado por modelo a partir de baseline + taxa publicada |
| `LOGGED` | Registro do astronauta ou de app |
| `LIVE` | Feed público real, ao vivo (única que usa cor: `--live`) |

---

## 5. Sistemas e métricas

Máx. 3 métricas por sistema. `(E)` = indicador nomeado no enunciado.

| Sistema | Métricas | Proveniência | Limiar |
|---|---|---|---|
| `cardiovascular` | FC de repouso (E) · Pressão sistólica (E) · Capacidade aeróbica | CONTINUOUS · CONTINUOUS · PERIODIC | Provisório · Provisório · **[V1 4003] ≥ 80%** |
| `skeletal` | Densidade quadril+coluna · Colo do fêmur | ESTIMATED | **[V1 4027] ≥ 95%** · **≥ 90%** |
| `muscular` | Força musculoesquelética · Exercício (média 7d) | PERIODIC · LOGGED | **[V1 4024] ≥ 80%** · Provisório |
| `neuro_ocular` | Edema de disco (Frisén 0–5) · Acuidade visual | PERIODIC · LOGGED | Provisório |
| `immune` | Leucócitos · Linfócitos · Temperatura corporal (E) | PERIODIC · PERIODIC · CONTINUOUS | Faixa clínica terrestre, rotulada · Provisório |
| `nutrition` | Ingestão energética · Massa corporal · Glicemia (E) | LOGGED · PERIODIC · PERIODIC | **[V1 4020] 100%** · Provisório · Faixa clínica |
| `behavior` | Sono (E) · Desempenho cognitivo · Humor (E) | CONTINUOUS · PERIODIC · LOGGED | Provisório |
| `radiation` | Dose da missão · Dose de carreira · Clima espacial | CONTINUOUS · CONTINUOUS · LIVE | **[V1 4030] < 600 mSv** |

Temperatura corporal (E) é a 3ª métrica do sistema imune (o motor decide o status de uma febre) e aparece nos indicadores do nível 1 e, pela lista de sistemas, em todas as telas do corpo; não há chip na barra superior.

**Instrumentos reais que justificam cada dado** (citar na UI, nunca inventar outros): Bio-Monitor/Astroskin (CSA), Bio-Analyzer (CSA), OCT e fundoscópio (ISS), SLAMMD, ARED/T2/CEVIS, dosímetro ativo pessoal (ESA), bateria Cognition.
**Não existe densitômetro a bordo** — densidade óssea é `ESTIMATED` a partir do DXA pré-voo.

---

## 6. Motor de status (`/engine/status.ts`)

Código puro, determinístico, com testes. Regras em ordem:

1. **Métrica com requisito NASA:** `CRITICAL` se viola o requisito. `WATCH` se respeita mas (a) a projeção linear viola em até 30 dias, ou (b) a folga é menor que a margem. Senão `NOMINAL`.
2. **Métrica sem requisito NASA:** faixas provisórias por métrica, sem projeção.
3. **Status do sistema** = pior status entre suas métricas.
4. **Status do astronauta** = pior entre os 7 sistemas e radiação.
5. **Ação prioritária** = ação principal do sistema de pior status. Desempate: `radiation` → `behavior` → `neuro_ocular` → `nutrition` → `skeletal` → `muscular` → `cardiovascular` → `immune`.
6. **Evento solar simulado ativo** → `radiation` = CRITICAL para todos; ação prioritária vira `RAD-SHELTER`.
7. **Se o astronauta é o CMO e há algum CRITICAL** → `CMO-CONSULT` vira "Consult the backup CMO" com nota na tela.
8. **Sintoma registrado pelo astronauta (RF-36, proposto, ainda não implementado) nunca muda status, limiar, projeção nem ação.** Só aparece no registro e no pacote. Se o dono decidir que um sintoma grave aciona `CMO-CONSULT`, esta regra muda e precisa de teste.

Projeção: regressão linear dos últimos 14 dias (métricas diárias) ou das últimas 3 amostras (periódicas).

Escrever testes cobrindo cada regra e a matriz de status esperada no dia 142.

---

## 7. Catálogo fechado de ações

A IA escolhe **somente por ID**, dentro das ações permitidas do sistema + `CMO-CONSULT` + `EARTH-PACKET`.

A tabela abaixo tem as 15 ações do dia a dia. `data/actions.ts` tem 26: as outras 11 são os passos `EMG-*` da triagem de emergência (`engine/emergency.ts`, RF-28 e RF-29), que seguem protocolos citados e não entram na lista `allowedActions` da IA. O protocolo de emergência não foi validado por um médico.

| ID | Ação (UI) | Sistemas | Recurso | Protocolo citado |
|---|---|---|---|---|
| `EX-RES` | Resistive exercise session | skeletal, muscular | ARED | Parte do programa de ~2 h/dia da ISS |
| `EX-AER` | Aerobic exercise session | cardiovascular, muscular | T2 ou CEVIS | 70–90% da FC máxima |
| `EX-PLAN` | Restore exercise plan adherence | muscular, skeletal | Agenda | Adesão na ISS: T2 47%, CEVIS 37% dos dias |
| `SLP-EXT` | Protect an 8-hour sleep window | behavior | Compartimento | — |
| `SLP-LIGHT` | Dim cabin light before sleep | behavior | Iluminação | — |
| `BEH-LOAD` | Rebalance today's task load | behavior | Planejamento | — |
| `NUT-CAL` | Raise energy intake to 100% of need | nutrition | Despensa | [V1 4020] |
| `NUT-D` | Confirm vitamin D supplementation | nutrition | Suplementos | 800 UI/dia, padrão ISS desde 2006 |
| `NUT-MASS` | Repeat body mass measurement | nutrition | SLAMMD | — |
| `OCU-EXAM` | Repeat eye exam and log symptoms | neuro_ocular | OCT, fundoscópio | — |
| `IMM-SAMPLE` | Collect a blood sample | immune | Bio-Analyzer | Resultado em 2–3 h |
| `RAD-SHELTER` | Move to the storm shelter | radiation | Área blindada | — |
| `RAD-REVIEW` | Review remaining-mission dose budget | radiation | — | [V1 4030] |
| `CMO-CONSULT` | Consult the Crew Medical Officer | todos | CMO ou reserva | — |
| `EARTH-PACKET` | Add to the flight surgeon packet | todos | Diário | — |

Ação principal por sistema: cardiovascular `EX-AER` · skeletal `EX-RES` · muscular `EX-PLAN` · neuro_ocular `OCU-EXAM` · immune `IMM-SAMPLE` · nutrition `NUT-CAL` · behavior `SLP-EXT` · radiation `RAD-REVIEW` (`RAD-SHELTER` durante evento).

---

## 8. Onde a IA entra e onde não entra

| A IA faz | A IA não faz |
|---|---|
| Resumo de 1 linha por sistema (≤ 22 palavras) | Não calcula nem altera status |
| Explicação do mecanismo (≤ 45 palavras) | Não cria números |
| Escolhe 1–2 ações por ID e justifica (≤ 18 palavras) | Não sugere medicamento, dose ou diagnóstico |
| Gera o pacote para o flight surgeon | Não conversa livremente; não há chat |

Implementação: chamada à API da Anthropic (`ANTHROPIC_API_KEY`, só no servidor) com **ferramenta forçada** (`tool_choice`) cujo `input_schema` é o esquema da resposta (`lib/explain.ts`), temperatura 0.2, timeout de 8 s.
Em falha ou timeout: usar **texto de reserva** do catálogo e mostrar discretamente `Offline explanation`.
Cache por `(astronautId, systemId, missionDay, linkState)`.
Validar a resposta: descartar ação fora de `allowedActions` e qualquer número ausente da entrada.

**Não treinar modelo próprio.** Não há dado rotulado de astronauta em acesso aberto; treinar na própria simulação é circular e indefensável.

---

## 9. Entrada de dados pelo astronauta

O enunciado autoriza coleta por teclado, cliques ou câmera. **O astronauta é a fonte de dados.**

Fluxo de medição:
1. Fila do dia mostra o pendente: `Blood sample due — last taken Day 128`.
2. Item aberto mostra: como executar, qual instrumento, duração, **por que o exame é necessário**.
3. Astronauta digita o valor, com unidade explícita no campo.
4. Sistema valida faixa plausível, grava com carimbo de tempo, recalcula status.
5. Tela devolve status, delta vs baseline, limiar aplicado e ação resultante.

Registro de sintomas (RF-36, proposto): o astronauta escolhe um sintoma da lista fechada, a gravidade e o início; vira um `SymptomEntry` com carimbo de tempo e `missionDay`, separado do diário de decisões, guardado em memória + `localStorage` em `try/catch`, e marcado `autonomous` em blackout. Nunca muda o status.

Diário de decisões: `{timestamp ISO, missionDay, astronautId, systemId, actionId, decision: "done"|"snoozed", linkState, statusSnapshot}`. Em blackout, marcar `autonomous`. Guardar em memória + `localStorage`, sempre em `try/catch`.

---

## 10. O corpo 3D e o cenário

**Corpo.** A camada de pele do Z-Anatomy (`public/models/skin.glb`) é a base: regiões nomeadas, mãos e pulsos (a cabeça e o pescoço visíveis vêm de `headModel.ts`; a cabeça do atlas só aparece enquanto o GLB não carrega ou se ele falhar, e é a forma do clique). `src/scene/bodyBuild.ts` a transforma em personagem:
- cor de pele única por astronauta (os materiais zebrados do atlas são ignorados), tom nos lábios e orelhas, cabelo, sobrancelhas e cílios na cor do cabelo, olhos procedurais com íris colorida e córnea com brilho;
- um **id de sistema por vértice** (`aSys`), derivado do nome da região por regras em `RULES` (cabeça e rosto → behavior; órbitas → neuro_ocular; pescoço e virilha → immune; tórax → cardiovascular; abdômen alto → nutrition; baixo-ventre e costas → skeletal; braços e pernas → muscular). Regiões `soft` (rosto) contam para o sistema, mas não se dissolvem;
- o macacão é uma **casca inflada das próprias regiões** ao longo de normais soldadas por posição (sem fendas entre regiões); inclui a base do pescoço e os punhos, cortados por um plano (`coverCut`; no pescoço o plano sobe pelo ombro, `collarPlane`, e a gola é uma peça à parte, `collar.ts`). A casca `variant.suit` só serve de fantasma do raio-X: o traje visível é o Z-2 ajustado;
- a região urogenital é relaxada (média dos vizinhos) e os genitais do atlas são excluídos das camadas internas: o personagem é sempre vestido;
- variantes `male` e `female` (`warp`) compartilham geometria entre astronautas do mesmo corpo-base. O atlas tem corpo de halterofilista, então `shapeBody` afina cada membro e o tronco (`LEAN`) e suaviza por Taubin tudo o que fica sob a roupa; tudo por grupo de vértices soldados, para as regiões nunca se separarem. No corpo feminino o `warp` estreita ombros, pescoço e cabeça, marca a cintura, alarga o quadril e modela busto e glúteos; o cabelo do atlas é alisado e ganha um **rabo de cavalo** (fios afunilados com `aT`/`aPh`, oscilação no shader, parado com `prefers-reduced-motion`), a sobrancelha é mais fina e os lábios mais coloridos;
- **físico dinâmico:** cada vértice de braço, perna e tronco carrega a direção radial (`aDir`) e dois pesos (`aW`: atrofia e massa). O vertex shader soma `aDir * (aW.x * uAtro + aW.y * uMassD)`, então os membros afinam quando força e exercício caem, e o corpo acompanha a massa registrada (±12%). `physique(astro, sim)` em `lib/model.ts` calcula atrofia, massa e fadiga das métricas (`strength`, `exercise`, `mass`, `sleep`, `cognition`); a fadiga aparece como olheiras e palidez no rosto. É só desenho: nunca altera status. Arraste o dia em Menu → Simulation para ver o corpo mudar.

**Cabeça (`headModel.ts`, `ShellMode` `head` e `headhair`).** Cada GLB traz `skin` (cabeça, pescoço, boca, pálpebras), `eyes` e, quando existe, `hair` (cartões com alfa), já no espaço do corpo do atlas (olhos nos olhos do atlas, pescoço no pescoço, com o `warp` feminino) e com o V da textura na convenção do glTF. O carregador acrescenta os atributos do shader do corpo (`aSys` por região, `aBase`, `aDir`, `aW`, `aAO`, `aCut`) e a cor média da bochecha, que vira a cor das mãos. Os dois modos novos herdam do shader do corpo a dissolução, o raio-X, o fade e o contorno de status (menos nos cartões de cabelo, onde o Fresnel dava faixas), mas **não somem com a varredura do traje**: o rosto fica visível dentro do capacete. A pele usa a luz com espalhamento (`SKIN_LIGHTS`) e as olheiras e a palidez da fadiga; poros, lábios e barba procedurais não valem aqui (a textura já traz). As malhas novas têm `raycast` desligado: o clique e o hover vão para o `pick`. Cada astronauta é um avatar diferente (tabela em `tools/heads/README.md`). **Tratamento em tempo de carga (`loadHead`):** as pálpebras descem (`closeLids`), o busto sai (`trimBust`) e a base do pescoço afina (`taperNeckBase`); os olhos do GLB viram esferas finas (`buildEyes`) com a íris de `look.eyes`; o couro cabeludo recebe a máscara `aScalp` e vira as camadas de fios (`hairShells.ts`, o estilo vem de `HAIR_STYLE`); o anel do pescoço (`measureNeck`, só com os triângulos que sobraram) dá a medida da gola. A cor da pele vem da textura; o cabelo pintado fica fosco pela máscara.

**Giro de 360°.** Quem gira é a câmera (`TrackballControls` em `Stage.tsx`), livre em qualquer direção, sem travas de azimute nem de polo; o astronauta fica parado. Arrastar gira (com inércia), a roda dá zoom. Ao voltar para a formação da Crew a câmera desfaz a inclinação (`camera.up`).

**Interação (RF-14).** O corpo é o mapa e a lista de sistemas à esquerda (`SystemsRail`) é o índice: passar o cursor numa linha realça a região no corpo (`railSys`) e passar o cursor no corpo marca a linha (`hoverSys`). No corpo, clique e hover são por região, sem botões flutuantes: raycast com BVH na geometria `pick` (invisível), `faceIndex` → `aSys`. Olhos têm raio de clique generoso, o dosímetro do braço abre a radiação (não há aura em volta do corpo: o estado da radiação fica na lista, como o dos outros sistemas). O hover no corpo mostra o nome do sistema e o status junto ao cursor. Teclado: a lista de sistemas é visível e vem antes do painel no Tab; a lista da tripulação aparece só ao receber foco.

**Shader do corpo** (`bodyShader.ts`, injetado em `MeshStandardMaterial` e `MeshPhysicalMaterial`): hover e contorno de status por sistema (nada de listras sobre o corpo), **dissolução** da região selecionada revelando a anatomia interna, raio-X geral, varredura de altura que veste e despe o traje, e fade geral do astronauta. O macacão e o traje têm **trama de tecido** (normal e rugosidade triplanares a partir da posição de repouso, texturas CC0) e a pele tem espalhamento sob a superfície (o difuso dá a volta no terminador, com tom avermelhado, trocando só a linha do difuso direto do chunk de luz do three: se uma versão nova do three mudar o chunk, o shader avisa no console), poros em células irregulares (só de perto, a distância os apaga), variação de tom, rubor, lábios, sombra de barba nos astronautas masculinos e cavidades do rosto (prega dos olhos, narinas, boca). Cada vértice carrega uma oclusão ambiente das concavidades da malha (`aAO`, calculada por `meshAO.ts` sem raios): escurece axilas, gola, virilha, órbitas e dobras. O macacão tem zíper, bolsos do peito e da coxa, costuras, cinto com fivela, reforço nos joelhos, vincos nas juntas, gola e punhos com costura e borda enrolada, tudo desenhado no shader (`coverDetails`, na posição de repouso), inclusive a plaqueta de nome e o emblema da missão (`CoverDecals`: texturas no próprio tecido). As cores das regiões do rosto são suavizadas entre vizinhas (`smoothTint`), para não aparecerem blocos de maquiagem. As camadas internas (`AnatomyLayers.tsx`: esqueleto, órgãos, vasos, nervos, músculos) carregam sob demanda, são fundidas por sistema e brilham na cor do status do sistema selecionado. O coração pulsa na FC (bpm/60 Hz).

**Raio-X e camadas.** O raio-X (botão no dock) liga **os cinco sistemas do atlas de uma vez**: Muscles, Skeleton, Organs, Circulation, Nerves (`ATLAS_LAYERS` e `layers` no store). A fileira **Anatomy layers** (`LayersRail` em `ui/Hud.tsx`), acima do dock e só com o raio-X ligado, tem "All" e um botão por camada: clicar liga ou desliga, e passar o cursor numa camada a mostra inteira enquanto as outras esmaecem (`hoverLayer`). Com qualquer camada ligada o corpo sólido se dissolve e uma **casca fantasma** (`makeGhostMaterial`, só contorno por Fresnel e uma varredura fraca, na mesma geometria e com o mesmo físico) mostra a silhueta, com o macacão ou o traje. As peças duras do traje (capacete, mochila, anéis, plaquetas) ficam translúcidas em vez de flutuarem soltas (isso vale para o traje que ainda se dissolve: desde 10/11 o raio-X não liga com o traje vestido, `xrayAllowed`). Cada sistema tem um **tom próprio, claro e dessaturado** (`LAYERS` em `anatomy.ts`: lilás, marfim, rosa, azul-gelo, palha), longe do verde, âmbar e vermelho de status, e é desenhado quase só com luz própria mais um brilho de borda, para a cor não se perder na luz da sala. O status do sistema aparece no **contorno** (cor de status); o corpo todo do sistema só muda para a cor de status quando ele está aberto (clique na região). Com vários sistemas, os músculos ficam nítidos por cima (opacidade 0,68, cor de tijolo apagada, com volume e brilho de borda) e deixam o esqueleto e os órgãos aparecerem através deles. Com o raio-X ligado a sala escurece (luzes, ambiente, Marte e céu: `scan` no `Stage`) e a câmera chega mais perto. Os sistemas carregam um a um em segundo plano (`WARM_LAYERS`), em pedaços para não travar a tela.

**Traje de EVA.** Botão "EVA suit" no dock (ou no cartão de exposição da Radiação). O traje é o **Z-2 da NASA** (`public/models/suit.glb`, 1 MB, geometria Draco e texturas WebP de 2048 px; carregado por `suitModel.ts`, decodificador em `public/draco`). O arquivo é o original sem a bandeira e sem os emblemas da NASA e **sem a sujeira assada no tecido** (a textura de cor foi limpa por painel de UV, preservando costuras, listras, remendo e luvas), com créditos em `public/models/ATTRIBUTION.md`, nos créditos e em Sources. O Z-2 é uma peça única com os braços esticados à frente, então `fitSuit(modelo, corpo)` o **adapta a cada astronauta** (e guarda o resultado por corpo): o modelo é feito de 43 peças soldadas; o tubo do braço alonga (`UPPER_STRETCH`, 1,3) e a manga também, só entre a sanfona e o punho (`FORE_STRETCH`, 1,6), para o cotovelo ficar na cintura e a luva no meio da coxa; a manga **afina como um antebraço** (`foreTaper`: no modelo ela é uma sanfona inteira, mais grossa que o braço e com a borda saltada no anel, e lia como um gesso; agora começa por dentro da bainha do braço e afina até o punho); e os braços ficam **para a frente e para baixo, uns 45° da vertical** (`ARM_UP`, `ARM_FORE`, ajustados à mão pelo dono e **aprovados: não alterar**), com a dobra no meio da sanfona (`ELBOW_AT`). Cada ponto do braço gira rigidamente por uma rotação que passa do tronco ao braço no ombro (`SHOULDER_BLEND`, 12 cm) e do braço ao antebraço no cotovelo (`ELBOW_BLEND`, ±8 cm), interpolada de forma esférica e alinhada pelos eixos medidos dos dois tubos (`Z2.upper` e `Z2.fore`, não pela ponta da luva); misturar duas posições murchava o tubo na dobra. A anatomia por baixo e o fantasma do raio-X seguem a postura de repouso do corpo (braços caídos), então só a casca visível do traje tem os braços à frente; no corpo feminino tronco, capacete e pernas ficam mais estreitos (`FIT`); o tronco recua 13,5 cm (`BODY_Z`) para o corpo ficar dentro dele; o resto da escala vem do grupo do astronauta (altura estimada e massa). O ajuste roda quando o navegador está livre, não ao apertar o botão. O material usa o mapa de especular do arquivo (branco = metal, amarelo = viseira dourada espelhada), tem o aspecto de tecido de traje (albedo 0,86, relevo suave de 0,55, brilho de fibra pequeno) e troca o vermelho do modelo pela cor de acento do astronauta. Ele ganha o mesmo shader do corpo (varredura que veste, dissolução por região com borda irregular, raio-X, destaque, contorno de status e oclusão de cavidade); a região por baixo de cada ponto vem de `suitSystemAt` (e do espelho em GLSL, calculado por fragmento para a borda ficar nítida; os braços do traje são sempre musculares, pelo atributo `aArm`), então clicar no visor abre neuro-ocular, no peito cardiovascular, e assim por diante, e a região coincide com a anatomia por baixo. O corpo, o cabelo antigo e as mãos somem por baixo da linha da varredura, mas a **cabeça fotográfica fica**: o capacete tem um **visor de vidro dourado semitransparente** (malha `visor` do traje ajustado, separada pelo mapa de especular e pela cor escura da janela; material em `makeVisorMaterial`) e o rosto do astronauta aparece atrás dele, com o cabelo, porque a cabeça sobe 12 cm e o traje já a espera (`HEAD_IN_HELMET`; sem avançar, pois o queixo furava a frente do capacete). A cabeça só sobe depois que a varredura passa pelo pescoço, para não esticar o pescoço acima da gola. Plaqueta e emblema da missão ficam no peito e somem junto com a região quando o peito se abre. Sem o modelo carregado, o traje não é vestido. A varredura veste o traje, a câmara de ar escurece a imagem e a cena troca para o lado de fora do casco (Sol, Marte, nave com cabo de segurança, partículas). Sem traje: baia médica, janela para Marte e Terra. A taxa de dose sobe (`doseRate` em `model.ts`), a projeção de dose de carreira muda por regra e o motor reavalia o status.

**Cenário.** `Environment.tsx`: baia chanfrada com racks em painéis instanciados alinhados às costelas, cada um com um decalque do atlas `rackAtlas()` (travas de quarto de volta, grades, plaquetas com texto, conectores, interruptores e velcro, só em cinza, azul e branco), bolsas de estiva e cabos nas paredes de baixo, dutos, luminárias, corrimãos, escotilha, telas, piso de convés procedural e janela com mosaico de painéis; fora do casco, módulo cilíndrico com mantas térmicas, corrimãos, escotilha, painéis solares e antena. **Imagens reais** (`public/assets`, créditos em `public/assets/ATTRIBUTION.md`, no modal de créditos e em Sources): mapa de Marte e céu da Via Láctea (Solar System Scope, CC BY 4.0, dados NASA/ESA), HDRI de estúdio só como luz de ambiente e texturas PBR (Poly Haven, CC0). `assets.ts` carrega tudo; se o HDRI faltar, a cena cai na sala procedural. Marte tem sombreamento próprio com terminador e escurecimento do limbo, **sem halo** (a atmosfera de Marte é fina demais para aparecer assim), cresce e a Terra encolhe com o dia da missão. Procedurais em `textures.ts`: estrelas nítidas, painéis, convés, casco, olhos, plaquetas, telas (sem números). Pós-processamento: profundidade de campo (foco no ponto que a câmera orbita), bloom, vinheta, ACES, grão leve e SMAA.

Obrigatório:
- **Atribuição** no rodapé do canvas (`footer.canvas-attr` em `App.tsx`, sempre visível) e no modal de créditos: `Model data: Z-Anatomy — the libre 3D atlas of anatomy (CC-BY-SA 4.0), derived from BodyParts3D © The Database Center for Life Science.`
- **Altura cresce** com o alongamento da coluna (até 3%, `estimatedHeight`); a largura vem da massa registrada.
- Respeitar `prefers-reduced-motion` (sem flutuação, giro, pulso nem varredura lenta).
- Descartado: corpo baseado em fotos de pessoas reais. (As cabeças do Rocketbox partem de fotos de referência muito misturadas; veja a regra 11.)

Desempenho: `dpr [1, 1.5]`, **sem mapas de sombra** (o material de profundidade não conhece os descartes do shader do corpo, e desligar a sombra cortou cerca de um terço do tempo de quadro numa GPU integrada), SMAA em vez de MSAA, casca do traje e do macacão só desenhadas quando visíveis, fantasma só durante o raio-X, geometrias fundidas, picking com BVH, camadas internas só quando precisam. Não reativar `StrictMode` sem testar a cena.

---

## 11. Design

Vidro sobre cena cinematográfica: painéis com `backdrop-filter`, raio 20–28 px, tipografia grande, uma ação por tela. Cor só para status: verde, âmbar e vermelho nunca são decoração (a cena usa tons naturais, azul-marinho de uniforme e o laranja de Marte). **Os dados vêm primeiro:** painel de detalhe de 440 px e lista de sistemas de 232 px com vidro mais opaco (`--glass-data`, para o texto não depender do que passa atrás); indicadores em tabela de colunas alinhadas; medidores com minigráfico, motivo e limite; gráficos com rótulos diretos nas linhas de referência; entrada do painel em 0,2 s (a câmera é que se move devagar).

```css
--ink: #f2f5ff;  --ink-2: #b4bfdc;  --ink-3: #7f8bb0;
--nominal: #3ddc97; --watch: #ffb547; --critical: #ff5d5d; --live: #5cc8ff;
```

Tipografia: `Space Grotesk` para interface e títulos; `JetBrains Mono` com números tabulares para todo valor numérico (valor de métrica 36 px, no nível 3 64 px).
Texto: inglês, sentence case, sem exclamações, sem emojis, máx. 1 casa decimal, dias como `Day 142`. Status sempre com forma + palavra (`● NOMINAL`, `▲ WATCH`, `◆ CRITICAL`).
Todo número tem unidade, baseline pré-voo e selo (nos medidores e no cabeçalho do nível 3).
Referência 1440×800. Abaixo de 1024 px o painel vira bottom sheet e o dock sobe.
Acessibilidade: contraste AA, `aria-label` nos medidores e nas listas de teclado, `aria-live="polite"` para o veredito.

---

## 12. Estrutura

```
/src
  /data/consequences.ts, /lib/symptoms.ts   (planejados, RF-35 e RF-36: ainda não existem)
  /state/store.ts           zustand: dia, solar, link, traje, raio-X e camadas do atlas, hover, menu; diário, medições, flags (localStorage)
  /data                     astronauts (aparência + overrides), systems (com BODY_ORDER e HAZARD_LABEL), rules, extras (função e riscos do HRP por sistema), actions
  /engine                   status.ts, projection.ts, status.test.ts
  /lib                      model.ts (resolveMetric, exposição, físico, fila, pacote), physique.test.ts, route.ts, format.ts, spaceWeather.ts
  /scene
    Stage.tsx               Canvas único, câmera, mundo, ciclo da câmara de ar
    Places.tsx, legPose.ts  cabine do foguete, estação e base lunar (RF-33); postura deitada e perna rígida no shader
    suitModel.ts            traje de EVA (Z-2, NASA): carregamento, ajuste por corpo (pose dos braços, tamanho) e região por ponto
    headModel.ts            cabeças fotográficas (Rocketbox): carregamento, tratamento (olhos, pálpebras, busto, pescoço), couro cabeludo e estilos de cabelo, região por ponto
    hairShells.ts           cabelo em camadas de fios sobre o couro cabeludo (material e malha instanciada)
    collar.ts               gola do macacão: plano de corte, laço do corte, anel do pescoço e o funil
    collar.test.ts          laço do corte, funil, sentido dos triângulos e anel do pescoço
    meshAO.ts               oclusão ambiente por vértice, a partir das concavidades da malha
    pose.ts                 postura de repouso do braço (rotações em torno do ombro e do cotovelo, pronação, dedos curvos), igual na pele, no macacão e na anatomia
    AstronautRig.tsx        um astronauta: cascas, cabelo, rabo de cavalo, olhos, traje, fantasma do raio-X, clique por região
    bodyBuild.ts            pele do atlas → regiões, sistemas, cascas, forma (magreza, Taubin, feminino), físico, cabelo
    bodyShader.ts           shader do corpo (hover, status, dissolução, varredura, fade, físico, tecido, poros), fantasma, rabo de cavalo
    AnatomyLayers.tsx, anatomy.ts, useAnatomy.ts   camadas do atlas sob demanda (fileira Anatomy layers, no raio-X)
    Environment.tsx, textures.ts, assets.ts, Particles.tsx    cenário, texturas procedurais, imagens reais e HDRI, radiação
    body.test.ts            proporções e classificação das camadas
    fit.test.ts             corte da gola e dos punhos, normais da cabeça, oclusão por cavidade e ajuste do traje ao corpo
    head.test.ts            região e atributos da cabeça, separação do visor e subida da cabeça no capacete
    pose.test.ts            postura do braço: articulações, pronação, dedos, espelho e o que não deve mexer
  /ui                       Emergency.tsx (RF-28/29), Timeline.tsx, CameraCheck.tsx (RF-24), ScenarioCard.tsx (RF-33), arrowNav.ts (setas nas listas), Hud (HUD, Crew, lista de sistemas, dock, camadas, menu, créditos), Panel (níveis 1–3: indicadores, medidores), panels (fila, log, diário, pacote), primitives (Sparkline, Crumbs, ActionCard, gráfico), SourcesScreen
/public/models              6 GLB do Shandon's Body Atlas, suit.glb (Z-2) e heads/ (4 cabeças do Rocketbox) + ATTRIBUTION.md
tools/heads                 conversor das cabeças (FBX do Rocketbox → GLB) e README com os comandos
/public/assets              Marte, Via Láctea, HDRI e texturas PBR + ATTRIBUTION.md
/public/draco               decodificador Draco do three.js (geometria do traje)
vite.config.ts              middleware do Vite para /api/space-weather (DONKI), /api/osdr e /api/explain (só no servidor)
/api                        funções da Vercel com as mesmas três rotas (produção); a lógica fica em src/server
/src/server                 spaceWeather.ts, osdr.ts, explain.ts (chamada à IA, validação) e rateLimit.ts (limite por IP)
LICENSE · README.md         licença MIT do código e guia de execução, hospedagem e créditos
```

---

## 13. Fontes de dados oficiais

| Fonte | Uso | Acesso |
|---|---|---|
| NASA-STD-3001 Vol. 1 Rev. C | Limiares [V1 4003], [V1 4020], [V1 4024], [V1 4027], [V1 4030] | PDF público |
| DONKI / CCMC | Clima espacial ao vivo | `ccmc.gsfc.nasa.gov/DONKI-API/get/FLR` e `/SEP` — sem chave, **só pelo servidor** (CORS não documentado) |
| OSDR / GeneLab | Camada explicativa molecular | `osdr.nasa.gov/osdr/data/search` — público |
| Human Research Program | Protocolos de contramedida e evidência | Público |
| Z-Anatomy / Shandon's Body Atlas | Modelo anatômico | CDN, CC BY-SA 4.0 |
| Microsoft Rocketbox | Cabeças e cabelo da tripulação | github.com/microsoft/Microsoft-Rocketbox, MIT |
| NASA 3D Resources | Traje de EVA (Z-2) | github.com/nasa/NASA-3D-Resources, domínio público |

Calibrações com fonte (nunca alterar sem nova fonte):
- Dose: **1,8 mSv/dia** (instrumento RAD, cruzeiro do Mars Science Laboratory).
- Perda óssea: **−0,8%/mês** nos membros inferiores (Stavnichuk et al., 2020, npj Microgravity).
- Altura: até **3%** de aumento por alongamento da coluna (NTRS 20090007782).
- Exercício: **~2 h/dia**, sessão de 2,5 h agendada; CEVIS 37% e T2 47% dos dias em órbita (relatório de evidência do HRP).

Não usar: Life Sciences Data Archive e Standard Measures (exigem IRB e acordo de uso).
Todo o resto dos sinais fisiológicos é **sintético e declarado** no rodapé do app.

---

## 14. O que o produto NÃO faz

Cada item aqui custaria pontos se entrasse:

- Diagnóstico clínico (a interface usa "assessment"; o diagnóstico fica com o flight surgeon)
- Prescrição de medicamento ou dose
- Recomendação de alimento específico (o sistema alimentar de bordo é fechado)
- IA decidindo status
- Modelo de IA treinado por nós
- Chat livre
- Sintoma tratado como diagnóstico ou causa (o registro do RF-36 diz "Logged by crew. Not a diagnosis.")
- Prontuário: diagnósticos, medicamentos, exames e histórico médico de uma pessoa real. Continuam permitidos, porque são dado do próprio astronauta e do app: o histórico das medições dele (gráficos, fila, diário de decisões) e o perfil pré-voo **sintético** do RF-34 (catálogo fechado, nunca muda o status)
- Astronautas reais ou pessoas identificáveis (os quatro tripulantes têm nomes comuns e são declarados fictícios; regra 11)
- Telemetria para a Terra
- Landing page, modo pitch, tour
- Mais de 3 métricas por sistema

---

## 15. Critérios de aceite

- [ ] Abre direto em `Crew`; nenhuma landing page
- [ ] 4 astronautas com a matriz de status esperada no dia 142
- [ ] O personagem carrega com cor, cabelo, olhos e macacão; clicar em cada região abre o sistema certo
- [ ] Atribuição Z-Anatomy visível no canvas e no modal
- [ ] O nível 1 mostra veredito, os 6 indicadores do enunciado (unidade, pré-voo e selo), 1 ação e até 2 medições pendentes, sem rolagem a 1440×800
- [ ] Os 8 sistemas e seus status aparecem numa lista ao lado do corpo, sem passar o cursor; o hover na lista realça a região no corpo, e o contrário
- [ ] Todo medidor do nível 2 mostra o limite (com o ID NASA quando oficial), o motivo do status e a tendência
- [ ] Nenhum painel de sistema mostra mais de 3 métricas ou 2 ações
- [ ] Todo número tem unidade, baseline e selo de proveniência
- [ ] Limites oficiais mostram o ID NASA; os demais mostram "Provisional threshold"
- [ ] Com o LLM fora do ar, o app continua completo com textos de reserva
- [ ] A chave de API não aparece em nenhum arquivo do cliente
- [ ] O DONKI mostra `LIVE` com dado real ou `SAMPLE` com a amostra, nunca erro na tela
- [ ] Teclado: Tab, setas, Enter e Esc navegam por todos os níveis
- [ ] (RF-35, se aprovado) Cada frase de consequência tem fonte, até 25 palavras e nenhum dígito; teste de invariância do motor
- [ ] (RF-36, se aprovado) Sintomas registrados não mudam status, limiar, projeção nem ação (teste); texto "Not a diagnosis"
- [ ] Teste humano: alguém de fora aponta quem precisa de atenção em ≤ 10 s

---

## 16. Restrições da competição

- Submissão abre sábado 9h e fecha domingo 23h59, hora local. **Sem edição depois.**
- Demo: vídeo de até 30 s **ou** até 7 slides, link público sem login.
- Todo o conteúdo da submissão em inglês.
- **Uso de IA deve ser declarado** na submissão: onde e como.
- Licença documentada; todas as fontes citadas, inclusive abertas.
- Pendência aberta: confirmar com o Local Lead se código escrito antes de 14/11 pode ser submetido. Até lá, tratar qualquer protótipo anterior como maquete de interface, e declarar a origem do código.

Alvo de prêmio: **Best Use of Technology** (primário) e **Best Mission Concept** (secundário).
O vídeo de 30 s precisa deixar explícito, sem narração: que o status vem de regra, que cada número diz se é medido ou estimado, e que existe uma ação.

---

## 17. Prioridades quando o tempo apertar

Ordem de corte: camada molecular do OSDR → entrada por câmera → feed DONKI → pacote de handover.

**Nunca cortar:** motor de status determinístico, selos de proveniência, IDs de requisito, ação por tela, modo autônomo.

Regra geral: **acabamento impecável no núcleo vence escopo amplo pela metade.** 25 dos 30 vencedores globais de 2023–2025 entregaram uma interface simples sobre dado real.