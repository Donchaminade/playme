import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4791'
const b = await chromium.launch()
for (const [tag, vp] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: tag === 'mobile' ? 2 : 1 })
  p.on('pageerror', e => console.log('ERR', e.message))
  await p.goto(B + '/'); await p.waitForTimeout(1200); await p.screenshot({ path: `shots/${tag}-accueil.png` })
  await p.goto(B + '/jeux/suis-l-ambulance'); await p.waitForTimeout(800)
  await p.fill('input', 'Ama GDG'); await p.click('text=Jouer')
  for (let lv = 0; lv < 5; lv++) {
    await p.waitForTimeout(600)
    if (lv === 0) await p.screenshot({ path: `shots/${tag}-jeu-ambulance.png` })
    await p.evaluate(() => { document.querySelectorAll('[data-amb]').forEach(e => e.removeAttribute('data-amb')); const r = document.querySelector('rect[fill="#F7F7FA"]'); r.closest('button').setAttribute('data-amb', '1') })
    if (lv === 1) { await p.waitForTimeout(2800); await p.screenshot({ path: `shots/${tag}-jeu-melange.png` }) }
    await p.waitForSelector('text=Touche le bon numéro', { timeout: 30000 })
    if (lv === 0) await p.screenshot({ path: `shots/${tag}-jeu-choix.png` })
    await p.click('[data-amb]')
    if (lv < 4) await p.waitForSelector('text=Repère', { timeout: 10000 })
  }
  await p.waitForSelector('text=VICTOIRE', { timeout: 10000 }); await p.waitForTimeout(1300)
  await p.screenshot({ path: `shots/${tag}-victoire.png` })
  if (tag === 'desktop') {
    await p.goto(B + '/jeux/suis-l-ambulance/demo'); await p.waitForTimeout(800); await p.click('text=LANCER')
    await p.waitForSelector('text=OÙ EST', { timeout: 60000 }); await p.waitForTimeout(1200)
    await p.screenshot({ path: `shots/desktop-demo.png` })
  }
}
await b.close()
