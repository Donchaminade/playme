export const COLS = 3, ROWS = 4, CELLS = COLS * ROWS
export type Rng = () => number
export interface Level { niveau: number; vagues: number; pairesParVague: number; dureeMs: number }
export const NIVEAUX: Level[] = [
  { niveau: 1, vagues: 5, pairesParVague: 1, dureeMs: 900 },
  { niveau: 2, vagues: 7, pairesParVague: 2, dureeMs: 800 },
  { niveau: 3, vagues: 9, pairesParVague: 2, dureeMs: 650 },
  { niveau: 4, vagues: 11, pairesParVague: 3, dureeMs: 550 },
  { niveau: 5, vagues: 14, pairesParVague: 3, dureeMs: 450 },
]
export type Pair = [number, number] // indices de cases échangées
export type Wave = Pair[]

export function mulberry32(seed: number): Rng {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/** Génère une vague de paires disjointes de cases. */
export function generateWave(pairs: number, rng: Rng = Math.random): Wave {
  const cells = Array.from({ length: CELLS }, (_, i) => i)
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]] }
  const w: Wave = []; for (let p = 0; p < Math.min(pairs, CELLS / 2); p++) w.push([cells[2 * p], cells[2 * p + 1]])
  return w
}
/** Génère le mélange ; garantit que l'ambulance bouge au moins dans ~1 vague sur 2. */
export function generateShuffle(level: Level, start: number, rng: Rng = Math.random): Wave[] {
  const waves: Wave[] = []; let amb = start
  for (let i = 0; i < level.vagues; i++) {
    let w = generateWave(level.pairesParVague, rng)
    if (i % 2 === 0 && !w.some(([a, b]) => a === amb || b === amb)) {
      const other = w[0][0] === amb ? w[0][1] : w[0][0] === w[0][1] ? 0 : w[0][1]
      w = [[amb, other === amb ? (amb + 1) % CELLS : other], ...w.slice(1).filter(([a, b]) => a !== amb && b !== amb && a !== other && b !== other)]
    }
    waves.push(w); amb = applyWave(amb, w)
  }
  return waves
}
/** Nouvelle case d'une voiture située en `cell` après la vague. */
export function applyWave(cell: number, w: Wave): number {
  for (const [a, b] of w) { if (cell === a) return b; if (cell === b) return a }
  return cell
}
/** positions[carId] = case ; applique une vague à toutes les voitures. */
export function applyWaveToAll(positions: number[], w: Wave) { return positions.map(c => applyWave(c, w)) }
export function finalCell(start: number, waves: Wave[]) { return waves.reduce(applyWave, start) }
export function cellXY(cell: number) { return { col: cell % COLS, row: Math.floor(cell / COLS) } }
export function scoreFor(level: Level, reactionMs: number) {
  const base = 100 * level.niveau
  const bonus = Math.max(0, Math.round(50 * (1 - reactionMs / 10000)))
  return base + bonus
}
