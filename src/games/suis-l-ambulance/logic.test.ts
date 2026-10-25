import { describe, it, expect } from 'vitest'
import { generateWave, generateShuffle, applyWave, applyWaveToAll, finalCell, mulberry32, NIVEAUX, CELLS, scoreFor } from './logic'
import { sortScores } from '../../lib/leaderboard'
describe('logique Suis l\'ambulance', () => {
  it('une vague contient des paires disjointes et valides', () => {
    const rng = mulberry32(42)
    for (let k = 0; k < 200; k++) {
      const w = generateWave(3, rng); const flat = w.flat()
      expect(new Set(flat).size).toBe(flat.length)
      flat.forEach(c => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThan(CELLS) })
      w.forEach(([a, b]) => expect(a).not.toBe(b))
    }
  })
  it('les positions restent une permutation après le mélange', () => {
    const rng = mulberry32(7); let pos = Array.from({ length: CELLS }, (_, i) => i)
    for (const w of generateShuffle(NIVEAUX[4], 9, rng)) pos = applyWaveToAll(pos, w)
    expect([...pos].sort((a, b) => a - b)).toEqual(Array.from({ length: CELLS }, (_, i) => i))
  })
  it('finalCell suit bien l\'ambulance', () => {
    expect(applyWave(2, [[2, 5]])).toBe(5)
    expect(finalCell(0, [[[0, 3]], [[3, 11]], [[4, 6]]])).toBe(11)
  })
  it('chaque niveau génère le bon nombre de vagues sans doublon', () => {
    for (const lv of NIVEAUX) {
      const ws = generateShuffle(lv, 3, mulberry32(lv.niveau))
      expect(ws).toHaveLength(lv.vagues)
      ws.forEach(w => { const f = w.flat(); expect(new Set(f).size).toBe(f.length) })
    }
  })
  it('l\'ambulance bouge pendant le mélange', () => {
    for (let s = 0; s < 30; s++) {
      const ws = generateShuffle(NIVEAUX[0], s % CELLS, mulberry32(s))
      expect(ws.some(w => w.flat().length > 0)).toBe(true)
      expect(ws[0].some(([a, b]) => a === s % CELLS || b === s % CELLS)).toBe(true)
    }
  })
  it('score et classement', () => {
    expect(scoreFor(NIVEAUX[0], 0)).toBe(150)
    expect(scoreFor(NIVEAUX[2], 20000)).toBe(300)
    const s = sortScores([{ nom: 'A', score: 10, niveau: 1, temps: 5, date: 0 }, { nom: 'B', score: 30, niveau: 2, temps: 9, date: 0 }, { nom: 'C', score: 30, niveau: 2, temps: 4, date: 0 }])
    expect(s.map(e => e.nom)).toEqual(['C', 'B', 'A'])
  })
})
