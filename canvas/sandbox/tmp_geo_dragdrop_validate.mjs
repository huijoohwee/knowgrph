import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE_URL = 'http://localhost:5173'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function clickCanvasViewOption(page, optionTitle) {
  const trigger = page.locator('button[title^="Canvas View Mode"]').first()
  await trigger.waitFor({ state: 'visible', timeout: 15000 })
  await trigger.click()
  const option = page.locator('text=' + optionTitle).first()
  await option.waitFor({ state: 'visible', timeout: 10000 })
  await option.click()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1080 } })

  const logs = []
  page.on('console', (msg) => logs.push('[console:' + msg.type() + '] ' + msg.text()))
  page.on('pageerror', (err) => logs.push('[pageerror] ' + err.message))

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 60000 })
  await sleep(1500)

  await page.screenshot({ path: '/tmp/geo-validate-before.png', fullPage: true })

  await clickCanvasViewOption(page, '2D Renderer: Flow Editor')
  await sleep(400)
  await clickCanvasViewOption(page, 'Geospatial Mode')
  await sleep(1800)

  const createNodeBtn = page.locator('button[title="Create Node"]').first()
  await createNodeBtn.waitFor({ state: 'visible', timeout: 10000 })
  await createNodeBtn.click()
  await sleep(600)

  const widgetButton = page.locator('button[title="Drag to canvas: GrabMap Chat Discovery Widget"]').first()
  await widgetButton.waitFor({ state: 'visible', timeout: 12000 })

  const canvasViewport = page.locator('section[aria-label="Canvas viewport"]').first()
  await canvasViewport.waitFor({ state: 'visible', timeout: 10000 })

  await widgetButton.dragTo(canvasViewport, { targetPosition: { x: 860, y: 520 } })
  await sleep(2200)

  const createdToastVisible = await page.locator('text=Created GrabMapsDiscovery node.').first().isVisible().catch(() => false)
  const legendVisible = await page.locator('text=Legend').first().isVisible().catch(() => false)

  await page.screenshot({ path: '/tmp/geo-validate-after.png', fullPage: true })

  const result = {
    pass: createdToastVisible && legendVisible,
    checks: {
      createdToastVisible,
      legendVisible,
    },
    artifacts: {
      before: '/tmp/geo-validate-before.png',
      after: '/tmp/geo-validate-after.png',
    },
    logs: logs.slice(-80),
  }

  writeFileSync('/tmp/geo-validate-result.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))

  await browser.close()

  if (!result.pass) process.exit(2)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
