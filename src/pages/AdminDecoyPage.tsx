import { useCallback, useEffect, useRef, useState } from 'react'

type AudioRefs = {
  ctx: AudioContext | null
  osc: OscillatorNode | null
  gain: GainNode | null
}

function stopAudio(r: AudioRefs) {
  try {
    r.osc?.stop()
  } catch {
    /* ignore */
  }
  try {
    r.osc?.disconnect()
    r.gain?.disconnect()
  } catch {
    /* ignore */
  }
  r.osc = null
  r.gain = null

  const ctx = r.ctx
  r.ctx = null
  if (ctx) void ctx.close().catch(() => undefined)
}

export function AdminDecoyPage() {
  const refs = useRef<AudioRefs>({ ctx: null, osc: null, gain: null })
  const [isPlaying, setIsPlaying] = useState(false)


  const start = useCallback(async () => {
    if (isPlaying) return
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) {
        return
      }

      const ctx = new Ctx()
      const gain = ctx.createGain()
      gain.gain.value = 0.03
      gain.connect(ctx.destination)

      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = 440
      osc.connect(gain)
      osc.start()

      // Petit motif agressif (change de fréquence en boucle)
      let i = 0
      const freqs = [440, 659.25, 523.25, 783.99, 392, 880]
      const timer = window.setInterval(() => {
        i = (i + 1) % freqs.length
        osc.frequency.setValueAtTime(freqs[i], ctx.currentTime)
      }, 160)

      // Nettoyage si on stop
      ;(osc as unknown as { __timer?: number }).__timer = timer

      refs.current.ctx = ctx
      refs.current.osc = osc
      refs.current.gain = gain
      setIsPlaying(true)
    } catch {
    }
  }, [isPlaying])

  const stop = useCallback(() => {
    const osc = refs.current.osc as (OscillatorNode & { __timer?: number }) | null
    if (osc?.__timer != null) window.clearInterval(osc.__timer)
    stopAudio(refs.current)
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    const onFirstGesture = () => {
      void start()
    }
    window.addEventListener('pointerdown', onFirstGesture, { once: true })
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture)
      stop()
    }
  }, [start, stop])

  return (
    <main className="shell">
      <header className="header">
        <p>Si tu vois ca t'es un fils de pute</p>
      </header>

      <div className="admin-actions-row">
        {!isPlaying ? (
          <button type="button" className="primary" onClick={() => void start()}>
            oui
          </button>
        ) : (
          <button type="button" className="secondary danger" disabled={isPlaying} onClick={stop}>
            je suis une pute
          </button>
        )}
      </div>
    </main>
  )
}

