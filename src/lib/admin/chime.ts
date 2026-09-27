/**
 * Alerta sonoro de pedido novo, gerado com Web Audio (sem arquivo de áudio).
 * Navegadores só liberam som depois de um toque/clique na página: por isso
 * o painel tem o botão "Ativar som", que chama unlockAudio().
 */
let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  return ctx
}

/** Deve ser chamado dentro de um clique/toque. */
export async function unlockAudio(): Promise<boolean> {
  const audio = getContext()
  if (!audio) return false
  if (audio.state === 'suspended') await audio.resume()
  return audio.state === 'running'
}

export function isAudioUnlocked(): boolean {
  return ctx?.state === 'running'
}

/** "Plim-plom" curto e bem audível, repetido duas vezes. */
export function playChime() {
  const audio = getContext()
  if (!audio || audio.state !== 'running') return

  const notes = [
    { freq: 880, at: 0 },
    { freq: 1318.5, at: 0.18 },
    { freq: 880, at: 0.6 },
    { freq: 1318.5, at: 0.78 },
  ]
  const start = audio.currentTime + 0.02
  for (const { freq, at } of notes) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start + at)
    gain.gain.exponentialRampToValueAtTime(0.5, start + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.35)
    osc.connect(gain).connect(audio.destination)
    osc.start(start + at)
    osc.stop(start + at + 0.4)
  }
}
