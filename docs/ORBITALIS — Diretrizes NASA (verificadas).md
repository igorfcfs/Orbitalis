# ORBITALIS — Diretrizes da NASA (verificadas)

Base de fatos mantida pela skill `orbitalis-viability`. Cada item diz de onde veio, quando foi conferido e como. **Texto integral**: li o texto da fonte primária. **Resumo**: só vi um resumo de terceiros. **Não verificado**: não consegui abrir. Para reconferir, veja `.claude/skills/orbitalis-viability/references/nasa-sources.md`.

Última verificação: 31 de outubro de 2026. Trechos entre aspas têm no máximo ~25 palavras; o resto é paráfrase minha.

## 1. O desafio (NASA Space Apps 2026)

"Create Health Monitoring Software for Astronauts on Space Missions". O texto abaixo foi colado pelo dono do produto em 30/10/2026 (**não** abri a página oficial do desafio). A comparação item a item com o ORBITALIS está em `ORBITALIS — Análise de UI e UX.md`, seção 2.

<details>
<summary>Enunciado completo</summary>

> Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, and a hostile closed environment, which can bring immune changes, bone loss, cardiovascular events, and behavioral health problems. On long missions, astronauts carry much of the responsibility for spotting these changes in themselves. Your challenge is to build a health monitoring software that gathers health indicators and enables astronauts to evaluate and act on the status of their health.
>
> **Background.** With rising investment in spacecraft technology and research, space missions have become more ambitious. NASA's Artemis program recently accomplished a crewed lunar flyby, and NASA and others have plans to send humans to Mars in the future. With increasingly longer missions, astronauts will be more exposed to the hostile space environment, which brings both physical and mental health risks.
>
> NASA's Human Research Program has mapped the five hazards of human spaceflight, which are space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments. These hazards can contribute to health problems such as immune system changes, bone density loss, cardiovascular events, inadequate nutrition, behavioral health conditions, and others. Astronauts must be capable of making health assessments on themselves during a mission, to prevent and treat health problems that may arise. Some useful health indicators are blood pressure, heart rate, blood sugar, body temperature, daily sleep hours, and mood.
>
> **Objectives.** Your challenge is to create a visual tool that helps astronauts assess their own health during space missions and provides guidance on treatments and health improvements. You may consider gathering data from the user through any kind of input—keyboard text, mouse clicks, or camera images, for example. Any kind of data can be used, as long as it represents a health indicator, such as blood sugar levels in mg/dL or ultrasound images.
>
> You can use NASA's Human Research Program resources, along with the publicly available resources from other space agencies, to understand how spaceflight hazards affect human health, and to decide which indicators are useful and how they can support a quick assessment. Which measurements can be performed in space? Why is an exam needed? How do spaceflight hazards affect these health indicators? When might a result warrant attention from the crew or from flight surgeons on the ground? What actions can be taken to prevent a critical health condition? These are questions worth considering as you develop your solution.
>
> User interface design plays an important role in presenting metrics and diagnosis clearly. You may consider taking advantage of animations and interactivity to present the information. For example, the software could display a human figure where each part of the body is clickable and displays information about its function and health status.
>
> **Potential Considerations.** You may (but are not required to) consider the following: Your tool could provide health insights for astronauts in different environments, such as a spacecraft, a space station, a rover, or a base on another planet or moon. Your tool could prompt astronauts to take measurements or complete specific actions from time to time as a part of the mission routine. Your tool could include the following features: a gamification system to help astronauts engage with tasks that support their health; dynamic charts that show how astronaut's health indicators change over time; color coding that helps the astronaut interpret the status of a health indicator at a glance. Do not assume that astronauts know everything about how to assess their health. Your tool could provide simple instructions and explanations covering measurements, health indicators, and risks.

</details>

Duas observações para a decisão do RF-29: o enunciado fala em "guidance on treatments" e em "presenting metrics and **diagnosis** clearly", enquanto a regra 3 do CLAUDE.md proíbe diagnóstico pela IA. O projeto responde com "assessment" e ações de contramedida do catálogo; vale justificar isso na submissão com [V1 3000] (seção 2).

## 2. NASA-STD-3001, Volume 1 (Crew Health), Revisão C

Fonte: `https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf`. Capa: "NASA-STD-3001, Volume 1, Revision C", **aprovada em 2023-09-15**, Office of the Chief Health and Medical Officer, substitui a Rev. B. **Texto integral** conferido em 31/10/2026 (PDF baixado e extraído com `pdftotext`; o `WebFetch` não lê esse PDF).

| ID | Seção | O que exige | Uso no ORBITALIS | Situação |
| --- | --- | --- | --- | --- |
| [V1 4003] | 4.1.3 | A capacidade aeróbica em missão "shall be maintained ... at or above 80% of the pre-mission capacity", por medida direta ou indireta | `vo2`, ≥ 80% | Confere |
| [V1 4020] | 4.5.2 | "Programs shall provide each crewmember with 100% of their calculated nutrient and energy requirements" (idade, sexo, massa, altura, atividade) | `energy`, 100% | **Atenção:** o sujeito é o programa; o app usa como piso da ingestão registrada (R-N09) |
| [V1 4024] | 4.6.2 | "Countermeasures shall maintain in-mission skeletal muscle strength at or above 80% of baseline values" | `strength`, ≥ 80% | Confere |
| [V1 4027] | 4.7.2 | Contramedidas mantêm a densidade óssea do quadril e da coluna "at or above 95% of pre-mission values" e a do colo do fêmur em 90% ou mais | `bmd` ≥ 95%, `fn` ≥ 90% | Confere |
| [V1 4030] | 4.8.2 | A "total career effective radiation dose" "shall be less than 600 mSv", igual para todas as idades e sexos. Nota: a dose efetiva usa o modelo "NASA Q" e parâmetros de mulher de 35 anos | `career_dose` < 600 mSv | **Atenção:** o app soma uma taxa medida (RAD) e a compara com um limite de dose efetiva (R-N08) |
| [V1 4011] | 4.3.1 | Saúde comportamental e cognição "shall be within clinically accepted values as determined by behavioral health evaluations" | `cognition`, `mood`, `sleep` com limiares provisórios | Sem limiar numérico na norma; manter o rótulo "Provisional" e citar [V1 4011] como requisito governante |
| [V1 4014] | 4.3.4 | Limites estabelecidos para as horas planejadas de tarefas críticas, jornada, exercício e período de sono | Ações `SLP-EXT` e `BEH-LOAD` | Oportunidade de citação |
| [V1 4017] | 4.4.3 | Contramedidas e monitoramento mantêm os valores imunológicos e hematológicos "outside the critical values" (falha significativa do sistema, definida por parâmetro) | `wbc`, `lymph` | Os limites críticos do app são do projeto, não da NASA (R-N10) |
| [V1 3000] | 3.1 | O cuidado médico em missão segue os padrões médicos dos EUA e parceiros e é "managed by the Flight Medicine team", incluindo os Crew Medical Officers | Papel do flight surgeon e do CMO; fundamenta "a IA não decide" | Base para validar o catálogo de emergência (R-N12) |
| [V1 3004] | 3.5 | Programas fornecem treinamento, capacidades e recursos de cuidado médico em missão, entre eles: (h) monitorar e acompanhar a tendência de sinais vitais; (j) registrar procedimentos e desfechos; (k) restrições físicas "appropriate to specific gravity environments"; (m) administrar medicamentos; (r) e (s) comunicação e transmissão privadas; (t) "Means of providing autonomous medical care and advanced life support"; (u) evacuação | Função central do app (h); RF-27 (j); CMRS (k); RF-29 e RF-28 (t); medicamentos ficam fora (m) | Sustenta o conceito de autonomia do RF-29 |
| [V1 3007], [V1 3008] | 3.6, 3.7 | Evacuação médica para um nível de cuidado maior "shall be available"; planos e veículos para transportar tripulante gravemente doente ou ferido (**só li o início**) | RF-33: o cruzeiro a Marte não tem evacuação | Reler o texto completo antes de citar |
| [V1 6002] | 6.2.1 | Comunicações médicas privadas agendadas rotineiramente; a justificativa aceita modalidades "stored/forward" quando há atraso | Pacote "queue for next window" | Confere |
| [V1 7001] | 7.1 | Os resultados do monitoramento de saúde ficam "in a permanent retrievable format" para avaliação, com análise de tendência | Registros em `localStorage`; "Clear saved data" apaga | Atenção (R-N11) |
| [V1 7002], [V1 7003] | 7.2, 7.3 | A transmissão dos dados médicos atende às necessidades operacionais; o manuseio, o armazenamento e a transmissão dos registros "shall be secured" (contêm PII; Privacy Act de 1974) | Pacote em texto puro; `localStorage` sem proteção | Atenção (R-N11) |
| Apêndice E, Tabela E.2-2 | E.2 | Condições de alta probabilidade ou consequência. Cardiovasculares: síndrome coronariana aguda, angina e infarto, arritmias (fibrilação e flutter atriais), choque cardiogênico, intolerância ortostática na transição de gravidade, hipertensão, parada cardíaca súbita, choque hipovolêmico traumático, tromboembolismo venoso | Cenário do RF-29 (dor no peito e colapso) | Sustenta o exemplo do dono do produto |
| Apêndice E, Tabela E.2-1 | E.2 | Saída de exemplo do IMM, por probabilidade por missão: insônia tardia 13,85; dor de cabeça tardia 5,25; infecção respiratória 3,46; cefaleia por CO2 2,15; SANS 2,08 | Sono e SANS estão no escopo | Confere |

Requisitos citados pelo projeto e **confirmados** nesta verificação: [V1 4003], [V1 4020], [V1 4024], [V1 4027], [V1 4030]. O código (`src/data/systems.ts`) e a spec citam exatamente esses cinco IDs, com os limiares corretos.

## 3. Space Apps 2026: termos e FAQ

Fontes: `https://www.spaceappschallenge.org/legal/` (termos de participação, "Updated August 7, 2026") e `https://www.spaceappschallenge.org/resources/participant-faqs/`. **Texto integral** lido em 31/10/2026 com o Chrome headless: o site entrega a cadeia de certificados incompleta, e `WebFetch`, `curl`, PowerShell e Node falham com erro de certificado.

**FAQ**

- **Trabalho antes do hackathon.** As datas: resumos dos desafios em 17/9, enunciados em 28/10, recursos em 13/11. Em seguida: "Teams are not allowed to begin working on the challenges prior to the hackathon." (R-N01)
- **Uso de SI.** Pelo FAQ, de acordo com uma ordem executiva de 29/9/2026, o governo passou a dizer "Super Intelligence (SI)" no lugar de "Artificial Intelligence (AI)". Os participantes podem usar ferramentas de SI, e "Each team's project submission must include a description of how SI tools were used during the development of their project." (R-N04)
- **Equipe.** No máximo 6 pessoas; evento local aceita 1 pessoa e evento universal exige 2 ou mais.
- **Envio.** Pela página do projeto em spaceappschallenge.org. Guias: Space Apps Connect em 3/11; Envio e Julgamento e Prêmios em 13/11. A regra de marca d'água e o formato da demo (30 s ou 7 slides) **não aparecem** nas páginas que li: ficam como "não verificado" até 13/11.

**Termos**

- **Conteúdo original.** Deve ser "freely available without restriction or is licensed as open source as defined by the Open Source Initiative (OSI)". Sem licença indicada, "NASA will distribute your original content under an Apache 2.0 license". (R-N03)
- **Materiais de terceiros** (código ou dados que não vêm da NASA nem de agências parceiras): "freely and publicly available without restriction or, at a minimum, ... licensed as open source as defined by the OSI". As licenças aplicáveis "must be identified in the documentation that you submit", e "NASA will not accept or post any Solutions that do not include appropriate license documentation for your Solution Materials". (R-N02)
- **Citação.** "You must cite every source that is used in the creation of your project, even if it is open source or freely available." A NASA pode remover indicações, prêmios ou o status de vencedor de quem não citar. (R-N05)
- **Vídeo.** Deve ser obra original, sem infringir direitos de terceiros, e as pessoas que aparecem precisam consentir por escrito o uso do nome e da imagem pela NASA. (R-N06)
- **Proibido.** Informação de identificação pessoal (datas de nascimento, endereços, telefones...), e nomes, vozes ou imagens reconhecíveis de menores de 18 anos. (R-N07)
- **Exportação.** Cabe ao participante garantir que não há informação controlada por ITAR ou EAR. O ORBITALIS usa apenas padrões e dados públicos da NASA.

## 4. Diretrizes de mídia da NASA

Fonte: `https://www.nasa.gov/nasa-brand-center/images-and-media/`. **Texto integral** lido em 31/10/2026 (Chrome headless).

- "The NASA Insignia, Logotype, identifiers, and imagery are not in the public domain." O uso da insígnia, do logotipo e dos identificadores "is protected by law".
- Conteúdo da NASA, inclusive o usado na renderização de modelos 3D ("texture maps and polygon data"), "generally are not subject to copyright in the United States", e pode ser usado para fins educacionais ou informativos, inclusive em simulações gráficas e páginas web. Usos factuais, sem sugerir endosso, dispensam permissão, e "NASA should be acknowledged as the source". Uso comercial não pode sugerir o endosso da NASA. (R-N13)
- **Sobre SI.** A atribuição direta à NASA de informação que passou por um modelo de linguagem "is not permitted", porque a NASA não consegue verificar a precisão depois disso. A NASA não permite que a insígnia (Meatball, Worm ou Seal) apareça com imagens geradas por SI, e "strongly encourages" que produtos gerados por SI levem uma marcação dizendo isso. (R-N14)

## 5. Os cinco riscos do HRP

Do enunciado: radiação espacial, isolamento e confinamento, distância da Terra, campos de gravidade e ambientes hostis e fechados. O projeto os usa em `hazards` (`src/data/extras.ts`) e `HAZARD_LABEL` (`src/data/systems.ts`), com rótulos próximos aos oficiais.

## 6. Ainda não verificado

- **NASA-STD-3001 Vol. 2** (fatores humanos, habitabilidade): as afirmações de interface do projeto (forma e palavra no status, contraste, tamanho de texto) não foram comparadas com ele.
- **Guias de Envio e de Julgamento** (13/11): regra de marca d'água, formato da demo, critérios e a forma da descrição do uso de SI.
- **Calibrações do projeto** (1,8 mSv/dia do RAD; −0,8%/mês de osso; adesão ao exercício): vêm de fontes públicas citadas em `CLAUDE.md` §13, que esta base ainda não reabriu.
- **Quantidade do RAD** (dose equivalente ou dose absorvida) e a conversão para dose efetiva: relevante para R-N08.
- **Texto completo de [V1 3007] e [V1 3008]**, e o resto do Apêndice E.
