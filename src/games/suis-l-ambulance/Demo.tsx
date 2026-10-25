import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, animate } from 'motion/react'
import { Link, useSearchParams } from 'react-router-dom'
import { Board } from './Board'
import { CELLS, NIVEAUX, buildPlan, buildVitrine, MOTIFS, type WavePlan } from './logic'
import { runPlan, newCtl, type RunCtl } from './engine'
import * as snd from './sound'

type Phase = 'pret' | 'montre' | 'sirene' | 'melange' | 'choix' | 'revele'
const COMPTE = 8
const ident = () => Array.from({ length: CELLS }, (_, i) => i)

/** Mode démo / grand écran : manches en boucle, compte à rebours pour le public, révélation. */
export default function Demo() {
  const [params] = useSearchParams()
  const vitrine = params.get('vitrine') === '1'
  const [manche, setManche] = useState(1)
  const [phase, setPhase] = useState<Phase>('pret')
  const [pos, setPos] = useState<number[]>(ident)
  const [ambCar, setAmbCar] = useState(0)
  const [plan, setPlan] = useState<WavePlan[]>([])
  const [vague, setVague] = useState(0)
  const [reste, setReste] = useState(COMPTE)
  const [paused, setPaused] = useState(false)
  const [son, setSon] = useState(snd.soundOn)
  const carEls = useRef<(HTMLDivElement | null)[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const ctl = useRef<RunCtl>(newCtl())
  const pausedRef = useRef(false)
  const lvIdx = Math.min(NIVEAUX.length - 1, manche - 1)
  const level = NIVEAUX[lvIdx]

  const nouvelleManche = useCallback((m: number) => {
    ctl.current.cancelled = true; ctl.current.anim?.stop()
    const amb = Math.floor(Math.random() * CELLS), idx = Math.min(NIVEAUX.length - 1, m - 1)
    setManche(m); setAmbCar(amb); setPos(ident()); setVague(0); setReste(COMPTE)
    setPlan(vitrine ? buildVitrine(Math.random, amb) : buildPlan(NIVEAUX[idx], Math.random, amb)); setPhase('montre')
  }, [vitrine])

  // minuterie de phase qui respecte la pause
  const after = (ms: number, fn: () => void) => {
    let left = ms, last = performance.now(), alive = true
    const tick = () => { if (!alive) return; const n = performance.now(); if (!pausedRef.current) left -= n - last; last = n; if (left <= 0) fn(); else setTimeout(tick, 30) }
    setTimeout(tick, 30); return () => { alive = false }
  }
  useEffect(() => {
    if (phase === 'montre') return after(3000, () => setPhase('sirene'))
    if (phase === 'sirene') return after(800, () => setPhase('melange'))
    if (phase === 'melange') {
      const c = newCtl(); c.paused = pausedRef.current; ctl.current = c
      runPlan(plan, pos, carEls.current, c, (i, w) => { setVague(i + 1); if (w.tag === 'rafale' || w.tag === 'final') snd.whoosh(w.dur) }).then(fin => {
        if (c.cancelled) return
        setPos(fin); snd.ding(); snd.vibrate(40)
        if (boardRef.current) animate(boardRef.current, { scale: [1, 1.03, 0.995, 1] }, { duration: 0.35 })
        setTimeout(() => setPhase('choix'), 300)
      })
      return () => { c.cancelled = true; c.anim?.stop() }
    }
    if (phase === 'choix') {
      if (reste <= 0) { setPhase('revele'); return }
      return after(1000, () => { setReste(r => r - 1); if (reste <= 4) snd.tick() })
    }
    if (phase === 'revele') { snd.win(); return after(4500, () => nouvelleManche(manche + 1)) }
  }, [phase, reste]) // eslint-disable-line

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setPaused(p => { const n = !p; pausedRef.current = n; ctl.current.paused = n; if (n) ctl.current.anim?.pause(); else ctl.current.anim?.play(); return n }) }
      else if (e.key === 'ArrowRight') nouvelleManche(manche + 1)
      else if (e.key.toLowerCase() === 'r' && phase === 'choix') setPhase('revele')
      else if (e.key.toLowerCase() === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [manche, phase, nouvelleManche])

  const titre = phase === 'choix' || phase === 'revele' ? ['OÙ EST ', "L'AMBULANCE ?"] : ['SUIS ', "L'AMBULANCE"]
  const motif = phase === 'melange' && vague > 0 ? plan[vague - 1]?.move.motif : undefined

  return (
    <div className="relative flex h-dvh w-full flex-col items-center overflow-hidden px-6 py-4">
      <div className="flex w-full items-center justify-between text-white/60">
        <Link to="/jeux/suis-l-ambulance" className="rounded-full border border-white/15 px-3 py-1 text-sm hover:bg-white/10">← Jeu</Link>
        <div className="font-titre text-[clamp(1rem,2.4vw,1.8rem)] tracking-wider text-white/80">
          {vitrine ? 'VITRINE DES MOUVEMENTS' : `MANCHE ${manche} · ${level.niveau === 6 ? 'EXPERT' : `NIVEAU ${level.niveau}`}`}
        </div>
        <button onClick={() => { snd.setSound(!son); setSon(!son) }} className="rounded-full border border-white/15 px-3 py-1 text-sm">{son ? '🔊' : '🔇'}</button>
      </div>
      <h1 className="mt-2 text-center font-titre text-[clamp(2rem,6vh,4.5rem)] leading-none tracking-wide">{titre[0]}<span className="text-sirene">{titre[1]}</span></h1>
      <div className="mt-2 h-[min(2.5vh,26px)] text-center text-[clamp(.9rem,2.2vh,1.4rem)] text-white/60">
        {phase === 'montre' && "Repérez l'ambulance !"}
        {phase === 'sirene' && <span className="text-sirene">Sirène coupée 🔇</span>}
        {phase === 'melange' && (motif ? <span>{vitrine ? <b className="text-orange">{MOTIFS[motif].nom}</b> : 'Suivez-la…'}</span> : 'Suivez-la…')}
      </div>
      <div className="relative mt-3 flex w-full flex-1 items-start justify-center">
        <div className="w-full">
          <Board ref={boardRef} pos={pos} ambCar={ambCar} carEls={carEls} big maxHeight="100dvh - 160px"
            showAmb={phase === 'montre' || phase === 'revele'} glow={phase === 'montre'} reveal={phase === 'revele'} numbers={phase === 'choix' || phase === 'revele'} />
        </div>
        <AnimatePresence>
          {phase === 'choix' && (
            <motion.div key={reste} className="pointer-events-none absolute right-[4%] top-[30%] font-titre text-[clamp(4rem,18vh,12rem)] text-orange drop-shadow-[0_6px_0_#000]"
              initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.3 }}>{reste}</motion.div>
          )}
          {phase === 'revele' && (
            <motion.div className="pointer-events-none absolute right-[3%] top-[30%] rounded-3xl bg-emerald-400 px-8 py-4 text-center font-titre text-nuit"
              initial={{ scale: 0.3, rotate: -10 }} animate={{ scale: 1, rotate: -3 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
              <div className="text-[clamp(1.2rem,3vh,2rem)]">C'ÉTAIT LE</div><div className="text-[clamp(4rem,14vh,9rem)] leading-none">{pos[ambCar] + 1}</div>
            </motion.div>
          )}
          {phase === 'pret' && (
            <motion.div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-nuit/85 text-center" exit={{ opacity: 0 }}>
              <p className="max-w-xl text-[clamp(1rem,2.5vh,1.5rem)] text-white/70">Mode démo / grand écran : le public suit l'ambulance et crie le numéro avant la fin du compte à rebours.</p>
              <button onClick={() => { snd.tick(); nouvelleManche(1) }} className="rounded-2xl bg-orange px-10 py-4 font-titre text-[clamp(1.5rem,4vh,2.5rem)] text-nuit">LANCER</button>
              <p className="text-sm text-white/40">Espace : pause · → : manche suivante · R : révéler · F : plein écran</p>
            </motion.div>
          )}
        </AnimatePresence>
        {paused && <div className="absolute inset-x-0 top-1/2 z-50 text-center font-titre text-6xl text-white/90">PAUSE</div>}
      </div>
      <p className="mt-1 text-xs text-white/30">Espace pause · → manche suivante · R révéler · F plein écran</p>
    </div>
  )
}
