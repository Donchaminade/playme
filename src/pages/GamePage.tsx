import { Suspense, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { findGame } from '../games'
export default function GamePage({ demo = false }: { demo?: boolean }) {
  const { slug } = useParams(); const g = findGame(slug)
  useEffect(() => { if (g) document.title = `${g.titre}${demo ? ' — Mode démo' : ''} — Jeux de réflexion` }, [g, demo])
  if (!g || !g.composant) return <div className="p-10 text-center"><p>Ce jeu arrive bientôt.</p><Link className="text-orange underline" to="/">Retour aux jeux</Link></div>
  const C = (demo && g.demo) || g.composant
  return <Suspense fallback={<p className="p-10 text-center text-white/50">Chargement…</p>}><C /></Suspense>
}
