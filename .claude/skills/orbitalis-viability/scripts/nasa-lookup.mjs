#!/usr/bin/env node
// Verifica fontes da NASA que as ferramentas comuns não conseguem ler.
//
//   node nasa-lookup.mjs std [ID ...] [--url <pdf>]
//       Baixa a NASA-STD-3001 Vol. 1 (ou o PDF de --url), extrai o texto com pdftotext e imprime, em JSON,
//       a capa (título, revisão, data de aprovação) e o texto de cada requisito [V1 xxxx].
//       Sem IDs, usa os IDs oficiais citados em src/data/systems.ts. O WebFetch NÃO lê esse PDF (fluxo comprimido).
//
//   node nasa-lookup.mjs page <url> [--grep <regex>] [--context <n>]
//       Imprime o texto de uma página renderizada pelo Chrome headless. Serve para sites com cadeia de certificados
//       incompleta (spaceappschallenge.org), em que WebFetch, curl e Node falham. O Chrome valida o certificado normalmente:
//       nunca desligue a verificação de certificado para contornar esse erro.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const DEFAULT_PDF = 'https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf'
const [cmd, ...rest] = process.argv.slice(2)

const flag = (name) => {
  const i = rest.indexOf(name)
  return i >= 0 ? rest[i + 1] : undefined
}
const fail = (msg) => {
  console.error(`erro: ${msg}`)
  process.exit(2)
}

function findExe(names, candidates = []) {
  for (const n of names) {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [n], { encoding: 'utf8' })
    if (r.status === 0) return r.stdout.split(/\r?\n/)[0].trim()
  }
  return candidates.find((c) => c && fs.existsSync(c)) ?? null
}

function texliveCandidates() {
  const base = 'C:\\texlive'
  if (!fs.existsSync(base)) return []
  return fs.readdirSync(base).map((y) => path.join(base, y, 'bin', 'windows', 'pdftotext.exe'))
}

function stripHtml(h) {
  // Só as quebras de bloco viram nova linha; tags em linha (strong, a, span...) ficam dentro da frase,
  // senão uma busca por "are not allowed to begin" não acha o texto cortado no meio.
  return h
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/ul|\/ol|\/table|\/dd|\/dt|\/header|\/footer|\/nav)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;|&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/(\s*\n\s*)+/g, '\n')
}

async function std() {
  let ids = rest.filter((a) => /^\[?V1 \d{4}\]?$/.test(a)).map((a) => a.replace(/[[\]]/g, ''))
  if (!ids.length) {
    const sys = fs.readFileSync(path.join(ROOT, 'src/data/systems.ts'), 'utf8')
    ids = [...new Set([...sys.matchAll(/kind:\s*'nasa',\s*id:\s*'(V1 \d{4})'/g)].map((m) => m[1]))].sort()
  }
  const url = flag('--url') ?? DEFAULT_PDF
  const exe = findExe(['pdftotext'], texliveCandidates())
  if (!exe) fail('pdftotext não encontrado. Instale o poppler (ou o TeX Live) e rode de novo.')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitalis-nasa-'))
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120000) })
    if (!res.ok) fail(`download falhou: HTTP ${res.status} em ${url}`)
    const pdf = path.join(dir, 'std.pdf')
    const txt = path.join(dir, 'std.txt')
    fs.writeFileSync(pdf, Buffer.from(await res.arrayBuffer()))
    const r = spawnSync(exe, ['-layout', pdf, txt], { encoding: 'utf8' })
    if (r.status !== 0) fail(`pdftotext falhou: ${r.stderr}`)
    const lines = fs.readFileSync(txt, 'utf8').split(/\r?\n/)
    const clean = (s) => s.trim().replace(/\s{2,}/g, ' ')
    const cover = lines.slice(0, 45).filter((l) => /NASA-STD-3001|Revision|Approved:|VOLUME/i.test(l)).map(clean)

    const requirements = []
    const missing = []
    for (const id of ids) {
      // O corpo é a primeira linha que COMEÇA com o ID e é seguida de "shall" nas próximas linhas
      // (no sumário e na tabela final o ID aparece no meio da linha).
      const start = lines.findIndex((l, i) => new RegExp(`^\\s*\\[${id}\\]\\s+\\S`).test(l) && /\bshall\b/.test(lines.slice(i, i + 4).join(' ')))
      if (start < 0) { missing.push(id); continue }
      let heading = ''
      for (let k = start - 1; k >= Math.max(0, start - 4); k--) {
        if (/^\s*\d+(\.\d+)+\s+\S/.test(lines[k])) { heading = clean(lines[k]); break }
      }
      const body = [clean(lines[start])]
      for (let k = start + 1; k < Math.min(lines.length, start + 14); k++) {
        if (/^\s*\[(V1 \d{4}|Rationale)/.test(lines[k]) || /^\s*\d+(\.\d+)+\s+\S/.test(lines[k])) break
        if (lines[k].trim()) body.push(clean(lines[k]))
      }
      requirements.push({ id, heading, text: body.join(' ') })
    }
    console.log(JSON.stringify({ source: url, extractedWith: path.basename(exe), characters: lines.join('\n').length, cover, requirements, missing }, null, 2))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function page() {
  const url = rest.find((a) => /^https?:\/\//.test(a))
  if (!url) fail('informe a URL da página')
  const chrome = findExe(['google-chrome', 'chrome', 'chromium'], [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    process.env.CHROME_PATH,
  ])
  if (!chrome) fail('Chrome não encontrado (defina CHROME_PATH).')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitalis-chrome-'))
  const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, '--virtual-time-budget=20000', '--dump-dom', url], {
    encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 90000,
  })
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* o Windows ainda segura o perfil: some depois */ }
  if (!r.stdout) fail(`o Chrome não devolveu a página (${r.error?.message ?? r.stderr?.slice(0, 200)})`)
  const txt = stripHtml(r.stdout)
  const re = flag('--grep')
  if (!re) return console.log(txt)
  const ctx = Number(flag('--context') ?? 2)
  const rx = new RegExp(re, 'i')
  const ls = txt.split('\n')
  const keep = new Set()
  ls.forEach((l, i) => { if (rx.test(l)) for (let k = Math.max(0, i - ctx); k <= Math.min(ls.length - 1, i + ctx); k++) keep.add(k) })
  let prev = -2
  for (const k of [...keep].sort((a, b) => a - b)) {
    if (k !== prev + 1) console.log('---')
    console.log(ls[k])
    prev = k
  }
}

if (cmd === 'std') await std()
else if (cmd === 'page') page()
else fail('uso: nasa-lookup.mjs std [ID ...] [--url <pdf>]  |  nasa-lookup.mjs page <url> [--grep <regex>] [--context <n>]')
