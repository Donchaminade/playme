import { animate } from 'motion/react'
import { CELL_RATIO, pt, angleAt, easeFn, type P, type WavePlan } from './logic'

export const xf = (p: P, rot = 0, sc = 1) => `translate(${p.x * 100}%, ${(p.y / CELL_RATIO) * 100}%) rotate(${rot}deg) scale(${sc})`
export const cellXf = (c: number) => xf(pt(c))
export interface RunCtl { paused: boolean; cancelled: boolean; anim?: { pause(): void; play(): void; stop(): void } }
export const newCtl = (): RunCtl => ({ paused: false, cancelled: false })
/** Attente qui respecte la pause et l'annulation. */
export function wait(ms: number, ctl: RunCtl) {
  return new Promise<void>(res => {
    let left = ms, last = performance.now()
    const tick = () => {
      const now = performance.now(); if (!ctl.paused) left -= now - last; last = now
      if (ctl.cancelled || left <= 0) res(); else setTimeout(tick, 16)
    }
    tick()
  })
}
function paint(el: HTMLElement, w: WavePlan, from: number, s: number) {
  const m = w.move.cars[from], p = m.path(s), env = Math.sin(Math.PI * s)
  const sc = m.layer === 1 ? 1 + 0.12 * env : m.layer === -1 ? 1 - 0.08 * env : 1
  el.style.transform = xf(p, angleAt(m.angles, s), sc)
  el.style.zIndex = m.layer === 1 ? '30' : m.layer === -1 ? '2' : '10'
  el.style.filter = m.layer === 1 ? `drop-shadow(0 ${(14 * env).toFixed(1)}px ${(10 * env).toFixed(1)}px rgba(0,0,0,.65))` : ''
  el.style.opacity = m.layer === 1 ? String(1 - 0.12 * env) : ''
}
/** Joue un plan de vagues en animant directement les transformations (aucun relayout). Renvoie les positions finales. */
export async function runPlan(plan: WavePlan[], start: number[], els: (HTMLElement | null)[], ctl: RunCtl,
  onWave?: (i: number, w: WavePlan) => void): Promise<number[]> {
  let pos = [...start]
  for (let i = 0; i < plan.length; i++) {
    while (ctl.paused && !ctl.cancelled) await wait(50, ctl)
    if (ctl.cancelled) return pos
    const w = plan[i], ease = easeFn(w.ease), cur = pos
    onWave?.(i, w)
    await new Promise<void>(res => {
      const a = animate(0, 1, { duration: w.dur / 1000, ease: 'linear', onUpdate: v => { const s = ease(v); cur.forEach((cell, car) => { const el = els[car]; if (el) paint(el, w, cell, s) }) }, onComplete: () => res() })
      ctl.anim = { pause: () => a.pause(), play: () => a.play(), stop: () => { a.stop(); res() } }
      if (ctl.paused) a.pause()
    })
    ctl.anim = undefined
    if (ctl.cancelled) return pos
    pos = cur.map(c => w.move.cars[c].to)
    pos.forEach((c, car) => { const el = els[car]; if (el) { el.style.transform = cellXf(c); el.style.zIndex = ''; el.style.filter = ''; el.style.opacity = '' } })
    await wait(w.pause, ctl)
  }
  return pos
}
