#!/usr/bin/env node
// Reúne as evidências mecânicas para a skill orbitalis-viability e imprime um JSON.
// Só lê o repositório (e roda typecheck e testes); não escreve nada fora do temporário do sistema.
//
// Uso (da raiz do repositório):
//   node .claude/skills/orbitalis-viability/scripts/gather-evidence.mjs [--fast] [--probe]
//   --fast   pula o typecheck e os testes (segundos em vez de ~1 min)
//   --probe  testa a rota /api/space-weather do dev server em localhost:5173
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const DOCS = path.join(ROOT, 'docs')
const args = new Set(process.argv.slice(2))

const abs = (p) => path.join(ROOT, p)
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')
const read = (p) => {
  try { return fs.readFileSync(p, 'utf8') } catch { return null }
}
const exists = (p) => fs.existsSync(p)
const run = (cmd, opts = {}) => spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...opts })
const lines = (s) => (s ?? '').split(/\r?\n/)
const uniq = (a) => [...new Set(a)]

function walk(dir, exts, out = []) {
  if (!exists(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, exts, out)
    else if (!exts || exts.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}

const srcFiles = walk(abs('src'), ['.ts', '.tsx', '.css'])
const clientFiles = [...srcFiles, abs('index.html'), abs('vite.config.ts')].filter(exists)
const cache = new Map()
const text = (f) => {
  if (!cache.has(f)) cache.set(f, read(f) ?? '')
  return cache.get(f)
}

/** Linhas (arquivo:linha) que casam com a regex, sem contar os testes. */
function grep(re, files = clientFiles, { tests = false } = {}) {
  const hits = []
  for (const f of files) {
    if (!tests && /\.test\.tsx?$/.test(f)) continue
    lines(text(f)).forEach((l, i) => { if (re.test(l)) hits.push(`${rel(f)}:${i + 1}`) })
  }
  return hits
}

// ---------- Datas ----------
const now = new Date()
const todayLocal = now.toLocaleDateString('sv-SE')
const claude = read(abs('CLAUDE.md')) ?? ''
const ev = claude.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/)
const pad = (n) => String(n).padStart(2, '0')
const eventStart = ev ? `${ev[4]}-${pad(ev[3])}-${pad(ev[1])}` : '2026-11-14'
const eventEnd = ev ? `${ev[4]}-${pad(ev[3])}-${pad(ev[2])}` : '2026-11-15'
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 86400000)

// ---------- Última avaliação (lida do documento de viabilidade) ----------
const viabPath = path.join(DOCS, 'ORBITALIS — Viabilidade e Riscos.md')
const viabText = read(viabPath)
const lastMatch = viabText?.match(/Última avaliação:\s*([0-9T:.+-]+)/)
const lastEval = lastMatch ? { timestamp: lastMatch[1], head: viabText.match(/HEAD\s+`?([0-9a-f]{7,})/)?.[1] ?? null } : null
const capacity = viabText?.match(/Capacidade da equipe:\s*(.+)/)?.[1]?.trim() ?? null

// ---------- Git ----------
const git = (a) => run(`git -c core.quotepath=off ${a}`).stdout.trim()
// O porcelain começa com um espaço quando só o working tree mudou: não use trim() aqui.
const porcelain = lines(run('git -c core.quotepath=off status --porcelain -uall').stdout).filter(Boolean)
  .map((l) => ({ status: l.slice(0, 2).trim(), path: l.slice(3).replace(/^"|"$/g, '') }))
const lastMs = lastEval ? Date.parse(lastEval.timestamp) : null
const changedSinceLastEval = lastMs
  ? porcelain.filter((f) => !/^(docs\/|\.claude\/)/.test(f.path) && exists(abs(f.path)) && fs.statSync(abs(f.path)).mtimeMs > lastMs).map((f) => f.path)
  : null
const NASA_SENSITIVE = /^(src\/data\/(rules|systems|extras|actions)\.ts|src\/lib\/(model|spaceWeather)\.ts|src\/engine\/|vite\.config\.ts|package\.json|public\/(models|assets)\/ATTRIBUTION\.md)/
const nasaSensitiveChanged = uniq((changedSinceLastEval ?? porcelain.map((f) => f.path)).filter((p) => NASA_SENSITIVE.test(p)))

// ---------- Typecheck e testes ----------
let typecheck = null
let tests = null
if (!args.has('--fast')) {
  const t0 = Date.now()
  const r = run('npx tsc --noEmit', { timeout: 240000 })
  typecheck = { ok: r.status === 0, seconds: Math.round((Date.now() - t0) / 1000), output: lines(r.stdout + r.stderr).filter(Boolean).slice(0, 15) }
  const out = path.join(os.tmpdir(), `orbitalis-vitest-${process.pid}.json`)
  const t1 = Date.now()
  const v = run(`npx vitest run --reporter=json --outputFile="${out}"`, { timeout: 300000 })
  try {
    const j = JSON.parse(read(out))
    tests = {
      ok: j.success === true && j.numFailedTests === 0,
      total: j.numTotalTests,
      passed: j.numPassedTests,
      failed: j.numFailedTests,
      files: j.testResults.length,
      seconds: Math.round((Date.now() - t1) / 1000),
      failing: j.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === 'failed').map((a) => `${rel(f.name)} › ${a.fullName}`)).slice(0, 15),
    }
  } catch {
    tests = { ok: v.status === 0, error: 'não consegui ler o JSON do vitest', output: lines(v.stdout + v.stderr).filter(Boolean).slice(-15) }
  }
  fs.rmSync(out, { force: true })
}

// ---------- Fatos do código ----------
const sys = text(abs('src/data/systems.ts'))
const actsSrc = text(abs('src/data/actions.ts'))
const astro = text(abs('src/data/astronauts.ts'))
const types = text(abs('src/types.ts'))
const systemIdBlock = types.match(/export type SystemId =([\s\S]*?)\r?\n\r?\n/)?.[1] ?? ''

const actions = [...actsSrc.matchAll(/'([A-Z]+(?:-[A-Z0-9]+)+)':\s*\{\s*id:\s*'[^']+',\s*label:\s*(['"])(.*?)\2,\s*resource:\s*(['"])(.*?)\4,\s*protocol:\s*(['"])(.*?)\6/g)]
  .map((m) => ({ id: m[1], label: m[3], resource: m[5], protocol: m[7] }))

const facts = {
  metrics: (sys.match(/provenance: '/g) ?? []).length,
  systems: (systemIdBlock.match(/'[a-z_]+'/g) ?? []).length,
  astronauts: (astro.match(/^\s{4}id:\s*'/gm) ?? []).length,
  catalogActions: actions.length,
  emergencyActions: actions.filter((a) => a.id.startsWith('EMG-')).length,
  srcFiles: srcFiles.length,
  testFiles: srcFiles.filter((f) => /\.test\.tsx?$/.test(f)).length,
}

// ---------- IDs e rótulos de limiar (regras 6 e 7 do CLAUDE.md) ----------
const thresholds = []
{
  let cur = null
  for (const l of lines(sys)) {
    const id = l.match(/^\s{4}id:\s*'(\w+)',\s*system:/)
    if (id) cur = id[1]
    const t = l.match(/threshold:\s*\{\s*kind:\s*'(\w+)'(?:,\s*id:\s*'([^']+)')?,\s*text:\s*'((?:[^'\\]|\\.)*)'/)
    if (t && cur) thresholds.push({ metric: cur, kind: t[1], id: t[2] ?? null, text: t[3] })
  }
}
const thresholdProblems = thresholds.flatMap((t) => {
  if (t.kind === 'provisional' && !/^Provisional/.test(t.text)) return [`${t.metric}: limiar provisório sem o rótulo "Provisional"`]
  if (t.kind === 'nasa' && (!t.id || !t.text.includes(`NASA-STD-3001 [${t.id}]`))) return [`${t.metric}: limiar oficial sem o ID da NASA no texto`]
  if (t.kind === 'clinical' && !/clinical|range/i.test(t.text)) return [`${t.metric}: faixa clínica sem rótulo de faixa clínica`]
  return []
})
const idsInCode = uniq(thresholds.filter((t) => t.kind === 'nasa').map((t) => t.id)).sort()
const specFiles = [...(exists(DOCS) ? fs.readdirSync(DOCS).filter((f) => /Especifica/i.test(f)).map((f) => path.join(DOCS, f)) : []), abs('CLAUDE.md')]
const idsInSpec = uniq(specFiles.flatMap((f) => [...text(f).matchAll(/\[(V1 \d{4})\]/g)].map((m) => m[1]))).sort()

// ---------- Regras do CLAUDE.md §2 e catálogo ----------
const DRUG = /aspirin|epinephrine|nitroglycerin|morphine|ibuprofen|paracetamol|acetaminophen|antibiotic|injection|tablet|\b\d+\s?(mg|mcg|µg|mL)\b/i
const catalog = {
  total: actions.length,
  withoutProtocol: actions.filter((a) => !a.protocol.trim()).map((a) => a.id),
  emergencyWithDrugTerms: actions.filter((a) => a.id.startsWith('EMG-') && DRUG.test(`${a.label} ${a.protocol}`)).map((a) => a.id),
  mentionsDose: actions.filter((a) => /\b\d+\s?(IU|mg|mcg|µg)\b/i.test(a.protocol)).map((a) => `${a.id}: ${a.protocol}`),
}

const attributionFiles = uniq(grep(/\bATTRIBUTION\b(?!\.md)/).map((h) => h.split(':')[0]))
const checks = {
  clientSecrets: grep(/API_KEY|apiKey|api_key|Authorization|Bearer|import\.meta\.env|process\.env/),
  externalFetchInClient: grep(/fetch\(\s*['"`]https?:\/\//, srcFiles),
  llmIntegration: grep(/anthropic|openai|generativelanguage|vertexai|gemini|gpt-\d|\/api\/(explain|assess|emergency|ai|llm)/i),
  externalFontsOrScripts: grep(/fonts\.googleapis|fonts\.gstatic|<script[^>]+src=["']https?:|<link[^>]+href=["']https?:/, [abs('index.html'), abs('src/styles.css')].filter(exists)),
  errorBoundary: grep(/ErrorBoundary|componentDidCatch|getDerivedStateFromError/),
  webglDetection: grep(/isWebGLAvailable|WebGL\.isWebGL|webglcontextlost|getContext\(\s*['"]webgl/),
  arrowKeys: grep(/ArrowUp|ArrowDown|ArrowLeft|ArrowRight/),
  notEndorsedNotice: grep(/endorse|not affiliated|não afiliad|não é afiliad|unofficial/i, [...clientFiles, ...walk(abs('public'), ['.md'])]),
  // Heurística: o rodapé de atribuição no canvas existiria se algum componente de cena ou do App usasse o texto.
  attributionUsedIn: attributionFiles,
  attributionOnCanvas: grep(/Z-Anatomy|ATTRIBUTION/, [abs('src/App.tsx'), abs('src/scene/Stage.tsx')].filter(exists)),
}

// ---------- Arquivos do repositório e ativos ----------
const rootNames = fs.readdirSync(ROOT)
const pkg = (() => { try { return JSON.parse(read(abs('package.json'))) } catch { return {} } })()
const publicFiles = walk(abs('public'), null).map((f) => ({ file: rel(f), bytes: fs.statSync(f).size }))
const LIC = /CC[- ]BY[- ]SA|CC[- ]BY|CC0|MIT|public domain|Apache|OFL/gi
const normLic = (s) => (/^cc/i.test(s) ? s.toUpperCase().replace(/-/g, ' ').replace(/^CC BY SA$/, 'CC BY-SA') : s.length <= 3 ? s.toUpperCase() : s.toLowerCase() === 'public domain' ? 'public domain' : s)
const repo = {
  license: rootNames.filter((n) => /^(LICENSE|LICENCE|COPYING)/i.test(n)),
  readme: rootNames.filter((n) => /^README/i.test(n)),
  packageLicenseField: pkg.license ?? null,
  packagePrivate: pkg.private ?? null,
  attributionDocs: ['public/models/ATTRIBUTION.md', 'public/assets/ATTRIBUTION.md'].filter((p) => exists(abs(p)))
    .map((p) => ({ file: p, licenses: uniq((read(abs(p)) ?? '').match(LIC) ?? []).map(normLic).filter((v, i, a) => a.indexOf(v) === i) })),
  publicMB: Math.round(publicFiles.reduce((s, f) => s + f.bytes, 0) / 1e5) / 10,
  largestPublic: publicFiles.sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((f) => `${f.file} (${Math.round(f.bytes / 1e5) / 10} MB)`),
}

// ---------- Deriva dos documentos: referências em `crase` que não existem mais no código ----------
function docDrift() {
  const docFiles = [...(exists(DOCS) ? fs.readdirSync(DOCS).filter((f) => f.endsWith('.md')).map((f) => path.join(DOCS, f)) : []), abs('CLAUDE.md')]
  const bigSrc = [...srcFiles, abs('vite.config.ts'), abs('package.json')].filter(exists).map(text).join('\n')
  const dirs = [ROOT, abs('src'), DOCS, abs('public'), abs('tools'), path.join(ROOT, '.claude/skills/orbitalis-viability')]
  const IGNORE = /^(RF|V1|NASA|HRP|SANS|DONKI|CCMC|ARED|CEVIS|CMRS|CMO|ISS|EMG|SLAMMD|OSDR)/
  // Menção intencional a algo que não existe (removido, proposto, ausente): vem marcada para a leitura ficar limpa.
  const INTENTIONAL = /remov|saiu|sa[ií]ram|substitu|propost|sugest|n[ãa]o (existe|há|tem)|falta|ainda n[ãa]o|antes d|hist[oó]ric|reserva|pendente|deixou de/i
  const basenames = new Set([abs('src'), abs('public'), DOCS, abs('tools'), abs('.claude/skills')].flatMap((d) => walk(d, null)).map((f) => path.basename(f)))
  const seen = new Set()
  const claims = []
  const out = []
  for (const f of docFiles) {
    lines(text(f)).forEach((l, i) => {
      for (const c of l.matchAll(/\b(\d+)\s+(testes|métricas|ações|sistemas|astronautas|arquivos|tests|metrics|actions)\b/gi)) {
        if (claims.length < 40) claims.push({ at: `${rel(f)}:${i + 1}`, claim: c[0] })
      }
      for (const m of l.matchAll(/`([^`\n]+)`/g)) {
        const t = m[1].trim()
        // Dedupe por arquivo: a primeira ocorrência, num doc que cita o termo de propósito, não pode esconder a velha do CLAUDE.md.
        if (seen.has(`${f}|${t}`) || /[<>*…]/.test(t) || t.length > 90) continue
        let kind = null
        let ok = true
        if (/\.(md|ts|tsx|mjs|js|json|css|glb|webp|png)$/.test(t)) {
          kind = 'caminho'
          ok = dirs.some((d) => exists(path.join(d, t))) || (!t.includes('/') && basenames.has(t))
        } else if (/^[A-Z]{2,4}(?:-[A-Z0-9]+)+$/.test(t) && !IGNORE.test(t)) {
          kind = 'id de ação'
          ok = actsSrc.includes(`'${t}'`)
        } else if (/^[A-Za-z_$][\w$]{3,}$/.test(t) && (/[a-z][A-Z]/.test(t) || t.includes('_') || /^[A-Z][A-Z0-9]{4,}$/.test(t)) && !IGNORE.test(t)) {
          kind = 'identificador'
          ok = new RegExp(`\\b${t.replace(/\$/g, '\\$')}\\b`).test(bigSrc)
        }
        if (kind) {
          seen.add(`${f}|${t}`)
          if (!ok && out.length < 80) out.push({ token: t, kind, at: `${rel(f)}:${i + 1}`, intentional: INTENTIONAL.test(l) })
        }
      }
    })
  }
  return { unresolved: out, claims }
}
const drift = docDrift()

// ---------- Rota do feed ao vivo (opcional) ----------
let probe = null
if (args.has('--probe')) {
  try {
    const r = await fetch('http://localhost:5173/api/space-weather', { signal: AbortSignal.timeout(8000) })
    const j = r.ok ? await r.json() : null
    probe = { status: r.status, flares: j?.flares?.length ?? null, sep: j?.sep?.length ?? null }
  } catch (e) {
    probe = { error: e.cause?.code ?? e.message }
  }
}

const result = {
  generatedAt: now.toISOString(),
  today: todayLocal,
  event: { start: eventStart, end: eventEnd, daysToEvent: dayDiff(todayLocal, eventStart) },
  git: {
    branch: git('branch --show-current'),
    head: git('rev-parse --short HEAD'),
    headDate: git('log -1 --format=%cs'),
    headSubject: git('log -1 --format=%s'),
    recent: lines(git('log --format="%h %cs %s" -n 6')).filter(Boolean),
    dirty: porcelain.length,
    modified: porcelain.filter((f) => f.status !== '??').map((f) => `${f.status} ${f.path}`),
    untracked: porcelain.filter((f) => f.status === '??').map((f) => f.path),
  },
  lastEvaluation: lastEval,
  capacity,
  changedSinceLastEval,
  nasaSensitiveChanged,
  typecheck,
  tests,
  facts,
  nasa: { idsInCode, idsInSpec, onlyInCode: idsInCode.filter((i) => !idsInSpec.includes(i)), onlyInSpec: idsInSpec.filter((i) => !idsInCode.includes(i)), thresholdKinds: Object.fromEntries(['nasa', 'provisional', 'clinical'].map((k) => [k, thresholds.filter((t) => t.kind === k).length])), thresholdProblems },
  catalog,
  checks,
  repo,
  docs: exists(DOCS) ? fs.readdirSync(DOCS).map((f) => ({ file: f, modified: fs.statSync(path.join(DOCS, f)).mtime.toISOString().slice(0, 16) })) : [],
  docDrift: drift,
  probe,
}
process.stdout.write(JSON.stringify(result, null, 2) + '\n')
