---
name: atomic-commits
description: Agrupa as alterações pendentes do repositório em commits atômicos (um assunto por commit), confere o typecheck de cada commit e grava. Use quando o usuário pedir para "commitar", "planejar commits", "commits atômicos" ou chamar /atomic-commits. Nunca faz push.
---

# /atomic-commits

Transforma o working tree sujo em uma sequência de commits pequenos, cada um com **um assunto** e que **compila sozinho**.

Chamar esta skill é a autorização para commitar **localmente**. Push, amend, rebase e `--no-verify` só com pedido explícito. Se o usuário disser "só planejar" (ou `plan`), pare depois do passo 3.

## Regras fixas deste repositório

- **`AGENTS.md` nunca entra em commit** (é uma cópia do CLAUDE.md para outro agente). Use sempre caminhos explícitos no `git add`; nunca `git add .`, `-A` ou `-u`.
- Mensagens em português, estilo convencional: `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `test: ...`, `chore: ...`. Assunto ≤ 72 caracteres, sem ponto final; corpo curto explicando o porquê quando não for óbvio.
- Todo commit termina com a linha de atribuição que o ambiente indicar (hoje: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`), depois de uma linha em branco.
- Escopos usados: `state`, `model`, `data`, `engine`, `scene`, `ui`, `anatomy`. Reaproveite-os.
- Arquivos **removidos** (`D`) e binários grandes (> 1 MB, `public/assets`, `public/models`): mencione no plano e confirme com `AskUserQuestion` se a remoção não for óbvia. Não os esconda dentro de um commit de outro assunto.
- Os vetores `ARM_UP` e `ARM_FORE` de `src/scene/suitModel.ts` foram aprovados pelo dono: se o diff os tocar, avise e não os inclua sem confirmação.

## Passos

### 1. Levantar o que mudou

```bash
git status --short -uall
git diff --stat
git log --format=%s -10        # para copiar o estilo e os escopos
```

Para arquivos modificados que não estejam claros, leia `git diff -U1 <arquivo>`. Para novos, leia o topo do arquivo. Ignore avisos de `LF will be replaced by CRLF` (o repositório usa `core.autocrlf=true`).

### 2. Agrupar por assunto e por dependência

Agrupe por **funcionalidade**, não por pasta. Depois ordene pela dependência de importação: quem é importado vem antes de quem importa.

- Descubra as dependências com `grep -n "^import" <arquivos>` (ou `from '\./`).
- Ordem típica: `types` e `data` → `engine` e `lib` → `state` → módulos de `scene` (folhas antes do `AstronautRig`/`Stage`) → `ui` → `docs`.
- **Teste vai junto do código que ele importa**, nunca antes.
- Se uma mudança de assinatura obriga dois arquivos a mudar juntos (ex.: `AnatomyLayers.tsx` e `Stage.tsx`), eles ficam no mesmo commit, mesmo que sejam "assuntos" diferentes. Diga isso no plano.
- Arquivos que misturam duas funcionalidades (comum em `AstronautRig.tsx`, `bodyShader.ts`, `Hud.tsx`, `Stage.tsx`):
  - primeiro tente unir as duas funcionalidades num commit só;
  - só divida por trecho se o usuário pedir. `git add -p` e `-i` **não funcionam** neste ambiente: monte um patch com só os trechos desejados e aplique com `git apply --cached <patch>`, e confirme com `git diff --cached` que nada extra entrou.
- `CLAUDE.md` e demais docs vão num commit `docs:` próprio, no fim, a menos que descrevam exclusivamente uma funcionalidade que sai no mesmo commit (aí podem acompanhá-la se o usuário preferir).

### 3. Mostrar o plano

Uma tabela curta: `# | mensagem | arquivos`. Aponte: arquivos deixados de fora (sempre `AGENTS.md`), remoções, trechos misturados e qualquer agrupamento forçado por dependência. Em seguida continue, a menos que o usuário tenha pedido só o plano.

### 4. Para cada commit, nesta ordem

1. `git add <caminhos explícitos>` (arquivos novos incluídos; binários só se estiverem no plano).
2. **Verificar que o índice compila**, sem tocar no working tree:
   ```bash
   D=/c/tmp/idx
   [ -e $D/node_modules ] && cmd //c "rmdir C:\\tmp\\idx\\node_modules"   # remove só o junction
   rm -rf $D && mkdir -p $D
   git checkout-index -a --prefix=$D/
   cmd //c "mklink /J C:\\tmp\\idx\\node_modules C:\\dev\\orbitalis\\node_modules"
   (cd $D && npx tsc --noEmit | head -20)
   ```
   **Nunca rode `rm -rf` com o junction de `node_modules` dentro de `$D`**: remova o junction antes com `rmdir`, senão o `node_modules` real pode ser apagado. Confira `ls node_modules | wc -l` depois.
3. Se o `tsc` falhar: leia o erro, descubra o arquivo que depende de algo ainda não commitado, mova-o para este commit (ou para o seguinte), refaça o `git add`/`git restore --staged` e verifique de novo. Não grave commit que não compila.
4. `git commit -q -m "<mensagem>"` (use here-doc se houver corpo).

### 5. Fechar

- Rode `npm test` uma vez no estado final (ou `npx vitest run <arquivos>` se a suíte for pesada) e informe o resultado.
- Apague `/c/tmp/idx` (com o `rmdir` do junction antes).
- `git status --short` deve mostrar só o que ficou de fora de propósito (`AGENTS.md`). Se sobrar outra coisa, diga o que e por quê.
- Responda com a lista `hash — mensagem`, os agrupamentos que fugiram do plano original e o resultado dos testes. Diga explicitamente que **não houve push**.

## Quando não commitar

- Há conflito de merge, rebase ou cherry-pick em andamento.
- O `tsc` já falha no `HEAD` por causa de erro antigo: avise, compare com o `HEAD` e commite só se a alteração não piorar nada.
- O diff inclui segredos (`.env`, chaves, tokens): pare e avise.
