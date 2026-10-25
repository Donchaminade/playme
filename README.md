# PlayMe — Jeux de réflexion

Plateforme de petits jeux de réflexion pour les événements tech (Lomé et ailleurs).

## Jeux
- **Suis l'ambulance** — repère l'ambulance, la sirène s'éteint, les taxis se mélangent… retrouve-la ! 5 niveaux, minuteur, score, classement mode événement.
- Bientôt : Mémoire flash, Trouve l'intrus, Code secret.

### Suis l'ambulance : mouvements et niveaux

À chaque vague, **les 12 voitures bougent** selon un motif tiré au hasard (jamais deux fois le même d'affilée) :

| Motif | Description |
|---|---|
| Paires voisines | 6 échanges entre cases adjacentes (11 pavages possibles) |
| Cercle | les 10 cases du pourtour tournent de 1 ou 2 crans (horaire / anti-horaire), le centre s'échange |
| Carrousels 2×2 | deux blocs 2×2 tournent d'un quart de tour, la colonne restante s'échange |
| Diagonales en X | croisements en diagonale : une voiture passe dessus (agrandie, ombre), l'autre dessous |
| Tapis roulant | colonnes ou lignes glissent d'une case, la voiture du bout revient par un arc extérieur |
| Serpent | toutes les voitures avancent d'une case le long d'un parcours en S |
| Miroir | symétrie haut-bas ou gauche-droite |
| Échanges lointains | 2–3 échanges à distance par-dessus, le reste en paires voisines |

| Niveau | Vagues | Motifs ajoutés | Rythme |
|---|---|---|---|
| 1 Échauffement | 6 | voisines, cercle (lent) | régulier |
| 2 Manège | 8 | carrousels, tapis | régulier |
| 3 Croisements | 9 | diagonales | 1 rafale |
| 4 Embrouilles | 10 | serpent, miroir | 1 rafale, 1 feinte |
| 5 Grand mix | 12 | échanges lointains | 2 rafales, 1 feinte, final rapide |
| 6 Expert | 14 | tout | 3 rafales, 2 feintes, final (débloqué après le N5) |

Rafale = 2–3 vagues au moins 2× plus rapides puis respiration ; feinte = ralentit presque à l'arrêt puis repart ; final = 2–3 vagues vives puis arrêt net avec rebond. Chaque trajectoire est vérifiée par échantillonnage (pas de collision, pas de saut, l'ambulance n'est jamais recouverte) ; toutes les voitures s'orientent de la même façon, l'orientation ne trahit donc rien.

Lien animateur : `/jeux/suis-l-ambulance?niveau=N`.

### Mode démo / grand écran

`/jeux/suis-l-ambulance/demo` (lien sur la carte du hub et dans le jeu) : manches en boucle, niveau croissant, gros numéros, compte à rebours de 8 s pour le public, puis révélation animée. `?vitrine=1` montre chaque motif une fois avec son nom.

Raccourcis : **Espace** pause · **→** manche suivante · **R** révéler · **F** plein écran. Son activable/coupable (mémorisé), vibration à la fin du mélange sur mobile.

## Stack
React + Vite + TypeScript + Tailwind + Motion.

```bash
npm install
npm run dev      # développement
npm run build    # production
npx vitest run   # tests
```

Ajouter un jeu : l'inscrire dans `src/games/index.ts` (route `/jeux/<slug>`).
