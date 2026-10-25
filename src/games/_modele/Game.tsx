import { useState } from 'react'
import { Link } from 'react-router-dom'
import { genererManche, scorePour, type Manche } from './logic'
import { loadScores, saveScore, type ScoreEntry } from '../../lib/leaderboard'

const SLUG = 'mon-jeu' // ⚠️ à remplacer par le slug de ton jeu (identique à celui du registre)
const MANCHES = 5

/** Composant de jeu minimal : export par défaut, sans props (contrat du registre). */
export default function Game() {
  const [manche, setManche] = useState<Manche>(() => genererManche(Math.random))
  const [tour, setTour] = useState(0)
  const [score, setScore] = useState(0)
  const [debut, setDebut] = useState(() => Date.now())
  const [fin, setFin] = useState(false)
  const [classement, setClassement] = useState<ScoreEntry[]>(() => loadScores(SLUG))

  const choisir = (i: number) => {
    const total = score + (i === manche.bonne ? scorePour(Date.now() - debut) : 0)
    setScore(total)
    if (tour + 1 >= MANCHES) {
      setClassement(saveScore(SLUG, { nom: 'Joueur', score: total, niveau: 1, temps: 0, date: Date.now() }))
      setFin(true)
    } else {
      setTour(tour + 1); setManche(genererManche(Math.random)); setDebut(Date.now())
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-6 px-4 py-6">
      <Link to="/" className="self-start rounded-full border border-white/15 px-3 py-1 text-sm">← Jeux</Link>
      <h1 className="font-titre text-4xl">LE PLUS GRAND</h1>
      <p className="text-white/70" aria-live="polite">{fin ? `Terminé : ${score} pts` : `Manche ${tour + 1}/${MANCHES} · ${score} pts`}</p>
      {!fin && (
        <div className="grid w-full grid-cols-3 gap-3">
          {manche.nombres.map((n, i) => (
            <button key={i} onClick={() => choisir(i)}
              className="min-h-16 rounded-2xl bg-white/10 text-3xl font-bold motion-safe:active:scale-95">{n}</button>
          ))}
        </div>
      )}
      {fin && <button onClick={() => { setTour(0); setScore(0); setFin(false); setManche(genererManche(Math.random)); setDebut(Date.now()) }}
        className="min-h-12 rounded-xl bg-orange px-6 font-bold text-nuit">Rejouer</button>}
      {fin && <ol className="w-full text-sm text-white/70">{classement.slice(0, 5).map((e, i) => <li key={i}>{i + 1}. {e.nom} — {e.score}</li>)}</ol>}
    </main>
  )
}
