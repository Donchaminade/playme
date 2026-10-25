/**
 * Multijoueur local (1 à 3 joueurs sur le même appareil) — logique pure, réutilisable par tout jeu
 * dont une manche se termine par « chacun choisit UNE réponse parmi N dans un temps limité ».
 */
export const DELAI_REPONSE = 5000
export const POINTS_JUSTE = 100, BONUS_RAPIDITE_MAX = 100, BONUS_PLUS_RAPIDE = 50

export interface Joueur { nom: string; couleur: string }
export const COULEURS = [
  { id: 'orange', hex: '#F5A343', nom: 'Orange' },
  { id: 'bleu', hex: '#4D8DFF', nom: 'Bleu' },
  { id: 'vert', hex: '#2BD47E', nom: 'Vert' },
  { id: 'rose', hex: '#FF5FA8', nom: 'Rose' },
  { id: 'violet', hex: '#A57BFF', nom: 'Violet' },
] as const
export const joueursParDefaut = (n: number): Joueur[] =>
  Array.from({ length: n }, (_, i) => ({ nom: `Joueur ${i + 1}`, couleur: COULEURS[i].hex }))

/** Réponse d'un joueur pendant la fenêtre de choix. `choix` = index de réponse, `ms` = délai depuis l'ouverture. */
export interface Reponse { choix: number | null; ms: number | null }
export const reponsesVides = (n: number): Reponse[] => Array.from({ length: n }, () => ({ choix: null, ms: null }))

/**
 * Verrouille la réponse d'un joueur : le PREMIER appui compte ; tout appui après DELAI_REPONSE est ignoré.
 * Renvoie un nouveau tableau (immuable) ou le même s'il n'y a rien à changer.
 */
export function verrouiller(reps: Reponse[], joueur: number, choix: number, ms: number, delai = DELAI_REPONSE): Reponse[] {
  if (joueur < 0 || joueur >= reps.length || reps[joueur].choix !== null || ms < 0 || ms > delai) return reps
  const out = reps.slice(); out[joueur] = { choix, ms }; return out
}
export const tousOntRepondu = (reps: Reponse[]) => reps.every(r => r.choix !== null)
/** La fenêtre de choix se ferme quand tout le monde a répondu ou quand le délai est écoulé. */
export const fenetreFermee = (reps: Reponse[], ecouleMs: number, delai = DELAI_REPONSE) => tousOntRepondu(reps) || ecouleMs >= delai

export interface ResultatJoueur { juste: boolean; points: number; rapidite: number; plusRapide: boolean }
/**
 * Score d'une manche : bonne réponse = 100 pts + bonus de rapidité (100 → 0 sur la durée du délai),
 * + 50 pts au(x) plus rapide(s) parmi les justes (égalité exacte : tous les ex æquo le reçoivent).
 */
export function scoreManche(reps: Reponse[], bonne: number, delai = DELAI_REPONSE): ResultatJoueur[] {
  const justes = reps.map(r => r.choix === bonne && r.ms !== null)
  const min = Math.min(...reps.filter((_, i) => justes[i]).map(r => r.ms as number))
  return reps.map((r, i) => {
    if (!justes[i]) return { juste: false, points: 0, rapidite: 0, plusRapide: false }
    const rapidite = Math.round(BONUS_RAPIDITE_MAX * Math.max(0, 1 - (r.ms as number) / delai))
    const plusRapide = r.ms === min
    return { juste: true, rapidite, plusRapide, points: POINTS_JUSTE + rapidite + (plusRapide ? BONUS_PLUS_RAPIDE : 0) }
  })
}

/** Classement avec ex æquo : même total ⇒ même rang (1, 1, 3). */
export function classer(totaux: number[]): { joueur: number; total: number; rang: number }[] {
  const tri = totaux.map((total, joueur) => ({ joueur, total })).sort((a, b) => b.total - a.total || a.joueur - b.joueur)
  return tri.map(e => ({ ...e, rang: 1 + tri.filter(o => o.total > e.total).length }))
}

/** Niveau de chaque manche, croissant de 1 à `max` sur `n` manches (3 → 1,3,5 ; 5 → 1..5 ; 10 → 1,1,2,2…). */
export const niveauManche = (i: number, n: number, max = 5) => Math.min(max, 1 + Math.floor((i * max) / n))
