/* Suis l'ambulance — logique pure : grille, bibliothèque de mouvements, tempo, niveaux. */
export const COLS = 3, ROWS = 4, CELLS = COLS * ROWS
/** Rapport hauteur/largeur d'une case. Toutes les coordonnées sont en largeurs de case. */
export const CELL_RATIO = 1.12
export type Rng = () => number
export interface P { x: number; y: number }
export type Layer = -1 | 0 | 1
export function mulberry32(seed: number): Rng {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export const cellXY = (c: number) => ({ col: c % COLS, row: Math.floor(c / COLS) })
export const pt = (c: number): P => ({ x: c % COLS, y: Math.floor(c / COLS) * CELL_RATIO })
const cellAt = (col: number, row: number) => row * COLS + col
const sgn = (rng: Rng) => (rng() < 0.5 ? 1 : -1)
const shuffle = <T,>(a: T[], rng: Rng) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

/* ---------- Trajectoires paramétriques (s ∈ [0,1]) ---------- */
export type Path = (s: number) => P
/** Segment A→B avec renflement latéral `bulge` (les deux voitures d'une paire passent de part et d'autre). */
export function arc(a: number, b: number, bulge: number): Path {
  const A = pt(a), B = pt(b), dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1
  const px = -dy / L, py = dx / L
  return s => { const k = bulge * Math.sin(Math.PI * s); return { x: A.x + dx * s + px * k, y: A.y + dy * s + py * k } }
}
/** Renflement exprimé dans le repère de la grille : `side` = décalage voulu en x (mouvement vertical) ou en y (horizontal). */
function arcSide(a: number, b: number, side: number, axis: 'x' | 'y'): Path {
  const A = pt(a), B = pt(b), dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1
  const px = -dy / L, py = dx / L
  const s = axis === 'x' ? Math.sign(px) || 1 : Math.sign(py) || 1
  return arc(a, b, side * s)
}
/** Rotation sur l'ellipse circonscrite à un bloc 2×2 (les coins restent des coins). */
export function orbit(c: number, cx: number, cy: number, deg: number): Path {
  const A = pt(c), rx = 0.5 * Math.SQRT2, ry = 0.5 * CELL_RATIO * Math.SQRT2
  const f0 = Math.atan2((A.y - cy) / ry, (A.x - cx) / rx), d = (deg * Math.PI) / 180
  return s => ({ x: cx + rx * Math.cos(f0 + d * s), y: cy + ry * Math.sin(f0 + d * s) })
}
/** Spline Catmull-Rom passant par les centres de cases ; les points fantômes arrondissent les virages. */
export function spline(cells: number[], ghostA?: number, ghostB?: number): Path {
  const pts = cells.map(pt), n = pts.length - 1
  const g0 = ghostA !== undefined ? pt(ghostA) : pts[0], g1 = ghostB !== undefined ? pt(ghostB) : pts[n]
  const all = [g0, ...pts, g1]
  return s => {
    const u = Math.min(n - 1e-9, Math.max(0, s) * n), i = Math.floor(u), t = u - i
    const p0 = all[i], p1 = all[i + 1], p2 = all[i + 2], p3 = all[i + 3]
    const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
    return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) }
  }
}

/** Décalage temporel doux : k<1 en avance, k>1 en retard (départ et arrivée inchangés). */
export const warp = (path: Path, k: number): Path => s => path(k < 1 ? Math.pow(s, k) : 1 - Math.pow(1 - s, 1 / k))

/* ---------- Orientation : tangente du déplacement, droite au départ et à l'arrivée ---------- */
export const ANGLE_SAMPLES = 60
export function headings(path: Path): number[] {
  const raw: number[] = []
  for (let i = 0; i <= ANGLE_SAMPLES; i++) {
    const s = i / ANGLE_SAMPLES, a = path(Math.max(0, s - 0.03)), b = path(Math.min(1, s + 0.03))
    let h = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI
    if (raw.length) { const prev = raw[raw.length - 1]; while (h - prev > 90) h -= 180; while (h - prev < -90) h += 180 }
    raw.push(h)
  }
  const mean = raw.reduce((x, y) => x + y, 0) / raw.length, k = Math.round(mean / 180) * 180
  return raw.map((h, i) => (h - k) * Math.pow(Math.sin((Math.PI * i) / ANGLE_SAMPLES), 0.7))
}
export function angleAt(angles: number[], s: number) {
  const N = angles.length - 1, u = Math.min(N, Math.max(0, s * N)), i = Math.min(N - 1, Math.floor(u))
  return angles[i] + (angles[i + 1] - angles[i]) * (u - i)
}

/* ---------- Mouvements ---------- */
export type MotifId = 'voisines' | 'cercle' | 'carrousel' | 'diagonales' | 'tapis' | 'serpent' | 'miroir' | 'lointains'
export interface CarMove { to: number; path: Path; layer: Layer; angles: number[] }
/** cars[case de départ] = déplacement de la voiture qui s'y trouve. */
export interface Move { motif: MotifId; variante: string; cars: CarMove[] }
type Draft = { to: number; path: Path; layer?: Layer; win?: [number, number] }[]
/** Fenêtre temporelle : la voiture ne bouge que pendant [a, b] de la vague (décalage entre croisements). */
export const DIAG_DECALAGE = 0.2
const clamp01 = (u: number) => Math.min(1, Math.max(0, u))
const finish = (motif: MotifId, variante: string, d: Draft): Move =>
  ({ motif, variante, cars: d.map(m => {
    const h = headings(m.path)
    if (!m.win) return { to: m.to, path: m.path, layer: m.layer ?? 0, angles: h }
    const [a, b] = m.win, base = m.path, u = (s: number) => clamp01((s - a) / (b - a))
    return { to: m.to, path: (s: number) => base(u(s)), layer: m.layer ?? 0, angles: Array.from({ length: ANGLE_SAMPLES + 1 }, (_, i) => angleAt(h, u(i / ANGLE_SAMPLES))) }
  }) })

/** Les 11 pavages de la grille par 6 paires voisines. */
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
function pairSwap(d: Draft, a: number, b: number, bulge: number, la: Layer = 0, lb: Layer = la) {
  d[a] = { to: b, path: arc(a, b, bulge), layer: la }; d[b] = { to: a, path: arc(b, a, bulge), layer: lb }
}
/** Appariement de cases libres par voisins (retour arrière). */
function neighbourMatching(free: number[], rng: Rng): [number, number][] | null {
  const set = new Set(free)
  const rec = (): [number, number][] | null => {
    if (!set.size) return []
    const c = Math.min(...set); set.delete(c)
    const { col, row } = cellXY(c)
    for (const n of shuffle([col + 1 < COLS ? c + 1 : -1, row + 1 < ROWS ? c + COLS : -1, col > 0 ? c - 1 : -1, row > 0 ? c - COLS : -1], rng)) {
      if (n < 0 || !set.has(n)) continue
      set.delete(n); const r = rec(); if (r) return [[c, n], ...r]; set.add(n)
    }
    set.add(c); return null
  }
  return rec()
}
const layeredWarp = (d: Draft) => d.forEach(m => { if (m.layer === 1) m.path = warp(m.path, 0.8); else if (m.layer === -1) m.path = warp(m.path, 1.25) })
const PERIM = [0, 1, 2, 5, 8, 11, 10, 9, 6, 3]
const SNAKE = [0, 1, 2, 5, 4, 3, 6, 7, 8, 11, 10, 9]
const mod = (n: number, m: number) => ((n % m) + m) % m

export const MOTIFS: Record<MotifId, { nom: string; gen: (rng: Rng) => Move }> = {
  voisines: { nom: 'Paires voisines', gen: rng => {
    const d: Draft = []; for (const [a, b] of TILINGS[Math.floor(rng() * TILINGS.length)]) pairSwap(d, a, b, 0.27 * sgn(rng))
    return finish('voisines', 'pavage', d) } },
  cercle: { nom: 'Cercle', gen: rng => {
    const k = rng() < 0.5 ? 1 : 2, dir = sgn(rng), d: Draft = []
    PERIM.forEach((c, i) => {
      const seq = Array.from({ length: k + 1 }, (_, j) => PERIM[mod(i + j * dir, 10)])
      d[c] = { to: seq[k], path: spline(seq, PERIM[mod(i - dir, 10)], PERIM[mod(i + (k + 1) * dir, 10)]) }
    })
    pairSwap(d, 4, 7, 0.27 * -dir)
    return finish('cercle', `${k} cran${k > 1 ? 's' : ''} ${dir > 0 ? 'horaire' : 'anti-horaire'}`, d) } },
  carrousel: { nom: 'Carrousels 2×2', gen: rng => {
    const left = rng() < 0.5, c0 = left ? 0 : 1, spare = left ? 2 : 0, d: Draft = []
    for (const r0 of [0, 2]) {
      const deg = 90 * sgn(rng), cx = c0 + 0.5, cy = (r0 + 0.5) * CELL_RATIO
      for (const [dc, dr] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const c = cellAt(c0 + dc, r0 + dr), path = orbit(c, cx, cy, deg), e = path(1)
        d[c] = { to: cellAt(Math.round(e.x), Math.round(e.y / CELL_RATIO)), path }
      }
    }
    const out = left ? 1 : -1
    pairSwap(d, cellAt(spare, 0), cellAt(spare, 1), 0); pairSwap(d, cellAt(spare, 2), cellAt(spare, 3), 0)
    for (const r of [0, 1, 2, 3]) { const c = cellAt(spare, r); d[c].path = arcSide(c, d[c].to, 0.27 * (r % 2 ? -out : out), 'x') }
    return finish('carrousel', left ? 'blocs à gauche' : 'blocs à droite', d) } },
  diagonales: { nom: 'Diagonales en X', gen: rng => {
    const left = rng() < 0.5, c0 = left ? 0 : 1, spare = left ? 2 : 0, d: Draft = []
    for (const r0 of [0, 2]) {
      const top: Layer = rng() < 0.5 ? 1 : -1, bot = -top as Layer
      pairSwap(d, cellAt(c0, r0), cellAt(c0 + 1, r0 + 1), 0.26 * sgn(rng), top)
      pairSwap(d, cellAt(c0 + 1, r0), cellAt(c0, r0 + 1), 0.26 * sgn(rng), bot)
      // les deux croisements du bloc sont décalés dans le temps (~18 % de la vague) : pas d'amas au centre
      const first = rng() < 0.5
      for (const c of [cellAt(c0, r0), cellAt(c0 + 1, r0 + 1)]) d[c].win = first ? [0, 1 - DIAG_DECALAGE] : [DIAG_DECALAGE, 1]
      for (const c of [cellAt(c0 + 1, r0), cellAt(c0, r0 + 1)]) d[c].win = first ? [DIAG_DECALAGE, 1] : [0, 1 - DIAG_DECALAGE]
    }
    const out = left ? 1 : -1
    pairSwap(d, cellAt(spare, 0), cellAt(spare, 1), 0); pairSwap(d, cellAt(spare, 2), cellAt(spare, 3), 0)
    for (const r of [0, 1, 2, 3]) { const c = cellAt(spare, r); d[c].path = arcSide(c, d[c].to, 0.27 * (r % 2 ? -out : out), 'x') }
    return finish('diagonales', left ? 'X à gauche' : 'X à droite', d) } },
  tapis: { nom: 'Tapis roulant', gen: rng => {
    const d: Draft = []
    if (rng() < 0.5) { // colonnes haut/bas
      let dirs = [sgn(rng), sgn(rng), sgn(rng)]; if (dirs.every(x => x === dirs[0])) dirs[1] = -dirs[0]
      for (let col = 0; col < COLS; col++) for (let row = 0; row < ROWS; row++) {
        const c = cellAt(col, row), to = cellAt(col, mod(row + dirs[col], ROWS)), wrap = Math.abs(cellXY(to).row - row) > 1
        d[c] = wrap ? { to, path: arcSide(c, to, col === 0 ? -0.4 : col === 2 ? 0.4 : 0.4 * dirs[col], 'x'), layer: 1 } : { to, path: arc(c, to, 0) }
      }
      return finish('tapis', 'colonnes', d)
    }
    let dirs = [sgn(rng), sgn(rng), sgn(rng), sgn(rng)]; if (dirs.every(x => x === dirs[0])) dirs[2] = -dirs[0]
    const up = sgn(rng) // tous les arcs de rebouclage du même côté : jamais l'un vers l'autre
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const c = cellAt(col, row), to = cellAt(mod(col + dirs[row], COLS), row), wrap = Math.abs(cellXY(to).col - col) > 1
      d[c] = wrap ? { to, path: arcSide(c, to, 0.38 * up, 'y'), layer: 1 } : { to, path: arc(c, to, 0) }
    }
    return finish('tapis', 'lignes', d) } },
  serpent: { nom: 'Serpent', gen: rng => {
    const dir = sgn(rng), d: Draft = []
    SNAKE.forEach((c, i) => {
      const j = i + dir
      if (j < 0 || j >= SNAKE.length) { const to = SNAKE[mod(j, 12)]; d[c] = { to, path: arcSide(c, to, -0.42, 'x'), layer: 1 } }
      else { const g0 = SNAKE[i - dir], g1 = SNAKE[j + dir]; d[c] = { to: SNAKE[j], path: spline([c, SNAKE[j]], g0, g1) } }
    })
    return finish('serpent', dir > 0 ? 'avant' : 'arrière', d) } },
  miroir: { nom: 'Miroir', gen: rng => {
    const d: Draft = []
    if (rng() < 0.5) { // haut-bas
      for (let col = 0; col < COLS; col++) {
        const t = rng() < 0.5 ? 1 : -1
        pairSwap(d, cellAt(col, 0), cellAt(col, 3), 0.42 * sgn(rng), t as Layer, -t as Layer)
        pairSwap(d, cellAt(col, 1), cellAt(col, 2), 0.25 * (col % 2 ? 1 : -1))
      }
      layeredWarp(d); return finish('miroir', 'haut-bas', d)
    }
    for (let row = 0; row < ROWS; row++) { const t = rng() < 0.5 ? 1 : -1; pairSwap(d, cellAt(0, row), cellAt(2, row), 0.4 * sgn(rng), t as Layer, -t as Layer) }
    // colonne centrale (son propre miroir) : deux échanges voisins au niveau du sol, sous/entre les traversées
    pairSwap(d, cellAt(1, 0), cellAt(1, 1), 0.27 * sgn(rng)); pairSwap(d, cellAt(1, 2), cellAt(1, 3), 0.27 * sgn(rng))
    layeredWarp(d); return finish('miroir', 'gauche-droite', d) } },
  lointains: { nom: 'Échanges lointains', gen: rng => {
    for (;;) {
      const m = rng() < 0.5 ? 2 : 3, used = new Set<number>(), far: [number, number][] = []
      for (let k = 0; k < 40 && far.length < m; k++) {
        const a = Math.floor(rng() * CELLS), b = Math.floor(rng() * CELLS), A = cellXY(a), B = cellXY(b)
        if (a === b || used.has(a) || used.has(b) || Math.abs(A.col - B.col) + Math.abs(A.row - B.row) < 2) continue
        far.push([a, b]); used.add(a); used.add(b)
      }
      const rest = neighbourMatching(Array.from({ length: CELLS }, (_, i) => i).filter(i => !used.has(i)), rng)
      if (far.length < m || !rest) continue
      const d: Draft = []
      for (const [a, b] of far) pairSwap(d, a, b, 0.5 * sgn(rng), 1)
      for (const [a, b] of rest) pairSwap(d, a, b, 0.27 * sgn(rng))
      return finish('lointains', `${m} grands arcs`, d)
    }
  } },
}
export const MOTIF_IDS = Object.keys(MOTIFS) as MotifId[]

/* ---------- Vérification : permutation complète, aucune collision, aucun saut ---------- */
/** MIN_COVER : une voiture « dessous » n'est jamais recouverte en entier (centres jamais confondus). */
export const MIN_COVER = 0.12
export const SAFE_GAP = 0.45, MAX_STEP = 0.2, MAX_TURN = 20, CHECK_SAMPLES = 48
export interface Check { ok: boolean; minGap: number; minCover: number; maxStep: number; maxTurn: number; immobile: number; perm: boolean }
/** `amb` = case de l'ambulance : elle ne doit jamais être entièrement recouverte par une autre voiture. */
export function checkMove(m: Move, amb?: number): Check {
  const to = m.cars.map(c => c.to), perm = m.cars.length === CELLS && new Set(to).size === CELLS
  const immobile = to.filter((t, i) => t === i).length
  let minGap = Infinity, minCover = Infinity, maxStep = 0, maxTurn = 0, ends = true
  m.cars.forEach((c, i) => {
    const a = c.path(0), b = c.path(1), A = pt(i), B = pt(c.to)
    if (Math.hypot(a.x - A.x, a.y - A.y) > 1e-6 || Math.hypot(b.x - B.x, b.y - B.y) > 1e-6) ends = false
    if (Math.abs(c.angles[0]) > 1e-6 || Math.abs(c.angles[c.angles.length - 1]) > 1e-6) ends = false
    for (let k = 1; k < c.angles.length; k++) maxTurn = Math.max(maxTurn, Math.abs(c.angles[k] - c.angles[k - 1]))
  })
  let prev: P[] | null = null
  for (let k = 0; k <= CHECK_SAMPLES; k++) {
    const s = k / CHECK_SAMPLES, ps = m.cars.map(c => c.path(s))
    if (prev) ps.forEach((p, i) => { maxStep = Math.max(maxStep, Math.hypot(p.x - prev![i].x, p.y - prev![i].y)) })
    for (let i = 0; i < CELLS; i++) for (let j = i + 1; j < CELLS; j++)
      { const dd = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)
        if (m.cars[i].layer === m.cars[j].layer) minGap = Math.min(minGap, dd); else if (amb === undefined || i === amb || j === amb) minCover = Math.min(minCover, dd) }
    prev = ps
  }
  return { ok: perm && ends && immobile === 0 && minGap >= SAFE_GAP && minCover >= MIN_COVER && maxStep <= MAX_STEP && maxTurn <= MAX_TURN, minGap, minCover, maxStep, maxTurn, immobile, perm }
}
export function generateMove(id: MotifId, rng: Rng = Math.random, amb?: number): Move {
  for (let k = 0; k < 400; k++) { const m = MOTIFS[id].gen(rng); if (checkMove(m, amb).ok) return m }
  throw new Error(`motif ${id} : aucune variante valide`)
}

/* ---------- Tempo ---------- */
export type EaseId = 'std' | 'feinte'
export type Tag = 'normal' | 'rafale' | 'feinte' | 'final'
export interface WavePlan { move: Move; dur: number; pause: number; ease: EaseId; tag: Tag }
/** plancher des rafales / plancher lisible des vagues normales / plancher du final */
export const MIN_DUR = 260, LISIBLE = 320, FINAL_MIN = 300, MAX_DUR = 1400
const cubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/** Feinte : avance, ralentit presque à l'arrêt vers 45 %, puis repart. Monotone et continue. */
export function easeFn(id: EaseId) {
  if (id === 'std') return cubic
  return (t: number) => t < 0.4 ? 0.44 * cubic(t / 0.4) : t < 0.7 ? 0.44 + 0.08 * cubic((t - 0.4) / 0.3) : 0.52 + 0.48 * cubic((t - 0.7) / 0.3)
}

export interface Level {
  niveau: number; nom: string; vagues: number; baseMs: number; accel: number
  motifs: MotifId[]; nouveaux: MotifId[]; rafales: number; feintes: number; final: boolean
}
const N1: MotifId[] = ['voisines', 'cercle', 'carrousel', 'tapis'], N2: MotifId[] = [...N1, 'diagonales']
const N3: MotifId[] = [...N2, 'serpent', 'miroir'], N4: MotifId[] = [...N3, 'lointains']
export const NIVEAUX: Level[] = [
  { niveau: 1, nom: 'Échauffement', vagues: 7, baseMs: 680, accel: 1.6, motifs: N1, nouveaux: N1, rafales: 1, feintes: 0, final: false },
  { niveau: 2, nom: 'Croisements', vagues: 8, baseMs: 620, accel: 1.65, motifs: N2, nouveaux: ['diagonales'], rafales: 1, feintes: 1, final: false },
  { niveau: 3, nom: 'Embrouilles', vagues: 9, baseMs: 565, accel: 1.7, motifs: N3, nouveaux: ['serpent', 'miroir'], rafales: 1, feintes: 1, final: false },
  { niveau: 4, nom: 'Grand mix', vagues: 10, baseMs: 515, accel: 1.7, motifs: N4, nouveaux: ['lointains'], rafales: 2, feintes: 1, final: true },
  { niveau: 5, nom: 'Tempête', vagues: 12, baseMs: 470, accel: 1.8, motifs: N4, nouveaux: [], rafales: 2, feintes: 2, final: true },
  { niveau: 6, nom: 'Expert', vagues: 14, baseMs: 430, accel: 1.8, motifs: N4, nouveaux: [], rafales: 3, feintes: 2, final: true },
]
/** Suite de motifs : les nouveautés du niveau apparaissent, jamais deux fois le même motif d'affilée. */
export function motifSequence(level: Level, rng: Rng): MotifId[] {
  for (;;) {
    const seq: (MotifId | null)[] = Array(level.vagues).fill(null)
    const slots = shuffle(Array.from({ length: level.vagues }, (_, i) => i), rng)
    level.nouveaux.forEach((m, i) => { seq[slots[i]] = m })
    let ok = true
    for (let i = 0; i < seq.length && ok; i++) {
      if (seq[i]) { if (i && seq[i - 1] === seq[i]) ok = false; continue }
      const opts = level.motifs.filter(m => m !== seq[i - 1] && m !== seq[i + 1])
      if (!opts.length) { ok = false; break }
      seq[i] = opts[Math.floor(rng() * opts.length)]
    }
    if (ok && seq.every((m, i) => !i || m !== seq[i - 1])) return seq as MotifId[]
  }
}
export function baseDuration(level: Level, i: number) {
  const p = level.vagues <= 1 ? 0 : i / (level.vagues - 1)
  return level.baseMs / (1 + (level.accel - 1) * Math.pow(p, 1.3))
}
/** Étiquettes de tempo : rafales (2-3 vagues), feintes, final (2-3 dernières vagues). */
export function tempoTags(level: Level, rng: Rng): Tag[] {
  for (let t = 0; t < 500; t++) {
    const tags = tryTags(level, rng)
    const blocs = tags.filter((x, i) => x === 'rafale' && tags[i - 1] !== 'rafale').length
    if (blocs === level.rafales && tags.filter(x => x === 'feinte').length === level.feintes) return tags
  }
  throw new Error('tempo impossible')
}
function tryTags(level: Level, rng: Rng): Tag[] {
  const n = level.vagues, tags: Tag[] = Array(n).fill('normal')
  const finalLen = level.final ? (rng() < 0.5 ? 2 : 3) : 0
  for (let i = n - finalLen; i < n; i++) tags[i] = 'final'
  let placed = 0
  for (let k = 0; k < 200 && placed < level.rafales; k++) {
    const len = rng() < 0.5 ? 3 : 2, st = 1 + Math.floor(rng() * (n - finalLen - len - 1))
    if (st < 1 || st + len > n - finalLen - 1) continue
    if (tags.slice(st - 1, st + len + 1).some(t => t !== 'normal')) continue
    for (let i = st; i < st + len; i++) tags[i] = 'rafale'
    placed++
  }
  placed = 0
  for (let k = 0; k < 200 && placed < level.feintes; k++) {
    const i = 1 + Math.floor(rng() * (n - 1)); if (tags[i] !== 'normal' || tags[i - 1] === 'feinte' || tags[i + 1] === 'feinte') continue
    tags[i] = 'feinte'; placed++
  }
  return tags
}
export function buildPlan(level: Level, rng: Rng = Math.random, ambStart = 0): WavePlan[] {
  const seq = motifSequence(level, rng), tags = tempoTags(level, rng), n = level.vagues
  let amb = ambStart
  const finalDur = Math.max(FINAL_MIN, baseDuration(level, n - 1) / 2)
  return seq.map((motif, i) => {
    const b = baseDuration(level, i), tag = tags[i]
    let dur = tag === 'rafale' ? Math.max(MIN_DUR, b / 2) : tag === 'feinte' ? b * 1.8 : tag === 'final' ? finalDur
      : b * (level.niveau >= 4 ? 0.85 + rng() * 0.35 : 0.92 + rng() * 0.16)
    dur = Math.round(Math.min(MAX_DUR, Math.max(tag === 'normal' ? LISIBLE : tag === 'final' ? FINAL_MIN : MIN_DUR, dur)))
    const nextRafale = tags[i + 1] === 'rafale'
    const pause = i === n - 1 ? 0 : tag === 'rafale' ? (nextRafale ? 60 : 480) : tag === 'final' ? 50 : Math.round(dur * 0.12)
    const move = generateMove(motif, rng, amb); amb = move.cars[amb].to
    return { move, dur, pause, ease: tag === 'feinte' ? 'feinte' : 'std', tag }
  })
}
/** Vitrine : chaque motif une fois, tempo calme (pour la démo et la vidéo best-of). */
export function buildVitrine(rng: Rng = Math.random, ambStart = 0): WavePlan[] {
  let amb = ambStart
  return MOTIF_IDS.map(id => { const move = generateMove(id, rng, amb); amb = move.cars[amb].to; return { move, dur: 850, pause: 500, ease: 'std' as EaseId, tag: 'normal' as Tag } })
}
export const applyPlan = (pos: number[], plan: WavePlan[]) => plan.reduce((p, w) => p.map(c => w.move.cars[c].to), pos)
export function scoreFor(level: Level, reactionMs: number) {
  return 100 * level.niveau + Math.max(0, Math.round(50 * (1 - reactionMs / 10000)))
}

/* ---------- Niveau Expert ---------- */
export const EXPERT_KEY = 'jeux-reflexion:ambulance:expert'
type KV = Pick<Storage, 'getItem' | 'setItem'>
export const isExpertUnlocked = (st: KV) => st.getItem(EXPERT_KEY) === '1'
/** Débloque le N6 quand le N5 est réussi. */
export function onLevelWon(niveau: number, st: KV) { if (niveau >= 5) st.setItem(EXPERT_KEY, '1') }
