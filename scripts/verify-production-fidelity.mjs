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

const browserOrigin = normalizeOrigin(process.env.PRODUCTION_ORIGIN)
const publicOrigin = normalizeOrigin(process.env.PRODUCTION_PUBLIC_ORIGIN || 'https://airvio.co')
const markerOrigin = normalizeOrigin(process.env.PRODUCTION_MARKER_ORIGIN || browserOrigin)
const expectedSourceRevision = String(process.env.RELEASE_SHA || '').trim()
const expectedManifestDigest = String(process.env.PRODUCTION_IMMUTABLE_MANIFEST_DIGEST || '').trim()
const browserHeadless = String(process.env.PRODUCTION_BROWSER_HEADLESS || 'true').trim() !== 'false'
if (!/^[0-9a-f]{40}$/.test(expectedSourceRevision)) throw new Error('RELEASE_SHA must be an exact lowercase 40-character SHA')
if (!/^[0-9a-f]{64}$/.test(expectedManifestDigest)) {
  throw new Error('PRODUCTION_IMMUTABLE_MANIFEST_DIGEST must be an exact lowercase SHA-256 digest')
}

const fetchMarker = async pathname => {
  const response = await fetch(`${markerOrigin}${pathname}`, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
  })
  const body = await response.text()
  assert.equal(response.status, 200, `${pathname} must return 200`)
  assert.match(response.headers.get('content-type') || '', /^application\/json\b/i)
  return { body, marker: JSON.parse(body) }
}

const PHYSICS_PLAYGROUND_PATTERN = /Physics runtime running with (?:ball|rocket) selected\./
const WEBGL_SOFTWARE_RENDERING_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader-webgl',
  '--enable-unsafe-swiftshader',
]

const isCanvasReady = text => text.length > 200
  && !text.includes('Preparing canvas view...')
  && !text.includes('Switching document:')
  && !text.includes('Switching document...')
  && PHYSICS_PLAYGROUND_PATTERN.test(text)

const waitForCanvas = async resolveBody => {
  const deadline = Date.now() + 45_000
  let lastError = null
  let lastText = ''
  while (Date.now() < deadline) {
    try {
      const body = await resolveBody()
      const text = await body.innerText({ timeout: 2_000 })
      lastText = text
      if (isCanvasReady(text)) return text
    } catch (error) {
      // Document selection replaces the frame; re-resolve it until the selected canvas owns the page.
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const observed = lastText.replace(/\s+/g, ' ').trim().slice(0, 240)
  const detail = observed ? ` Last observed text: ${observed}` : ''
  throw new Error(`Canvas did not reach a stable ready state within 45 seconds.${detail}`, { cause: lastError })
}

const resolveHomeCanvasFrames = page => page.frames().filter(candidate => {
    if (candidate === page.mainFrame()) return false
    try {
      const url = new URL(candidate.url())
      return url.pathname.replace(/\/$/, '') === '/knowgrph'
        && url.searchParams.get('kgPreview') === '1'
    } catch {
      return false
    }
  })

const resolveHomeCanvasBody = async page => {
  const frame = resolveHomeCanvasFrames(page).at(-1)
  // The Home startup handoff may promote the selected canvas into the top-level surface.
  return frame ? frame.locator('body') : page.locator('body')
}

const readHomeSourceAuthority = async page => {
  const frames = resolveHomeCanvasFrames(page)
  const targets = frames.length > 0 ? frames : [page]
  const evidenceByTarget = await Promise.all(targets.map(async target => ({
    url: target.url(),
    ...await target.evaluate(() => ({
      prematureSceneMounts: window.__kgHomeSourceAuthorityEvidence || [],
      sceneAuthorityMounts: window.__kgHomeXrSceneAuthorityEvidence || [],
      sceneRootCount: document.querySelectorAll('[data-kg-xr-scene-media-drop="1"]').length,
      documentLoadedRootCount: document.querySelectorAll(
        '[data-kg-xr-scene-media-drop="1"][data-kg-xr-document-loaded="1"]',
      ).length,
      canvasCount: document.querySelectorAll('[data-kg-xr-scene-media-drop="1"] canvas').length,
      sceneAuthorities: Array.from(document.querySelectorAll('[data-kg-xr-scene-media-drop="1"]'))
        .map(element => element.getAttribute('data-kg-xr-scene-authority')),
      emptyWorldCount: document.querySelectorAll('[data-kg-xr-empty-world="1"]').length,
      gameStageCount: document.querySelectorAll('[data-kg-game-fps-stage]').length,
      viewportLabels: Array.from(document.querySelectorAll('[data-kg-canvas-viewport-root="1"]'))
        .map(element => element.getAttribute('aria-label')),
      heavyRuntimeIntents: Array.from(document.querySelectorAll('[data-kg-canvas-heavy-runtime-intent]'))
        .map(element => element.getAttribute('data-kg-canvas-heavy-runtime-intent')),
      bodyTextTail: String(document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(-500),
    })),
  })))
  return evidenceByTarget.reduce((total, evidence) => ({
    targetUrls: [...total.targetUrls, evidence.url],
    prematureSceneMounts: [...total.prematureSceneMounts, ...evidence.prematureSceneMounts],
    sceneAuthorityMounts: [...total.sceneAuthorityMounts, ...evidence.sceneAuthorityMounts],
    sceneRootCount: total.sceneRootCount + evidence.sceneRootCount,
    documentLoadedRootCount: total.documentLoadedRootCount + evidence.documentLoadedRootCount,
    canvasCount: total.canvasCount + evidence.canvasCount,
    sceneAuthorities: [...total.sceneAuthorities, ...evidence.sceneAuthorities],
    emptyWorldCount: total.emptyWorldCount + evidence.emptyWorldCount,
    gameStageCount: total.gameStageCount + evidence.gameStageCount,
    viewportLabels: [...total.viewportLabels, ...evidence.viewportLabels],
    heavyRuntimeIntents: [...total.heavyRuntimeIntents, ...evidence.heavyRuntimeIntents],
    bodyTextTail: evidence.bodyTextTail || total.bodyTextTail,
  }), {
    targetUrls: [],
    prematureSceneMounts: [],
    sceneAuthorityMounts: [],
    sceneRootCount: 0,
    documentLoadedRootCount: 0,
    canvasCount: 0,
    sceneAuthorities: [],
    emptyWorldCount: 0,
    gameStageCount: 0,
    viewportLabels: [],
    heavyRuntimeIntents: [],
    bodyTextTail: '',
  })
}

const waitForHomeSourceAuthority = async page => {
  const deadline = Date.now() + 30_000
  let lastEvidence = null
  let lastError = null
  while (Date.now() < deadline) {
    try {
      lastEvidence = await readHomeSourceAuthority(page)
      if (
        lastEvidence.sceneRootCount === 1
        && lastEvidence.documentLoadedRootCount === 1
        && lastEvidence.canvasCount === 1
      ) return lastEvidence
    } catch (error) {
      // The remote-document handoff may replace the frame; always re-resolve it on the next poll.
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(
    `Home source authority did not stabilize: ${JSON.stringify(lastEvidence)}`,
    { cause: lastError },
  )
}

const markerAtApex = await fetchMarker('/.well-known/runtime-readiness.json')
const markerAtApp = await fetchMarker('/knowgrph/.well-known/runtime-readiness.json')
assert.equal(markerAtApex.body, markerAtApp.body, 'apex and /knowgrph readiness markers must be byte-identical')
await validateProductionRuntimeReadiness(markerAtApex.marker, {
  sourceRevision: expectedSourceRevision,
  immutableManifestDigest: expectedManifestDigest,
})

const browser = await chromium.launch({
  channel: 'chrome',
  headless: browserHeadless,
  // Release proof runs only the trusted immutable candidate and needs WebGL on GPU-less CI hosts.
  args: WEBGL_SOFTWARE_RENDERING_ARGS,
})
const context = await browser.newContext({ serviceWorkers: 'block' })
await context.addInitScript(() => {
  const prematureSceneMounts = []
  const sceneAuthorityMounts = []
  const observedSceneRoots = new WeakSet()
  const recordSceneAuthorityMount = () => {
    const sceneRoots = document.querySelectorAll('[data-kg-xr-scene-media-drop="1"]')
    for (const root of sceneRoots) {
      if (observedSceneRoots.has(root)) continue
      observedSceneRoots.add(root)
      sceneAuthorityMounts.push({
        authority: root.getAttribute('data-kg-xr-scene-authority'),
        documentLoaded: root.getAttribute('data-kg-xr-document-loaded'),
      })
    }
  }
  const recordPrematureSceneMount = () => {
    recordSceneAuthorityMount()
    const sceneRoots = document.querySelectorAll('[data-kg-xr-scene-media-drop="1"]')
    const canonicalSourceReady = document.querySelector('[data-kg-xr-physics-run-ready="full-frame"]')
      || Array.from(sceneRoots).every(root => root.getAttribute('data-kg-xr-document-loaded') === '1')
    if (sceneRoots.length === 0 || canonicalSourceReady) return
    prematureSceneMounts.push({
      rootCount: sceneRoots.length,
      documentLoaded: Array.from(sceneRoots).map(root => root.getAttribute('data-kg-xr-document-loaded')),
      sceneAuthorities: Array.from(sceneRoots).map(root => root.getAttribute('data-kg-xr-scene-authority')),
      emptyWorldCount: document.querySelectorAll('[data-kg-xr-empty-world="1"]').length,
      gameStageCount: document.querySelectorAll('[data-kg-game-fps-stage]').length,
    })
  }
  new MutationObserver(recordPrematureSceneMount).observe(document, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: [
      'data-kg-xr-document-loaded',
      'data-kg-xr-physics-run-ready',
      'data-kg-xr-scene-authority',
      'data-kg-xr-scene-media-drop',
    ],
  })
  Object.defineProperty(window, '__kgHomeSourceAuthorityEvidence', {
    configurable: false,
    get: () => prematureSceneMounts.slice(),
  })
  Object.defineProperty(window, '__kgHomeXrSceneAuthorityEvidence', {
    configurable: false,
    get: () => sceneAuthorityMounts.slice(),
  })
})
const pageErrors = []
const poisonedModules = []
const browserAssetScripts = []
context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)))
context.on('response', response => {
  const request = response.request()
  const contentType = String(response.headers()['content-type'] || '').toLowerCase()
  const url = new URL(response.url())
  if (request.resourceType() === 'script' && url.pathname.startsWith('/knowgrph/assets/')) {
    browserAssetScripts.push(url.pathname)
  }
  if (request.resourceType() === 'script' && contentType.includes('text/html')) {
    poisonedModules.push(response.url())
  }
})

try {
  const home = await context.newPage()
  await home.goto(`${browserOrigin}/?kgReleaseProof=${expectedSourceRevision}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await home.locator('h1').filter({ hasText: 'Map intent.' }).waitFor({ state: 'visible', timeout: 30_000 })
  const heading = await home.locator('h1').innerText()
  for (const phrase of ['Map intent.', 'Orchestrate agents.', 'Prove outcomes.']) assert.ok(heading.includes(phrase))
  const heroFrameElement = home.locator('iframe').first()
  await heroFrameElement.waitFor({ state: 'attached', timeout: 30_000 })
  const heroFrameSrc = await heroFrameElement.getAttribute('src')
  assert.ok(heroFrameSrc, 'Home must mount the canonical shared-canvas iframe')
  assert.equal(new URL(heroFrameSrc, browserOrigin).searchParams.get('kgPreview'), '1')
  const heroCanvasText = await waitForCanvas(() => resolveHomeCanvasBody(home))
  assert.match(heroCanvasText, PHYSICS_PLAYGROUND_PATTERN)
  assert.match(heroCanvasText, /Beach Ball/)
  assert.match(heroCanvasText, /Rocket/)
  assert.doesNotMatch(heroCanvasText, /Validation seed fallback/)
  const homeSourceAuthority = await waitForHomeSourceAuthority(home)
  assert.deepEqual(homeSourceAuthority.prematureSceneMounts, [], 'Home mounted an XR world before canonical source readiness')
  assert.ok(homeSourceAuthority.sceneAuthorityMounts.length > 0, 'Home must record its first XR scene authority')
  assert.deepEqual(
    homeSourceAuthority.sceneAuthorityMounts.map(mount => mount.authority),
    homeSourceAuthority.sceneAuthorityMounts.map(() => 'native-controller'),
    `Home recovered from a non-canonical XR scene owner: ${JSON.stringify(homeSourceAuthority.sceneAuthorityMounts)}`,
  )
  assert.equal(homeSourceAuthority.sceneRootCount, 1, 'Home must retain exactly one canonical XR scene root')
  assert.equal(homeSourceAuthority.documentLoadedRootCount, 1, 'Home XR scene root must own the loaded source document')
  assert.equal(homeSourceAuthority.canvasCount, 1, 'Home must retain exactly one canonical XR Canvas')
  assert.deepEqual(homeSourceAuthority.sceneAuthorities, ['native-controller'], 'Home canonical Physics must retain native-controller scene authority')
  assert.equal(homeSourceAuthority.emptyWorldCount, 0, 'Home must never retain an empty-world fallback')
  assert.equal(homeSourceAuthority.gameStageCount, 0, 'Home must not activate Game Mode before explicit invocation')

  const app = await context.newPage()
  await app.goto(`${browserOrigin}/knowgrph?kgReleaseProof=${expectedSourceRevision}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  const appText = await waitForCanvas(() => app.locator('body'))
  assert.match(appText, PHYSICS_PLAYGROUND_PATTERN)
  assert.match(appText, /Beach Ball/)
  assert.ok(browserAssetScripts.length > 0, 'browser proof must load exact-revision Knowgrph JavaScript assets')
  const exactReleaseAssetPrefix = `/knowgrph/assets/${expectedSourceRevision}/`
  const scriptsOutsideExactReleaseNamespace = [
    ...new Set(browserAssetScripts.filter(pathname => !pathname.startsWith(exactReleaseAssetPrefix))),
  ]
  assert.deepEqual(
    scriptsOutsideExactReleaseNamespace,
    [],
    `browser loaded JavaScript outside the exact release namespace: ${scriptsOutsideExactReleaseNamespace.join(', ')}`,
  )
  assert.deepEqual(poisonedModules, [], `JavaScript module requests returned HTML: ${poisonedModules.join(', ')}`)
  assert.deepEqual(pageErrors, [], `uncaught browser errors: ${pageErrors.join(' | ')}`)
} finally {
  await browser.close()
}

process.stdout.write(`${JSON.stringify({
  status: 'passed',
  browserOrigin,
  publicOrigin,
  markerOrigin,
  sourceRevision: markerAtApex.marker.source.revision,
  agenticCanvasOsRevision: markerAtApex.marker.agenticCanvasOs.revision,
  artifactDigest: markerAtApex.marker.artifact.digest,
})}\n`)
