/**
 * Défi partagé sans backend : le lien ?defi=<code> encode le jeu, le score, le niveau, le prénom et une graine.
 * Même graine ⇒ mêmes parties (PRNG mulberry32). Le code est en base64url avec une somme de contrôle.
 */
export interface Defi { jeu: string; score: number; niveau: number; prenom: string; graine: number }
const VERSION = 1

function somme(s: string) { // FNV-1a 32 bits, tronqué à 6 caractères base36
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36).padStart(7, '0').slice(-6)
}
const b64u = {
  enc: (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s: string) => new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))),
}
export const nettoyerPrenom = (p: string) => p.replace(/[\u0000-\u001f|]/g, '').trim().slice(0, 24) || 'Un ami'

export function encoderDefi(d: Defi): string {
  const corps = [VERSION, d.jeu, Math.max(0, Math.round(d.score)), d.niveau, d.graine >>> 0, nettoyerPrenom(d.prenom)].join('|')
  return b64u.enc(`${corps}|${somme(corps)}`)
}
/** Décode un code ; renvoie null s'il est invalide, altéré ou incohérent. */
export function decoderDefi(code: string | null | undefined): Defi | null {
  if (!code || code.length > 200 || !/^[A-Za-z0-9_-]+$/.test(code)) return null
  let txt: string
  try { txt = b64u.dec(code) } catch { return null }
  const parts = txt.split('|'); if (parts.length !== 7) return null
  const [v, jeu, score, niveau, graine, prenom, sum] = parts
  if (somme(parts.slice(0, 6).join('|')) !== sum || Number(v) !== VERSION) return null
  const d = { jeu, score: Number(score), niveau: Number(niveau), graine: Number(graine), prenom }
  if (!/^[a-z0-9-]{1,40}$/.test(jeu) || !Number.isInteger(d.score) || d.score < 0 || d.score > 1e7) return null
  if (!Number.isInteger(d.niveau) || d.niveau < 0 || d.niveau > 99 || !Number.isInteger(d.graine) || d.graine < 0 || d.graine > 0xffffffff) return null
  if (!prenom || prenom !== nettoyerPrenom(prenom)) return null
  return d
}
export const nouvelleGraine = () => (Math.random() * 0x100000000) >>> 0
/** Graine dérivée par manche/niveau : indépendante du temps de réponse du joueur. */
export const graineDe = (graine: number, k: number) => (Math.imul(graine ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(k + 1, 0xc2b2ae35)) >>> 0
