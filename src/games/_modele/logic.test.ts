import { describe, it, expect } from 'vitest'
import { genererManche, mulberry32, scorePour } from './logic'

describe('modèle de jeu', () => {
  it('la bonne réponse est le maximum, nombres distincts', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      const m = genererManche(rng)
      expect(new Set(m.nombres).size).toBe(6)
      expect(m.nombres[m.bonne]).toBe(Math.max(...m.nombres))
    }
  })
  it('même graine ⇒ même manche', () => {
    expect(genererManche(mulberry32(7))).toEqual(genererManche(mulberry32(7)))
  })
  it('score borné', () => {
    expect(scorePour(0)).toBe(100)
    expect(scorePour(60_000)).toBe(10)
  })
})
