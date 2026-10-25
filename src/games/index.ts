import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
export interface GameEntry {
  slug: string; titre: string; accroche: string; duree: string; emoji: string
  statut: 'actif' | 'bientot'; composant?: LazyExoticComponent<ComponentType>
}
// Pour ajouter un jeu : créer src/games/<slug>/Game.tsx puis l'ajouter ici.
export const games: GameEntry[] = [
  { slug: 'suis-l-ambulance', titre: "Suis l'ambulance", accroche: "La sirène s'éteint, les taxis se mélangent. Sauras-tu retrouver l'ambulance ?", duree: '2–4 min', emoji: '🚑', statut: 'actif', composant: lazy(() => import('./suis-l-ambulance/Game')) },
  { slug: 'memoire-flash', titre: 'Mémoire flash', accroche: 'Retiens la séquence de symboles…', duree: 'bientôt', emoji: '🧠', statut: 'bientot' },
  { slug: 'intrus', titre: "Trouve l'intrus", accroche: 'Un détail cloche dans la grille.', duree: 'bientôt', emoji: '🔍', statut: 'bientot' },
  { slug: 'code-secret', titre: 'Code secret', accroche: 'Devine le code en un minimum d\'essais.', duree: 'bientôt', emoji: '🔐', statut: 'bientot' },
]
export const findGame = (slug?: string) => games.find(g => g.slug === slug)
