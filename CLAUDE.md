# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ORBITALIS

Contexto para agentes de IA que trabalham neste repositório.
Equipe AstroCoders · NASA Space Apps Challenge 2026 · 14–15/11/2026.

---

## 0. Estado atual do repositório

- Stack: Vite + React 19 + TypeScript + `@react-three/fiber`/`drei` + `@react-three/postprocessing` + zustand + vitest. Sem git ainda.
- Comandos: `npm run dev` (http://localhost:5173; `/api/space-weather` é um middleware do Vite que busca o DONKI) · `npm run build` (typecheck + build) · `npm run typecheck` · `npm test` (um teste: `npx vitest run -t "nome"`).
- Parâmetros de URL para demonstrar e depurar: `?suit=1&xray=1&solar=1&day=200&link=blackout` (lidos em `urlFlags()` de `src/state/store.ts`).
- Funcional: RF-01 a RF-15. Telas: Crew (formação 3D da tripulação), Body, System, Metric, mais Log de medição, Today's queue, Decision diary, Flight surgeon packet e Sources (as quatro últimas e a simulação ficam no Menu).
- **Decisão de design de 28/10/2026, do dono do produto:** o design anterior (painéis densos, holograma cinza, hotspots flutuantes) foi descartado. Agora é uma cena 3D cinematográfica com personagem realista (pele colorida, cabelo, olhos, macacão), clique direto nas regiões do corpo, traje de EVA vestível que muda a radiação, e UI mínima em vidro. Isso **substitui** o "holograma clínico", os tokens antigos e o descarte de "cor de olhos e cabelo" da spec. Menos informação por tela é requisito, não preferência.
- Motor de status de verdade: `src/engine/status.ts` + `projection.ts`, regras por métrica em `src/data/rules.ts`. Os status NÃO são marcados à mão: a matriz do dia 142 sai do motor e é testada em `src/engine/status.test.ts`. Para mudar o cenário de um astronauta, altere só valores em `src/data/astronauts.ts` (`overrides`).
- Séries sintéticas determinísticas por (astronauta, métrica, dia) em `src/lib/model.ts` (`resolveMetric` é memoizado). Métricas periódicas só ganham ponto novo quando o astronauta registra uma medição.
- **Suposição declarada:** `SUIT_SHIELD_FACTOR = 2` (`src/lib/model.ts`). Fora do casco só o traje blinda, então a taxa de dose sobe ×2 sobre os 1,8 mSv/dia medidos pelo RAD. O fator não tem fonte publicada; trocar pela dosimetria real. A UI avisa disso. O traje muda taxa, projeção, dias até o limite e o status por regra, nunca o que já foi absorvido.
- Fora do escopo ainda: camada de IA e servidor de explicação (textos de reserva, marcados `Offline explanation`), entrada por câmera, OSDR, fallback sem WebGL. O corpo-base do atlas é masculino; Lena e Aiko usam uma deformação de proporções (`warp` em `bodyBuild.ts`), não um modelo feminino de verdade.

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
3. **A IA nunca sugere medicamento, dose, diagnóstico ou procedimento fora do catálogo.** Escolhe ações apenas por ID.
4. **Todo número exibido tem três companheiros:** unidade, baseline pré-voo e selo de proveniência. Número sozinho é proibido.
5. **Cor significa status e nada mais.** Verde, âmbar e vermelho nunca são decoração.
6. **Status nunca é comunicado só por cor:** sempre forma + palavra — `● NOMINAL`, `▲ WATCH`, `◆ CRITICAL`.
7. **Limite oficial aparece com o ID** (`NASA-STD-3001 [V1 4027] ≥ 95%`). Limite nosso aparece como `Provisional threshold`.
8. **O app abre direto na tela Crew.** Sem landing page, tour, onboarding ou modo apresentação. O título da Crew é a resposta à pergunta ("quem precisa de atenção?"), não uma hero de marketing.
9. **Todo texto de interface em INGLÊS.** Comentários de código e documentação podem ser em português.
10. **Chamadas a LLM e a APIs externas só em rotas de servidor.** Chave de API nunca no cliente.
11. **Tripulação 100% fictícia.** Sem fotos nem pessoas reais. Os rostos são do modelo genérico do atlas, coloridos para a tripulação fictícia.

---

## 3. Arquitetura de informação — o orçamento por tela

Cada nível responde a UMA pergunta. Se algo não cabe no orçamento, não entra. Menos é requisito.

| Nível | Tela | Pergunta | Teto |
|---|---|---|---|
| 0 | `Crew` | Quem precisa de atenção? | Formação 3D, **uma frase** de título e uma placa (nome + status) por astronauta. Zero números além do dia e do link |
| 1 | `Body` | O que acontece comigo e o que faço hoje? | Veredito + **1** ação + no máximo 1 aviso de medição. O corpo 3D é o mapa: clique direto nas regiões |
| 2 | `System` | Como está este sistema e por quê? | Máx. **3** medidores, **2** ações. Explicação recolhida. Radiação soma o cartão de exposição (Habitat × traje de EVA) |
| 3 | `Metric` | De onde vem este número? | Valor grande, 1 gráfico com projeção, 1 frase "Why", 1 ação. Fonte e explicação em "About this number" (recolhido) |

Fila do dia, pacote para o flight surgeon, diário, fontes, simulação e créditos ficam no **Menu** (ícone no canto), nunca na tela principal.

Navegação por hash: `#/crew` · `#/sources` · `#/body/{id}` · `#/body/{id}/{queue|diary|packet}` · `#/body/{id}/{system}` · `#/body/{id}/{system}/{metric}` · `#/body/{id}/{system}/{metric}/log`. `Esc` sobe um nível.

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
| `immune` | Leucócitos · Linfócitos | PERIODIC | Faixa clínica terrestre, rotulada |
| `nutrition` | Ingestão energética · Massa corporal · Glicemia (E) | LOGGED · PERIODIC · PERIODIC | **[V1 4020] 100%** · Provisório · Faixa clínica |
| `behavior` | Sono (E) · Desempenho cognitivo · Humor (E) | CONTINUOUS · PERIODIC · LOGGED | Provisório |
| `radiation` | Dose da missão · Dose de carreira · Clima espacial | CONTINUOUS · CONTINUOUS · LIVE | **[V1 4030] < 600 mSv** |

Temperatura corporal (E) é transversal: vai na barra superior como sinal agudo, não dentro de um sistema.

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

Projeção: regressão linear dos últimos 14 dias (métricas diárias) ou das últimas 3 amostras (periódicas).

Escrever testes cobrindo cada regra e a matriz de status esperada no dia 142.

---

## 7. Catálogo fechado de ações

A IA escolhe **somente por ID**, dentro das ações permitidas do sistema + `CMO-CONSULT` + `EARTH-PACKET`.

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

Implementação: saída JSON com `responseSchema`, temperatura 0.2, timeout de 8 s.
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

Diário de decisões: `{timestamp ISO, missionDay, astronautId, systemId, actionId, decision: "done"|"snoozed", linkState, statusSnapshot}`. Em blackout, marcar `autonomous`. Guardar em memória + `localStorage`, sempre em `try/catch`.

---

## 10. O corpo 3D e o cenário

**Corpo.** A camada de pele do Z-Anatomy (`public/models/skin.glb`) é a base: regiões nomeadas, rosto, orelhas, mãos, cabelo. `src/scene/bodyBuild.ts` a transforma em personagem:
- cor de pele única por astronauta (os materiais zebrados do atlas são ignorados), tom nos lábios e orelhas, cabelo, sobrancelhas e cílios na cor do cabelo, olhos procedurais com íris colorida e córnea com brilho;
- um **id de sistema por vértice** (`aSys`), derivado do nome da região por regras em `RULES` (cabeça e rosto → behavior; órbitas → neuro_ocular; pescoço e virilha → immune; tórax → cardiovascular; abdômen alto → nutrition; baixo-ventre e costas → skeletal; braços e pernas → muscular). Regiões `soft` (rosto) contam para o sistema, mas não se dissolvem;
- macacão e traje de EVA são **cascas infladas das próprias regiões** ao longo de normais soldadas por posição (sem fendas entre regiões);
- a região urogenital é relaxada (média dos vizinhos) e os genitais do atlas são excluídos das camadas internas: o personagem é sempre vestido;
- variantes `male` e `female` (`warp`) compartilham geometria entre astronautas do mesmo corpo-base.

**Interação (RF-14).** Clique e hover são por região do corpo, sem botões flutuantes: raycast com BVH na geometria `pick` (invisível), `faceIndex` → `aSys`. Olhos têm raio de clique generoso, o dosímetro do braço e a aura abrem a radiação; o corpo tem prioridade sobre a aura. O hover mostra o nome do sistema e o status junto ao cursor. Teclado: listas de sistemas e da tripulação, visíveis só ao receber foco.

**Shader do corpo** (`bodyShader.ts`, injetado em `MeshStandardMaterial`): hover e listras de status por sistema, **dissolução** da região selecionada revelando a anatomia interna, raio-X geral, varredura de altura que veste e despe o traje, e fade geral do astronauta. As camadas internas (`AnatomyLayers.tsx`: esqueleto, órgãos, vasos, nervos, músculos) carregam sob demanda, são fundidas por sistema e brilham na cor do status do sistema selecionado. O coração pulsa na FC (bpm/60 Hz).

**Traje de EVA.** Botão "EVA suit" no dock (ou no cartão de exposição da Radiação). A varredura veste o traje (casca branca, capacete com viseira dourada, mochila, unidade no peito, anéis, faixa na cor de acento do astronauta), a câmara de ar escurece a imagem e a cena troca para o lado de fora do casco (Sol, Marte, nave com cabo de segurança, partículas). Sem traje: baia médica, janela para Marte e Terra. A taxa de dose sobe (`doseRate` em `model.ts`), a projeção de dose de carreira muda por regra e o motor reavalia o status.

**Cenário.** `Environment.tsx` (baia chanfrada com janela, costelas e luzes; fora do casco) e texturas 100% procedurais em `textures.ts` (estrelas, Marte, painéis, olhos, plaquetas). Marte cresce e a Terra encolhe com o dia da missão. Luz chave quente, recorte laranja da janela, reflexos por `RoomEnvironment` (nada é baixado). Pós-processamento: bloom, vinheta, ACES.

Obrigatório:
- **Atribuição** no rodapé do canvas e no modal de créditos: `Model data: Z-Anatomy — the libre 3D atlas of anatomy (CC-BY-SA 4.0), derived from BodyParts3D © The Database Center for Life Science.`
- **Altura cresce** com o alongamento da coluna (até 3%, `estimatedHeight`); a largura vem da massa registrada.
- Respeitar `prefers-reduced-motion` (sem flutuação, giro, pulso nem varredura lenta).
- Descartado: corpo baseado em fotos de pessoas reais.

Desempenho: `dpr [1, 1.75]`, sem sombras, geometrias fundidas, picking com BVH, camadas internas só quando precisam. Não reativar `StrictMode` sem testar a cena.

---

## 11. Design

Vidro sobre cena cinematográfica: painéis com `backdrop-filter`, raio 20–28 px, tipografia grande, uma ação por tela. Cor só para status: verde, âmbar e vermelho nunca são decoração (a cena usa tons naturais, azul-marinho de uniforme e o laranja de Marte).

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
  /state/store.ts           zustand: dia, solar, link, traje, raio-X, hover, menu; diário, medições, flags (localStorage)
  /data                     astronauts (aparência + overrides), systems, rules, extras, actions
  /engine                   status.ts, projection.ts, status.test.ts
  /lib                      model.ts (resolveMetric, exposição, fila, pacote), route.ts, format.ts, spaceWeather.ts
  /scene
    Stage.tsx               Canvas único, câmera, mundo, ciclo da câmara de ar
    AstronautRig.tsx        um astronauta: cascas, cabelo, olhos, traje, clique por região, aura
    bodyBuild.ts            pele do atlas → regiões, sistemas, cascas, deformação feminina
    bodyShader.ts           shader do corpo (hover, status, dissolução, varredura, fade)
    AnatomyLayers.tsx, anatomy.ts, useAnatomy.ts   camadas internas sob demanda
    Environment.tsx, textures.ts, Particles.tsx    cenário, texturas procedurais, radiação
  /ui                       Hud (HUD, Crew, dock, menu, créditos), Panel (níveis 1–3), panels (fila, log, diário, pacote), primitives, SourcesScreen
/public/models              6 GLB do Shandon's Body Atlas + ATTRIBUTION.md
vite.config.ts              plugin com a rota /api/space-weather (DONKI, só no servidor)
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
- Prontuário ou histórico clínico
- Astronautas reais ou com nome verossímil
- Telemetria para a Terra
- Landing page, modo pitch, tour
- Mais de 3 métricas por sistema

---

## 15. Critérios de aceite

- [ ] Abre direto em `Crew`; nenhuma landing page
- [ ] 4 astronautas com a matriz de status esperada no dia 142
- [ ] O personagem carrega com cor, cabelo, olhos e macacão; clicar em cada região abre o sistema certo
- [ ] Atribuição Z-Anatomy visível no canvas e no modal
- [ ] O nível 1 mostra veredito, 1 ação e no máximo 1 aviso de medição; nenhum outro número
- [ ] Nenhum painel de sistema mostra mais de 3 métricas ou 2 ações
- [ ] Todo número tem unidade, baseline e selo de proveniência
- [ ] Limites oficiais mostram o ID NASA; os demais mostram "Provisional threshold"
- [ ] Com o LLM fora do ar, o app continua completo com textos de reserva
- [ ] A chave de API não aparece em nenhum arquivo do cliente
- [ ] O DONKI mostra `LIVE` com dado real ou `SAMPLE` com a amostra, nunca erro na tela
- [ ] Teclado: Tab, setas, Enter e Esc navegam por todos os níveis
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