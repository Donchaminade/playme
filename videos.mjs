import { chromium } from 'playwright'
const which = process.argv[2]
const b = await chromium.launch()
const big = which === 'demo' || which === 'bestof'
const vp = big ? { width: 1280, height: 720 } : { width: 390, height: 844 }
const ctx = await b.newContext({ viewport: vp, recordVideo: { dir: '/tmp/vid/' + which, size: vp } })
await ctx.addInitScript(() => { localStorage.setItem('jeux-reflexion:ambulance:expert', '1'); localStorage.setItem('jeux-reflexion:nom', 'Test') })
const p = await ctx.newPage(); const t0 = Date.now(); const marks = []
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => m.type() === 'error' && console.log('CERR', m.text()))
const U = 'http://127.0.0.1:4791/jeux/suis-l-ambulance'
if (!big) {
  await p.goto(U + '?niveau=' + which)
  await p.waitForSelector('text=Repère', { timeout: 15000 })
  await p.evaluate(() => document.querySelector('rect[fill="#F7F7FA"]').closest('button').setAttribute('data-amb', '1'))
  marks.push(['melange?', (Date.now() - t0) / 1000])
  await p.waitForSelector('text=Touche le bon numéro', { timeout: 60000 }); marks.push(['choix', (Date.now() - t0) / 1000])
  await p.waitForTimeout(700); await p.click('[data-amb]'); await p.waitForTimeout(2500)
} else {
  await p.goto(U + '/demo' + (which === 'bestof' ? '?vitrine=1' : '')); await p.waitForTimeout(800); await p.click('text=LANCER')
  await p.waitForSelector(which === 'bestof' ? 'text=OÙ EST' : 'text=MANCHE 2', { timeout: 90000 }); marks.push(['fin', (Date.now() - t0) / 1000])
  if (which === 'demo') await p.waitForTimeout(1500)
}
const path = await p.video().path(); await ctx.close(); await b.close()
console.log(JSON.stringify({ which, path, marks, ambKey: 'ok' }))
