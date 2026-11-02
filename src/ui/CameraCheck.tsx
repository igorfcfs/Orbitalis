import { useEffect, useRef, useState } from 'react'
import { MIN_QUALITY, estimateBpm } from '../lib/ppg'

const SECONDS = 15

type Phase =
  | { k: 'idle' }
  | { k: 'starting' }
  | { k: 'measuring'; left: number; covered: boolean }
  | { k: 'done'; bpm: number }
  | { k: 'fail'; msg: string }

/**
 * Entrada por câmera (RF-24): frequência cardíaca por fotopletismografia de ponta de dedo.
 * O vídeo é lido quadro a quadro só para tirar o brilho médio do canal vermelho; nenhum quadro é guardado,
 * exibido ou enviado, e a câmera é desligada ao terminar. O resultado preenche o campo do formulário, que continua
 * sendo a porta de entrada (faixa plausível, carimbo de tempo, recálculo do status).
 */
export function CameraCheck({ onReading }: { onReading: (bpm: number) => void }) {
  const [phase, setPhase] = useState<Phase>({ k: 'idle' })
  const stop = useRef<() => void>(() => {})
  useEffect(() => () => stop.current(), [])

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const start = async () => {
    setPhase({ k: 'starting' })
    let stream: MediaStream | null = null
    let timer = 0
    const release = () => {
      window.clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    }
    stop.current = release
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 160 }, height: { ideal: 120 } }, audio: false })
      // Lanterna, quando o aparelho tem: ilumina o dedo por trás
      const track = stream.getVideoTracks()[0]
      try {
        await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] })
      } catch {
        /* sem lanterna: a luz ambiente basta se o dedo cobrir a lente */
      }
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      await video.play()
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 16
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('no canvas')
      const samples: number[] = []
      const t0 = performance.now()
      let covered = false
      timer = window.setInterval(() => {
        ctx.drawImage(video, 0, 0, 16, 16)
        const px = ctx.getImageData(0, 0, 16, 16).data
        let r = 0
        let g = 0
        let b = 0
        for (let i = 0; i < px.length; i += 4) {
          r += px[i]
          g += px[i + 1]
          b += px[i + 2]
        }
        const n = px.length / 4
        r /= n
        g /= n
        b /= n
        // Dedo sobre a lente: vermelho domina e o quadro fica claro o bastante
        covered = r > 60 && r > 1.6 * (g + b) / 2
        if (covered) samples.push(r)
        const el = (performance.now() - t0) / 1000
        if (el >= SECONDS) {
          release()
          const fps = samples.length / el
          const res = estimateBpm(samples, fps)
          if (!res || res.quality < MIN_QUALITY) setPhase({ k: 'fail', msg: 'No steady pulse was found. Cover the lens fully with a fingertip, press lightly and stay still.' })
          else {
            setPhase({ k: 'done', bpm: Math.round(res.bpm) })
            onReading(Math.round(res.bpm))
          }
        } else setPhase({ k: 'measuring', left: Math.ceil(SECONDS - el), covered })
      }, 33)
    } catch {
      release()
      setPhase({ k: 'fail', msg: 'The camera is not available or permission was refused. Enter the value by hand below.' })
    }
  }

  if (!supported) return <p className="small muted">Camera input is not available in this browser. Enter the value by hand.</p>
  return (
    <div className="camera" aria-live="polite">
      <div className="mr-top">
        <span className="label">Camera pulse check</span>
        <span className="prov" title="Entered by the astronaut or an app">LOGGED</span>
      </div>
      {phase.k === 'idle' && (
        <>
          <p className="small">Cover the camera lens with a fingertip for {SECONDS} seconds, resting, then read the value it fills in. Nothing is recorded or sent: only the average redness of each frame is used, on this device.</p>
          <button type="button" className="btn" onClick={start}>Start camera check</button>
        </>
      )}
      {phase.k === 'starting' && <p className="small muted">Starting the camera…</p>}
      {phase.k === 'measuring' && (
        <>
          <p className="small">{phase.covered ? 'Hold still. Reading your pulse.' : 'Cover the lens with a fingertip.'} <span className="mono">{phase.left} s</span></p>
          <button type="button" className="linkbtn small" onClick={() => { stop.current(); setPhase({ k: 'idle' }) }}>Cancel</button>
        </>
      )}
      {phase.k === 'done' && (
        <>
          <p className="small"><span className="num">{phase.bpm}</span> <span className="unit">bpm</span> · camera estimate, filled in below. Check it, then save.</p>
          <button type="button" className="linkbtn small" onClick={start}>Measure again</button>
        </>
      )}
      {phase.k === 'fail' && (
        <>
          <p className="small err">{phase.msg}</p>
          <button type="button" className="linkbtn small" onClick={start}>Try again</button>
        </>
      )}
    </div>
  )
}
