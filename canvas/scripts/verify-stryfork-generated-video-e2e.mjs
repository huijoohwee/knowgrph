import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { chromium } from 'playwright'

const readRequiredEnv = name => {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

const parseFrontmatter = text => {
  const match = /^---\n([\s\S]*?)\n---/.exec(text)
  if (!match) return {}
  const parsed = yaml.load(match[1])
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

const readWorkspaceEntries = async page => page.evaluate(() => {
  const workspaceKey = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter(Boolean)
    .find(key => key === 'kg:workspace-fs' || key.endsWith('::kg:workspace-fs'))
  const raw = workspaceKey ? window.localStorage.getItem(workspaceKey) : null
  const entries = raw ? JSON.parse(raw).entries || {} : {}
  return Object.fromEntries(Object.entries(entries).map(([path, entry]) => [path, String(entry?.text || '')]))
})

const listArtifactPaths = entries => Object.keys(entries)
  .filter(path => /\/strybldr-video(?:-fallback)?-[^/]+\.md$/.test(path))
  .sort()

const envBool = name => /^(?:1|true|yes|on)$/i.test(String(process.env[name] || '').trim())

const parseErrorReason = text => /errorReason:\s*"?([^"\n]+)"?/i.exec(text)?.[1] || 'no generated artifact was written'
const parseStatus = text => /status:\s*"?([^"\n]+)"?/i.exec(text)?.[1] || ''

const parseApprovedCards = text => {
  const match = /## Approved Cards\s+```json\s+([\s\S]*?)\s+```/i.exec(text)
  if (!match) throw new Error('handoff artifact missing Approved Cards JSON block')
  const parsed = JSON.parse(match[1])
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('handoff artifact Approved Cards must be a non-empty array')
  return parsed
}

const assertHandoffArtifact = (text, expectedStatus) => {
  const required = [
    'kgStrybldrVideoHandoff: true',
    `status: "${expectedStatus}"`,
    '## Compiled Prompt',
    '## Approved Cards',
  ]
  for (const value of required) {
    if (!text.includes(value)) throw new Error(`handoff artifact missing ${value}`)
  }
  if (expectedStatus === 'fallback' && !/errorReason:\s*".+?"/i.test(text)) {
    throw new Error('fallback handoff artifact missing errorReason')
  }
  const cards = parseApprovedCards(text)
  const references = cards
    .flatMap(card => Array.isArray(card?.references) ? card.references : [])
    .map(value => String(value || ''))
  if (!references.some(value => value.includes('/__video_frame?'))) {
    throw new Error('handoff artifact missing frame-extraction thumbnail reference')
  }
  if (!references.some(value => /(?:^|\/\/)i\.ytimg\.com\//i.test(value))) {
    throw new Error('handoff artifact missing provider-safe YouTube thumbnail fallback')
  }
  return { cardCount: cards.length, referenceCount: references.length }
}

const assertPlayableMediaBody = (text, status) => {
  if (status !== 'generated' && status !== 'copied') return
  if (!text.includes('## Video')) throw new Error('playable handoff artifact missing Video section')
  if (!/(<video\b|<iframe\b|\[Open Strybldr video\])/i.test(text)) {
    throw new Error('playable handoff artifact missing visible video playback markup or link')
  }
}

const waitForStrybldrSurface = async page => {
  await page.getByRole('button', { name: 'Canvas View Mode: 2D Renderer: Strybldr' }).waitFor({ timeout: 45000 })
  await page.getByRole('region', { name: 'Storyboard lane Source' }).waitFor({ timeout: 45000 })
  await page.getByRole('region', { name: 'Storyboard lane Storyboard' }).waitFor({ timeout: 45000 })
  await page.getByRole('region', { name: 'Storyboard lane Elements' }).waitFor({ timeout: 45000 })
}

const seedBytePlusProviderSettings = url => {
  const basePath = (() => {
    try {
      const pathname = new URL(url).pathname || '/'
      if (!pathname || pathname === '/') return '/'
      return pathname.endsWith('/') ? pathname : `${pathname}/`
    } catch {
      return '/'
    }
  })()
  const prefix = basePath === '/' ? '' : `kg:scope:${basePath}::`
  for (const storagePrefix of prefix ? ['', prefix] : ['']) {
    window.localStorage.setItem(`${storagePrefix}kg:chat:provider`, JSON.stringify('byteplus-modelark'))
    window.localStorage.setItem(`${storagePrefix}kg:chat:authMode`, JSON.stringify('serverManaged'))
  }
}

const appUrl = process.env.KNOWGRPH_APP_URL || 'http://127.0.0.1:5173/'
const demoInputPath = readRequiredEnv('KNOWGRPH_STRYFORK_DEMO_INPUT')
const demoText = await readFile(demoInputPath, 'utf8')
const importUrl = String(process.env.KNOWGRPH_STRYFORK_IMPORT_URL || parseFrontmatter(demoText).kgWebpageUrl || '').trim()
if (!/^https?:\/\//i.test(importUrl)) throw new Error('demo frontmatter must provide kgWebpageUrl or set KNOWGRPH_STRYFORK_IMPORT_URL')
const flowMode = String(process.env.KNOWGRPH_STRYFORK_E2E_MODE || 'import-url').trim().toLowerCase()
if (flowMode !== 'import-url' && flowMode !== 'local-file') throw new Error('KNOWGRPH_STRYFORK_E2E_MODE must be import-url or local-file')

const timeoutMs = Number(process.env.KNOWGRPH_GENERATED_VIDEO_TIMEOUT_MS || 360000)
const requireGeneratedVideo = envBool('KNOWGRPH_REQUIRE_GENERATED_VIDEO')
const headless = process.env.KNOWGRPH_E2E_HEADLESS
  ? process.env.KNOWGRPH_E2E_HEADLESS !== '0'
  : !process.env.KNOWGRPH_E2E_CHROME_EXECUTABLE
const launchOptions = {
  headless,
  ...(process.env.KNOWGRPH_E2E_CHROME_EXECUTABLE ? { executablePath: process.env.KNOWGRPH_E2E_CHROME_EXECUTABLE } : {}),
}

const browser = await chromium.launch(launchOptions)
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(60000)
  const appConsoleErrors = []
  const failedResponses = []
  page.on('console', msg => {
    if (msg.type() === 'error') appConsoleErrors.push(msg.text())
  })
  page.on('pageerror', error => appConsoleErrors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() })
  })

  await page.addInitScript(seedBytePlusProviderSettings, appUrl)
  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(() => window.localStorage.clear())
  await page.evaluate(seedBytePlusProviderSettings, appUrl)
  await page.reload({ waitUntil: 'domcontentloaded' })

  if (flowMode === 'local-file') {
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Launch' }).click()
    await page.getByRole('button', { name: /^Import local files$/ }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(demoInputPath)
  } else {
    await page.getByRole('button', { name: 'Launch' }).click()
    await page.getByRole('button', { name: /^Import URL$/ }).click()
    await page.locator('.kg-import-url-input').fill(importUrl)
    await page.locator('select[aria-label="Import URL renderer"]').selectOption('strybldr:document')
    await page.locator('.kg-import-url-confirm').click()
  }
  try {
    await waitForStrybldrSurface(page)
  } catch (error) {
    const screenshotPath = join(tmpdir(), `knowgrph-stryfork-generated-video-e2e-surface-${Date.now().toString(36)}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => null)
    const diagnostic = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 1000),
      storageKeys: Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter(Boolean).sort(),
    })).catch(() => null)
    console.error(JSON.stringify({ stage: 'waitForStrybldrSurface', screenshotPath, diagnostic, appConsoleErrors, failedResponses }, null, 2))
    throw error
  }

  const beforeEntries = await readWorkspaceEntries(page)
  const beforeArtifacts = listArtifactPaths(beforeEntries)
  await page.getByRole('button', { name: 'Run all' }).click()
  await page.waitForFunction(
    previous => {
      const raw = window.localStorage.getItem('kg:workspace-fs')
        || Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
          .filter(Boolean)
          .filter(key => key.endsWith('::kg:workspace-fs'))
          .map(key => window.localStorage.getItem(key))
          .find(Boolean)
      const entries = raw ? JSON.parse(raw).entries || {} : {}
      return Object.keys(entries).some(path => /\/strybldr-video(?:-fallback)?-[^/]+\.md$/.test(path) && !previous.includes(path))
    },
    beforeArtifacts,
    { timeout: timeoutMs },
  )

  const afterEntries = await readWorkspaceEntries(page)
  const newArtifacts = listArtifactPaths(afterEntries).filter(path => !beforeArtifacts.includes(path))
  const playablePath = newArtifacts.find(path => /\/strybldr-video-(?!fallback-)[^/]+\.md$/.test(path))
  const fallbackPath = newArtifacts.find(path => /\/strybldr-video-fallback-[^/]+\.md$/.test(path))
  if (!playablePath) {
    const fallbackText = fallbackPath ? afterEntries[fallbackPath] : ''
    const reason = parseErrorReason(fallbackText)
    const settingsSnapshot = await page.evaluate(() => Object.fromEntries(
      Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
        .filter(key => key && /kg:chat:(?:provider|authMode|endpointUrl|model)$/.test(key))
        .map(key => [key, window.localStorage.getItem(key)]),
    )).catch(() => null)
    const detail = { appUrl, demoInputPath, importUrl, flowMode, fallbackPath: fallbackPath || null, reason, settingsSnapshot, appConsoleErrors, failedResponses }
    if (!fallbackPath) {
      console.error(JSON.stringify(detail, null, 2))
      process.exitCode = 2
    } else {
      const artifact = assertHandoffArtifact(fallbackText, 'fallback')
      if (requireGeneratedVideo) {
        console.error(JSON.stringify({ ...detail, mode: 'fallback', artifact, strictGeneratedVideo: true }, null, 2))
        process.exitCode = 2
      } else {
        console.log(JSON.stringify({ ...detail, mode: 'fallback', artifact }, null, 2))
      }
    }
  } else {
    const playableText = afterEntries[playablePath]
    const status = parseStatus(playableText)
    if (status === 'generated' && appConsoleErrors.length > 0) throw new Error(`application console errors: ${JSON.stringify(appConsoleErrors)}`)
    const paidCallEvidence = status === 'generated' ? 'paidCallCount: 1' : 'paidCallCount: 0'
    for (const required of ['kgStrybldrVideoHandoff: true', `status: "${status}"`, 'renderUrl:', 'sourceUrl:', paidCallEvidence]) {
      if (!playableText.includes(required)) throw new Error(`playable artifact missing ${required}`)
    }
    if (status !== 'generated' && status !== 'copied') throw new Error(`unsupported playable video status: ${status}`)
    if (status === 'copied' && !playableText.includes('copyReason:')) throw new Error('copied video artifact missing copyReason')
    assertPlayableMediaBody(playableText, status)
    const artifact = assertHandoffArtifact(playableText, status)
    console.log(JSON.stringify({ appUrl, demoInputPath, importUrl, flowMode, playablePath, mode: status, artifact }, null, 2))
  }
  await context.close()
} finally {
  await browser.close().catch(() => null)
}
