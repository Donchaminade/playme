import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, animate } from 'motion/react'
import { Board } from './Board'
import { Confettis } from './ui'
import { CELLS, NIVEAUX, type WavePlan } from './logic'
import { runPlan, newCtl } from './engine'
import { mancheSeedee } from './partie'
import * as snd from './sound'
import {
  COULEURS, DELAI_REPONSE, joueursParDefaut, reponsesVides, verrouiller, fenetreFermee, scoreManche, classer, niveauManche,
  type Joueur, type Reponse, type ResultatJoueur,
} from '../../lib/multijoueur'
import { nouvelleGraine } from '../../lib/defi'
import { messagePartage } from '../../lib/partage'
import { BoutonPartage } from '../../lib/Partage'

const SLUG = 'suis-l-ambulance', TITRE = "Suis l'ambulance"
type Phase = 'config' | 'montre' | 'sirene' | 'melange' | 'choix' | 'revele' | 'scores' | 'podium'
type Place = 'bas' | 'haut' | 'droite' | 'gauche'
const ident = () => Array.from({ length: CELLS }, (_, i) => i)

/** Touches clavier (codes physiques) par joueur, sur ordinateur : 3 rangées de 12 touches. */
export const RANGEES_CLAVIER: string[][] = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Backslash'],
]
const LIBELLES_QWERTY: Record<string, string> = { Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backslash: '\\' }
const libelleDefaut = (code: string) => LIBELLES_QWERTY[code] ?? code.replace(/^(Digit|Key)/, '')

function useOrdinateur() {
  const q = '(min-width: 1024px) and (pointer: fine)'
  const [v, setV] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => { const m = matchMedia(q); const f = () => setV(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return v
}
function useLibellesClavier() {
  const [map, setMap] = useState<Record<string, string>>({})
  useEffect(() => {
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard
    kb?.getLayoutMap?.().then(m => { const o: Record<string, string> = {}; m.forEach((v, k) => { o[k] = v.toUpperCase() }); setMap(o) }).catch(() => {})
  }, [])
  return (code: string) => map[code] ?? libelleDefaut(code)
}

/** Places à 2 et 3 joueurs (appareil à plat) : bas/haut face à face, 3e joueur sur le bord droit. */
export const placesPour = (n: number): Place[] => (n === 1 ? ['bas'] : n === 2 ? ['bas', 'haut'] : ['bas', 'haut', 'droite'])

export default function Multi({ onQuitter }: { onQuitter: () => void }) {
  const ordi = useOrdinateur()
  const grand = typeof innerWidth !== 'undefined' && innerWidth >= 768
  const touche = useLibellesClavier()
  const [nb, setNb] = useState(2)
  const [joueurs, setJoueurs] = useState<Joueur[]>(() => {
    try { const j = JSON.parse(localStorage.getItem('jeux-reflexion:multi:joueurs') || 'null'); if (Array.isArray(j) && j.length === 3) return j } catch { /* défaut */ }
    return joueursParDefaut(3)
  })
  const [manches, setManches] = useState(5)
  const [phase, setPhase] = useState<Phase>('config')
  const [k, setK] = useState(0)
  const [graine, setGraine] = useState(nouvelleGraine)
  const [pos, setPos] = useState<number[]>(ident)
  const [ambCar, setAmbCar] = useState(0)
  const [plan, setPlan] = useState<WavePlan[]>([])
  const [reps, setReps] = useState<Reponse[]>(() => reponsesVides(2))
  const [resultats, setResultats] = useState<ResultatJoueur[]>([])
  const [totaux, setTotaux] = useState<number[]>([0, 0, 0])
  const [reste, setReste] = useState(DELAI_REPONSE)
  const carEls = useRef<(HTMLDivElement | null)[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const t0 = useRef(0)
  const repsRef = useRef(reps); repsRef.current = reps
  const actifs = joueurs.slice(0, nb)
  const places = placesPour(nb)
  const niveau = niveauManche(k, manches)
  const bonne = pos[ambCar]

  const lancerManche = (i: number, g = graine) => {
    const lv = NIVEAUX[niveauManche(i, manches) - 1], m = mancheSeedee(g, i, lv)
    setK(i); setAmbCar(m.amb); setPlan(m.plan); setPos(ident()); setReps(reponsesVides(nb)); setResultats([]); setReste(DELAI_REPONSE); setPhase('montre')
  }
  const demarrer = () => {
    localStorage.setItem('jeux-reflexion:multi:joueurs', JSON.stringify(joueurs))
    const g = nouvelleGraine(); setGraine(g); setTotaux([0, 0, 0]); snd.tick(); lancerManche(0, g)
  }

  useEffect(() => {
    let t: number | undefined
    if (phase === 'montre') t = window.setTimeout(() => setPhase('sirene'), 2400)
    else if (phase === 'sirene') t = window.setTimeout(() => setPhase('melange'), 700)
    else if (phase === 'melange') {
      const ctl = newCtl()
      t = window.setTimeout(async () => {
        const fin = await runPlan(plan, pos, carEls.current, ctl, (_, w) => { if (w.tag === 'rafale' || w.tag === 'final') snd.whoosh(w.dur) })
        if (ctl.cancelled) return
        setPos(fin); snd.ding(); snd.vibrate(40)
        if (boardRef.current) animate(boardRef.current, { scale: [1, 1.03, 0.995, 1] }, { duration: 0.35 })
        window.setTimeout(() => { t0.current = performance.now(); setPhase('choix') }, 300)
      }, 250)
      return () => { clearTimeout(t); ctl.cancelled = true; ctl.anim?.stop() }
    } else if (phase === 'choix') {
      const iv = window.setInterval(() => {
        const e = performance.now() - t0.current; setReste(Math.max(0, DELAI_REPONSE - e))
        if (fenetreFermee(repsRef.current, e)) { clearInterval(iv); window.setTimeout(reveler, 250) }
      }, 50)
      return () => clearInterval(iv)
    } else if (phase === 'revele') t = window.setTimeout(() => setPhase(k + 1 >= manches ? 'podium' : 'scores'), 3200)
    return () => clearTimeout(t)
  }, [phase]) // eslint-disable-line

  const reveler = () => {
    const r = scoreManche(repsRef.current, pos[ambCar])
    setResultats(r); setTotaux(t => t.map((v, i) => v + (r[i]?.points ?? 0)))
    if (r.some(x => x.juste)) snd.win(); else snd.lose()
    setPhase('revele')
  }
  const choisir = (j: number, cell: number) => {
    if (phase !== 'choix') return
    const next = verrouiller(repsRef.current, j, cell, performance.now() - t0.current)
    if (next !== repsRef.current) { repsRef.current = next; setReps(next); snd.tick(); snd.vibrate(15) }
  }
  useEffect(() => { if (phase === 'podium') snd.win() }, [phase])

  // clavier (ordinateur) : chaque joueur a sa rangée de 12 touches
  useEffect(() => {
    if (!ordi) return
    const f = (e: KeyboardEvent) => {
      if (e.repeat) return
      RANGEES_CLAVIER.slice(0, nb).forEach((row, j) => { const i = row.indexOf(e.code); if (i >= 0) { e.preventDefault(); choisir(j, i) } })
    }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  })

  const classement = useMemo(() => classer(totaux.slice(0, nb)), [totaux, nb])

  if (phase === 'config') return <Config {...{ nb, setNb, joueurs, setJoueurs, manches, setManches, onQuitter, demarrer, ordi, touche }} />

  const zone = (j: number) => (
    <Zone key={j} joueur={actifs[j]} index={j} place={ordi ? (j === 0 ? 'gauche' : j === 1 ? 'droite' : 'bas') : places[j]} ordi={ordi}
      phase={phase} reponse={reps[j]} resultat={resultats[j]} total={totaux[j]} reste={reste} bonne={bonne}
      touches={ordi ? RANGEES_CLAVIER[j].map(touche) : undefined} onPick={cell => choisir(j, cell)} />
  )
  const marques = (_car: number, cell: number) => phase === 'revele' && (
    <div className="pointer-events-none absolute inset-x-0 -bottom-1 z-50 flex justify-center gap-0.5">
      {actifs.map((jo, j) => reps[j]?.choix === cell && (
        <motion.span key={j} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15 * j }}
          className="rounded-full px-1.5 text-[11px] font-black leading-5 text-nuit ring-2 ring-nuit" style={{ background: jo.couleur }}>
          {jo.nom.slice(0, 1).toUpperCase()}{cell === bonne ? '✓' : '✗'}
        </motion.span>
      ))}
    </div>
  )
  const plateau = (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-2">
      <div className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-white/50">
        Manche {k + 1}/{manches} · Niv. {niveau} · {phase === 'choix' ? 'à vous !' : phase === 'montre' ? "repérez l'ambulance" : phase === 'melange' ? 'suivez-la…' : phase === 'revele' ? `c'était le n° ${bonne + 1}` : ''}
      </div>
      <div className="w-full">
        <Board ref={boardRef} pos={pos} ambCar={ambCar} carEls={carEls} showAmb={phase === 'montre' || phase === 'revele' || phase === 'scores'} glow={phase === 'montre'}
          numbers={phase === 'choix' || phase === 'revele'} reveal={phase === 'revele'} overlay={marques}
          maxHeight={ordi ? (nb === 3 ? '100dvh - 300px' : '100dvh - 120px') : `100dvh - ${(nb === 1 ? 250 : 400) + (grand ? 130 : 0)}px`} />
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 flex select-none flex-col overflow-hidden bg-nuit" style={{ touchAction: 'manipulation' }}>
      {ordi ? (
        <div className="flex h-full flex-col">
          <div className="flex min-h-0 flex-1 gap-4 p-4">{zone(0)}{plateau}{nb > 1 && zone(1)}</div>
          {nb > 2 && <div className="px-4 pb-4">{zone(2)}</div>}
        </div>
      ) : (<>
        {nb > 1 && zone(1)}
        <div className="flex min-h-0 flex-1">{plateau}{nb > 2 && zone(2)}</div>
        {zone(0)}
      </>)}
      <button onClick={onQuitter} aria-label="Quitter la partie" className="absolute left-2 top-1/2 z-[70] -translate-y-1/2 rounded-full border border-white/15 bg-nuit/80 px-2 py-1 text-xs text-white/60">✕</button>

      <AnimatePresence>
        {(phase === 'scores' || phase === 'podium') && (
          <motion.div className="fixed inset-0 z-[75] flex items-center justify-center bg-nuit/85 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1124] p-6" initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}>
              {phase === 'podium' && <Confettis />}
              {phase === 'scores' ? (<>
                <h2 className="text-center font-titre text-3xl">SCORES · MANCHE {k + 1}/{manches}</h2>
                <ol className="mt-4 space-y-2">
                  {classement.map(c => (
                    <motion.li key={c.joueur} layout className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                      <span className="w-6 font-titre text-xl text-white/60">{c.rang}</span>
                      <span className="h-4 w-4 rounded-full" style={{ background: actifs[c.joueur].couleur }} />
                      <span className="flex-1 font-semibold">{actifs[c.joueur].nom}</span>
                      <span className="text-sm text-emerald-400">{resultats[c.joueur]?.points ? `+${resultats[c.joueur].points}` : '+0'}</span>
                      <span className="w-16 text-right font-titre text-xl text-taxi">{c.total}</span>
                    </motion.li>
                  ))}
                </ol>
                <button onClick={() => lancerManche(k + 1)} className="mt-5 min-h-12 w-full rounded-xl bg-orange font-extrabold uppercase text-nuit">Manche suivante (niv. {niveauManche(k + 1, manches)})</button>
              </>) : (
                <Podium joueurs={actifs} classement={classement} onRejouer={demarrer} onQuitter={onQuitter} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Zone({ joueur, index, place, ordi, phase, reponse, resultat, total, reste, bonne, touches, onPick }: {
  joueur: Joueur; index: number; place: Place; ordi: boolean; phase: Phase; reponse?: Reponse; resultat?: ResultatJoueur
  total: number; reste: number; bonne: number; touches?: string[]; onPick: (cell: number) => void
}) {
  const ouvert = phase === 'choix' && reponse?.choix === null
  const verrouille = reponse?.choix != null
  const rot = ordi ? 0 : place === 'haut' ? 180 : place === 'droite' ? -90 : place === 'gauche' ? 90 : 0
  const cote = !ordi && (place === 'droite' || place === 'gauche')
  const statut = phase === 'choix' ? (verrouille ? '🔒 Réponse verrouillée' : `${Math.ceil(reste / 1000)} s`)
    : phase === 'revele' ? (resultat?.juste ? `✓ Juste ! +${resultat.points}${resultat.plusRapide ? ' ⚡' : ''}` : reponse?.choix == null ? '⏱ Trop tard' : `✗ Faux (n° ${reponse.choix + 1})`)
    : phase === 'melange' ? 'Suis-la…' : 'Prêt ?'
  const contenu = (
    <div className={`flex h-full w-full flex-col gap-1.5 rounded-2xl border-2 p-2 ${ordi ? '' : ''}`} style={{ borderColor: joueur.couleur, background: `${joueur.couleur}14` }} data-joueur={index}>
      <div className="flex items-center justify-between gap-2 px-1 text-sm">
        <span className="truncate font-bold" style={{ color: joueur.couleur }}>{joueur.nom}</span>
        <span className={`font-titre text-lg tabular-nums ${phase === 'choix' && !verrouille && reste < 2000 ? 'text-sirene' : phase === 'revele' ? (resultat?.juste ? 'text-emerald-400' : 'text-sirene') : 'text-white'}`} aria-live="polite">{statut}</span>
        <span className="font-titre text-lg text-taxi">{total}</span>
      </div>
      {phase === 'choix' && !verrouille && (
        <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full" style={{ width: `${(reste / DELAI_REPONSE) * 100}%`, background: joueur.couleur, transition: 'width 50ms linear' }} /></div>
      )}
      <div className={`relative grid min-h-0 flex-1 gap-1.5 ${ordi && place !== 'bas' ? 'grid-cols-3' : 'grid-cols-6'}`}>
        {Array.from({ length: CELLS }, (_, cell) => (
          <button key={cell} type="button" disabled={!ouvert} aria-label={`${joueur.nom} : voiture ${cell + 1}`}
            onPointerDown={e => { e.preventDefault(); onPick(cell) }}
            className="relative flex min-h-11 items-center justify-center rounded-xl font-titre text-2xl md:text-4xl text-nuit transition-opacity disabled:opacity-35"
            style={{ background: joueur.couleur, touchAction: 'none', opacity: phase === 'revele' && cell === bonne ? 1 : undefined, outline: phase === 'revele' && cell === bonne ? '3px solid #34d399' : undefined }}>
            {cell + 1}
            {touches && <span className="absolute right-1 top-0.5 font-sans text-[10px] font-bold text-nuit/60">{touches[cell]}</span>}
          </button>
        ))}
        {phase === 'choix' && verrouille && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-nuit/85 text-center font-titre text-2xl" style={{ color: joueur.couleur }}>🔒 VERROUILLÉ</div>
        )}
      </div>
    </div>
  )
  if (ordi) return <div className={place === 'bas' ? 'mx-auto h-44 w-full max-w-3xl' : 'w-72 shrink-0'}>{contenu}</div>
  if (cote) return (
    <div className="relative w-[118px] shrink-0 md:w-[170px]" style={{ containerType: 'size' }}>
      <div className="absolute left-1/2 top-1/2 p-1" style={{ width: '100cqh', height: '100cqw', transform: `translate(-50%, -50%) rotate(${rot}deg)` }}>{contenu}</div>
    </div>
  )
  return <div className="h-[178px] shrink-0 p-1.5 md:h-[240px]" style={{ transform: rot ? `rotate(${rot}deg)` : undefined }}>{contenu}</div>
}

function Config({ nb, setNb, joueurs, setJoueurs, manches, setManches, onQuitter, demarrer, ordi, touche }: {
  nb: number; setNb: (n: number) => void; joueurs: Joueur[]; setJoueurs: (j: Joueur[]) => void; manches: number; setManches: (n: number) => void
  onQuitter: () => void; demarrer: () => void; ordi: boolean; touche: (c: string) => string
}) {
  const maj = (i: number, p: Partial<Joueur>) => setJoueurs(joueurs.map((j, k) => (k === i ? { ...j, ...p } : j)))
  const prises = joueurs.slice(0, nb).map(j => j.couleur)
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5">
      <button onClick={onQuitter} className="self-start rounded-full border border-white/15 px-3 py-1 text-sm text-white/70">← Solo</button>
      <h1 className="mt-4 font-titre text-4xl">À PLUSIEURS <span className="text-sirene">SUR CET APPAREIL</span></h1>
      <p className="mt-2 text-sm text-white/70">Posez le téléphone ou la tablette à plat entre vous. Chacun a son pavé de numéros sur son bord et 5 s pour répondre après le mélange.</p>
      <fieldset className="mt-5"><legend className="text-sm font-semibold text-white/60">Nombre de joueurs</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">{[1, 2, 3].map(n => (
          <button key={n} onClick={() => setNb(n)} aria-pressed={nb === n} className={`min-h-12 rounded-xl border font-titre text-2xl ${nb === n ? 'border-orange bg-orange text-nuit' : 'border-white/15'}`}>{n}</button>
        ))}</div>
      </fieldset>
      <div className="mt-4 space-y-3">
        {joueurs.slice(0, nb).map((j, i) => (
          <div key={i} className="rounded-2xl border-2 p-3" style={{ borderColor: j.couleur }}>
            <label className="block text-xs text-white/60">Prénom du joueur {i + 1} <span className="text-white/40">· {ordi ? `touches ${touche(RANGEES_CLAVIER[i][0])}…${touche(RANGEES_CLAVIER[i][11])}` : ['bord bas', 'bord haut', 'bord droit'][i]}</span>
              <input value={j.nom} maxLength={14} onChange={e => maj(i, { nom: e.target.value })} className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white outline-none" />
            </label>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label={`Couleur du joueur ${i + 1}`}>
              {COULEURS.map(c => {
                const prise = prises.includes(c.hex) && j.couleur !== c.hex
                return <button key={c.id} role="radio" aria-checked={j.couleur === c.hex} aria-label={c.nom} disabled={prise} onClick={() => maj(i, { couleur: c.hex })}
                  className={`h-11 w-11 rounded-full ring-offset-2 ring-offset-nuit disabled:opacity-20 ${j.couleur === c.hex ? 'ring-2 ring-white' : ''}`} style={{ background: c.hex }} />
              })}
            </div>
          </div>
        ))}
      </div>
      <fieldset className="mt-4"><legend className="text-sm font-semibold text-white/60">Manches</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">{[3, 5, 10].map(n => (
          <button key={n} onClick={() => setManches(n)} aria-pressed={manches === n} className={`min-h-12 rounded-xl border font-bold ${manches === n ? 'border-orange bg-orange text-nuit' : 'border-white/15'}`}>{n}</button>
        ))}</div>
      </fieldset>
      <button onClick={demarrer} className="mt-6 min-h-14 w-full rounded-xl bg-orange font-extrabold uppercase tracking-wide text-nuit">C'est parti !</button>
    </div>
  )
}

function Podium({ joueurs, classement, onRejouer, onQuitter }: {
  joueurs: Joueur[]; classement: { joueur: number; total: number; rang: number }[]; onRejouer: () => void; onQuitter: () => void
}) {
  const ordre = classement.length === 3 ? [classement[1], classement[0], classement[2]] : classement.length === 2 ? [classement[1], classement[0]] : classement
  const h = (rang: number) => (rang === 1 ? 150 : rang === 2 ? 105 : 75)
  const premiers = classement.filter(c => c.rang === 1).map(c => joueurs[c.joueur].nom)
  const gagnant = premiers.join(' et ')
  return (<>
    <h2 className="text-center font-titre text-4xl text-taxi">PODIUM 🏆</h2>
    <p className="mt-1 text-center text-white/70">{premiers.length > 1 ? `Égalité : ${gagnant} !` : `${gagnant} gagne !`}</p>
    <div className="mt-6 flex items-end justify-center gap-3" data-testid="podium">
      {ordre.map((c, i) => (
        <div key={c.joueur} className="flex w-24 flex-col items-center">
          <motion.div className="mb-1 text-center" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.25 }}>
            <div className="truncate font-bold" style={{ color: joueurs[c.joueur].couleur }}>{joueurs[c.joueur].nom}</div>
            <div className="font-titre text-xl text-taxi">{c.total}</div>
          </motion.div>
          <motion.div className="flex w-full items-start justify-center rounded-t-xl pt-2 font-titre text-4xl text-nuit" style={{ background: joueurs[c.joueur].couleur }}
            initial={{ height: 0 }} animate={{ height: h(c.rang) }} transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 + i * 0.25 }}>{c.rang}</motion.div>
        </div>
      ))}
    </div>
    <div className="mt-6 grid gap-2">
      <BoutonPartage className="w-full" libelle="Partager le résultat"
        texte={messagePartage({ score: classement[0].total, niveau: 5, jeu: TITRE, multi: { gagnant } })}
        url={`${location.origin}/jeux/${SLUG}`}
        carte={{ titre: TITRE, score: classement[0].total, niveau: 5, prenom: gagnant, sousTitre: 'Vainqueur à plusieurs !', url: `${location.origin}/jeux/${SLUG}` }} />
      <button onClick={onRejouer} className="min-h-12 rounded-xl bg-orange font-extrabold uppercase text-nuit">Revanche</button>
      <button onClick={onQuitter} className="min-h-11 text-sm text-white/60">Retour au jeu solo</button>
    </div>
  </>)
}
