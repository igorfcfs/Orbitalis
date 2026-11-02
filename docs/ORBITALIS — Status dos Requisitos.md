# ORBITALIS — Status dos requisitos

2 de novembro de 2026 · para a equipe AstroCoders · o evento é em 14–15/11 (faltam 12 dias; os resources oficiais saem em 13/11)

Estado do código em 02/11/2026 (`38f66ff` + 21 arquivos modificados ou novos, ainda sem commit), já com a rodada de UI/UX dos dados e a entrega de RF-18, RF-23 a RF-27. Os requisitos vêm da especificação (`ORBITALIS — Especificação Final.md`, RF-01 a RF-27) e dos novos que você está avaliando (RF-28 a RF-32), mais o RF-33, que sugiro. O catálogo de emergência do RF-33 está em `ORBITALIS — Catálogo de Emergência (rascunho).md`.

Conferi em 02/11: o typecheck limpo, o build e os 134 testes (9 arquivos; 22 novos cobrem RF-18 e RF-23 a RF-27), as rotas `/api/osdr` (dados reais do OSDR, 400 para sistema desconhecido) e `/api/explain` (503 sem chave, 405 em GET) com o servidor de pé, e uma captura da tela Crew timeline. **Não conferi:** uma chamada real ao modelo de IA (só `fetch` simulado nos testes), a câmera num aparelho real (o cálculo do pulso foi testado só com sinal sintético) nem a captura das telas de sistema e de registro. Conferi em 31/10, por captura de tela ou execução: o nível 1 e a lista de sistemas, o feed DONKI (HTTP 200, 15 flares), o typecheck e os 112 testes (8 arquivos, 27 deles do motor de status). Em 30/10 conferi as telas dos níveis 1 a 3, o teclado, o pacote, o formulário de registro e o evento solar. O restante vem da leitura do código e dos testes. A viabilidade e os riscos segundo as diretrizes da NASA estão em `ORBITALIS — Viabilidade e Riscos.md`.

## 1. Resumo

| Grupo | Total | Atendidos | Parciais | Não atendidos |
| --- | --- | --- | --- | --- |
| Obrigatórios (RF-01 a RF-15) | 15 | 15 | 0 | 0 |
| Fortes (RF-16 a RF-22) | 7 | 6 | 1 | 0 |
| Opcionais (RF-23 a RF-27) | 5 | 5 | 0 | 0 |
| Propostos (RF-28 a RF-33) | 6 | 0 | 1 | 5 |

Os 15 obrigatórios estão atendidos: o projeto já responde ao enunciado. No escopo original só falta a metade de RF-20 (sem WebGL). RF-18 e os cinco opcionais entraram em 02/11 (ver as ressalvas na seção 2).

**Fora da lista de RFs há três pendências baratas** que a verificação de hoje encontrou, descritas na seção 8:
1. A atribuição CC BY-SA do Z-Anatomy só aparece no modal Credits e em Sources; o CLAUDE.md pede também no rodapé do canvas.
2. Não existem `LICENSE` nem `README`, e a spec exige licença documentada.
3. Não há `ErrorBoundary` nem detecção de WebGL (é a metade que falta em RF-20).

## 2. Atendidos (26)

| ID | Requisito | Onde está, e observações |
| --- | --- | --- |
| RF-01 | Agregar indicadores de 7 sistemas e radiação, cada um ligado a um instrumento que já voou | 21 métricas em 8 sistemas (`data/systems.ts`), cada uma com instrumento e histórico de voo (`data/extras.ts`) |
| RF-02 | Comparar todo valor com o baseline pré-voo individual | `overrides` por astronauta (`data/astronauts.ts`); o pré-voo aparece ao lado de cada número e como linha tracejada nos gráficos |
| RF-03 | Entrada manual de medição pelo astronauta | Log a measurement (`ui/panels.tsx`): valida a faixa plausível, grava com carimbo de tempo, recalcula e devolve status, delta, limite e ação |
| RF-04 | Fila de medições pendentes | Até 2 pendentes na tela do astronauta, com atalho para registrar, e a fila completa no Menu (`dueItems`) |
| RF-05 | Motor de status determinístico em 3 níveis | `engine/status.ts` e `projection.ts`, regras em `data/rules.ts`, 27 testes em `engine/status.test.ts` (inclui a matriz do dia 142) |
| RF-06 | Projeção linear com horizonte de 30 dias | `HORIZON_DAYS = 30`; entra na regra do status (WATCH se a projeção viola o limite) e no gráfico do nível 3 |
| RF-07 | Ação única por tela, de catálogo fechado, com protocolo citado | `data/actions.ts`, 15 ações; 6 delas dizem "No protocol cited", como a spec. Só 13 são alcançáveis hoje: `BEH-LOAD` e `NUT-MASS` existem no catálogo e nenhum sistema as oferece (entrariam com a escolha por IA, RF-18) |
| RF-08 | Selo de proveniência em todo número | `MetricBadge` na tabela de indicadores, nos medidores, no gráfico, no registro e no pacote. **Exceção:** "Career dose at Day 250" no cartão de exposição da Radiação não tem selo nem pré-voo |
| RF-09 | Chip de limiar com ID NASA ou "Provisional" | `ThresholdChip` nos medidores (nível 2) e logo abaixo do valor (nível 3); as faixas clínicas dizem "Terrestrial clinical range" |
| RF-10 | Mecanismo em linguagem simples | "In plain words" e "Why it matters" no nível 3 (abertos) e "How it works" por sistema |
| RF-11 | Instrução de medição: como e por quê | Tela de registro: como fazer, instrumento e tempo, por que o exame é necessário |
| RF-12 | Gráfico de evolução por indicador | Minigráfico em cada medidor e gráfico com projeção, pré-voo e limite no nível 3 |
| RF-13 | Modo autônomo como padrão, com simulação de blackout | O app não depende da Terra para agir; Menu → Simulation alterna "Delayed 21 min" e "Blackout"; decisões em blackout ficam marcadas `autonomous` |
| RF-14 | Mapa corporal clicável | Clique e hover por região do corpo (`scene/AstronautRig.tsx`), ligados à lista dos 8 sistemas ao lado |
| RF-15 | Sinalizar o que vai ao flight surgeon | "Flag for flight surgeon" no nível 3 e "Add to packet" nas ações; os itens CRITICAL entram sozinhos |
| RF-16 | Diário de decisões | Carimbo ISO, dia, astronauta, sistema, ação, decisão, link e status no momento; marca `autonomous` em blackout; `localStorage` em try/catch |
| RF-17 | Pacote de handover para o flight surgeon | Prévia em texto, copiar e baixar. "Send" só registra o envio no aparelho (o produto não faz telemetria para a Terra) |
| RF-18 | Camada explicativa por IA | `lib/explain.ts` (contrato, esquema, limites de 22/45/18 palavras, validação), `server/explain.ts` e a rota `/api/explain` (`vite.config.ts`): ferramenta forçada com esquema JSON, temperatura 0,2, timeout de 8 s, chave só no servidor (`ANTHROPIC_API_KEY`, `.env.example`). A resposta é descartada inteira se tiver ação fora de `allowedActions`, número que não está na entrada ou termo de medicamento ou diagnóstico. Cache por astronauta, sistema, dia e link (`lib/useExplanation.ts`). Na tela do sistema o texto trocado leva a etiqueta "AI explanation"; sem chave ou em falha vale o texto de reserva "Offline explanation". 11 testes. **Ressalvas:** nunca rodou contra o modelo real; a IA só justifica ações que o motor já oferece (`BEH-LOAD` e `NUT-MASS` continuam inalcançáveis); a rota é middleware do Vite (ver R-P09); a submissão precisa declarar o uso de IA |
| RF-19 | Feed de clima espacial ao vivo | DONKI por `/api/space-weather` (`vite.config.ts`); verificado em 31/10: HTTP 200 com dados reais (15 flares). O cliente cai para `SAMPLE` sem mostrar erro. **Atenção:** a rota é um middleware do Vite (dev e preview); numa hospedagem estática o selo seria sempre `SAMPLE` |
| RF-23 | Gamificação: sequência de adesão | `adherenceStreak` (`lib/adherence.ts`) conta dias seguidos com a ação feita, a partir do diário; hoje em aberto não quebra a sequência. Aparece em Today (nível 1) e no Decision diary, sem pontos nem ranking. Testado |
| RF-24 | Entrada por câmera | "Check with camera" no registro da frequência cardíaca: pulso por fotopletismografia de ponta de dedo (`lib/ppg.ts`, `ui/CameraCheck.tsx`), 15 s, nenhum quadro guardado ou enviado. O resultado só preenche o campo, que segue a validação normal. **Ressalva:** testado só com sinal sintético, não numa câmera real (R-P10). A frequência continua com o selo CONTINUOUS na métrica; a caixa da câmera usa LOGGED |
| RF-25 | Visão temporal da tripulação | Menu → Crew timeline (`#/timeline`, `ui/Timeline.tsx`): uma faixa por astronauta com o status geral a cada 10 dias, em forma e cor, pelo mesmo motor; clicar leva o dia da simulação até ali. Testado |
| RF-26 | Camada molecular do OSDR | Cartão "Space biology · OSDR" em "How it works" de cada sistema: até 3 estudos públicos do GeneLab (rota `/api/osdr`, termos fixos por sistema, estudos de voo primeiro), selo LIVE ou SAMPLE. Verificado ao vivo em 02/11. É contexto: não entra no status. A maioria dos estudos é com animais ou células, e a tela diz isso |
| RF-27 | Registro de desfecho da ação | `decisionOutcome`: no Decision diary cada ação feita mostra o status do sistema na decisão e hoje (melhorou, sem mudança, piorou, ou "Check tomorrow"), lido do motor, sem afirmar causa. Testado |
| RF-21 | Regra do oficial médico como paciente | `CMO-CONSULT` vira "Consult the backup CMO", com nota na tela (`systemActions`); testado |
| RF-22 | Controles de cenário: dia, link, evento solar | Menu → Simulation (dia de 10 a 250, evento solar, link) e parâmetros de URL (`?day=`, `?solar=1`, `?link=blackout`) |

## 3. Parcialmente atendido (1)

| ID | Requisito | O que existe | O que falta |
| --- | --- | --- | --- |
| RF-20 | Degradação graciosa: nunca erro na tela | DONKI cai para `SAMPLE` e `useFeed` nunca lança erro; `localStorage` sempre em try/catch; a cabeça do atlas serve de reserva se o GLB do rosto falhar | Não há `ErrorBoundary` nem detecção de WebGL no código. A spec pede uma silhueta SVG com os pontos clicáveis; com a lista de sistemas já em HTML, basta isolar o `<Canvas>` num `ErrorBoundary` e mostrar só a lista e o painel |

## 4. Não atendidos (0)

Nenhum. Os seis que estavam aqui (RF-18, RF-23 a RF-27) passaram para a seção 2 em 02/11.

## 5. Propostos (RF-28 a RF-33)

Descrições e riscos como você escreveu; a coluna da direita é minha leitura do código. O número do RF-33 é só uma sugestão.

| ID | Requisito | Risco (seu) | Situação hoje e minha leitura |
| --- | --- | --- | --- |
| RF-28 | Adaptabilidade em 4 cenários: foguete, base lunar, estação espacial e espaço sideral | Alto | Não iniciado. Hoje há 1 cenário (cruzeiro a Marte, dia 142 de 250) e 2 modos de exposição. Concordo com **Alto**, mas os 4 não custam o mesmo: estação e espaço sideral são baratos, base lunar é média e foguete quebra o eixo de dias |
| RF-29 | IA para emergência: analisa o histórico do astronauta e a emergência que aconteceu com ele durante o diagnóstico | Alto | Não iniciado. O fluxo está definido (o socorrista dispara; uso em blackout). Depende do RF-33 e esbarra na regra 3 (diagnóstico). Concordo com **Alto** |
| RF-30 | CRUD de tripulantes | Baixo | Não iniciado. Eu estimo **Médio**: a tripulação está presa a 4 rostos, 4 posições e 4 estilos de cabelo fixos |
| RF-31 | CRUD de dados da missão: duração, distância a ser percorrida, riscos… | Baixo | Não iniciado. **Baixo** para a duração; **Médio** se incluir distância e riscos |
| RF-32 | Informar especificamente qual dispositivo de medição utilizar para os dados | Baixo | **Parcial.** Os dados existem para as 21 métricas, mas aparecem só em 4 telas e 3 campos precisam de ajuste. Concordo com **Baixo** |
| RF-33 | Catálogo de ações de emergência, cada uma com protocolo publicado (sugestão minha; pré-requisito do RF-29) | Médio (minha estimativa) | Rascunho escrito: 11 ações novas e 2 reaproveitadas, com fontes verificadas pelo resumo. Falta validação de um médico ou flight surgeon e o texto integral das 4 diretrizes citadas |

### RF-28: adaptabilidade em 4 cenários

**Como li o requisito.** Foguete é o lançamento e a subida (horas); depois vêm a base lunar, a estação espacial (órbita baixa) e o espaço sideral, que é o cruzeiro em espaço profundo de hoje. O enunciado da NASA pede algo próximo: "different environments, such as a spacecraft, a space station, a rover, or a base on another planet or moon". Hoje o app tem um cenário (cruzeiro a Marte, dia 142 de 250) e dois modos de exposição (habitat e traje).

**O que está preso ao cenário atual:**
- `MISSION_LENGTH`, `MISSION_DAY` e `LINK_DELAY_MIN` em `lib/model.ts`, a taxa de 1,8 mSv/dia e o fator do traje;
- as séries sintéticas, ancoradas no dia 142 com os valores típicos desse dia;
- Marte, Terra e Sol na cena 3D (`scene/Stage.tsx`, `scene/Environment.tsx`);
- textos de mecanismo que supõem microgravidade;
- o catálogo de ações, que supõe ARED, T2 e CEVIS.

**O que muda por cenário** ("a levantar" quer dizer que ainda não há fonte):

| Parâmetro | Foguete (subida) | Estação espacial | Base lunar | Espaço sideral (hoje) |
| --- | --- | --- | --- | --- |
| Escala de tempo | Minutos a horas | Meses | Semanas a meses | ~250 dias |
| Gravidade | Cargas de subida, depois microgravidade | Microgravidade | 1/6 g | Microgravidade |
| Link com a Terra | Contínuo (a confirmar) | Quase contínuo (a confirmar) | ≈1,3 s de ida (distância ÷ velocidade da luz); sem visada no lado oculto sem relé | 21–22 min e blackout de 2–3 semanas (já no projeto) |
| Dose de radiação | A levantar | 0,2 a 0,5 mSv/dia de dose efetiva ([Shavers et al.](https://doi.org/10.1016/j.zemedi.2023.06.005)) | 1369 µSv/dia de dose equivalente, medida pelo Chang'E-4 ([Zhang et al., 2020](https://doi.org/10.1126/sciadv.aaz1334)) | 1,8 mSv/dia (RAD, já no projeto) |
| Contramedidas e aparelhos | Só o que cabe num assento (a levantar) | ARED, T2, CEVIS (já no projeto) | A levantar | ARED, T2, CEVIS (já no projeto) |

**Atenção à grandeza.** O LND do Chang'E-4 mede dose equivalente, e o limite de carreira da NASA é em dose efetiva (Shavers et al.). O projeto já compara a taxa do RAD com o limite de 600 mSv; vale conferir a grandeza do RAD e declarar a grandeza em cada número de dose, para não comparar coisas diferentes (Validade).

**Custo por cenário (minha leitura):**
- **Espaço sideral:** já pronto.
- **Estação espacial: baixo.** A fisiologia é a mesma (microgravidade); mudam a duração, o regime do link, a taxa de dose e o fundo da janela (a Terra no lugar de Marte).
- **Base lunar: médio.** A perda óssea de −0,8%/mês e o alongamento de 3% da coluna são de microgravidade, e não verifiquei taxa publicada para 1/6 g. Esses parâmetros seriam suposições declaradas (como `SUIT_SHIELD_FACTOR`), e cada suposição sem fonte pesa em Validade. A dose tem fonte.
- **Foguete: alto.** O motor e a interface são em dias (`day`, passos de 2 dias, "Day 142"); uma subida dura minutos e pede outro eixo de tempo e outros indicadores, e nenhuma das 21 métricas foi pensada para isso. Sugestão: tratar como **fase de lançamento** (linha do tempo curta, só sinais do sensor vestível e o fluxo de emergência) ou deixar para depois.

**Como construir.** Um `MissionProfile`: duração, gravidade, regime do link, taxa de dose com grandeza e fonte, riscos do HRP, aparelhos e ações disponíveis, fundo da janela. O RF-31 edita esse mesmo perfil e o RF-28 são 4 perfis prontos, então os dois compartilham a base. Na cena, o ganho barato é trocar o fundo da janela (Terra, Lua, Marte), sem modelar um interior novo por cenário.

**Decisões suas:** (1) foguete é a fase de lançamento? (2) o cenário se escolhe no Menu (como o dia e o link) ou na configuração da missão? (3) aceita parâmetros declarados sem fonte, marcados como tais? (4) a adaptação visual fica só no fundo da janela?

### RF-29: IA para emergência, como você descreveu

**Fluxo.** O tripulante que socorre dispara a emergência de outro. No seu exemplo, a Aiko Sato, que é a oficial médica, sente dor no peito e desmaia; a IA analisa o histórico clínico, o diário de bordo e os dados estatísticos dela, estima o que aconteceu e instrui quem socorre. O uso principal é em blackout.

**O blackout muda o desenho.** Sem link não há modelo na nuvem. O caminho principal tem de funcionar offline: um motor de emergência por regras (código) escolhe a categoria e a ordem das ações do catálogo (RF-33), e a IA, quando houver link ou um modelo embarcado, só melhora o texto. É o inverso do que eu havia sugerido antes (RF-18 primeiro). O protótipo da NASA com a Google, o CMO-DA, roda no Google Cloud (Vertex AI, segundo as reportagens), e a Google o descreve como apoio ao oficial médico ou ao flight surgeon ([artigo da Google](https://publicsector.google/ai/how-google-and-nasa-are-testing-ai-for-medical-care-in-space/); [Space.com](https://www.space.com/technology/nasa-and-google-test-ai-medical-assistant-for-astronaut-missions-to-the-moon-and-mars)). A limitação de nuvem é a mesma, e o pitch deve dizer que o conceito assume um modelo embarcado.

**Onde o pedido esbarra nas regras do projeto (decisão sua):**
1. **"Prever o que aconteceu" é diagnóstico.** A regra 3 e o §14 do CLAUDE.md proíbem diagnóstico pela IA, e a spec deixa o diagnóstico com o flight surgeon. Uma saída que respeita as regras: a tela mostra a *categoria de protocolo* (por exemplo, "adulto inconsciente sem respiração normal"), os sinais do registro que a sustentam (com unidade, pré-voo e selo) e a ação, sem nomear causa. Nomear hipóteses de causa exige revogar a regra 3 no modo emergência, com custo em Validade e no risco do pitch ("IA diagnosticando"). O protótipo da NASA fala em "diagnóstico"; a nossa regra é mais estrita por escolha.
2. **"Histórico clínico" é prontuário**, que o §14 também exclui. Sugestão: uma ficha pré-voo fictícia e fechada por tripulante (campos de lista, sem texto livre), declarada como sintética.
3. **O "diário de bordo com todos os dias" não existe.** O diário de hoje só guarda decisões. Faltam um registro de sintomas (lista fechada: dor no peito, falta de ar, tontura…) e entradas diárias. Sugiro tratar como RF-34.
4. **A análise precisa de algo para analisar.** Hoje a Aiko tem frequência cardíaca de 60 bpm (pré-voo 58) e pressão de 121 mmHg (pré-voo 118): nada aponta para o coração. Sugestão: um cenário de emergência por sobreposição (como o evento solar) que injeta a deriva nos últimos dias, sem alterar a matriz do dia 142.
5. **O app não sabe quem está operando.** Precisa de "Reported by" (lista fechada de tripulantes) para o diário e o pacote. Com o CMO como paciente vale a regra do RF-21 (consulta ao CMO reserva), que hoje só atua em sistema CRITICAL e precisa ser reaproveitada no fluxo de emergência.
6. **A camada de IA continua sendo o RF-18** (rota de servidor, JSON com schema, validação, cache) e aqui é opcional. O pitch não pode parecer chatbot, e o uso de IA precisa ser declarado na submissão.

**Decisões suas:** (a) a regra 3 vale também na emergência? (b) a ficha clínica pré-voo sintética é aceitável? (c) o motor por regras é o caminho principal e a IA é opcional?

**O que a NASA-STD-3001 Vol. 1 Rev. C diz (texto integral, 31/10):** o cuidado médico em missão é "managed by the Flight Medicine team", incluindo os CMOs ([V1 3000]); entre as capacidades que os programas devem prover estão "autonomous medical care and advanced life support" e restrições físicas "appropriate to specific gravity environments" ([V1 3004], itens t e k); e o Apêndice E (Tabela E.2-2) lista "Angina/Myocardial infarction" e "Sudden cardiac arrest" entre as condições de alta probabilidade ou consequência, o que sustenta o seu cenário. Em contrapartida, o enunciado pede "diagnosis" e "guidance on treatments", e as diretrizes de mídia da NASA não permitem atribuir à NASA a informação que passou por um modelo de linguagem e incentivam a marca "SI-generated" (R-N14). Os detalhes estão em `ORBITALIS — Diretrizes NASA (verificadas).md`.

### RF-33: catálogo de ações de emergência

Você confirmou que precisamos ampliar o catálogo, e as ações de emergência são o que o motor por regras do RF-29 vai escolher. O rascunho está em `ORBITALIS — Catálogo de Emergência (rascunho).md`: entrada fechada (sem texto livre), 4 categorias de protocolo (parada cardiorrespiratória, inconsciente respirando, dor no peito, síncope), 11 ações novas (`EMG-…`) mais `CMO-CONSULT` e `EARTH-PACKET`, e a lista do que fica de fora de propósito (medicamentos, doses, via aérea avançada, nome de causa). Cada ação cita um protocolo publicado, com a situação da fonte: o resumo foi verificado para a AHA 2025 e para a diretriz de RCP em microgravidade, e falta o texto integral dessas duas e das diretrizes de dor no peito e síncope. Nada disso substitui a validação de um médico ou flight surgeon.

### RF-30: CRUD de tripulantes

Hoje a tripulação é fixa em `data/astronauts.ts` (4 astronautas; os `overrides` definem a história de cada um). Um tripulante novo precisa de mais que um formulário:

- **Rosto:** cada rosto é um GLB em `public/models/heads/<id>.glb` e o estilo do cabelo está por id em `HAIR_STYLE` (`scene/headModel.ts`). Um tripulante novo reaproveitaria um dos 4 rostos (ficaria igual a outro) ou cairia na cabeça do atlas, que é só reserva.
- **Formação da Crew:** as posições estão fixas em `LINEUP_X` (`scene/Stage.tsx`). Com mais de 4, o layout precisa ser calculado, e cada astronauta custa quadros (a cena roda a 27–45 fps numa GPU integrada).
- **Dados:** 21 baselines e a data da última coleta por astronauta. Um formulário mínimo (nome, função, corpo masculino ou feminino, altura, oficial médico) com baselines padrão cobre o essencial.
- **Padrão restaurável:** os testes da matriz do dia 142 e o roteiro do vídeo assumem os 4 originais; o CRUD deve mantê-los como padrão (o "Clear saved data" já limpa o `localStorage`).
- **Regra 11:** o nome livre permite digitar nomes reais; manter o aviso de tripulação fictícia.
- **Ficha clínica:** o RF-29 pede o histórico clínico de cada tripulante; a ficha pré-voo sintética e fechada entraria neste cadastro.

### RF-31: CRUD de dados da missão

- **Duração (barato):** `MISSION_LENGTH = 250`, `MISSION_DAY = 142` e `LINK_DELAY_MIN = 21` vivem em `lib/model.ts` e são importadas por 6 arquivos de interface e estado. Além delas, `250` aparece como número solto em `scene/Stage.tsx` (escala de Marte e da Terra) e em `state/store.ts` (limite do parâmetro `day`). `MISSION_DAY` também é a âncora das séries sintéticas e da matriz de status testada.
- **Distância a percorrer:** não existe hoje, então precisa de um uso (por exemplo, exibir na barra superior). Cuidado ao ligá-la ao atraso do link: o atraso depende da distância Terra–nave, não do caminho percorrido.
- **Riscos:** hoje os riscos do HRP por sistema são fixos (`hazards` em `data/extras.ts`). Tornar editável é fácil, mas as calibrações com fonte (1,8 mSv/dia, −0,8%/mês de osso) valem para cruzeiro a Marte e não devem mudar sem nova fonte (CLAUDE.md §13).
- **Persistência:** `localStorage` com try/catch, como o diário.
- **Perfil da missão:** o RF-28 usa o mesmo perfil, com 4 predefinidos; construir o perfil primeiro serve aos dois.

### RF-32: dispositivo de medição

- **Já existe:** as 21 métricas têm `instrument` e `heritage` (`data/systems.ts`, `data/extras.ts`), exibidos na tela de registro ("Instrument and time"), no nível 3 ("Where it comes from"), na fila de hoje e em Sources.
- **Falta aparecer onde o astronauta decide medir:** a lista de pendentes do nível 1 diz "Blood sample due" sem o aparelho, e os medidores do nível 2 não dizem com o que foi medido.
- **Falta precisão** (o requisito pede "especificamente"). Das 21 métricas:
  - 12 citam um aparelho específico (Bio-Monitor, Bio-Analyzer, SLAMMD, dosímetro, bateria Cognition, OCT e fundoscópio);
  - 1 depende da sessão, corretamente: `exercise` (ARED, T2 ou CEVIS);
  - 3 precisam de ajuste: `vo2` e `strength` mostram o grupo "ARED / T2 / CEVIS" no campo `instrument`, embora o texto de cada uma já fale do cicloergômetro (CEVIS) e do dispositivo resistivo (ARED); `acuity` lista "OCT and fundoscope", mas o texto manda ler uma tabela de acuidade;
  - 5 não são medidas por aparelho: `energy` (diário alimentar), `mood` (check-in diário), `bmd` e `fn` (estimadas do DXA pré-voo; não há densitômetro a bordo) e `space_weather` (feed público). Convém dizer isso na tela ("você registra", "estimado, não medido a bordo") em vez de inventar um instrumento.
- A spec manda citar só instrumentos reais e nunca inventar outros (CLAUDE.md §5).

## 6. Critérios de aceite (CLAUDE.md §15)

| Critério | Situação | Observação |
| --- | --- | --- |
| Abre direto em Crew; nenhuma landing page | Atendido | |
| 4 astronautas com a matriz de status do dia 142 | Atendido | Testado |
| Personagem com cor, cabelo, olhos e macacão; clicar na região abre o sistema certo | Atendido | |
| Atribuição Z-Anatomy visível no canvas e no modal | **Parcial** | Só no modal Credits e em Sources; falta o rodapé do canvas |
| Nível 1: veredito, 6 indicadores, 1 ação e até 2 medições, sem rolagem a 1440×800 | Atendido | Conferido nos 4 astronautas e no evento solar |
| Nenhum painel de sistema com mais de 3 métricas ou 2 ações | Atendido | O imune tem 3 métricas com a temperatura |
| Os 8 sistemas e seus status numa lista ao lado do corpo, ligada ao corpo pelo hover | Atendido | |
| Todo medidor do nível 2 mostra limite, motivo do status e tendência | Atendido | |
| Todo número tem unidade, baseline e selo | **Parcial** | Exceção: "Career dose at Day 250" no cartão de exposição (RF-08) |
| Limites oficiais com o ID NASA; os demais "Provisional threshold" | Atendido | As faixas clínicas dizem "Terrestrial clinical range" |
| Com o LLM fora do ar, o app continua completo com textos de reserva | Atendido | Testado com `fetch` simulado (`rf18to27.test.ts`): sem chave, erro de rede ou resposta reprovada, devolve null e o cliente mostra o texto de reserva. Falta repetir com a chave real |
| A chave de API não aparece em nenhum arquivo do cliente | Atendido | Não há chave nem `import.meta.env` no cliente |
| DONKI mostra `LIVE` ou `SAMPLE`, nunca erro na tela | Atendido | |
| Teclado: Tab, setas, Enter e Esc navegam por todos os níveis | **Parcial** | Tab, Enter e Esc verificados do nível 1 ao 2 e de volta; nenhuma seta está implementada |
| Teste humano: alguém de fora aponta quem precisa de atenção em ≤ 10 s | Pendente | Não feito |

## 7. Outros requisitos da especificação (sem número de RF)

| Requisito | Situação | Observação |
| --- | --- | --- |
| Altura cresce até 3% com a missão | Atendido | `estimatedHeight`; escala do corpo e cartão de altura do esquelético |
| Proporção e composição corporal derivadas dos dados | Atendido | `physique()` e `widthScale`; é só desenho e nunca altera status |
| Modo EVA muda a dose | Atendido | `doseRate`; o fator do traje (`SUIT_SHIELD_FACTOR = 2`) é uma suposição declarada, sem fonte |
| Coração pulsa na frequência cardíaca | Atendido | `AnatomyLayers.tsx`; só aparece nas camadas internas (raio-X ou região aberta) |
| `prefers-reduced-motion` | Atendido | Animações, pulso e giro ficam parados |
| Responsivo: painel vira bottom sheet abaixo de 1024 px | Atendido | Conferido a 900×800 |
| Texto de interface em inglês, sem emojis | Atendido | |
| Fallback sem WebGL (silhueta SVG) | Não atendido | Ver RF-20 |
| Contraste AA | Não auditado | |
| Desempenho: meta de 60 fps | Não atingida na GPU integrada | 27 a 45 fps medidos em 29–30/10 (Iris Xe); não remedido depois da UI de hoje |

## 8. Entrega e pendências fora do código

| Item | Situação | Observação |
| --- | --- | --- |
| GLB do atlas e dos modelos no repositório, com atribuição | Atendido | `public/models/` (6 camadas, `suit.glb`, 4 cabeças, `ATTRIBUTION.md`) |
| Atribuição CC BY-SA no rodapé do canvas | **Não atendido** | O CLAUDE.md §10 pede no canvas e no modal; hoje só há no modal e em Sources |
| Licença do repositório | **Pendente** | Sem `LICENSE` e sem campo `license` no `package.json` (`private: true`); decidir MIT ou Apache 2.0. Pelos termos do Space Apps, sem licença indicada a NASA distribui o conteúdo original sob Apache 2.0 (R-N03) |
| README | **Pendente** | Não existe. Sugestão: como rodar, fontes, licença e a declaração de IA |
| Declaração de uso de IA na submissão | **Pendente, obrigatória** | O FAQ do Space Apps exige "a description of how SI tools were used during the development" (SI é o termo oficial para IA em 2026; R-N04). Inclui o uso de assistente de IA na escrita do código e a nota do Rocketbox (texturas de referência misturadas de fotos de pessoas, CLAUDE.md §0) |
| Licenças de terceiros e citação de todas as fontes | Pendente | Os termos exigem identificar a licença de cada material de terceiros e citar toda fonte, "even if it is open source" (R-N02, R-N05) |
| Código escrito antes de 14/11 pode ser submetido? | **Risco alto** | O FAQ oficial diz que as equipes "are not allowed to begin working on the challenges prior to the hackathon" (R-N01), e o primeiro commit é de 28/10. Perguntar à organização agora, com o histórico do git, e guardar a resposta |
| Demo: vídeo de até 30 s ou até 7 slides, link público sem login | Pendente | Designar quem grava (spec: a partir do meio-dia de domingo); roteiro sugerido em `ORBITALIS — Análise de UI e UX.md` |
| Resources oficiais (13/11) | Pendente | Classificar cada um (previsto, substituto ou novo) e ver se há dado fisiológico real que encolha a parte sintética |

## 9. Ordem sugerida (minha sugestão)

A spec recomenda acabamento impecável nos RF-01 a RF-15 antes de qualquer adição. Eles estão atendidos, então o que sobra é escolher onde o tempo rende mais:

1. **Pendências baratas fora dos RFs:** rodapé de atribuição no canvas, `LICENSE` e `README`, `ErrorBoundary` em volta do `<Stage>` (fecha RF-20). São de risco baixo e quase todas protegem a submissão.
2. **RF-32:** corrigir os 3 campos de instrumento e mostrar o aparelho na lista de pendentes e nos medidores. Poucas horas, e responde direto a "quais medições podem ser feitas no espaço".
3. **RF-33 e o motor de emergência por regras**, antes de qualquer IA: é o que funciona em blackout, o uso principal do RF-29. A IA (RF-18) entra depois, como camada opcional. Antes de começar, decida a regra 3 (diagnóstico) e valide o catálogo com um médico ou flight surgeon.
4. **RF-31 (perfil da missão) e RF-28:** primeiro o perfil; depois estação espacial e espaço sideral, que são baratos; base lunar só se houver fonte para os parâmetros; foguete como fase de lançamento ou fora.
5. **RF-30 (formulário mínimo):** se sobrar tempo; é o primeiro a cortar se RF-29 e RF-28 entrarem.
6. **Opcionais:** RF-23 é o mais barato (sequência a partir do diário); RF-26 e RF-24 são os primeiros a cair, pela ordem de corte da spec.
