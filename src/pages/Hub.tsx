import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { games } from '../games'
export default function Hub() {
  useEffect(() => { document.title = 'Jeux de réflexion pour événements tech à Lomé' }, [])
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-5 py-10">
      <motion.p className="text-sm font-semibold uppercase tracking-[.25em] text-orange" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>Événements · Lomé</motion.p>
      <motion.h1 className="mt-2 font-titre text-[clamp(2.6rem,9vw,5rem)] leading-[.95]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        JEUX DE <span className="text-sirene">RÉFLEXION</span>
      </motion.h1>
      <p className="mt-3 max-w-xl text-white/70">Des défis d'attention rapides à jouer sur téléphone ou sur grand écran pendant vos meetups et événements. Choisis un jeu, entre ton nom et grimpe au classement.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {games.map((g, i) => {
          const card = (
            <motion.div className={`relative h-full overflow-hidden rounded-3xl border p-6 ${g.statut === 'actif' ? 'border-trait/50 bg-grille hover:border-orange' : 'border-white/10 bg-white/[.03] opacity-60'}`}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: g.statut === 'actif' ? 1 : 0.6, y: 0 }} transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 220, damping: 22 }}
              whileHover={g.statut === 'actif' ? { y: -4 } : undefined}>
              <div className="flex items-start justify-between"><span className="text-4xl">{g.emoji}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${g.statut === 'actif' ? 'bg-orange text-nuit' : 'bg-white/10 text-white/60'}`}>{g.statut === 'actif' ? 'Jouer' : 'Bientôt'}</span></div>
              <h2 className="mt-4 font-titre text-3xl tracking-wide">{g.titre.toUpperCase()}</h2>
              <p className="mt-1 text-white/70">{g.accroche}</p>
              <p className="mt-3 text-xs text-white/40">⏱ {g.duree}</p>
            </motion.div>)
          return g.statut === 'actif' ? <Link key={g.slug} to={`/jeux/${g.slug}`}>{card}</Link> : <div key={g.slug}>{card}</div>
        })}
      </div>
    </main>
  )
}
