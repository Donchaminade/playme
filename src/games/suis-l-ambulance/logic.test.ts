import { describe, it, expect } from 'vitest'
import { TILINGS, tilingKey, SIDE, generateWave, generateShuffle, applyWave, applyWaveToAll, finalCell, mulberry32, NIVEAUX, CELLS, scoreFor, waveDuration, minGap, SAFE_GAP, swapPoint, ACCEL_MAX, cellXY, CELL_RATIO } from './logic'
import { sortScores } from '../../lib/leaderboard'
const sig = (ws: ReturnType<typeof generateShuffle>) => ws.map(w => w.map(s => `${s.a}-${s.b}`).join(',')).join('|')

describe('Suis l\'ambulance — mélange', () => {
  it('11 pavages de la grille en 6 paires voisines', () => {
    expect(TILINGS).toHaveLength(11)
    TILINGS.forEach(tl => { const f = tl.flat(); expect(new Set(f).size).toBe(CELLS); tl.forEach(([a, b]) => { const A = cellXY(a), B = cellXY(b); expect(Math.abs(A.col - B.col) + Math.abs(A.row - B.row)).toBe(1) }) })
  })
  it('chaque vague : permutation complète, aucune voiture immobile, aucune collision', () => {
    const rng = mulberry32(42)
    for (let k = 0; k < 150; k++) {
      const w = generateWave(rng); expect(w).toHaveLength(6)
      const pos = applyWaveToAll(Array.from({ length: CELLS }, (_, i) => i), w)
      pos.forEach((p, i) => expect(p).not.toBe(i))
      expect([...pos].sort((a, b) => a - b)).toEqual(Array.from({ length: CELLS }, (_, i) => i))
      expect(minGap(w)).toBeGreaterThanOrEqual(SAFE_GAP)
    }
  })
  it('trajectoire continue : départ et arrivée exacts, pas de saut', () => {
    const p0 = swapPoint(0, 3, 1, 0), p1 = swapPoint(0, 3, 1, 1), B = cellXY(3)
    expect(p0.x).toBeCloseTo(0); expect(p0.y).toBeCloseTo(0)
    expect(p1.x).toBeCloseTo(B.col); expect(p1.y).toBeCloseTo(B.row * CELL_RATIO)
    for (let s = 0; s < 50; s++) { const a = swapPoint(0, 3, 1, s / 50), b = swapPoint(0, 3, 1, (s + 1) / 50); expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.15) }
  })
  it('les deux voitures d\'une paire se croisent de part et d\'autre', () => {
    const a = swapPoint(0, 3, 1, 0.5), b = swapPoint(3, 0, 1, 0.5)
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(2 * SIDE)
  })
  it('l\'ambulance bouge à chaque vague et finalCell la suit', () => {
    const ws = generateShuffle(NIVEAUX[4], 9, mulberry32(7)); let amb = 9
    for (const w of ws) { const n = applyWave(amb, w); expect(n).not.toBe(amb); amb = n }
    expect(amb).toBe(finalCell(9, ws))
  })
  it('mélanges différents entre niveaux, entre parties, et pavage changé à chaque vague', () => {
    const sigs = NIVEAUX.map(lv => sig(generateShuffle(lv, 4, mulberry32(lv.niveau * 99))))
    expect(new Set(sigs).size).toBe(NIVEAUX.length)
    expect(sig(generateShuffle(NIVEAUX[2], 4, mulberry32(1)))).not.toBe(sig(generateShuffle(NIVEAUX[2], 4, mulberry32(2))))
    const ws = generateShuffle(NIVEAUX[4], 0, mulberry32(5))
    for (let i = 1; i < ws.length; i++) expect(tilingKey(ws[i])).not.toBe(tilingKey(ws[i - 1]))
  })
})
describe('Suis l\'ambulance — vitesse', () => {
  it('accélère progressivement dans un niveau, borné à ACCEL_MAX', () => {
    for (const lv of NIVEAUX) {
      const ds = Array.from({ length: lv.vagues }, (_, i) => waveDuration(lv, i))
      for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeLessThanOrEqual(ds[i - 1])
      expect(ds[0] / ds[ds.length - 1]).toBeLessThanOrEqual(ACCEL_MAX + 0.01)
      expect(ds[0] / ds[ds.length - 1]).toBeGreaterThan(1.5)
      expect(Math.min(...ds)).toBeGreaterThanOrEqual(350)
    }
  })
  it('la vitesse de base augmente modérément de niveau en niveau', () => {
    for (let i = 1; i < NIVEAUX.length; i++) { const r = NIVEAUX[i - 1].baseMs / NIVEAUX[i].baseMs; expect(r).toBeGreaterThan(1); expect(r).toBeLessThan(1.25) }
  })
  it('score et classement', () => {
    expect(scoreFor(NIVEAUX[0], 0)).toBe(150)
    const s = sortScores([{ nom: 'A', score: 10, niveau: 1, temps: 5, date: 0 }, { nom: 'B', score: 30, niveau: 2, temps: 9, date: 0 }, { nom: 'C', score: 30, niveau: 2, temps: 4, date: 0 }])
    expect(s.map(e => e.nom)).toEqual(['C', 'B', 'A'])
  })
})
