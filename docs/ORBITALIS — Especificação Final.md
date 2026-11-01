# ORBITALIS

Oct 28, 2026 · @Igor Fernando Casita Ferreira da Silva

Especificação final para o NASA Space Apps Challenge 2026 — desafio *Create Health Monitoring Software for Astronauts on Space Missions*. Equipe AstroCoders. Hackathon em 14–15/11; resources oficiais em 13/11.

## O produto

**ORBITALIS **

**é um mapa corporal interativo, um por astronauta, que mostra em que sistema do corpo a missão está cobrando seu preço, de onde vem cada número, e qual é a única coisa a fazer hoje.**

Cenário: cruzeiro Terra → Marte, dia 142 de cerca de 250. Usuário: o próprio astronauta, não um médico e não um pesquisador. O app precisa funcionar sem contato com a Terra.

**Os três verbos do enunciado viram três gestos:**

| Enunciado | Gesto no ORBITALIS |
| --- | --- |
| *gathers* health indicators | O corpo acende por sistema, com dados de instrumentos que já voaram e medições que o astronauta registra |
| enables astronauts to *evaluate* | Clicar no sistema mostra no máximo três números, cada um com baseline pré-voo, limite e origem |
| enables astronauts to *act* | Toda tela termina numa ação do catálogo de contramedidas, com botão "Done" que vai para o diário de decisões |

**Nome.** ORBITALIS — Deep-Space Crew Health Monitoring. Evitar "Health Intelligence System": sugere um sistema que decide, e o produto não decide.

**O que o ORBITALIS não é — decisões firmes:**

- Não tem landing page, modo pitch, slides ou tour. Abre direto na tripulação.
- Não é prontuário. Só o baseline pré-voo de cada indicador monitorado.
- Não diagnostica e não prescreve medicamento. A interface usa "assessment"; o diagnóstico fica com o flight surgeon.
- Não usa dado de astronauta real. Tripulação fictícia, sem fotos, só iniciais.
- Não deixa a IA decidir status. Verde, âmbar e vermelho vêm de regra determinística.
- Não é um gêmeo digital. O nome honesto é mapa corporal: anatomia onde dados medidos e estimados são pendurados na região certa.

## Arquitetura de informação

O problema que derrubou a versão anterior do protótipo foi excesso de informação: cada tela tentava responder a todas as perguntas ao mesmo tempo. A regra que resolve: **cada nível responde a uma única pergunta e só mostra o necessário para respondê-la.**

| Nível | Tela | A única pergunta | Teto de informação |
| --- | --- | --- | --- |
| 0 | Crew | Quem precisa de atenção? | 4 cartões: iniciais, nome, função, status e uma frase. Zero números fora da barra |
| 1 | Body | O que acontece comigo e o que faço hoje? | Corpo 3D + 7 pontos + 1 ação prioritária. Sem rolagem |
| 2 | System | Como está este sistema e por quê? | Máximo 3 métricas, 2 ações. Explicação recolhida |
| 3 | Metric | De onde vem este número? | 1 gráfico, fonte, limiar, proveniência. Explicação aberta por padrão |

**As sete regras de design que decorrem disso:**

1. Cor só significa status. Verde, âmbar e vermelho nunca são decoração.
2. Status nunca depende só de cor: sempre forma + palavra — ● NOMINAL, ▲ WATCH, ◆ CRITICAL.
3. Todo número tem três companheiros: unidade, baseline pré-voo e selo de proveniência. Número sozinho não entra.
4. Toda tela termina em ação. Se não há, a tela diz "No action needed today".
5. Explicação é sob demanda no nível 2, aberta por padrão no nível 3.
6. Limite oficial aparece com o ID. Limite nosso aparece como "Provisional threshold".
7. Nada de rolagem no nível 1. Se não coube numa tela de notebook, sobrou informação.

**Os cinco selos de proveniência**, sempre visíveis, sempre no mesmo lugar:

| Selo | Significado |
| --- | --- |
| CONTINUOUS | Sensor vestível, leitura contínua |
| PERIODIC | Exame ou amostra coletada a bordo em intervalos |
| ESTIMATED | Calculado por modelo a partir de baseline + taxa publicada |
| LOGGED | Registro do astronauta ou de app |
| LIVE | Feed público real, ao vivo |

Isso vira argumento de pitch: *nosso mapa mostra o que é medido, o que é estimado e o que é registrado — porque um astronauta sozinho precisa saber o quanto confiar em cada número.*

## O corpo 3D

O enunciado sugere literalmente uma figura humana clicável por parte do corpo. Isso significa que **o corpo 3D é expectativa, não surpresa** — muitas equipes vão fazer. Ele serve à legibilidade no vídeo de 30 segundos; o diferencial real é proveniência, IDs de requisito e status determinístico.

**Estilo:** holograma clínico elegante sobre fundo escuro. Não cartum, não fotorrealista.

**Modelo:** os seis arquivos GLB do projeto open-source Shandon's Body Atlas, exportados do Z-Anatomy, licença CC BY-SA 4.0, carregados por CDN. Camadas: pele, esqueleto, órgãos, músculos, vasos, nervos. Corpo simplificado por primitivas como reserva, se o download falhar. Atribuição obrigatória no canvas e no modal de créditos.

**Quatro decisões visuais aprovadas**

| Decisão | Justificativa |
| --- | --- |
| **Altura cresce ao longo da missão** | Astronautas crescem até 3% em microgravidade — cerca de 5 cm numa pessoa de 1,80 m — por alongamento da coluna, e voltam ao normal na Terra. Começa em até dois dias. É dado real documentado pela NASA, e quase nenhuma equipe vai saber |
| **Proporção derivada de massa e altura** | Massa corporal já é métrica monitorada, medida pelo instrumento de bordo. A forma do corpo muda com o dado, não com um seletor |
| **Modo EVA em vez de "com ou sem traje"** | O traje é blindagem, não roupa. Alternar mostra como a dose de radiação muda dentro do habitat e fora dele. Vira funcionalidade do módulo de radiação |
| **Composição corporal visível** | Massa muscular e densidade óssea mudando a forma do corpo ao longo dos 142 dias. É o diferencial sendo mostrado, não decoração |

**Três descartes, com motivo**

| Descartado | Motivo |
| --- | --- |
| Cor dos olhos e do cabelo | Não são indicadores de saúde. Um jurado que vê seletor de cor num painel clínico lê "criador de personagem", e isso ataca Validade |
| Corpo baseado em fotos de astronautas | A coorte é pequena e a combinação de parâmetros re-identifica. A NASA faz revisão de atribuibilidade justamente por isso |
| Pele fotorrealista com textura e cabelo | Exige modelagem, texturização e rigging — semanas, não horas. Fotorrealismo malfeito cai no vale da estranheza e fica pior que o holograma |

**Batimento cardíaco:** os nós do coração pulsam na frequência cardíaca exibida. É visualização de um dado real, não uma medida de fluxo que não temos.

**Acessibilidade:** respeitar `prefers-reduced-motion` (sem flutuação, sem autorrotação, sem pulso). Sem WebGL, cair para uma silhueta SVG com os mesmos sete pontos clicáveis.

## Sistemas e indicadores

Sete sistemas mais radiação. Máximo de 3 métricas por sistema. **(E)** marca indicador nomeado no enunciado.

| Sistema | Região no corpo | Métricas | Proveniência | Limiar |
| --- | --- | --- | --- | --- |
| Cardiovascular | Coração e vasos | FC de repouso (E) · Pressão sistólica (E) · Capacidade aeróbica | CONTINUOUS · CONTINUOUS · PERIODIC | Provisório · Provisório · \[V1 4003\] ≥ 80% |
| Skeletal | Esqueleto, foco no quadril | Densidade quadril+coluna · Colo do fêmur | ESTIMATED | \[V1 4027\] ≥ 95% · ≥ 90% |
| Muscular | Coxas, panturrilhas, braços | Força musculoesquelética · Exercício (média 7 dias) | PERIODIC · LOGGED | \[V1 4024\] ≥ 80% · Provisório |
| Neuro-ocular (SANS) | Olhos e nervo óptico | Edema de disco (Frisén 0–5) · Acuidade visual | PERIODIC · LOGGED | Provisório |
| Immune | Linfonodos e baço | Leucócitos · Linfócitos | PERIODIC | Faixa clínica terrestre, rotulada |
| Nutrition & Metabolism | Trato digestivo | Ingestão energética · Massa corporal · Glicemia (E) | LOGGED · PERIODIC · PERIODIC | \[V1 4020\] 100% · Provisório · Faixa clínica |
| Sleep & Behavior | Cérebro | Sono (E) · Desempenho cognitivo · Humor (E) | CONTINUOUS · PERIODIC · LOGGED | Provisório |
| Radiation | Aura em volta do corpo | Dose da missão · Dose de carreira · Clima espacial | CONTINUOUS · CONTINUOUS · LIVE | \[V1 4030\] < 600 mSv |

**Temperatura corporal (E)** é transversal: entra na barra superior como sinal agudo, não dentro de um sistema. Febre atravessa vários sistemas, e escondê-la no imune perderia o sinal.

**Altura** entra no painel do sistema esquelético, com o alongamento da coluna como mecanismo.

**Por que "Nutrition & Metabolism" e não "Endócrino".** Para chamar um sistema de endócrino, ele precisa mostrar hormônio, e não há hormônio medido em voo com resultado a bordo — amostras são congeladas e analisadas na Terra. Nutrição é risco vermelho da NASA, tem requisito numerado e tem dado registrado a bordo. Se em 13/11 aparecer dataset hormonal, a decisão se reabre.

**Por que SANS entra mesmo sem ser citado.** É risco vermelho do Human Research Program que o enunciado omitiu. Incluir e declarar o motivo demonstra leitura do programa.

**Instrumentos reais que justificam cada dado:** Bio-Monitor/Astroskin (CSA) para sinais contínuos; Bio-Analyzer (CSA) para contagem de células em 2–3 h a bordo; OCT e fundoscópio usados na ISS para SANS; SLAMMD para massa corporal; ARED, T2 e CEVIS para exercício; dosímetro ativo pessoal (ESA) para radiação; bateria Cognition para desempenho cognitivo. **Não há densitômetro a bordo** — densidade óssea é estimada do DXA pré-voo.

## Entrada de dados pelo astronauta

O enunciado autoriza coletar dados do usuário por qualquer entrada — teclado, cliques, câmera. Isso desfaz o dilema do dado sintético: **o astronauta é a fonte.**

| Origem | Selo | Como chega |
| --- | --- | --- |
| Sensor vestível | CONTINUOUS | Sintético, declarado. FC, pressão, sono |
| Exame a bordo | PERIODIC | O app pede, o astronauta executa e digita. Leucócitos, glicemia, massa, Frisén |
| Registro do astronauta | LOGGED | O astronauta digita ou escolhe. Humor, exercício, ingestão, sintomas |

**O fluxo de medição, em cinco passos:**

1. A fila do dia mostra o que está pendente: *Blood sample due — last taken Day 128*.
2. O astronauta abre o item e vê a instrução: como executar, qual instrumento, quanto tempo leva, **por que o exame é necessário**.
3. Ele digita o valor, com unidade explícita no campo.
4. O sistema valida faixa plausível, grava com carimbo de tempo e recalcula o status.
5. A tela devolve status, delta contra baseline, limiar aplicado e a ação resultante.

**Por que isso é diferencial e não só conformidade.** A maioria das equipes vai simular tudo e mostrar um painel que se move sozinho. Um app que *pede* a medição e explica por que ela importa responde a três perguntas do enunciado de uma vez: quais medições podem ser feitas no espaço, por que o exame é necessário, e o que fazer com o resultado.

**Tripulação simulada — quatro perfis, quatro histórias.** Cada um exercita um estado diferente do sistema:

| Astronauta (fictício) | Função | História | Status esperado no dia 142 |
| --- | --- | --- | --- |
| Lena Moreau | Commander | Dose de carreira prévia alta; projeção estoura o limite no fim do cruzeiro | Radiation WATCH |
| Rafael Duarte | Flight Engineer | Adesão ao exercício caiu a \~60% do plano | Skeletal WATCH · Muscular WATCH |
| Aiko Sato | Crew Medical Officer | Dorme 5,3 h. **O oficial médico é o paciente** | Sleep & Behavior CRITICAL · Nutrition WATCH |
| Daniel Osei | Mission Specialist | Edema de disco grau 1; linfócitos abaixo da faixa | Neuro-ocular WATCH · Immune WATCH |

Três calibrações vêm de fonte publicada — dose de 1,8 mSv/dia do instrumento RAD no cruzeiro do MSL; perda óssea de −0,8%/mês nos membros inferiores; atraso de 21–22 min e blackout de conjunção de 2–3 semanas. Todo o resto é ilustrativo e declarado no rodapé.

## Motor de status, ações e IA

**Status é código, não IA.** As regras, em ordem:

1. **Métrica com requisito NASA:** CRITICAL se o valor viola o requisito. WATCH se respeita, mas a projeção linear viola em até 30 dias, ou a folga é menor que a margem. Senão NOMINAL.
2. **Métrica sem requisito NASA:** faixas provisórias por métrica, sem projeção, rotuladas na tela como provisórias.
3. **Status do sistema** = pior status entre suas métricas.
4. **Status do astronauta** = pior entre os sete sistemas e radiação.
5. **Ação prioritária** = ação principal do sistema de pior status. Desempate pela ordem dos riscos vermelhos: radiação, comportamental, neuro-ocular, nutrição, depois os demais.
6. **Evento solar simulado ativo** → Radiation CRITICAL para todos, ação prioritária vira abrigo.
7. **Se o CMO é o paciente** e há algum CRITICAL, a consulta roteia para o CMO reserva, com nota na tela.

Projeção: regressão linear dos últimos 14 dias para métricas diárias; das últimas 3 amostras para periódicas. Escrever testes cobrindo cada regra e a matriz de status esperada.

**Catálogo fechado de contramedidas.** A IA escolhe somente por ID, nunca inventa. Cada ação carrega a referência do protocolo publicado.

| ID | Ação | Sistemas | Recurso | Protocolo |
| --- | --- | --- | --- | --- |
| EX-RES | Resistive exercise session | Skeletal, Muscular | ARED | Parte do programa de \~2 h/dia da ISS |
| EX-AER | Aerobic exercise session | Cardiovascular, Muscular | T2 ou CEVIS | 70–90% da FC máxima |
| EX-PLAN | Restore exercise plan adherence | Muscular, Skeletal | Agenda | Adesão observada na ISS: T2 em 47% dos dias, CEVIS em 37% |
| SLP-EXT | Protect an 8-hour sleep window | Sleep & Behavior | Compartimento de dormir | — |
| SLP-LIGHT | Dim cabin light before sleep | Sleep & Behavior | Iluminação | — |
| BEH-LOAD | Rebalance today's task load | Sleep & Behavior | Planejamento | — |
| NUT-CAL | Raise energy intake to 100% of need | Nutrition | Despensa | \[V1 4020\] |
| NUT-D | Confirm vitamin D supplementation | Nutrition | Suplementos | 800 UI/dia, padrão ISS desde 2006 |
| NUT-MASS | Repeat body mass measurement | Nutrition | SLAMMD | — |
| OCU-EXAM | Repeat eye exam and log symptoms | Neuro-ocular | OCT, fundoscópio | — |
| IMM-SAMPLE | Collect a blood sample | Immune | Bio-Analyzer | Resultado em 2–3 h |
| RAD-SHELTER | Move to the storm shelter | Radiation | Área blindada | — |
| RAD-REVIEW | Review remaining-mission dose budget | Radiation | — | \[V1 4030\] |
| CMO-CONSULT | Consult the Crew Medical Officer | Todos | CMO ou reserva | — |
| EARTH-PACKET | Add to the flight surgeon packet | Todos | Diário | — |

**Onde a IA entra e onde não entra**

| A IA faz | A IA não faz |
| --- | --- |
| Escreve o resumo de uma linha de cada sistema | Não calcula nem altera status |
| Escreve o "por quê" — mecanismo biológico, até 45 palavras | Não cria números; só usa os valores que recebe |
| Escolhe 1–2 ações por ID dentro das permitidas e justifica | Não sugere medicamento, dose ou diagnóstico |
| Gera o pacote para o flight surgeon a partir do diário | Não conversa livremente; não há chat |

Saída em JSON com schema, temperatura baixa, limite de palavras, timeout de 8 s com texto de reserva vindo do catálogo, e cache por astronauta + sistema + dia + estado do link. Validar a resposta: descartar ação fora da lista permitida e qualquer número que não esteja na entrada.

**Honestidade para o pitch:** no protótipo o modelo roda na nuvem, o que num blackout real não existiria. Declarar: *o conceito assume um modelo embarcado, conforme a capacidade de apoio à decisão autônoma descrita no ConOps do HRP.*

## Requisitos e ordem de corte

**Obrigatórios.** Sem qualquer um destes, o projeto não responde ao enunciado ou perde o diferencial. É aqui que deve estar a maior parte do esforço.

| ID | Requisito | Cláusula |
| --- | --- | --- |
| RF-01 | Agregar indicadores de 7 sistemas + radiação, cada um ligado a instrumento que já voou | gathers |
| RF-02 | Comparar todo valor contra baseline pré-voo individual | evaluate |
| RF-03 | Entrada manual de medição pelo astronauta | gathering data from the user |
| RF-04 | Fila de medições pendentes do dia | prompt astronauts to take measurements |
| RF-05 | Motor de status determinístico em 3 níveis | color coding |
| RF-06 | Projeção linear com horizonte de 30 dias | prevent a critical condition |
| RF-07 | Ação única por tela, de catálogo fechado, com protocolo citado | guidance on treatments |
| RF-08 | Selo de proveniência em todo número | diferencial próprio |
| RF-09 | Chip de limiar com ID NASA ou "Provisional" | when a result warrants attention |
| RF-10 | Explicação do mecanismo em linguagem simples | do not assume astronauts know |
| RF-11 | Instrução de medição: como e por quê | simple instructions |
| RF-12 | Gráfico de evolução por indicador | dynamic charts |
| RF-13 | Modo autônomo como padrão, com simulação de blackout | distance from Earth |
| RF-14 | Mapa corporal interativo clicável | human figure clickable |
| RF-15 | Sinalização do que vai para o flight surgeon | flight surgeons on the ground |

**Fortes.** Entram se o bloco obrigatório estiver pronto no sábado à noite.

| ID | Requisito |
| --- | --- |
| RF-16 | Diário de decisões com carimbo, snapshot e marcação "autonomous" em blackout |
| RF-17 | Pacote de handover para o flight surgeon |
| RF-18 | Camada explicativa por IA |
| RF-19 | Feed de clima espacial ao vivo |
| RF-20 | Degradação graciosa: nunca erro na tela |
| RF-21 | Regra do oficial médico como paciente |
| RF-22 | Controles de cenário: dia, link, evento solar |

**Opcionais.** Só com o resto pronto.

| ID | Requisito | Risco |
| --- | --- | --- |
| RF-23 | Gamificação: sequência de adesão | Baixo; o enunciado cita |
| RF-24 | Entrada por câmera | Alto |
| RF-25 | Visão temporal da tripulação | Baixo |
| RF-26 | Camada molecular do OSDR | Médio |
| RF-27 | Registro de desfecho da ação | Baixo |

**Ordem de corte:** RF-26 → RF-24 → RF-19 → RF-17. **Nunca caem RF-01 a RF-15.**

**Aviso de escopo.** A taxa de vitória foi de cerca de 0,087% em 2025 — 10 prêmios em mais de 11.500 projetos — e 25 dos 30 vencedores globais de 2023 a 2025 entregaram uma interface simples sobre dado real. O Best Use of Science de 2025 foi feito por uma pessoa. Implementar tudo em 39 horas é a causa mais comum de derrota: às 20h de domingo existem doze funcionalidades pela metade e um vídeo mostrando tela quebrada. **A recomendação é acabamento impecável nos RF-01 a RF-15 antes de qualquer adição.**

## Identidade visual

Apresentação é um critério inteiro do julgamento, mas aqui "design decisivo" significa **legibilidade sob pressão**, não realismo. O que ganha é a tela que um jurado entende em 10 segundos sem narração. Um painel clínico mal desenhado não parece feio, parece inseguro — e isso atinge Validade, não só Apresentação.

**Tokens de cor**

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | #070B14 | Fundo |
| `--surface` | #0E1526 | Cartões |
| `--surface-2` | #141D33 | Elevação |
| `--border` | #22304D | Bordas 1 px |
| `--text` | #E8EDF7 | Texto |
| `--text-muted` | #8C9AB5 | Rótulos |
| `--nominal` | #3DDC97 | Status apenas |
| `--watch` | #FFB547 | Status apenas |
| `--critical` | #FF5D5D | Status apenas |
| `--live` | #5CC8FF | Selo LIVE e aura |

As três cores de status **nunca** aparecem como decoração. Todo o resto da interface é neutro.

**Tipografia.** Inter para interface; JetBrains Mono com números tabulares para todo valor numérico. Rótulos 12 px em caixa alta com espaçamento 0.08em na cor muted; títulos 18–20 px semibold; valores de métrica 28 px mono.

**Componentes**

- **Pílula de status:** glifo + palavra, texto na cor do status sobre fundo da mesma cor a 12%.
- **Selo de proveniência:** contorno, texto pequeno, neutro. Só LIVE usa cor.
- **Chip de limiar:** `NASA-STD-3001 [V1 4027] ≥ 95%` ou `Provisional threshold`.
- **Cartões:** raio 12 px, borda 1 px, sem sombras. Grade de 8 px.
- **Sparkline:** SVG próprio, 30 dias, com linha horizontal do limite.

**Texto.** Inglês, sentence case, sem exclamações, sem emojis, no máximo 1 casa decimal, dias como "Day 142".

**Responsivo.** Referência 1280×800. Abaixo de 1024 px o painel direito vira bottom sheet; abaixo de 640 px os cartões da tripulação empilham.

**Acessibilidade.** Contraste AA, navegação completa por teclado, `aria-label` nos hotspots e nas linhas de sistema, `aria-live="polite"` para mudança de status.

**O que dá para fazer antes de 14/11 sem tocar no desafio:** definir paleta, hierarquia de severidade, componentes de alerta e tipografia. Isso é identidade visual, não trabalho no desafio.

## Stack e fontes de dados

| Camada | Decisão |
| --- | --- |
| Front | React + Three.js (@react-three/fiber, drei). Corpo por primitivas como reserva |
| Motor de status | TypeScript puro, determinístico, com testes. Nunca IA |
| IA | Só resumo, mecanismo e escolha de ação por ID. JSON com schema, temperatura baixa, timeout 8 s |
| Servidor | Rotas para explicação, handover e clima espacial. Chave de API nunca no cliente |
| Persistência | Diário em memória + localStorage, sempre em try/catch |
| Desempenho | dpr \[1, 2\], sem sombras, material compartilhado por camada, meshes sem handlers. Meta 60 fps |

**Fontes oficiais usadas no produto**

| Fonte | O que entrega | Acesso |
| --- | --- | --- |
| [NASA-STD-3001 Vol. 1 Rev. C](https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf) | Limiares com ID: \[V1 4003\], \[V1 4020\], \[V1 4024\], \[V1 4027\], \[V1 4030\] | PDF público |
| [DONKI / CCMC](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | Flares e eventos de partículas solares, ao vivo | `ccmc.gsfc.nasa.gov/DONKI-API/get/FLR` e `/SEP`, sem chave, só pelo servidor |
| [OSDR / GeneLab](https://www.nasa.gov/reference/osdr-public-api/) | Estudos de biologia espacial | `osdr.nasa.gov/osdr/data/search`, público |
| [Human Research Program](https://www.nasa.gov/humans-in-space/counteracting-bone-and-muscle-loss-in-microgravity/) | Protocolos de contramedida e evidência por sistema | Público |
| [Nutrição e voo espacial](https://www.nasa.gov/wp-content/uploads/2024/10/human-adaptation-to-spaceflight-the-role-of-nutrition.pdf) | Vitamina D 800 UI/dia, padrão desde 2006 | PDF público |
| [Z-Anatomy / Shandon's Body Atlas](https://github.com/ryanjardine95/shandons-body-atlas) | Modelo anatômico em 6 camadas | CDN, CC BY-SA 4.0, atribuição obrigatória |

**Calibrações com fonte**

- Dose de 1,8 mSv/dia: medida pelo instrumento RAD no cruzeiro do Mars Science Laboratory ([SwRI](https://www.swri.org/newsroom/press-releases/swri-led-team-calculates-the-radiation-exposure-associated-trip-mars)).
- Perda óssea de −0,8%/mês nos membros inferiores ([Stavnichuk et al., 2020, npj Microgravity](https://www.nature.com/articles/s41526-020-0103-2)).
- Altura: até 3% de aumento por alongamento da coluna, começando em até dois dias ([NTRS 20090007782](https://ntrs.nasa.gov/citations/20090007782)).
- Exercício: \~2 h/dia, sessão de 2,5 h agendada; CEVIS em 37% e T2 em 47% dos dias em órbita ([relatório de evidência do HRP](https://ntrs.nasa.gov/api/citations/20220019338/downloads/Evidence%20report%20aerobic%20and%20muscle_FINAL%209-21-22%20Pubpress%20accepted_v2.pdf)).

**Não usar:** Life Sciences Data Archive e Standard Measures exigem IRB e acordo de uso. É essa restrição que justifica a tripulação fictícia, e ela vira argumento no pitch.

**Resources oficiais saem em 13/11.** Ao sair: marcar cada um como já previsto, substituto ou novo; priorizar o que a NASA apontou, porque usar o dataset indicado pelo autor pesa direto em Relevância; verificar se há dado fisiológico real que encolha a parte sintética. A CSA, parceira em 2026, já forneceu dados de Bio-Monitor numa edição anterior.

## Submissão, riscos e pendências

**Regras da submissão**

- Página do projeto e materiais **em inglês**. Vídeo pode ser narrado em português com legendas em inglês.
- Demo obrigatória: vídeo de até 30 segundos **ou** apresentação de até 7 slides, hospedados fora do site, link público sem login.
- Submissão abre sábado 9h e fecha domingo 23h59, hora local. Depois disso não há edição nem exceção.
- Licença documentada e todas as fontes citadas, inclusive as abertas.
- Uso de IA declarado: onde e como. Imagens e vídeos gerados precisam de marca d'água.
- Equipe de no máximo 6 pessoas, todas inscritas no mesmo evento.

**Alvo de prêmio:** Best Use of Technology como primário, Best Mission Concept como secundário. Descartar Best Use of Data — os sinais vitais são sintéticos, e disputar essa categoria é disputar no ponto mais fraco.

**O que o vídeo de 30 segundos precisa deixar explícito sem narração:** que o status vem de regra, que cada número diz se é medido ou estimado, e que existe uma ação. Se um jurado técnico sair achando que é um dashboard com chatbot, perdemos as duas categorias-alvo.

**Riscos abertos**

| # | Risco | Estado |
| --- | --- | --- |
| 1 | Código ou artigo escritos antes de 14/11 podem ser submetidos? | **Aberto.** Perguntar ao Local Lead. O guia de submissão sai em 13/11, véspera. Um artigo publicado e citado como referência externa é mais seguro que um artigo apresentado como parte do projeto |
| 2 | Limiares provisórios sem validação de especialista | Mitigado parcialmente: onde há requisito NASA, usa-se o ID; onde não há, rotula-se como provisório. Não elimina o risco |
| 3 | Corpo 3D deixou de ser diferencial | Reposicionado para legibilidade do vídeo |
| 4 | Resources só em 13/11 | Especificação escrita para absorver mudança |
| 5 | Dependência de CDN de terceiro | Copiar os GLB para o repositório antes de 14/11, com arquivo de atribuição |

**Decisões pendentes para a equipe**

- [ ] Confirmar com o Local Lead a regra de trabalho pré-evento
- [ ] Definir licença do repositório: MIT ou Apache 2.0
- [ ] Designar quem grava o vídeo, a partir do meio-dia de domingo
- [ ] Designar quem faz a auditoria de densidade de informação, tela por tela
- [ ] Baixar os seis GLB e hospedar no repositório da equipe

**Teste de aceitação final**, com alguém que não acompanhou a construção: abrir na tela Crew e perguntar "quem precisa de atenção?". Se a pessoa não apontar em 10 segundos, o problema está na tela Crew, não no código.
