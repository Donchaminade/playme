export interface ScoreEntry { nom: string; score: number; niveau: number; temps: number; date: number }
const key = (slug: string) => `jeux-reflexion:classement:${slug}`
export function sortScores(list: ScoreEntry[]) {
  return [...list].sort((a, b) => b.score - a.score || a.temps - b.temps).slice(0, 20)
}
export function loadScores(slug: string): ScoreEntry[] {
  try { return JSON.parse(localStorage.getItem(key(slug)) || '[]') } catch { return [] }
}
export function saveScore(slug: string, e: ScoreEntry) {
  const list = sortScores([...loadScores(slug), e]); localStorage.setItem(key(slug), JSON.stringify(list)); return list
}
export function clearScores(slug: string) { localStorage.removeItem(key(slug)) }
