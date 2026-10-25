import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, animate } from 'motion/react'
import { Link, useSearchParams } from 'react-router-dom'
import { Board } from './Board'
import { Classement, Confettis } from './ui'
import { CELLS, NIVEAUX, buildPlan, scoreFor, isExpertUnlocked, onLevelWon, MOTIFS, type WavePlan } from './logic'
import { runPlan, newCtl, type RunCtl } from './engine'
import * as snd from './sound'
import { mancheSeedee } from './partie'
import { DELAI_REPONSE } from '../../lib/multijoueur'
import { decoderDefi, encoderDefi, nouvelleGraine, type Defi } from '../../lib/defi'
import { messagePartage, formatPoints } from '../../lib/partage'
import { BoutonPartage } from '../../lib/Partage'
import Multi from './Multi'
import { loadScores, saveScore, clearScores, type ScoreEntry } from '../../lib/leaderboard'

const SLUG = 'suis-l-ambulance'
const TITRE = "Suis l'ambulance"
const urlJeu = () => `${location.origin}/jeux/${SLUG}`
type Phase = 'accueil' | 'montre' | 'sirene' | 'melange' | 'choix' | 'bravo' | 'perdu' | 'victoire'
const ident = () => Array.from({ length: CELLS }, (_, i) => i)

export default function Game() {
  const [params, setParams] = useSearchParams()
  if (params.get('mode') === 'multi') return <Multi onQuitter={() => setParams({})} />
  return <Solo onMulti={() => setParams({ mode: 'multi' })} />
}

function Solo({ onMulti }: { onMulti: () => void }) {
  const [params] = useSearchParams()
  const [defi] = useState<Defi | null>(() => { const d = decoderDefi(params.get('defi')); return d && d.jeu === SLUG ? d : null })
  const [graine, setGraine] = useState(() => defi?.graine ?? nouvelleGraine())
  const [reste, setReste] = useState(DELAI_REPONSE)
  const [tempsEcoule, setTempsEcoule] = useState(false)
  const [nom, setNom] = useState(() => localStorage.getItem('jeux-reflexion:nom') || '')
  const [phase, setPhase] = useState<Phase>('accueil')
  const [lvIdx, setLvIdx] = useState(0)
  const [lastIdx, setLastIdx] = useState(4)
  const [ambCar, setAmbCar] = useState(0)
  const [pos, setPos] = useState<number[]>(ident)
  const [plan, setPlan] = useState<WavePlan[]>([])
  const [vague, setVague] = useState(0)
  const [tag, setTag] = useState('')
  const [score, setScore] = useState(0)
  const [debut, setDebut] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [choisi, setChoisi] = useState<number | null>(null)
  const [classement, setClassement] = useState<ScoreEntry[]>(() => loadScores(SLUG))
  const [son, setSon] = useState(snd.soundOn)
  const [expert, setExpert] = useState(() => isExpertUnlocked(localStorage))
  const carEls = useRef<(HTMLDivElement | null)[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const ctlRef = useRef<RunCtl>(newCtl())
  const choixDebut = useRef(0)
  const level = NIVEAUX[lvIdx]
  const enJeu = !['accueil', 'perdu', 'victoire'].includes(phase)
  const ecoule = enJeu ? now - debut : 0

  useEffect(() => { if (!enJeu) return; const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t) }, [enJeu])

  const lancerNiveau = (idx: number) => {
    const { amb, plan } = mancheSeedee(graineRef.current, idx, NIVEAUX[idx])
    setLvIdx(idx); setAmbCar(amb); setPos(ident()); setVague(0); setTag(''); setChoisi(null); setTempsEcoule(false); setReste(DELAI_REPONSE)
    setPlan(plan); setPhase('montre')
  }
  const graineRef = useRef(graine)
  const demarrer = (startIdx: number) => {
    // une nouvelle partie hors défi tire une nouvelle graine ; un défi rejoue toujours la même
    const g = defi ? defi.graine : nouvelleGraine(); graineRef.current = g; setGraine(g)
    localStorage.setItem('jeux-reflexion:nom', nom.trim()); snd.tick()
    setLastIdx(startIdx === 5 ? 5 : 4); setScore(0); setDebut(Date.now()); setNow(Date.now()); lancerNiveau(startIdx)
  }
  // Lien direct animateur : ?niveau=N (le N6 seulement s'il est débloqué)
  useEffect(() => {
    const n = Number(params.get('niveau')); if (!n) return
    const idx = Math.min(n, isExpertUnlocked(localStorage) ? 6 : 5) - 1; if (idx >= 0) demarrer(idx)
  }, []) // eslint-disable-line

  useEffect(() => {
    let t: number | undefined
    if (phase === 'montre') t = window.setTimeout(() => setPhase('sirene'), 2400)
    else if (phase === 'sirene') t = window.setTimeout(() => setPhase('melange'), 700)
    else if (phase === 'melange') {
      const ctl = newCtl(); ctlRef.current = ctl
      t = window.setTimeout(async () => {
        const fin = await runPlan(plan, pos, carEls.current, ctl, (i, w) => { setVague(i + 1); setTag(w.tag); if (w.tag === 'rafale' || w.tag === 'final') snd.whoosh(w.dur) })
        if (ctl.cancelled) return
        setPos(fin); snd.ding(); snd.vibrate(40)
        if (boardRef.current) animate(boardRef.current, { scale: [1, 1.03, 0.995, 1] }, { duration: 0.35 })
        window.setTimeout(() => { choixDebut.current = Date.now(); setPhase('choix') }, 300)
      }, 250)
      return () => { clearTimeout(t); ctl.cancelled = true; ctl.anim?.stop() }
    } else if (phase === 'choix' && choisi === null) {
      // limite de 5 s après le mélange
      const iv = window.setInterval(() => {
        const r = Math.max(0, DELAI_REPONSE - (Date.now() - choixDebut.current)); setReste(r)
        if (r <= 0) { clearInterval(iv); setTempsEcoule(true); setChoisi(-1); snd.lose(); setTimeout(() => finir(false, scoreRef.current), 1400) }
      }, 100)
      return () => clearInterval(iv)
    } else if (phase === 'bravo') t = window.setTimeout(() => lancerNiveau(lvIdx + 1), 1300)
    return () => clearTimeout(t)
  }, [phase, choisi]) // eslint-disable-line

  const finir = (gagne: boolean, total: number) => {
    const entry = { nom: nom.trim() || 'Anonyme', score: total, niveau: gagne ? level.niveau : lvIdx + 1, temps: Math.round((Date.now() - debut) / 1000), date: Date.now() }
    setClassement(saveScore(SLUG, entry)); setPhase(gagne ? 'victoire' : 'perdu'); if (gagne) snd.win(); else snd.lose()
  }
  const scoreRef = useRef(0); scoreRef.current = score
  const choisir = (car: number) => {
    if (phase !== 'choix' || choisi !== null || Date.now() - choixDebut.current > DELAI_REPONSE) return
    setChoisi(car)
    if (car === ambCar) {
      const total = score + scoreFor(level, Date.now() - choixDebut.current); setScore(total); snd.ding()
      onLevelWon(level.niveau, localStorage); setExpert(isExpertUnlocked(localStorage))
      if (lvIdx >= lastIdx) setTimeout(() => finir(true, total), 900); else setPhase('bravo')
    } else setTimeout(() => finir(false, score), 1400)
  }

  const montreAmb = phase === 'montre' || phase === 'bravo' || (phase === 'choix' && choisi !== null) || phase === 'perdu' || phase === 'victoire'
  const progression = phase === 'melange' ? vague / Math.max(1, plan.length) : phase === 'choix' || phase === 'bravo' ? 1 : 0
  const titre = phase === 'choix' || phase === 'perdu' ? ['OÙ EST ', "L'AMBULANCE ?"] : ['SUIS ', "L'AMBULANCE"]
  const motifCourant = phase === 'melange' && vague > 0 ? plan[vague - 1]?.move.motif : undefined

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col items-center px-4 pb-8 pt-4">
      <header className="flex w-full items-center justify-between gap-2 text-sm text-white/70">
        <div className="flex gap-2">
          <Link to="/" className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10">← Jeux</Link>
          <button onClick={() => { snd.setSound(!son); setSon(!son) }} aria-label={son ? 'Couper le son' : 'Activer le son'} className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10">{son ? '🔊' : '🔇'}</button>
          <BoutonPartage libelle="" className="!min-h-0 rounded-full px-3 py-1 text-sm font-normal" texte={`Viens jouer à ${TITRE} sur PlayMe : retrouve l'ambulance parmi 12 taxis !`} url={urlJeu()} />
          <Link to={`/jeux/${SLUG}/demo`} className="hidden rounded-full border border-white/15 px-3 py-1 hover:bg-white/10 sm:inline">📺 Démo</Link>
        </div>
        <div className="flex gap-3 font-semibold tabular-nums">
          <span>{enJeu ? (level.niveau === 6 ? 'Expert' : `Niv. ${level.niveau}/5`) : 'Niv. –'}</span>
          <span>⏱ {(ecoule / 1000).toFixed(1)} s</span>
          <span className="text-taxi">★ {score}</span>
        </div>
      </header>

      <h1 className="mt-5 text-center font-titre text-[clamp(1.9rem,8vw,3rem)] leading-none tracking-wide">
        {titre[0]}<span className="text-sirene">{titre[1]}</span>
      </h1>
      {defi && <div className="mt-3 rounded-full border border-sirene/50 bg-sirene/15 px-4 py-1.5 text-sm font-semibold text-white" data-testid="banniere-defi">🏁 Défi de {defi.prenom} : {formatPoints(defi.score)} pts (niveau {defi.niveau})</div>}
      <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <motion.div className={`h-full ${tag === 'rafale' || tag === 'final' ? 'bg-sirene' : 'bg-orange'}`} animate={{ width: `${progression * 100}%` }} transition={{ duration: 0.3 }} />
      </div>

      <div className="relative mt-5 w-full">
        <Board ref={boardRef} pos={pos} ambCar={ambCar} carEls={carEls} showAmb={montreAmb} glow={phase === 'montre'}
          numbers={phase === 'choix' || phase === 'perdu'} picked={choisi} onPick={phase === 'choix' && choisi === null ? choisir : undefined} />
        <AnimatePresence>
          {phase === 'bravo' && (
            <motion.div className="absolute inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="rounded-2xl bg-emerald-400 px-6 py-3 font-titre text-3xl text-nuit" initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
                BIEN VU ! NIVEAU {level.niveau + 1}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 min-h-12 text-center text-white/75">
        {phase === 'montre' && <p>Repère l'ambulance… la sirène va s'éteindre ! <span className="text-white/40">({level.nom})</span></p>}
        {phase === 'sirene' && <p className="font-semibold text-sirene">Sirène coupée 🔇</p>}
        {phase === 'melange' && <p>{tag === 'rafale' ? <b className="text-sirene">Rafale !</b> : tag === 'feinte' ? 'Hmm…' : tag === 'final' ? <b className="text-sirene">Dernier virage !</b> : 'Ne la quitte pas des yeux…'}{motifCourant && <span className="ml-2 text-white/35">· {MOTIFS[motifCourant].nom}</span>}</p>}
        {phase === 'choix' && choisi === null && (
          <div className="flex items-center justify-center gap-3">
            <span className="inline-block rounded-full bg-orange px-5 py-2 text-sm font-extrabold uppercase tracking-wide text-nuit">Touche le bon numéro ↑</span>
            <span aria-live="polite" className={`font-titre text-3xl tabular-nums ${reste < 2000 ? 'text-sirene' : 'text-white'}`}>{Math.ceil(reste / 1000)}</span>
          </div>
        )}
        {phase === 'choix' && tempsEcoule && <p className="font-semibold text-sirene">Temps écoulé ! C'était le n° {pos[ambCar] + 1}.</p>}
        {phase === 'choix' && choisi !== null && choisi >= 0 && choisi !== ambCar && <p className="font-semibold text-sirene">Raté ! C'était le n° {pos[ambCar] + 1}.</p>}
      </div>

      <AnimatePresence>
        {(phase === 'accueil' || phase === 'perdu' || phase === 'victoire') && (
          <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-nuit/80 p-4 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="relative max-h-[94dvh] w-full max-w-md overflow-auto rounded-3xl border border-white/10 bg-[#0d1124] p-6" initial={{ y: 60, scale: 0.95 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
              {phase === 'victoire' && <Confettis />}
              {phase === 'accueil' && (<>
                <h2 className="font-titre text-4xl">SUIS <span className="text-sirene">L'AMBULANCE</span></h2>
                <p className="mt-2 text-white/70">Repère l'ambulance, sa sirène s'éteint, puis les 12 taxis se mélangent : cercles, carrousels, diagonales, tapis roulants… Retrouve-la en moins de 5 s ! 5 niveaux, puis le niveau Expert.</p>
                {defi && <p className="mt-3 rounded-xl bg-sirene/15 px-3 py-2 text-sm font-semibold">🏁 Défi de {defi.prenom} : {formatPoints(defi.score)} pts au niveau {defi.niveau}. Tu joues exactement les mêmes mélanges !</p>}
              </>)}
              {phase === 'perdu' && (<>
                <h2 className="font-titre text-4xl text-sirene">PERDU !</h2>
                <p className="mt-2 text-white/70">Tu as atteint le niveau {level.niveau} avec <b className="text-taxi">{score} pts</b>.</p>
              </>)}
              {phase === 'victoire' && (<>
                <motion.h2 className="font-titre text-5xl text-taxi" initial={{ scale: 0.3, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 10 }}>VICTOIRE ! 🚑</motion.h2>
                <p className="mt-2 text-white/80">{level.niveau === 6 ? 'Niveau Expert réussi !' : 'Les 5 niveaux réussis !'} <b className="text-taxi">{score} pts</b> en {Math.round((Date.now() - debut) / 1000)} s.</p>
                {level.niveau === 5 && <p className="mt-2 rounded-xl bg-sirene/15 px-3 py-2 text-sm font-semibold text-sirene">🔓 Niveau Expert débloqué !</p>}
              </>)}
              <label className="mt-5 block text-sm text-white/60">Nom du joueur (mode événement)
                <input value={nom} onChange={e => setNom(e.target.value)} maxLength={24} placeholder="Ex. Ama du GDG Lomé"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-orange" />
              </label>
              <button onClick={() => demarrer(defi?.niveau === 6 ? 5 : 0)} className="mt-4 w-full rounded-xl bg-orange py-3 font-extrabold uppercase tracking-wide text-nuit active:scale-[.98]">
                {phase === 'accueil' ? 'Jouer' : 'Rejouer'}
              </button>
              {phase !== 'accueil' && <Comparaison defi={defi} score={score} />}
              {phase !== 'accueil' && (
                <div className="mt-3 flex justify-center">
                  <BoutonPartage className="w-full" libelle="Partager mon score / défier un ami"
                    texte={messagePartage({ score, niveau: level.niveau, jeu: TITRE })}
                    url={`${urlJeu()}?defi=${encoderDefi({ jeu: SLUG, score, niveau: level.niveau, prenom: nom || 'Un ami', graine })}`}
                    carte={{ titre: TITRE, score, niveau: level.niveau, prenom: nom.trim() || 'Joueur', sousTitre: 'Tu peux me battre ?', url: urlJeu() }} />
                </div>
              )}
              <button onClick={onMulti} className="mt-2 min-h-12 w-full rounded-xl border border-white/20 py-3 font-extrabold uppercase tracking-wide text-white active:scale-[.98]">👥 2–3 joueurs sur cet appareil</button>
              {expert && <button onClick={() => demarrer(5)} className="mt-2 w-full rounded-xl border border-sirene py-3 font-extrabold uppercase tracking-wide text-sirene active:scale-[.98]">Niveau Expert</button>}
              <Link to={`/jeux/${SLUG}/demo`} className="mt-2 block text-center text-sm text-white/50 underline">📺 Mode démo / grand écran</Link>
              <Classement list={classement} onReset={() => { clearScores(SLUG); setClassement([]) }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Comparaison({ defi, score }: { defi: Defi | null; score: number }) {
  if (!defi) return null
  const diff = score - defi.score
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-center text-sm" data-testid="comparaison-defi">
      <div className="flex justify-around font-semibold"><span>Toi : <b className="text-taxi">{formatPoints(score)}</b></span><span>{defi.prenom} : <b className="text-taxi">{formatPoints(defi.score)}</b></span></div>
      <p className={`mt-1 font-titre text-xl ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-sirene' : 'text-white'}`}>
        {diff > 0 ? `DÉFI RELEVÉ ! +${formatPoints(diff)} PTS` : diff < 0 ? `ENCORE ${formatPoints(-diff)} PTS POUR GAGNER` : 'ÉGALITÉ PARFAITE !'}
      </p>
    </div>
  )
}
