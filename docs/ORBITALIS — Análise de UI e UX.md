# ORBITALIS — Análise de UI e UX dos dados

30 de outubro de 2026 · para a equipe AstroCoders e o dono do produto

Análise do protótipo frente ao desafio *Create Health Monitoring Software for Astronauts on Space Missions*, com foco em como os dados aparecem na tela. Parte do código em 30/10 (commit `c600f8f`) e de capturas a 1440×800 das telas Crew, Body, System e Metric. O redesenho da seção 7 foi aprovado pelo dono do produto no mesmo dia.

## 1. Resumo

**O ORBITALIS é viável e responde ao desafio no conteúdo. O que falha é a apresentação dos dados.** O motor de status, os limites com ID da NASA, os selos de proveniência, o catálogo de ações, a entrada de medição e o pacote para o flight surgeon estão prontos e testados. Quase tudo isso, porém, fica atrás da cena: na tela do astronauta nenhum dos 8 sistemas aparece sem passar o cursor pelo corpo, 8 dos 9 controles em volta do corpo mexem no 3D, e o ID da NASA só aparece numa seção recolhida do nível 3. A impressão de "animação primeiro" vem daí, e não do 3D em si.

A correção é de interface, sem mudar as regras do motor de status nem o visual da cena: **o corpo é o mapa, a lista é o índice.** Uma lista fixa dos 8 sistemas com status ao lado do corpo, os seis indicadores citados pela NASA na tela do astronauta, e o limite, o motivo e a tendência de cada número à vista no nível 2.

Decisões do dono do produto em 30/10/2026:

- O nível 1 passa a mostrar os seis indicadores citados no enunciado (frequência cardíaca, pressão, glicemia, temperatura, sono e humor), cada um com unidade, valor pré-voo e selo.
- A lista dos 8 sistemas ocupa o lado esquerdo da tela do corpo; as camadas do atlas aparecem só com o raio-X ligado; o botão Radiation sai do dock e a radiação vira uma linha da lista.

## 2. O que o desafio pede e o que o ORBITALIS entrega

Situação **antes** do redesenho de 30/10; o estado atual está em `ORBITALIS — Status dos Requisitos.md`.

| Pedido do enunciado | Situação | Onde está, ou o que falta |
| --- | --- | --- |
| *Gathers* health indicators | Atende | 21 métricas em 7 sistemas e radiação (20 antes da temperatura), cada uma ligada a um instrumento que já voou; entrada manual em Log a measurement |
| Enables astronauts to *evaluate* | Atende no motor, parcial na tela | Status por regra testada, com o motivo calculado em inglês simples. Na tela, o índice dos sistemas, o limite e o motivo ficam escondidos |
| Enables astronauts to *act* | Atende | Catálogo fechado com protocolo citado, Done e Snooze, diário de decisões |
| Indicadores citados: pressão, frequência cardíaca, glicemia, temperatura, horas de sono, humor | 5 de 6 | A temperatura existe nos dados (`tempNow` em `src/data/astronauts.ts`) e não aparece em tela nenhuma |
| Ferramenta visual que orienta tratamento e melhora | Atende | Uma ação por tela; "No action needed today" quando não há |
| Entrada por teclado, clique ou câmera | Teclado e clique | Câmera fora do escopo (RF-24) |
| Quais medições dá para fazer no espaço? | Atende | Instrumento e onde já voou, em About this number e em Sources |
| Por que o exame é necessário? | Atende | "Why this exam is needed" na tela de registro; "Why it matters" no nível 3 |
| Como os riscos do voo afetam os indicadores? | Parcial | Há o mecanismo por sistema, mas sem ligar aos cinco riscos do HRP (radiação, isolamento, distância da Terra, gravidade, ambiente fechado) |
| Quando um resultado pede atenção da tripulação ou do flight surgeon? | Parcial | Status, limite e pacote existem; o limite fica recolhido e o pacote fica no Menu |
| Que ações previnem uma condição crítica? | Atende | Catálogo e projeção de 30 dias: WATCH antes do limite ser violado |
| Figura humana clicável que mostra função e status de cada parte | Parcial | Clique por região e status, mas a função do sistema não aparece e o mapeamento região → sistema não é óbvio |
| Ambientes diferentes (nave, estação, rover, base) | Parcial | Habitat e EVA, com a dose mudando |
| Pedir medições e ações na rotina | Atende, escondido | Today's queue fica no Menu; o nível 1 mostra só "A measurement is due" |
| Gamificação | Falta | Opcional na spec (RF-23) |
| Gráficos que mostram a evolução no tempo | Parcial | Só no nível 3, uma métrica por vez |
| Cores para ler o status num relance | Parcial | Cor, forma e palavra, mas só onde o status aparece; no corpo é um contorno suave |
| Instruções e explicações simples | Atende, escondido | Textos bons, recolhidos por padrão |

## 3. Pelos critérios do julgamento

Critérios do Space Apps: impacto, criatividade, validade, relevância e apresentação (conferir no guia de julgamento de 2026, que sai em 13/11).

| Critério | Hoje | Por quê |
| --- | --- | --- |
| Impacto | Médio a alto | O conceito serve a Artemis e a Marte: o astronauta avalia e age sozinho, com o link atrasado ou cortado. Precisa ficar claro em segundos |
| Criatividade | Alto | Corpo que muda com os dados (atrofia, massa, fadiga, altura), traje que muda a dose, o oficial médico como paciente, blackout com decisões autônomas |
| Validade | Alto no código, baixo na tela | IDs da NASA-STD-3001, selos, instrumentos reais, densidade óssea ESTIMATED (não há densitômetro a bordo), calibrações com fonte, testes. O jurado quase não vê nada disso |
| Relevância | Alto | Responde às perguntas do enunciado. Faltam a temperatura na tela, a função de cada parte do corpo e a ligação com os riscos do HRP |
| Apresentação | Baixo | Os dados ficam numa coluna de 400 px de vidro translúcido, com rótulos de 11 px e eixo de gráfico de 9 px; a cena ocupa uns 70% da tela |

Riscos do julgamento:

- **O vídeo de 30 s é o que o jurado vê.** Com a interface atual, a maior parte do tempo vai para câmera e transições, e o texto do painel fica ilegível num vídeo comprimido. A spec pede que o vídeo mostre, sem narração, que o status vem de regra, que cada número diz se é medido ou estimado, e que existe uma ação. Hoje só as duas últimas aparecem no caminho principal.
- **Muitos jurados não vão rodar o app.** A cena é pesada (30 a 45 quadros por segundo numa GPU integrada Iris Xe). Uma lista de sistemas em HTML deixa o app navegável mesmo enquanto a cena carrega.
- **"Offline explanation" em todas as telas.** Como este build não chama IA, o rótulo aparece sempre e pode ser lido como falha.

## 4. Pontos fortes, que ficam

- **Status por código determinístico**, com regras por métrica (`src/data/rules.ts`), projeção linear e a matriz do dia 142 testada (`src/engine/status.test.ts`). O motivo de cada status sai calculado ("5.3 h is below the critical bound of 5.5 h").
- **Selos de proveniência** em todo número: CONTINUOUS, PERIODIC, ESTIMATED, LOGGED, LIVE.
- **Limites oficiais com ID** (NASA-STD-3001 [V1 4003], [V1 4020], [V1 4024], [V1 4027], [V1 4030]) e "Provisional threshold" nos demais.
- **Catálogo fechado de ações** com recurso e protocolo, Done e Snooze, diário de decisões com a marca "autonomous" no blackout.
- **Fluxo de medição completo:** como fazer, instrumento, tempo, por que o exame é necessário, faixa plausível, recálculo do status e a ação resultante.
- **Pacote para o flight surgeon** montado por regra, com o atraso do link e o blackout.
- **O corpo 3D é dado, não enfeite:** o físico acompanha força, exercício, massa e sono; o coração pulsa na frequência cardíaca; a altura cresce com a coluna; o traje de EVA muda a taxa de dose. O enunciado sugere justamente a figura humana clicável.
- **Clima espacial real** (DONKI) pelo servidor, com amostra quando a rede cai.
- **Abre direto na tripulação**, com uma frase que responde "quem precisa de atenção?".
- **Acessibilidade de base:** forma e palavra no status, teclado, `aria-live` no veredito, `prefers-reduced-motion`.
- **Honestidade declarada:** tripulação fictícia, sinais sintéticos, o fator do traje como suposição.

## 5. Pontos fracos, com evidência

Estado de 30/10, antes do redesenho.

1. **O índice dos dados é invisível.** Os 8 sistemas só aparecem passando o cursor pelo corpo, ou numa lista que só existe com foco de teclado (`SystemRail` em `src/ui/Hud.tsx`, escondida pela regra `.a11y-rail:not(:focus-within)`). O mapeamento não é óbvio: o imune fica no pescoço e na virilha, o esquelético no baixo-ventre e nas costas, a nutrição no abdômen alto. O status no corpo é só um contorno suave, por decisão de design.
2. **Os controles visíveis são da cena.** No nível 1, 8 dos 9 controles em volta do corpo mexem no 3D (EVA suit, X-ray e os seis botões do painel Anatomy); só Radiation leva a dados.
3. **Duas coisas chamadas "systems".** O painel Anatomy oferece "All systems", Muscles, Skeleton, Organs, Circulation e Nerves, que não têm status nem número. Os 8 sistemas monitorados, que têm, não aparecem.
4. **Nenhum número na tela do astronauta** (regra do §3 do CLAUDE.md), e a temperatura corporal não aparece em lugar nenhum.
5. **Os diferenciais estão escondidos.** O chip do limite com o ID da NASA só aparece dentro de "About this number", recolhido, no nível 3 (`Metric` em `src/ui/Panel.tsx`). Os medidores do nível 2 não mostram limite; o motivo de cada status fica no "How it works" recolhido; o medidor tem marcas de pré-voo e de limite sem rótulo e é `aria-hidden`.
6. **Sem tempo antes do nível 3.** Os medidores não têm minigráfico; o gráfico comparativo (`TrendCompare`) fica recolhido.
7. **A rotina está no Menu.** A fila de medições, que o enunciado sugere ("prompt astronauts to take measurements"), aparece no nível 1 só como "A measurement is due".
8. **Inconsistências.** Done em "Add to the flight surgeon packet" (`EARTH-PACKET`) só grava no diário e não põe nada no pacote; a spec manda a explicação aberta no nível 3 e ela vem recolhida; só a radiação tem botão próprio no dock.
9. **A Crew diz quem, mas não por quê.** As placas têm nome e pílula; "Three others on watch" não diz quem nem o motivo. A dica "Click a crew member..." fica coberta pela placa do Rafael.
10. **Pouco espaço para o dado e muito movimento.** O painel tem 400 px de 1440; o painel de Radiation tem 1.476 px de conteúdo para 684 px visíveis (2,2 telas de rolagem). Cada navegação move a câmera e dissolve a região antes de o olho chegar ao número.

## 6. Diagnóstico: por que parece que a animação vem primeiro

A versão anterior do protótipo caiu por excesso de informação sem hierarquia: cada tela tentava responder a tudo. A decisão de 28/10 corrigiu com menos informação por tela, mas foi longe demais: tirou da tela o índice (a lista de sistemas) e os números, e deixou o corpo 3D como único caminho até os dados. O corpo é ótimo para mostrar *onde*, e ruim como menu: não diz o que é clicável, não lista nada, e o status nele é discreto de propósito.

O problema não é volume, é visibilidade da hierarquia. A resposta é o padrão clássico de painéis de monitoramento: visão geral primeiro, zoom no que importa, detalhe sob demanda. Para o ORBITALIS isso vira um princípio:

> **O corpo é o mapa, a lista é o índice.** O índice mostra todos os sistemas e o status de cada um, sempre. O corpo mostra onde fica o sistema que o índice aponta. Todo número aparece antes do movimento.

## 7. Proposta, nível por nível

### Layout da tela do corpo (níveis 1 a 3)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ORBITALIS                                      Day 142/250 · Earth 21 min · ☰ │
├────────────────┬───────────────────────────────────┬─────────────────────────┤
│ SYSTEMS        │                                   │ painel de detalhe        │
│ ◆ Sleep &      │                                   │ (nível 1, 2 ou 3)        │
│   behavior     │                                   │                          │
│   CRITICAL ·   │            corpo 3D               │                          │
│   Sleep        │      (realça a região da          │                          │
│ ● Neuro-ocular │       linha sob o cursor)         │                          │
│ ● Immune       │                                   │                          │
│ ● Cardiovasc.  │                                   │                          │
│ ▲ Nutrition    │                                   │                          │
│   WATCH ·      │  [All][Muscles][Skeleton]...      │                          │
│   Energy       │  (camadas: só com o raio-X)       │                          │
│ ● Skeletal     │     ( EVA suit · X-ray · ↺ )      │                          │
│ ● Muscular     │                                   │                          │
│ ● Radiation    │                                   │                          │
└────────────────┴───────────────────────────────────┴─────────────────────────┘
```

- **Lista de sistemas à esquerda**, da cabeça aos pés (comportamento, olhos, imune, coração, nutrição, esqueleto, músculos e, por último, a radiação, que é o corpo inteiro). A ordem espelha o corpo ao lado e ensina onde fica cada sistema. Cada linha tem forma, cor e palavra do status; quando não é nominal, diz qual métrica causa o status. Passar o cursor numa linha realça a região no corpo; passar o cursor no corpo marca a linha. Clicar abre o sistema.
- **As camadas do atlas** viram uma fileira acima do dock, só com o raio-X ligado. Continuam ligando, desligando e isolando cada sistema anatômico.
- **O dock** fica só com os controles da cena: EVA suit, X-ray e Reset view.
- **Painel de 440 px** com vidro mais opaco, para o texto não depender do que passa atrás.

### Crew (nível 0): quem e por quê

Cada placa ganha uma linha com os sistemas fora do nominal, sem números:

```
 ┌──────────────────────────────────┐
 │ Aiko Sato            ◆ CRITICAL  │
 │ ◆ Sleep & behavior · ▲ Nutrition │
 └──────────────────────────────────┘
```

O subtítulo nomeia quem está em observação ("Lena, Rafael and Daniel are on watch.").

### Body (nível 1): o que acontece comigo e o que faço hoje

```
┌─────────────────────────────────────────────┐
│ AS  Aiko Sato                   ◆ CRITICAL  │
│     Crew Medical Officer                    │
│ ◆ Needs attention                           │
│   Sleep is far below plan. ...              │
│ KEY INDICATORS       Now  Pre-flight Source │
│ ● Heart rate       60 bpm        58 CONT.   │
│ ● Systolic BP    121 mmHg       118 CONT.   │
│ ● Glucose        91 mg/dL        88 PERIOD. │
│ ● Temperature     36.8 °C      36.6 CONT.   │
│ ◆ Sleep             5.3 h       7.4 CONT.   │
│   CRITICAL · 5.3 h is below the critical    │
│   bound of 5.5 h.                           │
│ ● Mood          3.9 score       4.1 LOGGED  │
│ TODAY                                       │
│ Protect an 8-hour sleep window              │
│ SLP-EXT · 8 h · Crew compartment · ...      │
│ [ Done ]  [ Snooze ]                        │
│ Body mass due          last Day 133   Log   │
└─────────────────────────────────────────────┘
```

- Veredito como hoje, com a pílula do status geral no cabeçalho.
- **Key indicators:** os seis indicadores do enunciado numa tabela de colunas alinhadas (valor, pré-voo e selo); fora do nominal, a linha diz a palavra do status e o motivo. Clicar abre o nível 3; passar o cursor realça no corpo a região do sistema.
- **Today** fecha a tela, porque toda tela termina numa ação: a ação do dia e as medições pendentes, com o atalho para registrar (até duas; o resto fica na fila).
- Continua sem rolagem a 1440×800, conferido nos quatro astronautas e no evento solar.

### System (nível 2): como está este sistema e por quê

Cada medidor passa a mostrar a evidência que hoje está recolhida:

```
┌──────────────────────────────────────────────┐
│ Sleep duration                   ◆ CRITICAL  │
│ 5.3 h          ╲╱╲__╱╲__  ─ ─ limit          │
│ 5.3 h is below the critical bound of 5.5 h.  │
│ pre-flight 7.4 h · CONTINUOUS                │
│ Provisional threshold ≥ 6.5 h                │
└──────────────────────────────────────────────┘
```

- Minigráfico com a série, a linha do pré-voo e a do limite, no lugar do medidor sem rótulos.
- O motivo do status dentro do medidor.
- O chip do limite (com o ID da NASA quando é oficial) dentro do medidor.
- No cabeçalho: trilha de navegação, a **função** do sistema (o enunciado pede "information about its function and health status") e os **riscos do HRP** que o atingem.
- "Add to packet" passa a pôr as métricas fora do nominal no pacote, de fato.

### Metric (nível 3): de onde vem este número

- O chip do limite logo abaixo do valor grande.
- No gráfico, eixos legíveis (11 px) e rótulo direto na linha do limite e em "Today".
- "About this number" aberto por padrão, como manda a spec.

### Temperatura corporal

Vira métrica do motor, no sistema imune: CONTINUOUS (Bio-Monitor), em °C, faixa provisória de 36,0 a 37,5 °C, crítica abaixo de 35,0 ou acima de 38,0. Uma febre muda o status pelo motor e aparece na lista de sistemas, em todas as telas do corpo, e nos indicadores do nível 1. A matriz do dia 142 não muda. Vale conferir, para a evidência do sistema, o estudo sobre a temperatura central elevada em missões longas (Stahn et al., 2017, *Scientific Reports*) antes de citá-lo na interface.

## 8. Regras do CLAUDE.md que mudam

| Regra até 30/10 | Regra nova | Por quê |
| --- | --- | --- |
| Crew: placa com nome e status | Placa com nome, status e os sistemas fora do nominal (sem números) | Responder "quem" e "por quê" no mesmo olhar |
| Body: veredito, 1 ação, no máximo 1 aviso de medição, nenhum outro número | Veredito, 1 ação, até 2 medições pendentes e os seis indicadores do enunciado, com unidade, pré-voo e selo; a lista de sistemas ao lado | Um app de monitoramento cuja tela principal não mostra nenhum indicador parece vitrine |
| O corpo é o único caminho até os sistemas | O corpo e a lista, ligados nos dois sentidos | Navegação que não depende de adivinhar a região |
| Painel Anatomy fixo à esquerda | Camadas só com o raio-X, acima do dock | São controles de visualização, não dados |
| Estado da radiação no botão Radiation do dock | Radiação como linha da lista, como os outros sistemas | Consistência: nenhum sistema tem acesso privilegiado |
| Temperatura transversal, na barra superior | Métrica do sistema imune, sempre visível pela lista e pelos indicadores | O motor passa a decidir o status da febre, e ela não fica escondida |
| Medidor com marcas sem rótulo | Minigráfico com pré-voo, limite, motivo e chip do limite | "Evaluate" precisa do limite e do motivo à vista |
| Explicação do nível 3 recolhida | Aberta por padrão | Era o que a spec já pedia |

## 9. O que fica de fora agora

- **Gamificação (RF-23).** Candidata simples: sequência de dias com a ação do dia feita. No demo pesa pouco, porque o dia é simulado.
- **Camada de IA (RF-18) e o rótulo "Offline explanation".** Sem IA neste build, o rótulo aparece em todas as telas. A equipe decide entre implementar a rota de explicação ou trocar o rótulo, enquanto não houver IA, por algo que não pareça falha.
- **Entrada por câmera (RF-24) e camada do OSDR (RF-26).**
- **Contorno de status no rosto.** Com Sleep & behavior aberto, o contorno aparece como linhas finas e quebradas em volta da testa, dos olhos e das bochechas da Aiko. Vale conferir com o mesmo critério das rodadas anteriores (nada que pareça pintura).

## 10. Roteiro sugerido para o vídeo de 30 s

Sem narração, com o texto da própria interface:

| Tempo | Tela | O que o jurado lê |
| --- | --- | --- |
| 0–4 s | Crew | "Aiko Sato needs attention." e, em cada placa, os sistemas fora do nominal |
| 4–9 s | Body da Aiko | ◆ Sleep & behavior na lista, 5.3 h nos indicadores, a ação "Protect an 8-hour sleep window" |
| 9–14 s | Cursor em Sleep & behavior, depois clique | A cabeça realçada no corpo; o medidor com o motivo, o limite provisório e o selo CONTINUOUS |
| 14–20 s | Skeletal do Rafael | "NASA-STD-3001 [V1 4027] ≥ 95%" e ESTIMATED: não há densitômetro a bordo |
| 20–25 s | Registro de uma amostra de sangue | O status recalculado na hora, com o limite aplicado |
| 25–30 s | Done em blackout | O diário com a decisão marcada "autonomous" |

## 11. Ordem de execução e aceite

1. Lista de sistemas à esquerda, ligada ao corpo; camadas só no raio-X; Radiation fora do dock.
2. Nível 1 com a ação, as medições pendentes e os seis indicadores.
3. Níveis 2 e 3 com minigráfico, motivo e limite à vista, função e riscos do sistema, "Add to packet" de verdade.
4. Temperatura como métrica, placas da Crew, legibilidade.
5. CLAUDE.md e AGENTS.md atualizados.

Critérios de aceite novos:

- [ ] Na tela do astronauta, os 8 sistemas e o status de cada um aparecem sem passar o cursor pelo corpo
- [ ] Passar o cursor numa linha da lista realça a região no corpo, e o contrário
- [ ] Os seis indicadores do enunciado aparecem no nível 1, com unidade, pré-voo e selo, sem rolagem a 1440×800
- [ ] Todo medidor do nível 2 mostra limite (com ID NASA quando oficial), motivo do status e tendência
- [ ] O nível 3 mostra o limite ao lado do valor e a explicação aberta
- [ ] As placas da Crew dizem quais sistemas estão fora do nominal
- [ ] A temperatura corporal tem status pelo motor e aparece na tela
- [ ] Teste dos 10 segundos: alguém de fora diz quem precisa de atenção, por quê e o que fazer

**Estado em 30/10/2026:** as cinco etapas estão implementadas. Typecheck limpo e 112 testes passando (cinco novos: temperatura no motor, febre levando o imune e o astronauta a CRITICAL, ordem da lista, métrica que causa o status, sistemas fora do nominal das placas). Conferido por capturas a 1440×800 e 900×800: o nível 1 cabe sem rolagem nos quatro astronautas e no evento solar; Tab chega à lista, Enter abre o sistema e Esc volta; o cursor numa linha da lista realça a região no corpo; "Add to packet" põe a métrica no pacote. Falta o teste dos 10 segundos com alguém de fora.
