# Fontes da NASA e como verificá-las

Índice das fontes oficiais que o ORBITALIS precisa respeitar: o que conferir em cada uma, como abri-las neste ambiente e que parte do projeto elas tocam. Os **fatos já verificados** ficam em `docs/ORBITALIS — Diretrizes NASA (verificadas).md`; aqui fica o procedimento, para este arquivo não envelhecer.

## 1. Fontes

| Fonte | O que conferir | Como abrir |
| --- | --- | --- |
| NASA-STD-3001 Vol. 1 Rev. C (Crew Health), `https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf` | IDs `[V1 xxxx]` e limiares de `src/data/systems.ts`; cuidado médico (§3), desempenho (§4), operações (§6), registros (§7), Apêndice E | `nasa-lookup.mjs std [ID ...]`. Para outras seções, baixe o PDF para uma pasta nova e rode `pdftotext -layout` |
| NASA-STD-3001 Vol. 2 (Human Factors, Habitability, and Environmental Health) | Interface: exibição, cor, texto, controles. **Ainda não verificado** | Sistema de padrões técnicos da NASA (standards.nasa.gov); só cite depois de ler |
| Termos do Space Apps 2026, `https://www.spaceappschallenge.org/legal/` | Licenças, materiais de terceiros, citação de fontes, vídeo, PII, elegibilidade | `nasa-lookup.mjs page <url> --grep <regex>` |
| FAQ do Space Apps 2026, `https://www.spaceappschallenge.org/resources/participant-faqs/` | Trabalho antes do hackathon, uso de SI (IA), formato do envio, datas dos guias | idem |
| Guias de Envio e de Julgamento (publicados em 13/11) | Critérios, formato da demo, descrição do uso de SI, marca d'água | páginas do evento, a partir de 13/11 |
| Diretrizes de mídia da NASA, `https://www.nasa.gov/nasa-brand-center/images-and-media/` | Insígnia e logotipo, endosso, modelos 3D | `WebFetch` funciona |
| HRP (Human Research Program) | Os cinco riscos; relatórios de evidência usados nas calibrações (exercício, osso) | páginas e relatórios do HRP; ao citar número, confira no relatório |
| NASA 3D Resources (modelo Z-2) | Licença do modelo e insígnia removida | repositório `github.com/nasa/NASA-3D-Resources` |

## 2. Mapa: o que mudou → o que conferir

| Mudou… | Confira contra… |
| --- | --- |
| `src/data/rules.ts`, `src/data/systems.ts` (limiares, IDs, rótulos) | NASA-STD-3001 Vol. 1 §4: texto do requisito, a grandeza (dose efetiva × dose medida) e o sujeito (o programa ou a tripulante) |
| `src/lib/model.ts` (dose, projeção, séries) | [V1 4030] (dose efetiva de carreira, modelo da NASA) e as calibrações com fonte (CLAUDE.md §13) |
| `src/data/actions.ts`, emergência, IA | [V1 3000], [V1 3004], Apêndice E; regras 1 a 3 do CLAUDE.md; validação por flight surgeon ou CMO |
| `src/state/store.ts`, pacote, CRUD, dados clínicos | [V1 6002], [V1 7001] a [V1 7003]; regra de PII nos termos do Space Apps |
| Cenários e missão (RF-28, RF-31) | [V1 3007], [V1 3008] (evacuação); as calibrações valem só para o cenário em que foram medidas |
| `public/models`, `public/assets`, créditos, `index.html` | Termos do Space Apps (materiais de terceiros, citação); diretrizes de mídia |
| Vídeo, README, página de envio | Termos do Space Apps (vídeo original, consentimento, citação, licença, descrição do uso de SI); guias de 13/11 |
| Qualquer código escrito antes de 14/11 | FAQ do Space Apps (trabalho antes do hackathon) |

## 3. Severidade

- **Alta:** pode impedir a aceitação ou a elegibilidade da submissão, ou derrubar uma afirmação central do produto (status por regra com ID da NASA, dados sintéticos, nada de diagnóstico).
- **Média:** enfraquece uma afirmação ou um critério de julgamento (validade, relevância), mas se corrige com uma declaração ou uma mudança pequena.
- **Baixa:** polimento, declaração opcional, ou risco que só existe em uso real.

Pese impacto e probabilidade. Impacto alto com probabilidade baixa, dependente de interpretação, é **Média** com a recomendação de perguntar à organização.

## 4. Cuidados ao citar a NASA

- Cite o ID e a seção, e trechos de até ~25 palavras entre aspas; o resto, parafraseie.
- Anote a data da verificação e o modo: "texto integral", "resumo" ou "não verificado".
- Normas mudam de revisão: confira a revisão na capa (a verificada é a Rev. C, aprovada em 2023-09-15).
- O que a norma exige do **programa** não é, sem mais, exigência sobre a **tripulante** (exemplo: [V1 4020] manda o programa fornecer 100% das necessidades).
- Termo oficial: nas páginas do Space Apps de 2026, "IA" aparece como "Super Intelligence (SI)". No texto da submissão, use o termo oficial junto do nosso.
- Requisito sem número (exemplo: [V1 4011], cognição "dentro de valores clinicamente aceitos") não vira limiar da NASA: o limiar numérico do projeto continua "Provisional".
