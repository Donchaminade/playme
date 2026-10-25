import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { imageScore, liensReseaux, type CarteScore } from './partage'

interface Props { texte: string; url: string; carte?: CarteScore; libelle?: string; className?: string }

/** Bouton « Partager » : navigator.share (avec l'image si possible), sinon panneau copier / réseaux / image. */
export function BoutonPartage({ texte, url, carte, libelle = 'Partager', className = '' }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [copie, setCopie] = useState(false)
  const nomFichier = 'playme-score.png'

  const partager = async () => {
    if (navigator.share) {
      try {
        if (carte) {
          const f = new File([await imageScore(carte)], nomFichier, { type: 'image/png' })
          if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], text: `${texte} ${url}`, title: 'PlayMe' }); return }
        }
        await navigator.share({ text: texte, url, title: 'PlayMe' }); return
      } catch (e) { if ((e as Error).name === 'AbortError') return }
    }
    setOuvert(true)
  }
  const copier = async () => {
    try { await navigator.clipboard.writeText(`${texte} ${url}`) } catch {
      const t = document.createElement('textarea'); t.value = `${texte} ${url}`; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
    }
    setCopie(true); setTimeout(() => setCopie(false), 1800)
  }
  const telecharger = async () => {
    if (!carte) return
    const a = document.createElement('a'); a.href = URL.createObjectURL(await imageScore(carte)); a.download = nomFichier; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  return (<>
    <button type="button" onClick={partager} className={`min-h-11 rounded-xl border border-white/20 px-4 font-bold hover:bg-white/10 ${className}`}>📤 {libelle}</button>
    <AnimatePresence>
      {ouvert && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setOuvert(false)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div role="dialog" aria-label="Partager" className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d1124] p-5" onClick={e => e.stopPropagation()}
            initial={{ y: 40 }} animate={{ y: 0 }}>
            <h3 className="font-titre text-2xl">PARTAGER</h3>
            <p className="mt-2 rounded-xl bg-white/5 p-3 text-sm text-white/80">{texte}<br /><span className="break-all text-white/50">{url}</span></p>
            <button onClick={copier} className="mt-3 min-h-11 w-full rounded-xl bg-orange font-bold text-nuit">{copie ? '✓ Lien copié' : '🔗 Copier le lien'}</button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {liensReseaux(texte, url).map(l => (
                <a key={l.id} href={l.href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-white/15 text-sm font-semibold hover:bg-white/10">{l.nom}</a>
              ))}
            </div>
            {carte && <button onClick={telecharger} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 text-sm font-semibold hover:bg-white/10">🖼️ Télécharger l'image du score</button>}
            <button onClick={() => setOuvert(false)} className="mt-2 min-h-11 w-full text-sm text-white/50">Fermer</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </>)
}
