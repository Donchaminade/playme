import { describe, it, expect } from 'vitest'
import { encoderDefi, decoderDefi, graineDe } from './defi'
import { messagePartage, liensReseaux, formatPoints } from './partage'
import { mancheSeedee } from '../games/suis-l-ambulance/partie'
import { NIVEAUX } from '../games/suis-l-ambulance/logic'

const d = { jeu: 'suis-l-ambulance', score: 1240, niveau: 4, prenom: 'Ama Kéké', graine: 3735928559 }
describe('défi partagé', () => {
  it('encode puis décode à l\'identique (accents compris), code url-safe', () => {
    const c = encoderDefi(d)
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decoderDefi(c)).toEqual(d)
  })
  it('rejette un code invalide ou altéré', () => {
    const c = encoderDefi(d)
    for (const bad of [null, '', 'abc', '!!!', c.slice(0, -2), c.slice(0, 10) + (c[10] === 'A' ? 'B' : 'A') + c.slice(11), 'x'.repeat(300)]) expect(decoderDefi(bad)).toBeNull()
    const forge = btoa('1|suis-l-ambulance|999999|5|1|Triche|000000').replace(/=+$/, '')
    expect(decoderDefi(forge)).toBeNull()
  })
  it('graine reproductible : mêmes ambulance et mélanges pour la même graine', () => {
    const a = mancheSeedee(d.graine, 2, NIVEAUX[2]), b = mancheSeedee(d.graine, 2, NIVEAUX[2]), c = mancheSeedee(d.graine + 1, 2, NIVEAUX[2])
    const sig = (m: typeof a) => m.amb + ':' + m.plan.map(w => `${w.move.motif}/${w.move.variante}/${w.dur}/${w.move.cars.map(x => x.to).join(',')}`).join('|')
    expect(sig(a)).toBe(sig(b)); expect(sig(a)).not.toBe(sig(c))
    expect(sig(mancheSeedee(d.graine, 3, NIVEAUX[3]))).not.toBe(sig(a))
    expect(graineDe(1, 2)).toBe(graineDe(1, 2))
  })
  it('message et liens de partage', () => {
    expect(formatPoints(1240)).toBe('1 240')
    expect(messagePartage({ score: 1240, niveau: 4, jeu: "Suis l'ambulance" })).toBe("J'ai fait 1 240 points au niveau 4 de Suis l'ambulance sur PlayMe ! Tu peux me battre ?")
    const l = liensReseaux('Salut', 'https://ex.com/?defi=a')
    expect(l.map(x => x.id)).toEqual(['whatsapp', 'facebook', 'x', 'telegram'])
    expect(l[0].href).toContain(encodeURIComponent('https://ex.com/?defi=a'))
  })
})
