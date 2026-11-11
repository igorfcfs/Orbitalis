# ORBITALIS — Viabilidade e riscos

Última avaliação: 2026-11-06T14:20:00-03:00 · HEAD `5953700` + 0 arquivos modificados ou novos · modo rápido
Capacidade da equipe: não informada (edite esta linha: pessoas × horas por dia até o evento)
Evento: 14 de novembro de 2026 (faltam 12 dias)

Mantido pela skill `orbitalis-viability` (`/orbitalis-viability`): compara o projeto atual com o esperado (CLAUDE.md, spec e enunciado da NASA), diz se o esperado ainda é alcançável e lista o que pode dar problema segundo as diretrizes da NASA. Os fatos da NASA citados aqui estão conferidos em `ORBITALIS — Diretrizes NASA (verificadas).md`; o detalhe dos requisitos está em `ORBITALIS — Status dos Requisitos.md`. Os tamanhos de esforço (S, M, L) são estimativas da skill a partir do código, não da equipe: S = até meio dia, M = 1 a 2 dias, L = 3 dias ou mais (contados como 0,5, 1,5 e 3,5 dias-pessoa).

## 1. Veredito

| Dimensão | Veredito | Por quê |
| --- | --- | --- |
| Técnica | **Viável com cortes** (provisório: capacidade não informada) | Os 15 requisitos obrigatórios estão atendidos, o typecheck está limpo, e os 180 testes passam. RF-18, RF-20 e RF-23 a RF-27 entraram em 02/11, e o dono aprovou e fez entrar RF-28 (catálogo de emergência, antes numerado 33) e RF-29 (emergência por regras). O que falta é a entrega (≈ 5,5 dias-pessoa) e os propostos restantes RF-29 (a parte de IA), RF-30, RF-31, RF-32, RF-33 e RF-34 (incluído em 04/11) (≈ 14 dias-pessoa, ou 10,5 sem o cenário foguete). Para 12 dias corridos isso só cabe com mais de uma pessoa ou com cortes |
| Conformidade | **Em risco** | Dois riscos de severidade alta abertos: R-N01 (o FAQ do Space Apps proíbe começar a trabalhar nos desafios antes do hackathon; o primeiro commit é de 28/10) e R-N04 (a submissão exige a descrição do uso de SI). R-N04 se resolve em meio dia; R-N01 só a organização do evento resolve |

## 2. Esperado × atual

Desde 31/10: RF-18 e RF-23 a RF-27 saíram de "não atendido" para atendido (com as ressalvas do documento de status).

| Item | Situação |
| --- | --- |
| Obrigatórios (RF-01 a RF-15) | 15 de 15 atendidos |
| Fortes (RF-16 a RF-22) | 7 de 7 atendidos |
| Opcionais (RF-23 a RF-27) | 5 de 5 |
| Propostos (RF-28 a RF-34) | 3 de 7 atendidos (RF-28, RF-32, RF-33), 1 parcial (RF-29 sem a parte de IA); RF-34 incluído em 04/11, não iniciado |
| Critérios de aceite (CLAUDE.md §15) | 11 atendidos, 3 parciais (atribuição no canvas, número sem selo, setas do teclado), 1 pendente (teste dos 10 segundos) |
| Qualidade | Typecheck limpo; build ok; 158 de 158 testes em 13 arquivos (sem a chamada real ao modelo de IA nem a câmera real); feed do DONKI ao vivo (HTTP 200, 15 flares) |
| Interface (captura de 31/10) | Nível 1 sem rolagem (702/702) e 8 sistemas na lista |
| Regressões | Nenhuma. Outra sessão alterou `bodyShader.ts` (4 linhas) e `AstronautRig.tsx`: typecheck, testes e a captura do corpo seguem bem |

## 3. O que falta e o que cabe

**Entrega e conformidade** (vem antes do escopo, porque trava a submissão):

| Item | Tamanho | Depende de | Riscos |
| --- | --- | --- | --- |
| Perguntar à organização sobre o trabalho prévio e as licenças CC | S | decisão do dono | R-N01, R-N02 |
| `LICENSE` e `README` (como rodar, fontes e licenças, aviso de não afiliação à NASA) | S | decidir MIT ou Apache 2.0 | R-N03, R-N05, R-N13 |
| Texto da descrição do uso de SI | S | | R-N04 |
| Rodapé de atribuição CC BY-SA no canvas | S | | R-P01 |
| Declarações na interface: dose como aproximação, redação de [V1 4020], dados sintéticos | S | | R-N08, R-N09, R-N11 |
| ~~RF-32: corrigir `vo2`, `strength` e `acuity` e mostrar o aparelho nos pendentes e nos medidores~~ | S | | entregue em 06/11 (`165a18d`) |
| Hospedar as fontes tipográficas em vez do Google Fonts | S | | R-P05, R-N05 |
| Vídeo de 30 s (roteiro, captura, sem música com direitos) | M | app estável | R-N06 |

Total de entrega: 8 S + 1 M ≈ 5,5 dias-pessoa.

**Propostos que sobraram**, em ordem de número. O RF-28 e o RF-29 já foram aprovados e entregues em 02/11 (restam a validação do RF-28 e o que ficou de fora do RF-29); RF-30 a RF-34 só entram quando o dono os aprovar:

| Item | Tamanho | Depende de |
| --- | --- | --- |
| Validação das ações de emergência (RF-28) por um flight surgeon ou médico e leitura do texto integral das quatro diretrizes e do manual da ISS | M | pessoa externa à equipe de código |
| RF-29, o que ficou de fora: texto de IA na emergência (sem nomear causa), ficha clínica sintética, registro de sintomas (sem número desde 04/11; o RF-34 passou a ser a personalização epigenética) e o cenário por sobreposição | M | RF-18 já pronto; decisão do dono |
| RF-30 CRUD de tripulantes mínimo | M | |
| RF-31 perfil da missão (`MissionProfile`) | M | |
| RF-34 personalização por exames epigenéticos (perfil sintético, notas de contexto no nível 3 e no pacote, testes de invariância do motor) | M | estudos do OSDR com dado epigenético a confirmar; decisões do dono (seção 6); R-N17 |

Total dos propostos que sobraram ≈ 9 dias-pessoa (o RF-33 foi entregue em 06/11). **Ordem de corte sugerida:** RF-34 e RF-30, depois RF-31. O RF-34 não mexe no motor, mas é o de maior risco de conformidade entre os opcionais (R-N17). O que sobrou do RF-29 reaproveita a camada do RF-18, já pronta, e o motor por regras do RF-28 e RF-29 já existe. Da spec, o que nunca cai: motor determinístico, selos, IDs de requisito, ação por tela e modo autônomo.

## 4. Riscos segundo as diretrizes da NASA

Os riscos marcados "condicional" só existem se o requisito proposto correspondente for implementado. R-N17 foi acrescentado em 04/11 por causa do RF-34, sem reavaliar as demais fontes da NASA.

| ID | Severidade | Diretriz (verificada em) | O que pode dar problema no ORBITALIS | Evidência | Mitigação | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-N01 | **Alta** | FAQ do Space Apps (texto integral, 31/10/2026): "Teams are not allowed to begin working on the challenges prior to the hackathon." | O projeto foi construído antes de 14/11 e pode ser considerado inelegível, ou ter o trabalho prévio descartado. Não sei como a organização aplica a regra nem se uma base genérica conta | `git log`: primeiro commit em 28/10/2026 às 20h17, "Protótipo navegável com corpo 3D do Z-Anatomy e os 15 requisitos"; 14 commits até 30/10; enunciados publicados em 28/10; CLAUDE.md §16 já trata o protótipo como maquete | Perguntar agora à organização (Contact Us ou Local Lead) com o histórico do git; decidir entre autorização por escrito, declarar o trabalho prévio ou refazer o que for vedado; guardar a resposta | Aberto |
| R-N02 | Média | Termos do Space Apps, materiais de terceiros (texto integral, 31/10/2026) | Materiais de terceiros devem ser "freely and publicly available without restriction or, at a minimum, ... licensed as open source as defined by the OSI", e sem a documentação de licenças a NASA "will not accept or post" a Solução. CC BY e CC BY-SA não são licenças da OSI e impõem condições. Impacto alto, probabilidade baixa e dependente de interpretação | `public/models/ATTRIBUTION.md` (CC BY-SA, Apache, MIT) e `public/assets/ATTRIBUTION.md` (CC BY, CC0, domínio público) | Perguntar junto com R-N01; listar todas as licenças na submissão; plano B: trocar as texturas CC BY (Marte, Via Láctea) por imagens da NASA, que ficam fora da exigência (a regra fala em materiais "non-NASA"). O corpo (Z-Anatomy) não tem troca barata | Aberto |
| R-N03 | Baixa | Termos do Space Apps, propriedade intelectual (texto integral, 31/10/2026) | Sem licença indicada, a NASA distribui o conteúdo original sob Apache 2.0; a spec pede decidir MIT ou Apache 2.0 | Sem `LICENSE`, sem campo `license` no `package.json`, sem `README` (`gather-evidence.mjs`, `repo`) | Adicionar `LICENSE` e uma tabela de licenças por componente no README (o corpo derivado do Z-Anatomy continua CC BY-SA 4.0) | Aberto |
| R-N04 | **Alta** | FAQ do Space Apps (texto integral, 31/10/2026): "Each team's project submission must include a description of how SI tools were used" | Falta a descrição obrigatória do uso de SI (IA) no desenvolvimento | Nenhum documento a descreve; o desenvolvimento usa assistente de IA (`CLAUDE.md`, `AGENTS.md`, `.claude/skills`) | Escrever o texto (onde e como: código, análises, docs, skills), usar "SI (Super Intelligence)" junto de "AI", e pôr no README e no formulário | Aberto |
| R-N05 | Média | Termos do Space Apps, citação (texto integral, 31/10/2026): citar "every source", "even if it is open source" | Quem não cita as fontes pode perder indicações, prêmios ou o status de vencedor | Sources lista 9 fontes e 5 calibrações; faltam bibliotecas (three, React, r3f, drei, zustand, Vite), fontes tipográficas, o decodificador Draco e, se entrar, a bibliografia do catálogo de emergência | Uma lista única de fontes e licenças no README e no campo de referências do formulário | Aberto |
| R-N06 | Média | Termos do Space Apps, vídeo (texto integral, 31/10/2026) | O vídeo deve ser obra original, sem direitos de terceiros, e quem aparece consente por escrito o uso do nome e da imagem pela NASA | O vídeo ainda não existe (spec: 30 s, sem narração) | Só capturas do próprio app; áudio original ou nenhum; sem música ou imagens de banco com direitos; sem rosto de membros da equipe sem consentimento | Aberto |
| R-N07 | Baixa | Termos do Space Apps, conteúdo proibido (texto integral, 31/10/2026) | Informação de identificação pessoal e imagens de menores de 18 anos não podem entrar. Só importa se RF-29 e RF-30 criarem campos de texto livre | Tripulação fictícia (CLAUDE.md regra 11); hoje não há campo livre de dados pessoais | Campos fechados, aviso "fictional" nos formulários, nenhum dado real | Aberto (condicional) |
| R-N08 | Média | NASA-STD-3001 Vol. 1 [V1 4030] §4.8.2 (texto integral, 31/10/2026) | O limite é de dose **efetiva** calculada com o modelo "NASA Q"; o ORBITALIS soma uma taxa medida por detector e a compara com os 600 mSv, e o motivo do status diz "violates the requirement". Um avaliador que conheça a norma percebe a troca de grandeza (Validade) | `src/lib/model.ts` (`CRUISE_DOSE_RATE`, `careerAtArrival`), `src/engine/status.ts`, tela "Career limit [V1 4030]" | Declarar na tela e em Sources que é uma aproximação, trocar "violates the requirement" por uma frase de projeção para dose, e conferir a grandeza do RAD | Aberto |
| R-N09 | Baixa | [V1 4020] §4.5.2 (texto integral, 31/10/2026): "Programs shall provide..." | A norma obriga o programa a fornecer 100% das necessidades; o app a usa como piso da ingestão registrada pela tripulante e diz que ela "viola o requisito" | `src/data/rules.ts` (`energy`), motivo do status | Reescrever como meta de fornecimento ("below the 100% provisioning target of [V1 4020]") e explicar em "About this number" | Aberto |
| R-N10 | Baixa | [V1 4017] §4.4.3 e [V1 4011] §4.3.1 (texto integral, 31/10/2026) | A norma não dá limiar numérico para imunologia nem para cognição. Os limites do app são do projeto; deixá-los parecer da NASA enfraqueceria a regra 7 | `src/data/rules.ts` (`critRange`, limiares provisórios); os rótulos já dizem "Provisional" | Citar [V1 4017] e [V1 4011] como requisito governante em "About this number", mantendo "Provisional" | Aberto |
| R-N11 | Média | [V1 7001] §7.1, [V1 7002], [V1 7003] §7.3 (texto integral, 31/10/2026) | Os registros de saúde devem ficar em formato permanente e protegido. O app guarda tudo em `localStorage` sem proteção, "Clear saved data" apaga, e o pacote é texto puro. Cresce com o histórico clínico do RF-29 | `src/state/store.ts` (`save`, `resetData`), `PacketPanel` em `src/ui/panels.tsx` | Declarar em Sources e no README: dados sintéticos, e uma implantação real exigiria [V1 7001] a [V1 7003]; oferecer exportação completa do registro | Aberto |
| R-N12 | **Alta** | [V1 3000] §3.1 e [V1 3004] §3.5 (texto integral, 31/10/2026) | O cuidado médico em missão é gerido pela Flight Medicine (flight surgeon, CMO), e a autonomia é uma capacidade a ser provida sob esse gerenciamento. Instruções de emergência ou uma "previsão do que aconteceu" feitas por IA, sem validação clínica, enfraquecem a Validade e contradizem a regra 3 | RF-28 e RF-29 entregues em 02/11 por regras em código (a regra 3 vale: a tela dá categoria de protocolo, nunca causa, e não há texto de IA na emergência); as 11 ações `EMG-` ainda sem validação clínica e com fontes conferidas só pelo resumo; o enunciado pede "guidance on treatments" e "diagnosis" | Rotular como apoio à decisão, validar o catálogo com médico ou flight surgeon antes da demo, deixar medicamentos de fora ([V1 3004 m], cumprido) e confirmar a regra 3 com o dono (adotada por padrão em 02/11) | Aberto: o risco agora é real, porque a emergência existe na interface |
| R-N13 | Baixa | Diretrizes de mídia da NASA (texto integral, 31/10/2026) | Insígnia, logotipo e identificadores da NASA não são de domínio público, e o uso não pode sugerir endosso | Nenhum logotipo da NASA no app (insígnia removida do Z-2); porém nenhum aviso de não afiliação em `src`, `public/*.md` ou `index.html` | Uma linha em Credits, Sources e README ("not affiliated with or endorsed by NASA"); sem logotipos da NASA no vídeo e nos slides | Aberto |
| R-N14 | Média (condicional) | Diretrizes de mídia da NASA, seção sobre SI (texto integral, 31/10/2026) | A informação que passou por um modelo de linguagem não pode ser atribuída diretamente à NASA, a insígnia não pode aparecer com imagens geradas por SI, e a NASA "strongly encourages" marcar o que é gerado por SI | Ainda não há LLM; as explicações de reserva são fixas e citam os IDs a partir do código | Texto de IA leva a marca "SI-generated"; nenhum texto de IA diz "NASA says"; as citações de requisito continuam vindo do código | Aberto (condicional) |
| R-N15 | Baixa (condicional) | [V1 3007] e [V1 3008] §3.6, §3.7 (só li o início) | Evacuação médica é requisito de programa. O cenário de cruzeiro a Marte não tem evacuação; o fluxo de emergência e o RF-33 precisam dizer isso por cenário | RF-33 e RF-29 propostos | Levar a disponibilidade de evacuação no `MissionProfile`; reler o texto completo antes de citar | Aberto (condicional) |
| R-N17 | Média (condicional) | Termos do Space Apps, conteúdo proibido (texto integral, 31/10/2026); CLAUDE.md §13 (LSDA e Standard Measures fora por exigirem IRB) e regras 1 a 3 | Perfil epigenético é dado genético e de saúde sensível: se vier de dado real de astronauta, viola IRB e o acordo de uso; se for sintético mas parecer real, confunde o avaliador. Além disso, não conheço limiar publicado que ligue um marcador epigenético a um status, então qualquer uso para decidir seria suposição sem fonte (Validade) e quebraria a regra 1. Não verifiquei quais estudos do OSDR têm dado epigenético | RF-34 incluído em 04/11, ainda sem código; o RF-26 só mostra estudos públicos como contexto | Perfil 100% sintético e rotulado "synthetic epigenetic profile"; só escolhe e ordena notas de contexto de uma lista fechada, com ID de estudo do OSDR; teste de invariância do motor; nenhum exame epigenético na fila (não há aparelho permitido); confirmar os estudos antes de citar | Aberto (condicional) |
| R-N16 | Baixa | NASA-STD-3001 Vol. 2 (não verificado) | As afirmações de interface (forma e palavra no status, contraste, tamanho de texto) não foram comparadas com o Volume 2 | Contraste AA não auditado | Ler as seções de exibição no próximo modo completo; até lá, não citar o Vol. 2 | Aberto |

## 5. Outros riscos do projeto

| ID | Severidade | Origem | O que pode dar problema | Evidência | Mitigação | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-P01 | Média | CLAUDE.md §10 e licença CC BY-SA do Z-Anatomy | O CLAUDE.md exige a atribuição no rodapé do canvas e no modal; hoje só existe no modal Credits e em Sources | `gather-evidence.mjs`: `checks.attributionOnCanvas` vazio | Rodapé discreto no canvas | Aberto |
| R-P02 | Média | RF-20 e CLAUDE.md §15 | Sem `ErrorBoundary` nem detecção de WebGL, uma falha do contexto pode deixar a tela em branco para quem avalia em hardware fraco | `checks.errorBoundary` e `checks.webglDetection` vazios | `ErrorBoundary` em volta do `<Stage>` que preserve a lista de sistemas e o painel | Mitigado em 02/11 (`SafeStage`, `webgl.ts`, 5 testes e captura sem WebGL) |
| R-P03 | Média | Desempenho | 27 a 45 fps medidos numa GPU integrada (meta de 60, medição de 29 e 30/10, não repetida depois da UI de hoje) e 39,2 MB em `public/` (o maior: `studio_2k.hdr`, 6,3 MB; `muscles.glb`, 5,9 MB) | `repo.publicMB`, `repo.largestPublic` | Remedir; manter as camadas sob demanda; avaliar um modo de qualidade reduzida | Aberto |
| R-P04 | Média | Feed ao vivo | A rota `/api/space-weather` é um middleware do Vite (dev e preview); numa hospedagem estática o selo seria sempre `SAMPLE` | `vite.config.ts`; hoje o feed responde (HTTP 200, 15 flares) | Função de servidor equivalente se o app for hospedado, ou declarar a limitação | Aberto |
| R-P05 | Baixa | Regra 10 e modo autônomo | As fontes tipográficas vêm do Google Fonts; sem rede, o app cai para a fonte do sistema, e cada acesso chama um terceiro | `index.html` linhas 8 a 10 | Hospedar Space Grotesk e JetBrains Mono (OFL) em `public/` | Aberto |
| R-P06 | Média | Processo | 32 arquivos modificados ou novos sem commit (inclui docs e skills), desde 30/10 às 17h39; a memória do projeto registra dois incidentes de perda por edição em lote | `git status` | Rodar `/atomic-commits` (o `AGENTS.md` fica de fora) | Aberto |
| R-P07 | Média | Planejamento | A capacidade da equipe é desconhecida; o veredito técnico é provisório | Linha `Capacidade da equipe` deste documento | Preencher a linha | Aberto |
| R-P09 | Média | RF-18, RF-26 e CLAUDE.md §2 (regra 10) | As rotas `/api/explain` e `/api/osdr` são middlewares do Vite, como a do DONKI (R-P04): numa hospedagem estática a IA nunca atua e o OSDR cai sempre para SAMPLE. A IA nunca rodou contra o modelo real, e o uso de IA precisa ser declarado na submissão (R-N04) | `vite.config.ts`; `rf18to27.test.ts` usa `fetch` simulado | Testar uma vez com a chave real; função de servidor equivalente se hospedar, ou declarar a limitação; incluir a IA na descrição do uso de SI | Aberto |
| R-P10 | Baixa | RF-24 | A câmera foi validada só com sinal sintético; em hardware real o pulso pode falhar (luz, lente, movimento). Falha mostra mensagem e a entrada manual continua | `lib/ppg.ts`, `ui/CameraCheck.tsx` | Testar num celular e num notebook antes de mostrar no vídeo; não depender da câmera na demo | Aberto |
| R-P08 | Baixa | Documentação | O CLAUDE.md cita `TrackballControls` (§10), que não existe mais (a câmera usa `FreeOrbit`), e `responseSchema` e `allowedActions` (§8), que descrevem a IA ainda não implementada. A skill não edita o CLAUDE.md | `docDrift.unresolved` | O dono corrige o CLAUDE.md | Aberto |

## 6. Decisões em aberto

1. **Trabalho antes do hackathon e licenças CC** (R-N01, R-N02): perguntar à organização. Quem decide: o dono do produto. Destrava a decisão de escopo inteira.
2. **A regra 3 vale na emergência?** (diagnóstico × assessment; R-N12). Quem decide: o dono. Adotei por padrão que **vale** (categoria de protocolo, nunca causa) ao implementar RF-28 e RF-29; confirme ou mande reverter.
3. **Capacidade da equipe** (R-P07). Quem decide: o dono. Destrava o veredito técnico.
4. **Aprovar ou recusar RF-30 a RF-34** (RF-28 e RF-29 foram aprovados e entregues em 02/11). O número RF-34 que eu havia sugerido para o registro de sintomas ficou com a sua personalização epigenética (04/11); o registro de sintomas segue sem número. Em 02/11 os números 28 e 33 foram trocados: o catálogo de emergência, pré-requisito do RF-29, passou a RF-28, e a adaptabilidade em 4 cenários passou a RF-33.
5. **Foguete é a fase de lançamento?** (RF-33, entregue em 06/11). Decidido pelo dono em 06/11: o foguete é a cápsula na plataforma, com a tripulação sentada e presa; o espaço sideral é a EVA da estação, não um lugar à parte; a base lunar é um cenário próprio em terra firme. Fica em aberto se a fase de subida deve ter indicadores próprios.
6. **Licença do projeto**: MIT ou Apache 2.0 (R-N03).
7. **RF-34, escopo da personalização** (R-N17). Quem decide: o dono. Adotei por padrão que o perfil só escolhe e ordena notas de contexto (nunca status, limiar, projeção nem ação), que o exame é pré-voo e sintético, e que a prioridade é a de corte. Confirme, ou diga se a personalização pode reordenar a fila de medições (eu recomendo que não). Detalhes no documento de status.

## 7. Histórico

| Data | HEAD | Modo | Técnica | Conformidade | Obrigatórios | Testes | Riscos abertos (A/M/B) | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 06/11/2026 | `5953700` | rápido | Viável com cortes (provisório) | Em risco | 15 de 15 | 158 de 158 | 3 / 12 / 9 | RF-32 entregue; botão Emergency em todas as telas (RF-29). Tudo commitado. Menu e fluxo de emergência não abertos no navegador. Fontes da NASA não reverificadas (nada na área sensível mudou) |
| 02/11/2026 | `fc22393` (+19) | rápido | Viável com cortes (provisório) | Em risco | 15 de 15 | 154 de 154 | 3 / 12 / 9 | RF-28 (catálogo de emergência) e RF-29 (emergência por regras, sem texto de IA) entregues; números 28 e 33 trocados. As ações de emergência não foram validadas por médico. Fontes da NASA não reverificadas |
| 02/11/2026 | `38f66ff` (+21) | rápido | Viável com cortes (provisório) | Em risco | 15 de 15 | 139 de 139 | 3 / 12 / 9 | RF-18 e RF-23 a RF-27 entregues. Fontes da NASA não reverificadas (só `vite.config.ts` mudou na área sensível, e o OSDR responde ao vivo) |
| 31/10/2026 | `c600f8f` (+32) | completo | Viável com cortes (provisório) | Em risco | 15 de 15 | 112 de 112 | 3 / 12 / 9 | Primeira avaliação. Fontes da NASA verificadas em texto integral |
