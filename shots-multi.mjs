// Captures du mode multijoueur, du partage et du défi : node shots-multi.mjs (preview lancée sur :4791)
import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4791/jeux/suis-l-ambulance'
const video = process.argv[2] === 'video'
const b = await chromium.launch()

// même encodage que src/lib/defi.ts
function somme(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(36).padStart(7, '0').slice(-6) }
const defi = (() => { const c = ['1', 'suis-l-ambulance', 1240, 4, 123456789, 'Ama'].join('|'); return Buffer.from(`${c}|${somme(c)}`).toString('base64url') })()

async function partie(vp, tag, nb, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: video ? 1 : 2, hasTouch: vp.width < 1024, ...(video ? { recordVideo: { dir: '/tmp/vid/multi', size: vp } } : {}) })
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message))
  await p.goto(B + '?mode=multi'); await p.waitForTimeout(700)
  await p.click(`button[aria-pressed] >> text="${nb}"`)
  const noms = ['Ama', 'Koffi', 'Yao']
  for (let i = 0; i < nb; i++) await p.locator('input').nth(i).fill(noms[i])
  await p.locator('fieldset').nth(1).locator('button', { hasText: /^3$/ }).click()
  if (opts.config) await p.screenshot({ path: `shots/${tag}-multi-config.png` })
  await p.click("text=C'est parti")
  const manches = opts.podium ? 3 : 1
  for (let m = 0; m < manches; m++) {
    await p.waitForSelector("text=repérez l'ambulance", { timeout: 15000 })
    await p.evaluate(() => { document.querySelectorAll('[data-amb]').forEach(e => e.removeAttribute('data-amb')); document.querySelector('rect[fill="#F7F7FA"]').closest('button').setAttribute('data-amb', '1') })
    await p.waitForSelector('text=à vous', { timeout: 40000 })
    const n = Number((await p.getAttribute('[data-amb]', 'aria-label')).replace(/\D/g, ''))
    await p.waitForTimeout(700)
    await p.locator(`button[aria-label="Ama : voiture ${n}"]`).dispatchEvent('pointerdown')
    if (m === 0 && opts.choix) { await p.waitForTimeout(500); await p.screenshot({ path: `shots/${tag}-multi-${nb}j-choix.png` }) }
    await p.waitForTimeout(400)
    await p.locator(`button[aria-label="Koffi : voiture ${(n % 12) + 1}"]`).dispatchEvent('pointerdown')
    if (nb > 2) { await p.waitForTimeout(300); await p.locator(`button[aria-label="Yao : voiture ${n}"]`).dispatchEvent('pointerdown') }
    await p.waitForSelector("text=c'était le", { timeout: 8000 }); await p.waitForTimeout(900)
    if (m === 0 && opts.revele) await p.screenshot({ path: `shots/${tag}-multi-${nb}j-revelation.png` })
    if (m < manches - 1) {
      await p.waitForSelector('text=Manche suivante', { timeout: 8000 }); await p.waitForTimeout(600)
      if (m === 0 && opts.revele) await p.screenshot({ path: `shots/${tag}-multi-scores.png` })
      await p.click('text=Manche suivante')
    }
  }
  if (opts.podium) {
    await p.waitForSelector('[data-testid=podium]', { timeout: 10000 }); await p.waitForTimeout(1800)
    await p.screenshot({ path: `shots/${tag}-multi-podium.png` })
    await p.click('text=Partager le résultat'); await p.waitForTimeout(1200)
    await p.screenshot({ path: `shots/${tag}-partage.png` })
  }
  if (video) await p.waitForTimeout(800)
  const v = video ? await p.video().path() : null
  await ctx.close(); return v
}

if (video) {
  console.log(await partie({ width: 390, height: 844 }, 'mobile', 2))
} else {
  await partie({ width: 390, height: 844 }, 'mobile', 2, { config: true, choix: true, revele: true, podium: true })
  await partie({ width: 390, height: 844 }, 'mobile', 3, { choix: true, revele: true })
  await partie({ width: 820, height: 1180 }, 'tablette', 2, { choix: true })
  await partie({ width: 820, height: 1180 }, 'tablette', 3, { config: true, choix: true, revele: true })
  await partie({ width: 1440, height: 900 }, 'desktop', 3, { choix: true })
  // bannière de défi + comparaison
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await p.goto(`${B}?defi=${defi}`); await p.waitForTimeout(900)
  await p.screenshot({ path: 'shots/mobile-defi-accueil.png' })
  await p.click('text=Jouer'); await p.waitForTimeout(800)
  await p.screenshot({ path: 'shots/mobile-defi-banniere.png' })
  await p.waitForSelector('text=Touche le bon numéro', { timeout: 30000 })
  await p.screenshot({ path: 'shots/mobile-solo-5s.png' })
  await p.waitForSelector('[data-testid=comparaison-defi]', { timeout: 12000 }); await p.waitForTimeout(1200)
  await p.screenshot({ path: 'shots/mobile-defi-comparaison.png' })
}
await b.close()
