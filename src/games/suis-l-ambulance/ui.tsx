import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { ScoreEntry } from '../../lib/leaderboard'

export function Classement({ list, onReset }: { list: ScoreEntry[]; onReset: () => void }) {
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

export function Confettis() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ i, x: Math.random() * 100, d: Math.random() * 0.6, c: ['#F5B800', '#F0435A', '#2F6BFF', '#F5A343', '#fff'][i % 5], r: Math.random() * 360 })), [])
  return <div className="pointer-events-none absolute inset-0">{bits.map(b => (
    <motion.span key={b.i} className="absolute top-0 h-3 w-1.5 rounded-sm" style={{ left: `${b.x}%`, backgroundColor: b.c }}
      initial={{ y: -20, rotate: b.r, opacity: 1 }} animate={{ y: 420, rotate: b.r + 540, opacity: 0 }} transition={{ duration: 2.2, delay: b.d, repeat: Infinity, repeatDelay: 0.6 }} />))}</div>
}
