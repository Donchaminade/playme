import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Link } from 'react-router-dom'
import { Car } from './Car'
import { CELLS, COLS, ROWS, NIVEAUX, cellXY, generateShuffle, applyWaveToAll, scoreFor, type Wave } from './logic'
import { loadScores, saveScore, clearScores, type ScoreEntry } from '../../lib/leaderboard'

const SLUG = 'suis-l-ambulance'
type Phase = 'accueil' | 'montre' | 'sirene' | 'melange' | 'choix' | 'bravo' | 'perdu' | 'victoire'
const pct = (c: number) => { const { col, row } = cellXY(c); return { left: `${(col * 100) / COLS}%`, top: `${(row * 100) / ROWS}%` } }

export default function Game() {
  const [nom, setNom] = useState(() => localStorage.getItem('jeux-reflexion:nom') || '')
  const [phase, setPhase] = useState<Phase>('accueil')
  const [lvIdx, setLvIdx] = useState(0)
  const [ambCar, setAmbCar] = useState(0)
  const [pos, setPos] = useState<number[]>(() => Array.from({ length: CELLS }, (_, i) => i))
  const [prev, setPrev] = useState<number[]>(pos)
  const [vague, setVague] = useState(0)
  const [waves, setWaves] = useState<Wave[]>([])
  const [score, setScore] = useState(0)
  const [debut, setDebut] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [choisi, setChoisi] = useState<number | null>(null)
  const [classement, setClassement] = useState<ScoreEntry[]>(() => loadScores(SLUG))
  const choixDebut = useRef(0)
  const level = NIVEAUX[lvIdx]
  const enJeu = !['accueil', 'perdu', 'victoire'].includes(phase)
  const ecoule = enJeu ? now - debut : 0

  useEffect(() => { if (!enJeu) return; const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t) }, [enJeu])

  const lancerNiveau = (idx: number) => {
    const base = Array.from({ length: CELLS }, (_, i) => i)
    const amb = Math.floor(Math.random() * CELLS)
    setLvIdx(idx); setAmbCar(amb); setPos(base); setPrev(base); setVague(0); setChoisi(null)
    setWaves(generateShuffle(NIVEAUX[idx], amb)); setPhase('montre')
  }
  const demarrer = () => { localStorage.setItem('jeux-reflexion:nom', nom.trim()); setScore(0); setDebut(Date.now()); setNow(Date.now()); lancerNiveau(0) }

  useEffect(() => {
    let t: number | undefined
    if (phase === 'montre') t = window.setTimeout(() => setPhase('sirene'), 2400)
    else if (phase === 'sirene') t = window.setTimeout(() => setPhase('melange'), 700)
    else if (phase === 'melange') {
      if (vague >= waves.length) t = window.setTimeout(() => { choixDebut.current = Date.now(); setPhase('choix') }, 350)
      else t = window.setTimeout(() => { setPrev(pos); setPos(p => applyWaveToAll(p, waves[vague])); setVague(v => v + 1) }, vague === 0 ? 200 : level.dureeMs + 60)
    } else if (phase === 'bravo') t = window.setTimeout(() => lancerNiveau(lvIdx + 1), 1300)
    return () => clearTimeout(t)
  }, [phase, vague]) // eslint-disable-line

  const finir = (gagne: boolean, total: number) => {
    const entry = { nom: nom.trim() || 'Anonyme', score: total, niveau: gagne ? NIVEAUX.length : lvIdx + 1, temps: Math.round((Date.now() - debut) / 1000), date: Date.now() }
    setClassement(saveScore(SLUG, entry)); setPhase(gagne ? 'victoire' : 'perdu')
  }
  const choisir = (car: number) => {
    if (phase !== 'choix') return
    setChoisi(car)
    if (car === ambCar) {
      const total = score + scoreFor(level, Date.now() - choixDebut.current); setScore(total)
      if (lvIdx === NIVEAUX.length - 1) setTimeout(() => finir(true, total), 900); else setPhase('bravo')
    } else setTimeout(() => finir(false, score), 1400)
  }

  const montreAmb = phase === 'montre' || phase === 'bravo' || (phase === 'choix' && choisi !== null) || phase === 'perdu' || phase === 'victoire'
  const progression = phase === 'melange' ? vague / Math.max(1, waves.length) : phase === 'choix' || phase === 'bravo' ? 1 : 0
  const titre = phase === 'choix' || phase === 'perdu' ? ['OÙ EST ', "L'AMBULANCE ?"] : ['SUIS ', "L'AMBULANCE"]
  const ambCell = pos[ambCar]

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col items-center px-4 pb-8 pt-4">
      <header className="flex w-full items-center justify-between text-sm text-white/70">
        <Link to="/" className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10">← Jeux</Link>
        <div className="flex gap-3 font-semibold tabular-nums">
          <span>Niv. {enJeu ? level.niveau : '–'}/{NIVEAUX.length}</span>
          <span>⏱ {(ecoule / 1000).toFixed(1)} s</span>
          <span className="text-taxi">★ {score}</span>
        </div>
      </header>

      <h1 className="mt-5 text-center font-titre text-[clamp(1.9rem,8vw,3rem)] leading-none tracking-wide">
        {titre[0]}<span className="text-sirene">{titre[1]}</span>
      </h1>
      <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full bg-orange" animate={{ width: `${progression * 100}%` }} transition={{ duration: 0.3 }} />
      </div>

      <div className="relative mt-5 w-full" style={{ aspectRatio: `${COLS} / ${ROWS * 1.12}`, maxWidth: `calc((100dvh - 230px) * ${COLS / (ROWS * 1.12)})` }}>
        <div className="absolute inset-0 grid border border-trait/80 bg-grille shadow-[0_0_60px_rgba(80,90,180,.18)]" style={{ gridTemplateColumns: `repeat(${COLS},1fr)`, gridTemplateRows: `repeat(${ROWS},1fr)` }}>
          {Array.from({ length: CELLS }, (_, i) => <div key={i} className="border border-trait/40" />)}
        </div>
        {phase === 'montre' && (
          <motion.div className="absolute -left-4 z-10 h-0 w-0 border-y-[8px] border-l-[12px] border-y-transparent border-l-sirene"
            style={{ top: `calc(${pct(ambCell).top} + ${50 / ROWS}% - 8px)` }} animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} />
        )}
        {pos.map((cell, car) => {
          const from = pct(prev[car]), to = pct(cell)
          const moving = phase === 'melange' && prev[car] !== cell
          const a = cellXY(prev[car]), b = cellXY(cell)
          const dx = (b.col - a.col) * (100 / COLS), dy = (b.row - a.row) * (100 / ROWS) * 1.12
          let heading = (Math.atan2(dy, dx) * 180) / Math.PI + 90
          if (heading > 90) heading -= 180; if (heading < -90) heading += 180
          const midL = `calc((${from.left} + ${to.left}) / 2 + ${(-dy * 0.18).toFixed(2)}%)`
          const midT = `calc((${from.top} + ${to.top}) / 2 + ${(dx * 0.18).toFixed(2)}%)`
          const isAmb = car === ambCar
          const numero = phase === 'choix' || phase === 'perdu' ? cell + 1 : undefined
          return (
            <motion.button key={car} type="button" aria-label={numero ? `Voiture ${numero}` : 'Voiture'}
              onClick={() => choisir(car)} disabled={phase !== 'choix' || choisi !== null}
              className="absolute flex items-center justify-center p-[3%] outline-none"
              style={{ width: `${100 / COLS}%`, height: `${100 / ROWS}%`, zIndex: moving ? 5 : 1 }}
              initial={false}
              animate={moving ? { left: [from.left, midL, to.left], top: [from.top, midT, to.top], rotate: [0, heading, 0] } : { left: to.left, top: to.top, rotate: 0 }}
              transition={moving ? { duration: level.dureeMs / 1000, ease: 'easeInOut', times: [0, 0.5, 1] } : { duration: 0 }}
              whileTap={phase === 'choix' ? { scale: 0.9 } : undefined}>
              <div className="relative h-[78%]">
                {isAmb && phase === 'montre' && (
                  <motion.div className="absolute -inset-5 rounded-full blur-xl" animate={{ backgroundColor: ['rgba(240,67,90,.75)', 'rgba(47,107,255,.6)', 'rgba(240,67,90,.75)'], scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} />
                )}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div key={isAmb && montreAmb ? 'amb' : 'taxi'} className="relative h-full"
                    initial={{ opacity: 0, scale: 0.8, rotateY: 90 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.35 }}>
                    <Car ambulance={isAmb && montreAmb} numero={numero} />
                  </motion.div>
                </AnimatePresence>
                {choisi === car && (
                  <motion.div className={`absolute -inset-2 rounded-xl border-4 ${car === ambCar ? 'border-emerald-400' : 'border-sirene'}`} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />
                )}
              </div>
            </motion.button>
          )
        })}

        <AnimatePresence>
          {phase === 'bravo' && (
            <motion.div className="absolute inset-0 z-20 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="rounded-2xl bg-emerald-400 px-6 py-3 font-titre text-3xl text-nuit" initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>BIEN VU ! NIVEAU {level.niveau + 1}</motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 min-h-12 text-center text-white/75">
        {phase === 'montre' && <p>Repère l'ambulance… la sirène va s'éteindre !</p>}
        {phase === 'sirene' && <p className="font-semibold text-sirene">Sirène coupée 🔇</p>}
        {phase === 'melange' && <p>Ne la quitte pas des yeux…</p>}
        {phase === 'choix' && choisi === null && <span className="inline-block rounded-full bg-orange px-5 py-2 text-sm font-extrabold uppercase tracking-wide text-nuit">Touche le bon numéro ↓</span>}
        {phase === 'choix' && choisi !== null && choisi !== ambCar && <p className="font-semibold text-sirene">Raté ! C'était le n° {ambCell + 1}.</p>}
      </div>

      <AnimatePresence>
        {(phase === 'accueil' || phase === 'perdu' || phase === 'victoire') && (
          <motion.div className="fixed inset-0 z-30 flex items-end justify-center bg-nuit/80 p-4 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0d1124] p-6" initial={{ y: 60, scale: 0.95 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
              {phase === 'victoire' && <Confettis />}
              {phase === 'accueil' && (<>
                <h2 className="font-titre text-4xl">SUIS <span className="text-sirene">L'AMBULANCE</span></h2>
                <p className="mt-2 text-white/70">Repère l'ambulance, sa sirène s'éteint, puis les taxis se mélangent. Retrouve-la ! {NIVEAUX.length} niveaux, de plus en plus rapides.</p>
              </>)}
              {phase === 'perdu' && (<>
                <h2 className="font-titre text-4xl text-sirene">PERDU !</h2>
                <p className="mt-2 text-white/70">Tu as atteint le niveau {level.niveau} avec <b className="text-taxi">{score} pts</b>.</p>
              </>)}
              {phase === 'victoire' && (<>
                <motion.h2 className="font-titre text-5xl text-taxi" initial={{ scale: 0.3, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 10 }}>VICTOIRE ! 🚑</motion.h2>
                <p className="mt-2 text-white/80">Œil de lynx ! Les {NIVEAUX.length} niveaux réussis : <b className="text-taxi">{score} pts</b> en {Math.round((Date.now() - debut) / 1000)} s.</p>
              </>)}
              <label className="mt-5 block text-sm text-white/60">Nom du joueur (mode événement)
                <input value={nom} onChange={e => setNom(e.target.value)} maxLength={24} placeholder="Ex. Ama du GDG Lomé"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-orange" />
              </label>
              <button onClick={demarrer} className="mt-4 w-full rounded-xl bg-orange py-3 font-extrabold uppercase tracking-wide text-nuit active:scale-[.98]">
                {phase === 'accueil' ? 'Jouer' : 'Rejouer'}
              </button>
              <Classement list={classement} onReset={() => { clearScores(SLUG); setClassement([]) }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Classement({ list, onReset }: { list: ScoreEntry[]; onReset: () => void }) {
  if (!list.length) return <p className="mt-4 text-center text-sm text-white/40">Aucun score pour l'instant.</p>
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between"><h3 className="font-titre text-xl tracking-wide">CLASSEMENT</h3>
        <button onClick={() => confirm('Effacer le classement ?') && onReset()} className="text-xs text-white/40 underline">Réinitialiser</button></div>
      <ol className="mt-2 max-h-44 space-y-1 overflow-auto text-sm">
        {list.slice(0, 10).map((e, i) => (
          <li key={e.date + e.nom} className="flex justify-between rounded-lg bg-white/5 px-3 py-1.5">
            <span>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} {e.nom}</span>
            <span className="tabular-nums text-white/70">niv. {e.niveau} · {e.temps}s · <b className="text-taxi">{e.score}</b></span>
          </li>))}
      </ol>
    </div>
  )
}

function Confettis() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ i, x: Math.random() * 100, d: Math.random() * 0.6, c: ['#F5B800', '#F0435A', '#2F6BFF', '#F5A343', '#fff'][i % 5], r: Math.random() * 360 })), [])
  return <div className="pointer-events-none absolute inset-0">{bits.map(b => (
    <motion.span key={b.i} className="absolute top-0 h-3 w-1.5 rounded-sm" style={{ left: `${b.x}%`, backgroundColor: b.c }}
      initial={{ y: -20, rotate: b.r, opacity: 1 }} animate={{ y: 420, rotate: b.r + 540, opacity: 0 }} transition={{ duration: 2.2, delay: b.d, repeat: Infinity, repeatDelay: 0.6 }} />))}</div>
}
