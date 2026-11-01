---
name: orbitalis-viability
description: Avalia a viabilidade do ORBITALIS atual contra o projeto esperado (CLAUDE.md, spec e enunciado da NASA), aponta o que pode dar problema segundo as diretrizes da NASA (NASA-STD-3001, HRP, termos e FAQ do Space Apps, uso de mídia) e atualiza os documentos em docs/. Use sempre que o usuário pedir viabilidade, "dá tempo?", "o que falta", status dos requisitos, riscos da NASA ou para atualizar a documentação, e ao concluir qualquer entrega que mude funcionalidade, regra, dados ou docs. Só escreve em docs/; nunca commita.
---

# /orbitalis-viability

Compara o que o ORBITALIS **é** hoje (código, testes, docs) com o que ele **deve ser** (decisões do dono, spec e enunciado da NASA), diz se o esperado ainda é alcançável até o evento e grava o resultado em `docs/`. Toda execução parte do estado atual do repositório: nunca reaproveite uma conclusão antiga sem conferir de novo.

Chamar esta skill autoriza editar arquivos em `docs/` e **nada além disso**. Sem commit nem push (o dono commita; para isso existe a skill `atomic-commits`) e sem tocar em `src/`, `CLAUDE.md`, `AGENTS.md` nem na spec. Se algo fora de `docs/` precisar mudar, descreva a mudança no relatório.

## O esperado, e quem manda

Em ordem de precedência:

1. `CLAUDE.md`: decisões do dono (§0), regras inegociáveis (§2), orçamento por tela (§3) e critérios de aceite (§15). Onde ele diz que substitui a spec, vale o CLAUDE.md.
2. `docs/ORBITALIS — Especificação Final.md`: RF-01 a RF-27, ordem de corte, prêmios, vídeo e regras da submissão. É o "esperado": **nunca a edite**. Divergências vão para o documento de status.
3. `docs/ORBITALIS — Diretrizes NASA (verificadas).md`: enunciado do desafio e exigências oficiais já conferidas, cada uma com fonte e data.
4. RFs **propostos** (RF-28 em diante, em `docs/ORBITALIS — Status dos Requisitos.md` §5): avalie a viabilidade deles, mas não os conte como falha enquanto o dono não os aprovar, e nunca os promova por conta própria.

`AGENTS.md` é cópia do CLAUDE.md para outro agente: ignore.

## Modos

- **rápido** (padrão, ao fim de uma entrega): passos 1, 2, 3, 5 e 6. No passo 4 só reverifique a NASA se o script marcar `nasaSensitiveChanged` ou se a verificação mais antiga em `Diretrizes NASA (verificadas)` tiver mais de 14 dias.
- **completo** (`full`; o usuário pede "viabilidade completa"; antes de marcos como 13/11): todos os passos, reverificando as fontes da NASA.

## Passos

### 1. Reunir as evidências

```bash
node .claude/skills/orbitalis-viability/scripts/gather-evidence.mjs          # ~30 s: inclui typecheck e testes
node .claude/skills/orbitalis-viability/scripts/gather-evidence.mjs --fast   # segundos: sem typecheck e testes
```

`--probe` testa a rota do DONKI com o dev server de pé. O JSON traz: datas e `event.daysToEvent`; git (HEAD, arquivos modificados, `changedSinceLastEval`); `typecheck` e `tests`; `facts` (contagens); conformidade mecânica (`nasa`, `catalog`, `checks`, `repo`); e `docDrift`.

Leia também o `docs/ORBITALIS — Viabilidade e Riscos.md` anterior, se existir: veredito, capacidade, riscos abertos e histórico. O foco do relatório é o que mudou desde `Última avaliação`.

Se `typecheck` ou `tests` falharem, o working tree pode ter trabalho em andamento de outra sessão: reporte o arquivo e o erro, marque o veredito como **provisório** e não tente consertar.

### 2. Esperado × atual

Confira cada RF aprovado e cada critério de aceite do CLAUDE.md §15. Nível de evidência, do mais forte ao mais fraco: **testado** > **executado ou capturado** > **lido no código** > **declarado no doc**. Sem pelo menos "lido no código" o item não é Atendido. Um item que estava Atendido e perdeu a evidência é **regressão**: ele abre o relatório.

Atualize `docs/ORBITALIS — Status dos Requisitos.md`: a tabela do grupo, as contagens da seção 1 e a linha "Estado do código em…". Faça edições mínimas. O dono também edita esse arquivo à mão, então releia-o antes, preserve o que ele escreveu e mova uma linha de tabela só quando o status mudar de fato.

As regras do CLAUDE.md §2 que o script não cobre (status só por código, IA sem números inventados, ação só por ID de catálogo, três números por unidade, forma e palavra no status) confira por amostragem quando o diff tocar `src/engine`, `src/data` ou `src/lib/model.ts`.

### 3. Viabilidade

1. Liste o que falta: RFs aprovados abertos ou parciais, itens de entrega (licença, README, descrição do uso de IA, vídeo, fontes) e riscos abertos de severidade alta ou média. Os RFs propostos entram numa lista à parte.
2. Dimensione cada item em **S** (até meio dia: mudança em até 2 arquivos, sem dado novo), **M** (1 a 2 dias: componente ou dado novo, com testes) ou **L** (3 dias ou mais: infraestrutura, servidor, cena 3D nova ou conteúdo que exige fonte externa). Anote as dependências. São estimativas suas, feitas a partir do código; diga isso no documento.
3. Capacidade: leia a linha `Capacidade da equipe:` do documento de viabilidade. Se estiver ausente ou "não informada", pergunte uma vez com `AskUserQuestion` (quantas pessoas e quantas horas por dia até o evento) e grave a resposta. No modo rápido não bloqueie: use "não informada" e compare só o esforço total com os dias que restam.
4. Dê o veredito em **duas linhas**, porque cumprir o escopo e cumprir as regras do evento são perguntas diferentes:
   - **Técnica.** *Viável*: obrigatórios atendidos e o que falta cabe com folga. *Viável com cortes*: obrigatórios atendidos, mas o planejado passa da capacidade; liste os cortes na ordem da spec (RF-26 → RF-24 → RF-19 → RF-17) e o que nunca cai (motor determinístico, selos, IDs de requisito, ação por tela, modo autônomo). *Em risco*: obrigatório ausente ou regredido, testes falhando, ou caminho crítico maior que os dias que restam.
   - **Conformidade.** *Conforme*; *Com pendências* (só risco de severidade baixa ou média); *Em risco* (algum risco de severidade alta aberto).

### 4. Diretrizes da NASA: o que pode dar problema

Leia `references/nasa-sources.md` (fontes, como abri-las neste ambiente, mapa "o que mudou → o que conferir" e escala de severidade) e `docs/ORBITALIS — Diretrizes NASA (verificadas).md`.

- **Nunca afirme o que a NASA exige sem ter lido a fonte.** Toda exigência citada precisa de fonte e data de verificação no documento de diretrizes. O que não conseguir abrir fica como "não verificado"; resumo de terceiros fica como "resumo".
- Compare as áreas que mudaram (`nasaSensitiveChanged`) com o mapa de `references/nasa-sources.md`: limiares e IDs, dados e segurança, IA e emergência, cenários, mídia e marca, termos do evento.
- No modo completo, revalide com `node .claude/skills/orbitalis-viability/scripts/nasa-lookup.mjs std` (os IDs `[V1 xxxx]` do código contra o PDF oficial) e `... page <url> --grep <regex>` (páginas do Space Apps).
- Para cada problema, uma linha no registro de riscos (modelo em `references/templates.md`): ID estável, diretriz com data de verificação, o que no ORBITALIS conflita (arquivo:linha ou documento), severidade, mitigação e quem decide. Os IDs `R-N##` (NASA e Space Apps) e `R-P##` (projeto) nunca mudam: risco resolvido vira "Mitigado" e fica na tabela.

### 5. Atualizar `docs/`

Ordem: Diretrizes NASA (fatos novos) → Status dos Requisitos → Viabilidade e Riscos (veredito, riscos, histórico) → varredura de fatos. Depois:

- **Varredura.** Compare `facts` e `docDrift.claims` com os números citados nos docs (testes, métricas, ações…) e corrija os que mudaram. Em `docDrift.unresolved`, o que tem `intentional: false` precisa de triagem: ou é referência velha (corrija nos docs), ou é menção a algo proposto ou histórico, como `MissionProfile` ou `tempNow` (deixe). Se estiver no `CLAUDE.md`, só relate.
- **Histórico.** Acrescente uma linha na tabela do fim do documento de viabilidade e atualize a linha `Última avaliação:` (horário local ISO, HEAD e quantos arquivos modificados): o script a lê na próxima vez.
- Escreva em português, com datas no formato dos docs ("31 de outubro de 2026"), sem emojis. O texto de interface continua em inglês.

### 6. Responder

No máximo ~25 linhas, nesta ordem: o veredito (técnica e conformidade) e os dias até o evento; regressões e o que mudou desde a última avaliação; os 3 a 5 riscos mais graves, cada um com a diretriz que o sustenta e se foi verificada; as decisões que só o dono pode tomar; os docs alterados, com links. Diga sempre o que **não** pôde verificar. Diga que não houve commit.

## Quando parar e perguntar

- A spec e o CLAUDE.md se contradizem num ponto que muda o veredito.
- Um RF proposto parece já aprovado (o dono o cita como decidido): peça confirmação antes de movê-lo para as tabelas dos aprovados.
- Um risco alto depende de interpretar as regras do evento: recomende perguntar à organização e não decida por ela.
- A capacidade da equipe é desconhecida e o veredito depende dela (modo completo).

## Armadilhas deste ambiente (Windows)

- O `WebFetch` não lê os PDFs comprimidos da NASA: use `nasa-lookup.mjs std` (precisa do `pdftotext`; no TeX Live fica em `C:\texlive\<ano>\bin\windows`).
- `spaceappschallenge.org` entrega a cadeia de certificados incompleta: `WebFetch`, `curl`, PowerShell e Node falham com erro de certificado. Use `nasa-lookup.mjs page <url>` (Chrome headless). Nunca desligue a verificação de certificado.
- O PowerShell 5.1 lê UTF-8 como ANSI e os acentos viram `Ã©`. Leia os `.md` com a ferramenta `Read` ou com `Get-Content -Encoding UTF8`.
- Rode `npx vitest run` e `npm run typecheck` pelo PowerShell (o script já faz isso).
- Outra sessão do Claude pode estar editando o repositório ao mesmo tempo: o working tree atual é a verdade. Não "corrija" arquivos que não são seus.
