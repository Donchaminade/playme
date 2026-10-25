import { describe, it, expect } from 'vitest'
import {
  MOTIFS, MOTIF_IDS, NIVEAUX, CELLS, TILINGS, SAFE_GAP, MIN_COVER, MAX_STEP, MAX_TURN, MIN_DUR, MAX_DUR,
  checkMove, generateMove, mulberry32, buildPlan, buildVitrine, baseDuration, tempoTags, motifSequence, easeFn,
  applyPlan, isExpertUnlocked, onLevelWon, EXPERT_KEY, scoreFor, pt, type MotifId,
} from './logic'
import { sortScores } from '../../lib/leaderboard'

describe('bibliothèque de mouvements', () => {
  it('8 motifs, 11 pavages de paires voisines', () => {
    expect(MOTIF_IDS).toEqual(['voisines', 'cercle', 'carrousel', 'diagonales', 'tapis', 'serpent', 'miroir', 'lointains'])
    expect(TILINGS).toHaveLength(11)
  })
  for (const id of MOTIF_IDS) it(`${MOTIFS[id].nom} : permutation complète, aucune voiture immobile, aucune collision ni saut`, () => {
    const rng = mulberry32(id.length * 31)
    const variantes = new Set<string>()
    for (let k = 0; k < 25; k++) {
      const amb = k % CELLS, m = generateMove(id, rng, amb), c = checkMove(m, amb)
      variantes.add(m.variante)
      expect(c.perm).toBe(true); expect(c.immobile).toBe(0)
      expect(c.minGap).toBeGreaterThanOrEqual(SAFE_GAP)
      expect(c.minCover).toBeGreaterThanOrEqual(MIN_COVER)
      expect(c.maxStep).toBeLessThanOrEqual(MAX_STEP); expect(c.maxTurn).toBeLessThanOrEqual(MAX_TURN)
      m.cars.forEach((car, i) => { // départ/arrivée exacts, droite au départ et à l'arrivée
        const a = car.path(0), b = car.path(1)
        expect(a.x).toBeCloseTo(pt(i).x); expect(a.y).toBeCloseTo(pt(i).y)
        expect(b.x).toBeCloseTo(pt(car.to).x); expect(b.y).toBeCloseTo(pt(car.to).y)
        expect(car.angles[0]).toBeCloseTo(0); expect(car.angles.at(-1)!).toBeCloseTo(0)
      })
    }
    if (['cercle', 'carrousel', 'diagonales', 'tapis', 'serpent', 'miroir'].includes(id)) expect(variantes.size).toBeGreaterThan(1)
  })
  it('l\'ambulance n\'est jamais recouverte et bouge à chaque vague', () => {
    for (let s = 0; s < 6; s++) {
      const amb0 = s * 2, plan = buildPlan(NIVEAUX[5], mulberry32(s), amb0); let amb = amb0
      for (const w of plan) { expect(checkMove(w.move, amb).minCover).toBeGreaterThanOrEqual(MIN_COVER); const n = w.move.cars[amb].to; expect(n).not.toBe(amb); amb = n }
      expect(applyPlan([amb0], plan)[0]).toBe(amb)
    }
  })
})

describe('tempo', () => {
  it('table de tempo : N1 ≈ 650-700 ms, +8-10 %/niveau, planchers lisibles', () => {
    expect(NIVEAUX[0].baseMs).toBeGreaterThanOrEqual(650); expect(NIVEAUX[0].baseMs).toBeLessThanOrEqual(700)
    for (let i = 1; i < NIVEAUX.length; i++) { const r = NIVEAUX[i - 1].baseMs / NIVEAUX[i].baseMs; expect(r).toBeGreaterThanOrEqual(1.08); expect(r).toBeLessThanOrEqual(1.105) }
    NIVEAUX.forEach(lv => { expect(lv.accel).toBeGreaterThanOrEqual(1.6); expect(lv.accel).toBeLessThanOrEqual(1.8); expect(lv.motifs.length).toBeGreaterThanOrEqual(4); expect(lv.rafales).toBeGreaterThanOrEqual(1) })
    for (let i = 1; i < NIVEAUX.length; i++) { expect(NIVEAUX[i].rafales).toBeGreaterThanOrEqual(NIVEAUX[i - 1].rafales); expect(NIVEAUX[i].feintes).toBeGreaterThanOrEqual(NIVEAUX[i - 1].feintes) }
    for (let s = 0; s < 30; s++) NIVEAUX.forEach(lv => buildPlan(lv, mulberry32(s), 0).forEach(w => {
      expect(w.dur).toBeGreaterThanOrEqual(w.tag === 'rafale' ? 260 : w.tag === 'final' ? 300 : 320)
    }))
  })
  it('feinte : monotone, continue, quasi-arrêt au milieu', () => {
    const f = easeFn('feinte'); let prev = 0
    for (let i = 1; i <= 200; i++) { const v = f(i / 200); expect(v).toBeGreaterThanOrEqual(prev - 1e-9); expect(v - prev).toBeLessThan(0.03); prev = v }
    expect(f(1)).toBeCloseTo(1); expect(f(0.55) - f(0.45)).toBeLessThan(0.05)
  })
  it('courbe de base : lente au départ, accélère, bornée par accel', () => {
    for (const lv of NIVEAUX) {
      const d = Array.from({ length: lv.vagues }, (_, i) => baseDuration(lv, i))
      for (let i = 1; i < d.length; i++) expect(d[i]).toBeLessThanOrEqual(d[i - 1])
      expect(d[0] / d.at(-1)!).toBeCloseTo(lv.accel); expect(lv.accel).toBeLessThanOrEqual(1.8)
    }
  })
  it('rafales, feintes et final conformes et bornés', () => {
    for (let s = 0; s < 30; s++) for (const lv of NIVEAUX) {
      const plan = buildPlan(lv, mulberry32(s * 7 + lv.niveau), s % CELLS), tags = plan.map(w => w.tag)
      expect(plan).toHaveLength(lv.vagues)
      plan.forEach(w => { expect(w.dur).toBeGreaterThanOrEqual(MIN_DUR); expect(w.dur).toBeLessThanOrEqual(MAX_DUR) })
      // rafales : blocs de 2-3 vagues au moins 2× plus rapides que la base (ou au plancher), puis respiration
      const blocks = tags.join(',').split(/(?:normal|feinte|final)/).map(x => x.split(',').filter(Boolean).length).filter(Boolean)
      expect(blocks.length).toBe(lv.rafales); blocks.forEach(b => expect(b === 2 || b === 3).toBe(true))
      plan.forEach((w, i) => {
        if (w.tag === 'rafale') { expect(w.dur <= baseDuration(lv, i) / 2 + 1 || w.dur === MIN_DUR).toBe(true); if (tags[i + 1] !== 'rafale') expect(w.pause).toBeGreaterThanOrEqual(400) }
        if (w.tag === 'feinte') { expect(w.ease).toBe('feinte'); expect(w.dur).toBeGreaterThan(baseDuration(lv, i)) }
      })
      expect(tags.filter(t => t === 'feinte').length).toBe(lv.feintes)
      const fin = plan.filter(w => w.tag === 'final')
      if (lv.final) {
        expect(fin.length === 2 || fin.length === 3).toBe(true); expect(tags.slice(-fin.length).every(t => t === 'final')).toBe(true)
        const autres = plan.filter(w => w.tag === 'normal' || w.tag === 'feinte').map(w => w.dur)
        fin.forEach(w => expect(w.dur).toBeLessThanOrEqual(Math.min(...autres)))
      } else expect(fin.length).toBe(0)
      expect(plan.at(-1)!.pause).toBe(0)
    }
  })
})

describe('niveaux et séquences', () => {
  it('motifs autorisés par niveau, nouveautés présentes, jamais deux fois le même d\'affilée', () => {
    const b1: MotifId[] = ['voisines', 'cercle', 'carrousel', 'tapis'], b2: MotifId[] = [...b1, 'diagonales'], b3: MotifId[] = [...b2, 'serpent', 'miroir']
    const attendu: MotifId[][] = [b1, b2, b3, MOTIF_IDS, MOTIF_IDS, MOTIF_IDS]
    NIVEAUX.forEach((lv, i) => expect([...lv.motifs].sort()).toEqual([...attendu[i]].sort()))
    for (let s = 0; s < 40; s++) for (const lv of NIVEAUX) {
      const seq = motifSequence(lv, mulberry32(s + 100 * lv.niveau))
      seq.forEach((m, i) => { expect(lv.motifs).toContain(m); if (i) expect(m).not.toBe(seq[i - 1]) })
      lv.nouveaux.forEach(n => expect(seq).toContain(n))
    }
  })
  it('séquence différente à chaque partie et entre niveaux', () => {
    const sig = (lv: number, s: number) => buildPlan(NIVEAUX[lv], mulberry32(s), 0).map(w => w.move.motif + w.move.variante + w.dur).join('|')
    expect(sig(3, 1)).not.toBe(sig(3, 2)); expect(sig(1, 5)).not.toBe(sig(2, 5))
  })
  it('vitrine : chaque motif une fois', () => {
    expect(buildVitrine(mulberry32(3), 4).map(w => w.move.motif)).toEqual(MOTIF_IDS)
  })
  it('niveau Expert débloqué seulement après le N5 et mémorisé', () => {
    const mem = new Map<string, string>(), st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    expect(isExpertUnlocked(st)).toBe(false)
    for (let n = 1; n <= 4; n++) onLevelWon(n, st)
    expect(isExpertUnlocked(st)).toBe(false)
    onLevelWon(5, st); expect(isExpertUnlocked(st)).toBe(true); expect(mem.get(EXPERT_KEY)).toBe('1')
    expect(NIVEAUX[5].nom).toBe('Expert')
  })
  it('score et classement', () => {
    expect(scoreFor(NIVEAUX[0], 0)).toBe(150)
    const s = sortScores([{ nom: 'A', score: 10, niveau: 1, temps: 5, date: 0 }, { nom: 'B', score: 30, niveau: 2, temps: 9, date: 0 }, { nom: 'C', score: 30, niveau: 2, temps: 4, date: 0 }])
    expect(s.map(e => e.nom)).toEqual(['C', 'B', 'A'])
  })
})
