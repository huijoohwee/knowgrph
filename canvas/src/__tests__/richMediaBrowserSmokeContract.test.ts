import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export function testRichMediaBrowserSmokeContract() {
  const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
  const smokePageSource = readFileSync(new URL('../features/testing/RichMediaBrowserSmokePage.tsx', import.meta.url), 'utf8')
  const preloadSource = readFileSync(new URL('../features/command-menu/MediaCatalogPreviewPreloads.tsx', import.meta.url), 'utf8')
  const packageJson = readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
  const runnerSource = readFileSync(new URL('../../scripts/run_rich_media_browser_smoke.mjs', import.meta.url), 'utf8')
  const verifierSource = readFileSync(new URL('../../scripts/verify_rich_media_browser_smoke.py', import.meta.url), 'utf8')
  const fixtureManifestSource = readFileSync(new URL('../features/testing/richMediaBrowserSmokeFixtures.json', import.meta.url), 'utf8')
  const fixtureManifest = JSON.parse(fixtureManifestSource) as {
    catalogVideo: { durationSeconds: number; height: number; path: string; sha256: string; sizeBytes: number; width: number }
  }
  const catalogVideoFixture = fixtureManifest.catalogVideo
  const videoFixture = readFileSync(new URL(`../../public${catalogVideoFixture.path}`, import.meta.url))

  for (const snippet of [
    "pathname === '/__smoke__/rich-media'",
    "kgPath === '/__smoke__/rich-media'",
    'RichMediaBrowserSmokePageLazy',
  ]) {
    if (!appSource.includes(snippet)) {
      throw new Error(`expected App smoke route wiring for rich media browser smoke: ${snippet}`)
    }
  }

  for (const snippet of [
    'data-kg-rich-media-smoke-page="1"',
    'data-kg-smoke-panel="text-preview"',
    'data-kg-smoke-panel="text-edit"',
    'data-kg-smoke-panel="iframe-srcdoc"',
    'data-kg-smoke-panel="iframe-snapshot"',
    'data-kg-smoke-panel="iframe-open-overlay"',
    'data-kg-smoke-panel="image-zoom"',
    'data-kg-smoke-panel="video-inline"',
    'data-kg-smoke-panel="audio"',
    'data-kg-smoke-panel="storyboard-widget"',
    'richMediaBrowserSmokeFixtures.catalogVideo.path',
    'richMediaBrowserSmokeFixtures.catalogVideo.contentType',
    'richMediaBrowserSmokeFixtures.catalogVideo.sizeBytes',
    'setEditableText(next.text)',
  ]) {
    if (!smokePageSource.includes(snippet)) {
      throw new Error(`expected rich media smoke page to mount shared media surfaces: ${snippet}`)
    }
  }

  if (smokePageSource.includes('data:video/mp4;base64,AAAA')) {
    throw new Error('expected the browser smoke to use the valid local video fixture')
  }
  const fixtureSha256 = createHash('sha256').update(videoFixture).digest('hex')
  if (
    videoFixture.length !== catalogVideoFixture.sizeBytes
    || videoFixture.subarray(4, 8).toString('ascii') !== 'ftyp'
    || fixtureSha256 !== catalogVideoFixture.sha256
    || catalogVideoFixture.width !== 160
    || catalogVideoFixture.height !== 90
    || !Number.isFinite(catalogVideoFixture.durationSeconds)
    || catalogVideoFixture.durationSeconds <= 0
  ) {
    throw new Error('expected the video fixture binary to match its source-owned metadata identity')
  }

  for (const snippet of [
    'data-kg-media-catalog-preview-preloads="1"',
    'pointer-events-none fixed -left-2 -top-2 h-px w-px overflow-hidden opacity-0',
    "resource.setAttribute('src', item.url)",
    'Strict Mode replays cleanup; setup must restore the source it owns.',
  ]) {
    if (!preloadSource.includes(snippet)) {
      throw new Error(`expected media preview preloads to remain fetchable while visually isolated: ${snippet}`)
    }
  }

  if (!packageJson.includes('"test:smoke:rich-media:browser": "node ./scripts/run_rich_media_browser_smoke.mjs"')) {
    throw new Error('expected package.json to expose rich media browser smoke command')
  }

  for (const snippet of [
    "import { runLocalViteBrowserSmoke } from './lib/run-local-vite-browser-smoke.mjs'",
    "logLabel: 'rich-media-browser-smoke'",
    "devServerPath: '/__smoke__/rich-media'",
    "verifierArgs: ['scripts/verify_rich_media_browser_smoke.py']",
    "prepareBeforeStart: true",
    "devServerStartMode: 'vite-runner'",
    'KG_RICH_MEDIA_SMOKE_BASE_URL',
  ]) {
    if (!runnerSource.includes(snippet)) {
      throw new Error(`expected rich media smoke runner to target the rich media route and verifier: ${snippet}`)
    }
  }

  for (const snippet of [
    'TARGET_URL = f"{BASE_URL}/__smoke__/rich-media"',
    'window.__kgRichMediaSmokeOpened = []',
    'def open_text_edit_input(page):',
    'display = page.locator(f\'{panel_selector} [data-kg-card-inline-edit="1"]\').first',
    'input_locator = page.locator(f\'{panel_selector} [data-kg-card-inline-edit-input="1"]\').first',
    'input_locator.wait_for(state="visible", timeout=5000)',
    'expected rich media text edit panel to reveal the inline editor surface',
    'KG_RICH_MEDIA_SMOKE_BASE_URL',
    'data-kg-smoke-panel="storyboard-widget"',
    'data-kg-smoke-flow-size="1"',
    'CATALOG_PREVIEW_READY_BUDGET_MS',
    'KG_MEDIA_PREVIEW_READY_BUDGET_MS',
    'CATALOG_PREVIEW_TIMING_PATH',
    'FIXTURE_MANIFEST_PATH',
    'richMediaBrowserSmokeFixtures.json',
    'def wait_for_image_ready(page, image, timeout_ms: int) -> None:',
    'def wait_for_video_metadata(page, video, timeout_ms: int) -> None:',
    'def assert_video_metadata_identity(video, label: str) -> dict[str, float]:',
    'element.readyState >= element.HAVE_METADATA',
    'math.isfinite(duration_seconds)',
    '"preloaded": preloaded_video_metadata',
    '"visible": visible_video_metadata',
    'expected preloaded image preview ready within',
    'expected preloaded video metadata ready within',
    '"criterion": "readyState >= HAVE_METADATA"',
    'preloadedTransitionReadyMs',
    'OK rich-media-browser-smoke',
  ]) {
    if (!verifierSource.includes(snippet)) {
      throw new Error(`expected rich media browser verifier to assert the real panel surface contract: ${snippet}`)
    }
  }
}
