# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ORBITALIS

Contexto para agentes de IA que trabalham neste repositório.
Equipe AstroCoders · NASA Space Apps Challenge 2026 · 14–15/11/2026.

---

## 0. Estado atual do repositório

- Stack real: Vite + React 19 + TypeScript + `@react-three/fiber`/`drei` + zustand + vitest. Sem git ainda.
- Comandos: `npm run dev` (http://localhost:5173; a rota `/api/space-weather` é um middleware do Vite que busca o DONKI) · `npm run build` (typecheck + build) · `npm run typecheck` · `npm test` (vitest; um teste: `npx vitest run -t "nome do teste"`).
- Estado: protótipo funcional dos RF-01 a RF-15. Telas: Crew → Body → System → Metric, mais Log de medição, Today's queue, Decision diary, Flight surgeon packet e Sources. Corpo 3D real (Z-Anatomy, 6 GLB em `public/models`, ver `public/models/ATTRIBUTION.md`).
- Motor de status de verdade: `src/engine/status.ts` + `projection.ts`, regras por métrica em `src/data/rules.ts`. Os status NÃO são marcados à mão: a matriz do dia 142 sai do motor e é testada em `src/engine/status.test.ts`. Para mudar o cenário de um astronauta, altere só valores em `src/data/astronauts.ts` (`overrides`).
- Séries sintéticas determinísticas por (astronauta, métrica, dia) em `src/lib/model.ts` (`resolveMetric` é memoizado). Métricas periódicas só ganham ponto novo quando o astronauta registra uma medição.
- Cena 3D: `src/scene/anatomy.ts` baixa cada GLB, classifica as malhas por palavra-chave de nome (sistema) e funde tudo em poucas geometrias; `useAnatomy.ts` carrega camadas sob demanda e normaliza (altura 1.80, +z). Hotspots são DOM (drei `Html`); há um `<Html>` sentinela em `BodyCanvas.tsx` porque o drei descarta a primeira instância montada. Não reativar `StrictMode` sem rever isso.
- Fora do escopo ainda: camada de IA e servidor de explicação (os textos são de reserva, marcados `Offline explanation`), modo EVA, entrada por câmera, OSDR, fallback SVG sem WebGL (existe corpo por primitivas se o GLB falhar).
- Objetivo de desenvolvimento declarado: apresentar dados com um design impressionante que capte a atenção em menos de 5 segundos. Isso é alcançado **dentro** das regras da §2 e §3 (a tela Crew, o corpo 3D e os tokens da §11 são o impacto visual); não com landing page, hero ou modo apresentação.

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
8. **O app abre direto na tela Crew.** Sem landing page, hero, tour, onboarding ou modo apresentação.
9. **Todo texto de interface em INGLÊS.** Comentários de código e documentação podem ser em português.
10. **Chamadas a LLM e a APIs externas só em rotas de servidor.** Chave de API nunca no cliente.
11. **Tripulação 100% fictícia.** Sem fotos, sem rostos, só iniciais.

---

## 3. Arquitetura de informação — o orçamento por tela

Cada nível responde a UMA pergunta. Se algo não cabe no orçamento, não entra.

| Nível | Tela | Pergunta | Teto |
|---|---|---|---|
| 0 | `Crew` | Quem precisa de atenção? | 4 cartões. Zero números fora da barra superior |
| 1 | `Body` | O que acontece comigo e o que faço hoje? | Corpo 3D + 7 pontos + **1** ação. Sem rolagem |
| 2 | `System` | Como está este sistema e por quê? | Máx. **3** métricas, **2** ações. Explicação recolhida |
| 3 | `Metric` | De onde vem este número? | 1 gráfico, fonte, limiar, proveniência. Explicação aberta |

Navegação por hash: `#/crew` · `#/body/{id}` · `#/body/{id}/{system}` · `#/body/{id}/{system}/{metric}`.

O canvas 3D é montado ao entrar no nível 1 e **não é desmontado** ao trocar entre níveis 1–3 nem ao trocar de astronauta.

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

## 10. O corpo 3D

Estilo: **holograma clínico elegante** sobre fundo escuro. Não cartum, não fotorrealista.

Modelo: 6 arquivos GLB do Shandon's Body Atlas (Z-Anatomy, CC BY-SA 4.0), carregados por CDN, com compressão meshopt. Camadas: `skin`, `skeleton`, `organs`, `muscles`, `vessels`, `nerves`.

Obrigatório:
- **Normalizar** todas as camadas com a mesma transformação: altura 1.80, pés em y=0, olhando para +z. Imprimir no console dimensões e rotação aplicada.
- **Substituir materiais originais** por `MeshStandardMaterial` neutros, um por camada. Nenhum material base pode ser verde, âmbar ou vermelho saturado.
- **Índice de nós por palavra-chave**; registrar no console quantos casaram por sistema. Se zero, acender a camada inteira. Nunca quebrar por causa de nome.
- **Corpo simplificado por primitivas** como placeholder e reserva, se o download falhar.
- **Atribuição** no canvas e no modal de créditos: `Model data: Z-Anatomy — the libre 3D atlas of anatomy (CC-BY-SA 4.0), derived from BodyParts3D © The Database Center for Life Science.`

Decisões visuais aprovadas:
- **Altura cresce ao longo da missão** — astronautas crescem até 3% por alongamento da coluna, começando em até 2 dias. Dado real, documentado.
- **Proporção derivada de massa e altura registradas**, nunca de seletor.
- **Modo EVA** em vez de "com ou sem traje": o traje é blindagem; alternar mostra a dose dentro e fora do habitat.
- **Batimento**: nós do coração pulsam na FC exibida (bpm/60 Hz).

Descartado, não reintroduzir: cor de olhos e cabelo, corpo baseado em fotos de astronautas reais, pele fotorrealista com textura e cabelo.

Desempenho: `dpr [1, 2]`, sem sombras, material compartilhado por camada, meshes anatômicos **sem handlers de evento** (só hotspots recebem ponteiro). Meta 60 fps.
Respeitar `prefers-reduced-motion`. Sem WebGL, cair para silhueta SVG com os mesmos 7 pontos clicáveis.

---

## 11. Design tokens

```css
--bg: #070B14;        --surface: #0E1526;   --surface-2: #141D33;
--border: #22304D;    --text: #E8EDF7;      --text-muted: #8C9AB5;
--nominal: #3DDC97;   --watch: #FFB547;     --critical: #FF5D5D;
--live: #5CC8FF;
```

Tipografia: `Inter` para interface; `JetBrains Mono` com números tabulares para **todo** valor numérico.
Rótulos 12 px caixa alta, espaçamento 0.08em, cor muted. Títulos 18–20 px semibold. Valores de métrica 28 px mono.
Cartões: raio 12 px, borda 1 px `--border`, sem sombras. Grade de 8 px.
Texto: inglês, sentence case, sem exclamações, sem emojis, máx. 1 casa decimal, dias como `Day 142`.
Referência 1280×800. Abaixo de 1024 px o painel direito vira bottom sheet; abaixo de 640 px os cartões empilham.
Acessibilidade: contraste AA, navegação completa por teclado, `aria-label` em hotspots e linhas de sistema, `aria-live="polite"` para mudança de status.

---

## 12. Stack e estrutura

```
/src
  /state/store.ts           zustand: astronauta, nível, sistema, métrica, dia, link, evento, diário
  /data
    anatomy.ts              ANATOMY_BASE, arquivos, lotes, palavras-chave por sistema
    astronauts.ts           4 perfis fictícios, baseline → alvo, sementes
    systems.ts              sistemas, métricas, limiares, sourceNotes, presets de câmera, hotspots
    requirements.ts         IDs NASA-STD-3001
    actions.ts              catálogo fechado
    generator.ts            PRNG semeado (mulberry32), séries dia 0 → 250
  /engine
    status.ts               motor determinístico
    projection.ts           regressão linear
    status.test.ts          testes por regra + matriz esperada
  /scene                    BodyCanvas, AnatomyModel, ProceduralBody, Hotspots, CameraRig, RadiationAura
  /ui                       TopBar, CrewScreen, BodyScreen, SystemPanel, MetricRow, MetricDrawer,
                            ActionCard, StatusPill, ProvenanceBadge, Sparkline, CommsDrawer, SimulationMenu
  /services/api.ts          chamadas às rotas do servidor
/server                     /api/explain, /api/earth-packet, /api/space-weather
```

Front: React + Three.js (`@react-three/fiber`, `drei`).
Dados determinísticos: PRNG semeado por astronauta, para que tudo seja reprodutível.

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
- [ ] Modelo anatômico carrega normalizado; se falhar, corpo simplificado com aviso
- [ ] Atribuição Z-Anatomy visível no canvas e no modal
- [ ] No nível 1, os únicos números visíveis são dia da missão, atraso do link, dose de carreira e duração da ação
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