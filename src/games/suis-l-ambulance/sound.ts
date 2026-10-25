/* Sons synthétisés en Web Audio (aucun fichier externe). */
const KEY = 'jeux-reflexion:son'
let ctx: AudioContext | null = null
export const soundOn = () => localStorage.getItem(KEY) !== '0'
export const setSound = (on: boolean) => localStorage.setItem(KEY, on ? '1' : '0')
function ac() {
  if (!soundOn()) return null
  try { ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx } catch { return null }
}
function tone(freq: number, at: number, dur: number, vol = 0.12, type: OscillatorType = 'sine') {
  const c = ac(); if (!c) return
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at
  o.type = type; o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05)
}
/** Whoosh / léger crissement : bruit filtré qui balaie. */
export function whoosh(ms: number) {
  const c = ac(); if (!c) return
  const len = Math.max(0.15, ms / 1000), buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime
  src.buffer = buf; f.type = 'bandpass'; f.Q.value = 2.5
  f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + len * 0.6); f.frequency.exponentialRampToValueAtTime(900, t + len)
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + len * 0.4); g.gain.linearRampToValueAtTime(0, t + len)
  src.connect(f).connect(g).connect(c.destination); src.start(t)
}
export const ding = () => { tone(1320, 0, 0.5, 0.1); tone(1980, 0.005, 0.35, 0.04) }
export const win = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 0.09, 'triangle'))
export const lose = () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.12, 0.3, 0.08, 'triangle'))
export const tick = () => tone(880, 0, 0.06, 0.05, 'square')
export const vibrate = (ms = 40) => { try { navigator.vibrate?.(ms) } catch { /* rien */ } }
