/**
 * Modèle de jeu PlayMe — logique pure (sans React), testée avec Vitest.
 * Jeu d'exemple : « Le plus grand » — touche la case qui contient le plus grand nombre.
 * Ce dossier n'est PAS inscrit dans src/games/index.ts : il n'apparaît ni dans le hub ni dans le bundle.
 */
export type Rng = () => number

/** PRNG déterministe (mulberry32) : même graine ⇒ même partie (utile pour un défi partagé). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Manche { nombres: number[]; bonne: number }

/** Génère une manche de `taille` nombres distincts entre 1 et 99. */
export function genererManche(rng: Rng, taille = 6): Manche {
  const set = new Set<number>()
  while (set.size < taille) set.add(1 + Math.floor(rng() * 99))
  const nombres = [...set]
  return { nombres, bonne: nombres.indexOf(Math.max(...nombres)) }
}

/** Score : 100 points, moins 1 point par dixième de seconde, minimum 10. */
export function scorePour(ms: number) {
  return Math.max(10, 100 - Math.floor(ms / 100))
}
