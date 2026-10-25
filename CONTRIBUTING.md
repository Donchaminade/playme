# Contribuer à PlayMe

Merci de vouloir enrichir PlayMe ! Ce guide explique comment proposer une idée, corriger un bug ou **ajouter ton propre jeu**.

## Sommaire

1. [Code de conduite](#code-de-conduite)
2. [Workflow](#workflow)
3. [Ajouter un nouveau jeu](#ajouter-un-nouveau-jeu)
4. [Fonctionnalités optionnelles](#fonctionnalités-optionnelles)
5. [Règles de qualité](#règles-de-qualité)
6. [Checklist de PR](#checklist-de-pr)
7. [Proposer une idée de jeu](#proposer-une-idée-de-jeu)

## Code de conduite

Sois bienveillant·e, respectueux·se et constructif·ve, dans les issues, les revues et les événements. Aucun propos discriminant, harcelant ou insultant n'est toléré. Les jeux doivent rester adaptés à tous les publics. Le mainteneur peut fermer ou modérer toute contribution qui enfreint ces règles.

## Workflow

1. **Forke** le dépôt `Donchaminade/playme`, puis clone ton fork.
2. Installe et vérifie que tout est vert : `npm install`, `npm test`, `npm run build`.
3. Crée une branche depuis `main` :
   - `feat/<slug-du-jeu>` pour un nouveau jeu (ex. `feat/memoire-flash`) ;
   - `feat/<sujet>` pour une fonctionnalité transverse ;
   - `fix/<sujet>` pour une correction (ex. `fix/classement-egalite`) ;
   - `docs/<sujet>` pour la documentation.
4. Commite par petites étapes. **Messages en français, à l'impératif**, avec une portée :
   - `Mémoire flash : ajoute la logique des séquences`
   - `Hub : corrige le contraste des cartes « bientôt »`
5. Pousse ta branche et ouvre une **Pull Request vers `main`** en remplissant le modèle de PR.
6. Une revue est faite ; corrige, puis la PR est fusionnée par le mainteneur.

## Ajouter un nouveau jeu

### 1. Copier le modèle

Un jeu minimal qui compile et dont les tests passent est fourni dans [`src/games/_modele/`](src/games/_modele/) (« Le plus grand » : touche le plus grand nombre). Il n'est pas inscrit au registre, donc absent du hub et du bundle de production.

```bash
cp -r src/games/_modele src/games/mon-jeu
```

Dans `src/games/mon-jeu/Game.tsx`, remplace `const SLUG = 'mon-jeu'` par ton slug.

### 2. Fichiers attendus

```text
src/games/<slug>/
├── Game.tsx        # obligatoire : composant React exporté par défaut, sans props
├── logic.ts        # recommandé : logique pure (aucun import React), facile à tester
├── logic.test.ts   # obligatoire dès qu'il y a de la logique : tests Vitest
└── …               # composants, sons, images (assets) propres au jeu
```

Le `slug` est en minuscules, avec des tirets, sans accents : `memoire-flash`, `code-secret`. C'est aussi l'URL du jeu : **`/jeux/<slug>`**. La route est générique (`/jeux/:slug` dans `src/main.tsx`), tu n'as pas de route à créer.

### 3. Le contrat du registre

Chaque jeu est déclaré dans [`src/games/index.ts`](src/games/index.ts). Voici le type réel :

```ts
export interface GameEntry {
  slug: string; titre: string; accroche: string; duree: string; emoji: string
  statut: 'actif' | 'bientot'; composant?: LazyExoticComponent<ComponentType>; demo?: LazyExoticComponent<ComponentType>
}
```

| Champ | Rôle |
|---|---|
| `slug` | identifiant et URL `/jeux/<slug>` |
| `titre` | titre de la carte du hub et de l'onglet |
| `accroche` | une phrase sous le titre de la carte |
| `duree` | durée affichée sur la carte (ex. `'2–4 min'`) |
| `emoji` | icône de la carte |
| `statut` | `'actif'` (carte cliquable) ou `'bientot'` (carte grisée « Bientôt ») |
| `composant` | le jeu, chargé à la demande avec `lazy()` ; requis si `statut: 'actif'` |
| `demo` | optionnel : composant du mode démo, servi sur `/jeux/<slug>/demo` ; la carte affiche alors le lien « Mode démo / grand écran » |

Ajoute ton entrée au tableau `games` :

```ts
{ slug: 'mon-jeu', titre: 'Mon jeu', accroche: 'Une phrase qui donne envie.', duree: '2 min', emoji: '🎯',
  statut: 'actif', composant: lazy(() => import('./mon-jeu/Game')) },
```

Pendant le développement, tu peux laisser `statut: 'bientot'` pour annoncer le jeu sans le rendre jouable.

### 4. Classement

Utilise le module partagé [`src/lib/leaderboard.ts`](src/lib/leaderboard.ts) avec ton slug :

```ts
import { loadScores, saveScore, clearScores, type ScoreEntry } from '../../lib/leaderboard'
// ScoreEntry = { nom, score, niveau, temps (s), date (ms) }
const liste = saveScore('mon-jeu', { nom: 'Ama', score: 420, niveau: 3, temps: 75, date: Date.now() })
```

Le tri est fait par score décroissant puis par temps, et seuls les 20 meilleurs sont gardés.

### 5. Style

Tailwind 4, avec le thème défini dans `src/index.css` : couleurs `nuit`, `grille`, `trait`, `taxi`, `sirene`, `orange` (ex. `bg-orange`, `text-sirene`) et la police `font-titre`. Inspire-toi du modèle et de `suis-l-ambulance`.

### 6. Vérifier

```bash
npm test
npm run build
npm run dev   # puis ouvre http://localhost:5173/jeux/mon-jeu
```

## Fonctionnalités optionnelles

| Fonctionnalité | Comment faire aujourd'hui |
|---|---|
| **Mode démo / grand écran** | Pris en charge par l'architecture : crée `Demo.tsx` (export par défaut) et renseigne `demo: lazy(() => import('./mon-jeu/Demo'))`. Exemple : `src/games/suis-l-ambulance/Demo.tsx` (raccourcis clavier, plein écran avec `requestFullscreen`). |
| **Son** | Pas de module commun pour l'instant : `src/games/suis-l-ambulance/sound.ts` est propre au jeu ambulance (Web Audio, préférence dans `localStorage`). Tu peux t'en inspirer dans ton dossier ; pas de fichiers audio lourds. |
| **Partie reproductible / défi partagé** | Utilise `src/lib/defi.ts` : `nouvelleGraine()`, `graineDe(graine, k)` pour une graine par manche, `encoderDefi({ jeu, score, niveau, graine, prenom })` et `decoderDefi(code, jeu)` (renvoie `null` si le code est invalide). Lis `?defi=` avec `useSearchParams`, seede ton PRNG (`mulberry32`) avec la graine, puis compare les scores en fin de partie. Exemple : `suis-l-ambulance/Game.tsx` et `partie.ts`. |
| **Partage** | `<BoutonPartage>` de `src/lib/Partage.tsx` (feuille native, sinon copier + réseaux + image). Les textes et l'image viennent de `src/lib/partage.ts` (`messagePartage`, `liensReseaux`, `imageScore`). Pas de clé ni de serveur. |
| **Multijoueur local** | `src/lib/multijoueur.ts` fournit le délai (`DELAI_REPONSE` 5 s), `verrouiller` (1er appui seulement), `scoreManche` (100 + rapidité + bonus du plus rapide), `classer` (ex-aequo) et `niveauManche`. L'interface (pavés orientés, multi-touch en pointer events, clavier sur ordinateur, podium) est dans `suis-l-ambulance/Multi.tsx` : copie-la et adapte le pavé de réponse à ton jeu. |
| **Paramètres d'URL** | Lis-les avec `useSearchParams` de `react-router-dom` (exemple : `?niveau=N` dans le jeu ambulance). |

## Règles de qualité

- **Mobile-first** : conçu d'abord pour 390 px de large, puis vérifié sur grand écran.
- **Accessibilité** :
  - contrastes lisibles sur le fond `nuit` ;
  - cibles tactiles d'au moins 44 × 44 px ;
  - vrais `<button>`, avec `aria-label` quand il n'y a pas de texte ;
  - `aria-live` pour les annonces de score ;
  - respect de `prefers-reduced-motion` (variantes `motion-safe:` / `motion-reduce:` de Tailwind, ou `useReducedMotion` de `motion/react`).
- **Tout en français** : textes, commentaires visibles, messages de commit.
- **Performances** :
  - jeu chargé avec `lazy()` ;
  - animations sur `transform` et `opacity` ;
  - pas de boucle inutile au repos ;
  - assets légers (SVG de préférence).
- **Sécurité** :
  - aucune clé, aucun secret, aucun appel à un service tiers dans le code ;
  - pas de nouvelle dépendance lourde sans discussion préalable dans une issue.
- **Tests Vitest obligatoires** sur la logique (`logic.test.ts`) : règles, génération, score, cas limites.
- **`npm run build` et `npm test` verts** avant d'ouvrir la PR.

## Checklist de PR

- [ ] Branche `feat/<slug>` ou `fix/<sujet>` à jour avec `main`
- [ ] Dossier `src/games/<slug>/` avec `Game.tsx` et `logic.test.ts`
- [ ] Entrée ajoutée dans `src/games/index.ts`, au bon `statut`
- [ ] `npm test` vert
- [ ] `npm run build` vert
- [ ] Testé sur mobile (390 px) et sur ordinateur
- [ ] Accessibilité vérifiée (contrastes, cibles tactiles, `prefers-reduced-motion`)
- [ ] Textes en français, aucune clé ni secret
- [ ] Capture ou courte vidéo jointe à la PR
- [ ] Ligne ajoutée au tableau des jeux du `README.md`

## Proposer une idée de jeu

Ouvre une issue avec le modèle **« Idée de jeu »** (`.github/ISSUE_TEMPLATE/idee-de-jeu.md`) : principe, déroulé d'une partie, durée, niveaux, références. Pour un bug, utilise le modèle **« Bug »**. Les meilleures idées sont courtes à expliquer, jouables en 2–4 minutes et spectaculaires sur grand écran.
