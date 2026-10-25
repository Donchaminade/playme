export const COLS = 3, ROWS = 4, CELLS = COLS * ROWS
/** Rapport hauteur/largeur d'une case (la grille est légèrement plus haute que large). */
export const CELL_RATIO = 1.12
export type Rng = () => number
export interface Level { niveau: number; vagues: number; baseMs: number }
/** Vitesse de base qui augmente modérément ; plus de vagues aux niveaux avancés. */
export const NIVEAUX: Level[] = [
  { niveau: 1, vagues: 6, baseMs: 1000 },
  { niveau: 2, vagues: 8, baseMs: 900 },
  { niveau: 3, vagues: 10, baseMs: 810 },
  { niveau: 4, vagues: 12, baseMs: 730 },
  { niveau: 5, vagues: 14, baseMs: 660 },
]
/** Accélération maximale dans une partie : la dernière vague va 1,8× plus vite que la première. */
export const ACCEL_MAX = 1.8
/** Échange : a et b permutent en tournant autour de leur milieu ; dir = sens de rotation (1 ou -1). */
export interface Swap { a: number; b: number; dir: 1 | -1 }
export type Wave = Swap[]

export function mulberry32(seed: number): Rng {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export function cellXY(cell: number) { return { col: cell % COLS, row: Math.floor(cell / COLS) } }

/** Durée d'une vague (ms) : lente au début, accélère progressivement (ease-in), bornée par ACCEL_MAX. */
export function waveDuration(level: Level, i: number) {
  const p = level.vagues <= 1 ? 0 : i / (level.vagues - 1)
  return Math.round(level.baseMs / (1 + (ACCEL_MAX - 1) * Math.pow(p, 1.3)))
}
/** Pause naturelle entre deux vagues. */
export function pauseAfter(level: Level, i: number) { return Math.round(waveDuration(level, i) * 0.12) }

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Écart latéral (en largeur de case) quand les deux voitures d'une paire se croisent. */
export const SIDE = 0.27
/** Position (unités de largeur de case) d'une voiture au temps t∈[0,1] : demi-ellipse autour du milieu de la paire.
 *  Les deux voitures d'une paire passent chacune d'un côté (rotation rigide de 180°). */
export function swapPoint(from: number, to: number, dir: 1 | -1, t: number) {
  const A = cellXY(from), B = cellXY(to)
  const ax = A.col, ay = A.row * CELL_RATIO, bx = B.col, by = B.row * CELL_RATIO
  const cx = (ax + bx) / 2, cy = (ay + by) / 2
  const hx = ax - cx, hy = ay - cy, L = Math.hypot(hx, hy) || 1
  const ux = hx / L, uy = hy / L, px = -uy, py = ux
  const th = Math.PI * easeInOut(t)
  const along = L * Math.cos(th), side = SIDE * Math.sin(th) * dir
  return { x: cx + ux * along + px * side, y: cy + uy * along + py * side }
}
/** Inclinaison (degrés) : penchée aux quarts du trajet, droite au départ, au croisement et à l'arrivée. */
export function tilt(from: number, to: number, dir: 1 | -1, t: number) {
  const e = easeInOut(t)
  // Échange horizontal : la voiture se tourne dans le sens de la marche (de profil au croisement), sinon elles se chevaucheraient.
  if (cellXY(from).row === cellXY(to).row) return (cellXY(to).col > cellXY(from).col ? 1 : -1) * 90 * Math.sin(Math.PI * e)
  return dir * 28 * Math.sin(2 * Math.PI * e)
}

/** Distance minimale entre centres de voitures pendant une vague. */
export function minGap(w: Wave, samples = 24) {
  let min = Infinity
  for (let s = 0; s <= samples; s++) {
    const t = s / samples
    const pts: { x: number; y: number }[] = []
    for (let c = 0; c < CELLS; c++) {
      const sw = w.find(x => x.a === c || x.b === c)
      if (sw) pts.push(swapPoint(c, sw.a === c ? sw.b : sw.a, sw.dir, t))
      else { const { col, row } = cellXY(c); pts.push({ x: col, y: row * CELL_RATIO }) }
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
      min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y))
  }
  return min
}
export const SAFE_GAP = 0.45

/** Tous les pavages de la grille 3x4 par 6 paires voisines (11 pavages). */
export const TILINGS: [number, number][][] = (() => {
  const out: [number, number][][] = []
  const rec = (used: boolean[], acc: [number, number][]) => {
    const c = used.indexOf(false); if (c < 0) { out.push([...acc]); return }
    const { col, row } = cellXY(c)
    for (const n of [col + 1 < COLS ? c + 1 : -1, row + 1 < ROWS ? c + COLS : -1]) {
      if (n < 0 || used[n]) continue
      used[c] = used[n] = true; acc.push([c, n]); rec(used, acc); acc.pop(); used[c] = used[n] = false
    }
  }
  rec(Array(CELLS).fill(false), []); return out
})()

/** Une vague = les 12 voitures bougent : 6 échanges simultanés sans collision. */
export function generateWave(rng: Rng = Math.random, avoid?: string): Wave {
  for (let k = 0; k < 500; k++) {
    const tiling = TILINGS[Math.floor(rng() * TILINGS.length)]
    const w: Wave = tiling.map(([x, y]) => (rng() < 0.5 ? { a: x, b: y, dir: rng() < 0.5 ? 1 : -1 } : { a: y, b: x, dir: rng() < 0.5 ? 1 : -1 }))
    if (avoid && tilingKey(w) === avoid && k < 50) continue
    if (minGap(w) >= SAFE_GAP) return w
  }
  throw new Error('aucune vague sans collision')
}
export const tilingKey = (w: Wave) => w.map(s => [Math.min(s.a, s.b), Math.max(s.a, s.b)].join('-')).sort().join(',')
export function applyWave(cell: number, w: Wave): number {
  for (const { a, b } of w) { if (cell === a) return b; if (cell === b) return a }
  return cell
}
/** Mélange d'un niveau : à chaque vague un pavage différent du précédent, toutes les voitures bougent. */
export function generateShuffle(level: Level, _start: number, rng: Rng = Math.random): Wave[] {
  const waves: Wave[] = []
  for (let i = 0; i < level.vagues; i++) waves.push(generateWave(rng, waves[i - 1] && tilingKey(waves[i - 1])))
  return waves
}
export const applyWaveToAll = (positions: number[], w: Wave) => positions.map(c => applyWave(c, w))
export const finalCell = (start: number, waves: Wave[]) => waves.reduce(applyWave, start)
export function scoreFor(level: Level, reactionMs: number) {
  return 100 * level.niveau + Math.max(0, Math.round(50 * (1 - reactionMs / 10000)))
}
