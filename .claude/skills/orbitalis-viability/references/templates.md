# Modelos dos documentos

## `docs/ORBITALIS — Viabilidade e Riscos.md`

As três primeiras linhas depois do título são lidas pelo script (`gather-evidence.mjs`); mantenha o formato.

```markdown
# ORBITALIS — Viabilidade e riscos

Última avaliação: 2026-10-31T14:05:00-03:00 · HEAD `c600f8f` + 26 arquivos modificados · modo completo
Capacidade da equipe: não informada
Evento: 14 de novembro de 2026 (faltam 14 dias)

## 1. Veredito
| Dimensão | Veredito | Por quê |
| --- | --- | --- |
| Técnica | Viável com cortes | … |
| Conformidade | Em risco | … (cite os IDs `R-N##`) |

## 2. Esperado × atual
Contagens por grupo (obrigatórios, fortes, opcionais, propostos), com a variação desde a última avaliação,
testes e typecheck, e regressões. Remeta ao documento de status para o detalhe, sem repeti-lo.

## 3. O que falta e o que cabe
| Item | Tamanho | Depende de | Caminho crítico? |
| --- | --- | --- | --- |
Totais: esforço de cada lista (obrigatório, entrega, proposto) contra os dias que restam. Cortes sugeridos na ordem da spec.
Diga que os tamanhos são estimativas da skill.

## 4. Riscos segundo as diretrizes da NASA
| ID | Severidade | Diretriz (verificada em) | O que pode dar problema no ORBITALIS | Evidência | Mitigação | Estado |
| --- | --- | --- | --- | --- | --- | --- |

## 5. Outros riscos do projeto
Mesma tabela, com IDs `R-P##` e a coluna "Diretriz" trocada por "Origem" (licença de ativo, desempenho, processo...).

## 6. Decisões em aberto
Lista numerada, cada uma com quem decide e o que ela destrava.

## 7. Histórico
| Data | HEAD | Modo | Técnica | Conformidade | Obrigatórios | Testes | Riscos abertos (A/M/B) | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

## Linha de risco

- **ID:** `R-N01`, `R-N02`… (NASA e regras do Space Apps) ou `R-P01`… (projeto). Nunca renumere.
- **Diretriz:** ID e seção, com a data e o modo da verificação: `[V1 4030] §4.8.2 (texto integral, 2026-10-31)`.
- **Evidência:** `arquivo:linha` ou o documento, nunca "parece que".
- **Estado:** Aberto · Em andamento · Mitigado · Aceito (com quem aceitou e quando).

Exemplo:

```markdown
| R-N08 | Média | [V1 4030] §4.8.2 (texto integral, 2026-10-31) | O limite é de dose **efetiva** calculada com o modelo da NASA; o ORBITALIS soma uma taxa medida (RAD) e a compara com os 600 mSv | `src/lib/model.ts` (`CRUISE_DOSE_RATE`, `careerAtArrival`) | Declarar na tela e em Sources que é uma aproximação; evitar "violates the requirement" para dose | Aberto |
```

## Resposta no chat (modelo, ~25 linhas)

```markdown
**Veredito (31/10, faltam 14 dias).** Técnica: viável com cortes. Conformidade: em risco.

**O que mudou desde 30/10.** …regressões primeiro, depois avanços (RF e testes).

**Riscos mais graves**
1. R-N01 (alta): …diretriz, o que conflita, verificado em… 
…

**Decisões suas:** …

**Docs alterados:** [Viabilidade e Riscos](…), [Status dos Requisitos](…).
Não verifiquei: …. Não houve commit.
```
