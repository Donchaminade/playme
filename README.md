# PlayMe — Jeux de réflexion

Plateforme de petits jeux de réflexion pour les événements tech (Lomé et ailleurs).

## Jeux
- **Suis l'ambulance** — repère l'ambulance, la sirène s'éteint, les taxis se mélangent… retrouve-la ! 5 niveaux, minuteur, score, classement mode événement.
- Bientôt : Mémoire flash, Trouve l'intrus, Code secret.

## Stack
React + Vite + TypeScript + Tailwind + Motion.

```bash
npm install
npm run dev      # développement
npm run build    # production
npx vitest run   # tests
```

Ajouter un jeu : l'inscrire dans `src/games/index.ts` (route `/jeux/<slug>`).
