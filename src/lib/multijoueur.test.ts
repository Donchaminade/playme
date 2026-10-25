import { describe, it, expect } from 'vitest'
import { DELAI_REPONSE, verrouiller, reponsesVides, fenetreFermee, scoreManche, classer, niveauManche, tousOntRepondu } from './multijoueur'

describe('multijoueur local', () => {
  it('la réponse est verrouillée au premier appui', () => {
    let r = reponsesVides(3)
    r = verrouiller(r, 0, 4, 1200)
    const avant = r
    r = verrouiller(r, 0, 7, 1500)
    expect(r).toBe(avant); expect(r[0]).toEqual({ choix: 4, ms: 1200 })
    r = verrouiller(r, 1, 7, 900); expect(r[1]).toEqual({ choix: 7, ms: 900 }); expect(r[2].choix).toBeNull()
  })
  it('délai de 5 s : appui tardif ignoré, fenêtre fermée à 5 s ou quand tous ont répondu', () => {
    expect(DELAI_REPONSE).toBe(5000)
    const r = reponsesVides(2)
    expect(verrouiller(r, 0, 1, 5001)).toBe(r)
    expect(verrouiller(r, 0, 1, 5000)[0].choix).toBe(1)
    expect(fenetreFermee(r, 4999)).toBe(false); expect(fenetreFermee(r, 5000)).toBe(true)
    const tous = verrouiller(verrouiller(r, 0, 1, 100), 1, 2, 200)
    expect(tousOntRepondu(tous)).toBe(true); expect(fenetreFermee(tous, 300)).toBe(true)
    expect(verrouiller(r, 5, 1, 10)).toBe(r)
  })
  it('score : juste + rapidité + bonus au plus rapide', () => {
    const r = scoreManche([{ choix: 3, ms: 1000 }, { choix: 3, ms: 2500 }, { choix: 5, ms: 200 }], 3)
    expect(r[0]).toEqual({ juste: true, rapidite: 80, plusRapide: true, points: 230 })
    expect(r[1]).toEqual({ juste: true, rapidite: 50, plusRapide: false, points: 150 })
    expect(r[2].points).toBe(0) // le plus rapide mais faux : aucun bonus
  })
  it('égalités : ex æquo les plus rapides reçoivent tous le bonus ; pas de réponse = 0', () => {
    const r = scoreManche([{ choix: 2, ms: 700 }, { choix: 2, ms: 700 }, { choix: null, ms: null }], 2)
    expect(r[0].plusRapide && r[1].plusRapide).toBe(true); expect(r[0].points).toBe(r[1].points); expect(r[2].points).toBe(0)
    expect(scoreManche([{ choix: 1, ms: 100 }], 0)[0].points).toBe(0)
    expect(classer([300, 500, 300]).map(c => [c.joueur, c.rang])).toEqual([[1, 1], [0, 2], [2, 2]])
    expect(classer([200, 200]).map(c => c.rang)).toEqual([1, 1])
  })
  it('niveau croissant selon le nombre de manches', () => {
    expect([0, 1, 2].map(i => niveauManche(i, 3))).toEqual([1, 2, 4])
    expect([0, 1, 2, 3, 4].map(i => niveauManche(i, 5))).toEqual([1, 2, 3, 4, 5])
    expect(Array.from({ length: 10 }, (_, i) => niveauManche(i, 10))).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })
})
