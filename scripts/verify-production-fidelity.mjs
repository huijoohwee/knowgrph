import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { validateProductionRuntimeReadiness } from './production-runtime-readiness.mjs'

const normalizeOrigin = value => {
  const url = new URL(String(value || 'https://airvio.co'))
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

const origin = normalizeOrigin(process.env.PRODUCTION_ORIGIN)
const expectedSourceRevision = String(process.env.RELEASE_SHA || '').trim()
const expectedManifestDigest = String(process.env.PRODUCTION_IMMUTABLE_MANIFEST_DIGEST || '').trim()
if (!/^[0-9a-f]{40}$/.test(expectedSourceRevision)) throw new Error('RELEASE_SHA must be an exact lowercase 40-character SHA')
if (!/^[0-9a-f]{64}$/.test(expectedManifestDigest)) {
  throw new Error('PRODUCTION_IMMUTABLE_MANIFEST_DIGEST must be an exact lowercase SHA-256 digest')
}

const fetchMarker = async pathname => {
  const response = await fetch(`${origin}${pathname}`, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
  })
  const body = await response.text()
  assert.equal(response.status, 200, `${pathname} must return 200`)
  assert.match(response.headers.get('content-type') || '', /^application\/json\b/i)
  return { body, marker: JSON.parse(body) }
}

const waitForCanvas = async frame => {
  await frame.waitForFunction(() => {
    const text = document.body?.innerText || ''
    return text.length > 400
      && !text.includes('Preparing canvas view...')
      && !text.includes('Switching document:')
      && !text.includes('Switching document...')
  }, null, { timeout: 45_000 })
}

const markerAtApex = await fetchMarker('/.well-known/runtime-readiness.json')
const markerAtApp = await fetchMarker('/knowgrph/.well-known/runtime-readiness.json')
assert.equal(markerAtApex.body, markerAtApp.body, 'apex and /knowgrph readiness markers must be byte-identical')
await validateProductionRuntimeReadiness(markerAtApex.marker, {
  sourceRevision: expectedSourceRevision,
  immutableManifestDigest: expectedManifestDigest,
})

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ serviceWorkers: 'block' })
const pageErrors = []
const poisonedModules = []
context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)))
context.on('response', response => {
  const request = response.request()
  const contentType = String(response.headers()['content-type'] || '').toLowerCase()
  if (request.resourceType() === 'script' && contentType.includes('text/html')) {
    poisonedModules.push(response.url())
  }
})

try {
  const home = await context.newPage()
  await home.goto(`${origin}/?kgReleaseProof=${expectedSourceRevision}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await home.locator('h1').filter({ hasText: 'Map intent.' }).waitFor({ state: 'visible', timeout: 30_000 })
  const heading = await home.locator('h1').innerText()
  for (const phrase of ['Map intent.', 'Orchestrate agents.', 'Prove outcomes.']) assert.ok(heading.includes(phrase))
  const heroFrameElement = home.locator('iframe').first()
  await heroFrameElement.waitFor({ state: 'attached', timeout: 30_000 })
  const heroFrameHandle = await heroFrameElement.elementHandle()
  const heroFrame = await heroFrameHandle?.contentFrame()
  assert.ok(heroFrame, 'home hero must mount its Knowgrph canvas iframe')
  await waitForCanvas(heroFrame)

  const app = await context.newPage()
  await app.goto(`${origin}/knowgrph?kgReleaseProof=${expectedSourceRevision}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await waitForCanvas(app.mainFrame())
  const appText = await app.locator('body').innerText()
  assert.match(appText, /Explorer|Storyboard|Markdown/)
  assert.deepEqual(poisonedModules, [], `JavaScript module requests returned HTML: ${poisonedModules.join(', ')}`)
  assert.deepEqual(pageErrors, [], `uncaught browser errors: ${pageErrors.join(' | ')}`)
} finally {
  await browser.close()
}

process.stdout.write(`${JSON.stringify({
  status: 'passed',
  origin,
  sourceRevision: markerAtApex.marker.source.revision,
  agenticCanvasOsRevision: markerAtApex.marker.agenticCanvasOs.revision,
  artifactDigest: markerAtApex.marker.artifact.digest,
})}\n`)
