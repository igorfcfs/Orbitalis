# ORBITALIS — Catálogo de ações de emergência (rascunho)

30 de outubro de 2026 · RF-28 (pré-requisito do RF-29; numerado 33 até 02/11) · para a equipe AstroCoders

**Estado em 02/11/2026:** implementado em `src/data/actions.ts` (as 11 ações `EMG-`), `src/engine/emergency.ts` (triagem e ordem dos passos) e `src/ui/Emergency.tsx`. O texto abaixo continua sendo o rascunho de origem e **ainda não foi validado por um flight surgeon ou médico**; as fontes seguem conferidas só pelo resumo. A interface usou a lista de entradas da seção 2 mais a pergunta "O paciente desmaiou?", que a síncope exige.

> **Aviso.** Rascunho para discussão, não aconselhamento médico: o ORBITALIS é um protótipo com tripulação fictícia. Antes de aparecer como instrução numa demonstração, cada ação precisa ser validada por um flight surgeon ou médico e conferida no texto integral da fonte. Verifiquei as fontes pelo resumo e pelos dados bibliográficos; não consegui abrir o texto integral de nenhuma das quatro diretrizes citadas (acesso bloqueado), e o PDF do manual de emergência da ISS está protegido por senha.

## 1. Regras que o catálogo respeita

- **Catálogo fechado.** A IA escolhe só por ID (regra 3) e cada ação cita um protocolo publicado.
- **Sem medicamento, dose, diagnóstico nem nome de causa.** O que depende de remédio (por exemplo, o que se dá numa suspeita de infarto) fica com o CMO e o flight surgeon; o catálogo só encaminha (`CMO-CONSULT`, `EMG-GROUND`). A NASA-STD-3001 põe o cuidado médico em missão sob a Flight Medicine ([V1 3000]) e lista a administração de medicamentos entre as capacidades dos programas ([V1 3004], item m).
- **Funciona em blackout.** A categoria e a ordem das ações saem de regras em código; a IA, quando existe, só escreve o texto, e esse texto leva a marca "SI-generated" e nunca atribui à NASA o que o modelo disse (diretrizes de mídia da NASA, R-N14). O status da emergência é `◆ CRITICAL` por regra, nunca por IA.
- **Quem socorre pode não ser médico.** A literatura espera que o primeiro a responder a uma emergência em órbita não seja médico ([Beck, 2004](https://doi.org/10.1016/j.rcc.2004.04.002)); cada ação é um passo curto, em inglês simples.
- **O paciente pode ser o CMO** (RF-21): `CMO-CONSULT` vira "Consult the backup CMO".
- **Cor só para status.** O botão que abre a emergência é neutro; o vermelho só aparece quando a regra marca CRITICAL.

## 2. Entrada: o que quem socorre informa

Campos fechados, sem texto livre.

| Campo | Opções |
| --- | --- |
| Quem informa | Lista dos tripulantes |
| Responde? | Sim · Não |
| Respira normalmente? | Sim · Não · Só arfa · Não sei |
| Antes, relatou | Dor no peito · Falta de ar · Tontura · Dor de cabeça · Alteração da visão · Nada · Não sei |
| Lesão ou sangramento? | Sim · Não |
| Há quanto tempo? | Menos de 1 min · 1 a 5 min · Mais de 5 min |

## 3. Triagem por regras e ordem das ações

A categoria vem de regras em código (funciona offline). Se o quadro piorar (por exemplo, o paciente para de respirar), reclassifica para a categoria mais grave.

| Situação informada | Categoria de protocolo | Ações, em ordem | Fonte |
| --- | --- | --- | --- |
| Não responde e não respira normalmente (ou só arfa) | Parada cardiorrespiratória | `EMG-SAFE` → `EMG-HELP` → `EMG-CHECK` → `EMG-RESTRAIN` → `EMG-CPR` → `EMG-AED` → `CMO-CONSULT` → `EMG-GROUND` → `EMG-LOG` | AHA 2025 Part 7; Hinkelbein 2020 |
| Não responde, mas respira normalmente | Inconsciente, respirando | `EMG-SAFE` → `EMG-HELP` → `EMG-CHECK` → `EMG-RESTRAIN` → `EMG-MONITOR` → `EMG-STANDBY` → `CMO-CONSULT` → `EMG-GROUND` → `EMG-LOG` | AHA 2025 Part 7; Shen 2017 |
| Responde e relatou dor no peito | Dor no peito | `EMG-REST` → `EMG-MONITOR` → `EMG-STANDBY` → `CMO-CONSULT` → `EMG-GROUND` → `EMG-LOG` | Gulati 2021 |
| Voltou a responder depois de desmaiar | Síncope | `EMG-REST` → `EMG-MONITOR` → `CMO-CONSULT` → `EMG-GROUND` → `EMG-LOG` (com dor no peito antes do desmaio, entra `EMG-STANDBY` e a categoria sobe) | Shen 2017; Gulati 2021 |

A tela mostra a **categoria de protocolo** e os sinais do registro que a sustentam, sem nomear uma causa (ver RF-29 no documento de status).

## 4. Ações

Onze novas, mais duas que já existem no catálogo. O texto da interface fica em inglês.

| ID | Texto da interface | Recurso | Protocolo citado | Situação da fonte |
| --- | --- | --- | --- | --- |
| `EMG-SAFE` | Secure yourself and the patient | Alças e contenções | Hinkelbein 2020 (posição do socorrista e contenção em microgravidade) | Resumo verificado |
| `EMG-HELP` | Call the crew for help | Interfone ou alarme da tripulação | AHA 2025 Part 7 (ativação da resposta de emergência) | Resumo verificado |
| `EMG-CHECK` | Check if the patient responds and breathes normally | Nenhum | AHA 2025 Part 7 (reconhecimento da parada cardíaca) | Resumo verificado; duração do exame de respiração e pulso: conferir no texto |
| `EMG-RESTRAIN` | Restrain the patient on the medical restraint system | Crew Medical Restraint System (CMRS) | Hinkelbein 2020 (paciente contido no CMRS) | Resumo verificado |
| `EMG-CPR` | Start chest compressions | Nenhum (CMRS, se contido) | AHA 2025 Part 7 (RCP de alta qualidade); Hinkelbein 2020 (método Evetts-Russomano no suporte básico imediato; método da parada de mãos com o paciente no CMRS) | Resumo verificado; frequência, profundidade e relação compressão-ventilação: conferir no texto antes de exibir |
| `EMG-AED` | Attach the defibrillator and follow its prompts | Desfibrilador de bordo | AHA 2025 Part 7 (uso do DEA); Hinkelbein 2020 (a defibrilação em microgravidade pede cuidado próprio) | Resumo verificado |
| `EMG-MONITOR` | Monitor heart rate, blood pressure and breathing | Bio-Monitor (sensor vestível) | Gulati 2021 (dor no peito aguda) | Dado bibliográfico verificado; recomendação específica a conferir |
| `EMG-REST` | Stop all activity and keep the patient still and restrained | Contenções | Gulati 2021; Shen 2017 | Dado bibliográfico verificado; recomendação específica a conferir |
| `EMG-STANDBY` | Bring the defibrillator to the patient and keep it ready | Desfibrilador de bordo | No protocol cited | Prática geral; sem fonte |
| `EMG-GROUND` | Open a medical conference with the ground (queued if the link is down) | Link de comunicação | Manual de emergência médica da ISS (trecho de 2016, divulgado por FOIA) | **Pendente:** não consegui abrir o PDF |
| `EMG-LOG` | Record the timeline: onset, collapse, what was done and when | Registro do app | No protocol cited | Prática geral; sem fonte |
| `CMO-CONSULT` | Consult the Crew Medical Officer (backup CMO se o paciente é o CMO) | CMO ou reserva | Já no catálogo | Existente |
| `EARTH-PACKET` | Add to the flight surgeon packet (a linha do tempo entra sozinha) | Registro | Já no catálogo | Existente |

## 5. O que fica de fora de propósito

- **Medicamentos e doses**, inclusive o que se dá numa suspeita de infarto: regra 3. Ficam com o CMO e o flight surgeon.
- **Via aérea avançada** (dispositivo supraglótico, intubação): a diretriz de microgravidade a condiciona a dois socorristas, com o paciente contido, e a quem tem treino. Candidata à v2, validada pelo CMO.
- **Parâmetros numéricos de compressão e de choque**: só depois de conferir o texto da AHA 2025.
- **Nome de causa** ("infarto", "arritmia"): fica fora enquanto a regra 3 valer.

## 6. Variação por cenário (RF-33)

- **Estação espacial e espaço sideral:** microgravidade, o caso que a diretriz cobre. No espaço sideral o blackout é o caso normal.
- **Base lunar:** gravidade parcial. A evidência para RCP em hipogravidade é limitada: a revisão de escopo de [Overbeek et al. (2024)](https://doi.org/10.1016/j.resplu.2024.100762) achou 2 estudos de hipogravidade entre 26, e um simulador de [2026](https://doi.org/10.1038/s41526-026-00577-1) ainda chama a eficácia de incerta. O catálogo teria de dizer que a técnica terrestre se aplica com ressalva.
- **Foguete (cápsula):** espaço mínimo. No estudo da Polaris Dawn na cápsula Dragon, o assento externo foi o melhor local de trabalho, a tarefa teve avaliação alta de dificuldade e as compressões elevaram o CO₂ da cabine até um limite de cautela ([Menon et al., 2025](https://doi.org/10.1177/10806032251346746)). As ações e os recursos dessa cápsula ainda precisam ser levantados.

## 7. Exemplo: o caso da Aiko Sato em blackout

1. Daniel toca em "Report emergency" e escolhe Aiko Sato; em "Quem informa" aparece o nome dele.
2. Informa: não responde, só arfa, relatou dor no peito antes, há 1 a 5 minutos.
3. As regras classificam como parada cardiorrespiratória e a emergência fica `◆ CRITICAL`. Como a Aiko é o CMO, `CMO-CONSULT` vira "Consult the backup CMO".
4. A tela lista o que o registro mostra, com unidade, pré-voo e selo: sono 5,3 h (pré-voo 7,4 h, CRITICAL), frequência cardíaca 60 bpm (pré-voo 58), pressão sistólica 121 mmHg (pré-voo 118). **Nada disso aponta para o coração**: hoje a Aiko não tem precursor cardíaco nos dados, então a "análise" não teria o que mostrar (ver RF-29).
5. Cada ação da lista vira um passo com "Done", gravado no diário com carimbo de tempo e marcado `autonomous`.
6. O pacote para o flight surgeon sai montado com a linha do tempo e fica na fila para a próxima janela de contato.

## 8. Como entra no código

- Onze entradas novas em `ACTIONS` (`data/actions.ts`, 15 → 26 ações) com o prefixo `EMG-`.
- A lista permitida da emergência é separada da lista permitida por sistema; a categoria vem de uma função pura, com testes, como o motor de status.
- Testes novos: toda ação cita protocolo ou diz "No protocol cited", nenhuma cita remédio ou dose, e cada categoria devolve as ações na ordem da seção 3.

## 9. Fontes

Metadados recuperados do PubMed; os DOIs levam ao texto.

| Referência | Uso | Verificação |
| --- | --- | --- |
| NASA-STD-3001 Vol. 1 Rev. C, [V1 3000] §3.1 e [V1 3004] §3.5. [PDF](https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf) | Cuidado médico gerido pela Flight Medicine; capacidades em missão: cuidado autônomo e suporte avançado de vida, restrições físicas adequadas à gravidade, medicamentos | Texto integral (31/10/2026) |
| NASA-STD-3001 Vol. 1 Rev. C, Apêndice E, Tabela E.2-2 | Angina e infarto, arritmias e parada cardíaca súbita entre as condições de alta probabilidade ou consequência (sustenta o cenário do RF-29) | Texto integral (31/10/2026) |
| Kleinman ME et al. Part 7: Adult Basic Life Support, 2025 AHA Guidelines for CPR and ECC. Circulation 2025;152(16_suppl_2):S448–S478. [DOI](https://doi.org/10.1161/CIR.0000000000001369) | Reconhecimento, ativação, RCP, DEA | Resumo |
| Hinkelbein J et al. CPR during spaceflight: a guideline for CPR in microgravity (DGLRM e ESAM-SMG). Scand J Trauma Resusc Emerg Med 2020;28:108. [DOI](https://doi.org/10.1186/s13049-020-00793-y) | RCP em microgravidade: BLS, ALS, CMRS, via aérea, defibrilação | Resumo |
| Gulati M et al. 2021 AHA/ACC/ASE/CHEST/SAEM/SCCT/SCMR Guideline for the Evaluation and Diagnosis of Chest Pain. Circulation 2021;144(22):e368–e454. [DOI](https://doi.org/10.1161/CIR.0000000000001029) | Dor no peito | Só dados bibliográficos |
| Shen W-K et al. 2017 ACC/AHA/HRS Guideline for the Evaluation and Management of Patients With Syncope. Circulation 2017;136(5):e60–e122. [DOI](https://doi.org/10.1161/CIR.0000000000000499) | Síncope | Só dados bibliográficos |
| Beck G. Emergency airway management in orbit. Respir Care Clin N Am 2004;10(3):401–21. [DOI](https://doi.org/10.1016/j.rcc.2004.04.002) | Primeiro socorrista provavelmente não é médico | Resumo |
| Menon A et al. CPR Techniques on the Dragon Spacecraft: A Polaris Dawn Mission Study. Wilderness Environ Med 2025;36(1_suppl):53S–60S. [DOI](https://doi.org/10.1177/10806032251346746) | Cenário foguete (cápsula) | Resumo |
| Overbeek R et al. Alternative techniques for CPR in extreme environments: a scoping review. Resusc Plus 2024;20:100762. [DOI](https://doi.org/10.1016/j.resplu.2024.100762) | Evidência em hipogravidade | Resumo |
| Lord Z et al. A high-fidelity simulator for evaluation of hemodynamic response during CPR in hypogravity environments. npj Microgravity 2026;12(1). [DOI](https://doi.org/10.1038/s41526-026-00577-1) | Evidência em hipogravidade | Resumo |

**A obter:** o texto integral da AHA 2025 Part 7, de Hinkelbein 2020, de Gulati 2021 e de Shen 2017; uma versão legível do manual de emergência médica da ISS (o trecho de 2016 divulgado por FOIA em governmentattic.org está em PDF protegido); e a validação de um flight surgeon ou médico sobre cada ação.
