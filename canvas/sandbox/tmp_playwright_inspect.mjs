import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

page.on('console', (msg) => {
  console.log(`[console:${msg.type()}] ${msg.text()}`)
})
page.on('pageerror', (err) => {
  console.log(`[pageerror] ${err.message}`)
})

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle')
await page.waitForTimeout(3000)

const title = await page.title()
const bodyText = await page.locator('body').innerText()
const buttons = await page.locator('button').evaluateAll((els) =>
  els.map((el) => ({
    text: (el.textContent || '').trim(),
    aria: el.getAttribute('aria-label') || '',
    title: el.getAttribute('title') || '',
  })),
)

writeFileSync('/tmp/knowgrph-inspect.html', await page.content())
await page.screenshot({ path: '/tmp/knowgrph-inspect.png', fullPage: true })

console.log(JSON.stringify({
  title,
  bodyText: bodyText.slice(0, 4000),
  buttonCount: buttons.length,
  buttons: buttons.slice(0, 100),
}, null, 2))

await browser.close()
