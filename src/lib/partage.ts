/** Partage d'un score : message, liens réseaux sociaux, image 1080×1350 (canvas). Aucun backend, aucune clé. */
export const formatPoints = (n: number) => new Intl.NumberFormat('fr-FR').format(n).replace(/\u202f|\u00a0/g, ' ')

export function messagePartage(o: { score: number; niveau: number; jeu: string; multi?: { gagnant: string } }) {
  if (o.multi) return `${o.multi.gagnant} a gagné avec ${formatPoints(o.score)} points à ${o.jeu} sur PlayMe ! Tu peux faire mieux ?`
  return `J'ai fait ${formatPoints(o.score)} points au niveau ${o.niveau} de ${o.jeu} sur PlayMe ! Tu peux me battre ?`
}
export function liensReseaux(texte: string, url: string) {
  const t = encodeURIComponent(texte), u = encodeURIComponent(url), tu = encodeURIComponent(`${texte} ${url}`)
  return [
    { id: 'whatsapp', nom: 'WhatsApp', href: `https://wa.me/?text=${tu}` },
    { id: 'facebook', nom: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'x', nom: 'X', href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { id: 'telegram', nom: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
  ]
}

export interface CarteScore { titre: string; score: number; niveau: number; prenom: string; sousTitre: string; url: string }
/** Dessine l'image de score 1080×1350 et renvoie un PNG (Blob). Navigateur uniquement. */
export async function imageScore(c: CarteScore): Promise<Blob> {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const g = cv.getContext('2d')!
  try { await document.fonts?.load('120px Anton') } catch { /* police de repli */ }
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d1124'); bg.addColorStop(1, '#05060B'); g.fillStyle = bg; g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(142,148,200,.18)'; g.lineWidth = 2
  for (let x = 90; x < W; x += 150) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
  for (let y = 90; y < H; y += 150) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
  g.textAlign = 'center'
  g.fillStyle = '#F5A343'; g.font = '700 44px Inter, sans-serif'; g.fillText('PLAYME · JEUX DE RÉFLEXION', W / 2, 150)
  g.fillStyle = '#ffffff'; g.font = '110px Anton, Impact, sans-serif'; g.fillText(c.titre.toUpperCase(), W / 2, 300)
  g.font = '160px serif'; g.fillText('🚑', W / 2, 520)
  g.fillStyle = '#F5B800'; g.font = '240px Anton, Impact, sans-serif'; g.fillText(formatPoints(c.score), W / 2, 820)
  g.fillStyle = '#ffffff'; g.font = '700 64px Inter, sans-serif'; g.fillText('POINTS', W / 2, 900)
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '600 50px Inter, sans-serif'
  g.fillText(`${c.prenom} · niveau ${c.niveau}`, W / 2, 1010)
  g.fillStyle = '#F0435A'; g.font = '80px Anton, Impact, sans-serif'; g.fillText(c.sousTitre.toUpperCase(), W / 2, 1150)
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '500 34px Inter, sans-serif'; g.fillText(c.url.replace(/^https?:\/\//, '').slice(0, 60), W / 2, 1260)
  return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('canvas'))), 'image/png'))
}
