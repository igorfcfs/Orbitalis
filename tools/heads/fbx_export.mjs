// Uso: node fbx_export.mjs <Avatar> <saida.json> [zMinCm]
// Lê o FBX (em /tmp_rb/<Avatar>.fbx, servido pelo Vite) com o FBXLoader do three, dentro do Chrome de teste, e grava os
// triângulos da cabeça (materiais 1 = cabeça e 2 = cabelo/opacidade, acima de zMinCm) em JSON, em metros e com Y para cima.
import fs from 'node:fs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const [avatar, out, zMin = '128'] = process.argv.slice(2)
const targets = await (await fetch('http://localhost:9333/json')).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } })
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Page.enable'); await send('Runtime.enable')
const cur = (await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true })).result?.result?.value
if (!cur || !cur.startsWith('http://localhost:5173/')) { await send('Page.navigate', { url: 'http://localhost:5173/?r=export' }); await sleep(5000) }
const code = `(async () => {
  const T = await import('/node_modules/.vite/deps/three.js')
  const { FBXLoader } = await import('/node_modules/three/examples/jsm/loaders/FBXLoader.js')
  const buf = await (await fetch('/tmp_rb/${avatar}.fbx')).arrayBuffer()
  const root = new FBXLoader().parse(buf, '/tmp_rb/')
  root.updateMatrixWorld(true)
  let mesh = null
  root.traverse((o) => { if (o.isSkinnedMesh) mesh = o })
  const g = mesh.geometry
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv
  const m = mesh.matrixWorld
  const nm = new T.Matrix3().getNormalMatrix(m)
  const v = new T.Vector3()
  const tris = []
  const zMin = ${Number(zMin)}
  for (const gr of g.groups) {
    if (gr.materialIndex === 0) continue
    for (let t = gr.start; t < gr.start + gr.count; t += 3) {
      // z bruto (cm) é a altura; descarta o que está abaixo do pescoço
      let zmax = -1e9
      for (let k = 0; k < 3; k++) zmax = Math.max(zmax, P.getZ(t + k))
      if (zmax < zMin) continue
      const row = [gr.materialIndex]
      for (let k = 0; k < 3; k++) {
        v.fromBufferAttribute(P, t + k).applyMatrix4(m).multiplyScalar(0.01)
        row.push(+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5))
        v.fromBufferAttribute(N, t + k).applyMatrix3(nm).normalize()
        row.push(+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4))
        row.push(+UV.getX(t + k).toFixed(5), +UV.getY(t + k).toFixed(5))
      }
      tris.push(row)
    }
  }
  return { avatar: '${avatar}', count: tris.length, tris }
})()`
const r = await send('Runtime.evaluate', { expression: code, returnByValue: true, awaitPromise: true })
if (r.result?.exceptionDetails) { console.log('EXC', JSON.stringify(r.result.exceptionDetails).slice(0, 1200)); process.exit(1) }
fs.writeFileSync(out, JSON.stringify(r.result.result.value))
console.log('ok', r.result.result.value.count, 'triângulos ->', out)
process.exit(0)
