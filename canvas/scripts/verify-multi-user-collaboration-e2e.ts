import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'
import { QUERY_PARAM_OPEN_EDITOR_WORKSPACE } from '../src/lib/routing/queryParams'

const DEFAULT_APP_URL = 'http://127.0.0.1:5174/'
const APP_URL = process.env.KG_COLLABORATION_E2E_URL || DEFAULT_APP_URL
const SCREENSHOT_PATH = process.env.KG_COLLABORATION_E2E_SCREENSHOT || join(tmpdir(), 'knowgrph-collaboration-e2e.png')

function buildWorkspaceUrl(rawUrl: string): string {
  const url = new URL(rawUrl)
  if (!String(url.searchParams.get(QUERY_PARAM_OPEN_EDITOR_WORKSPACE) || '').trim()) {
    url.searchParams.set(QUERY_PARAM_OPEN_EDITOR_WORKSPACE, '1')
  }
  return url.toString()
}

async function failWithScreenshot(page: Page, message: string): Promise<never> {
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => undefined)
  throw new Error(`${message}\nScreenshot: ${SCREENSHOT_PATH}`)
}

function assertIncludes(haystack: string, needle: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`expected Collaboration panel to include ${JSON.stringify(needle)}`)
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  const pageErrors: string[] = []
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  try {
    await page.goto(buildWorkspaceUrl(APP_URL), { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForFunction(() => window.__KG_MAIN_PANEL_OPEN_READY__ === true, null, { timeout: 60_000 })
    await page.waitForSelector('[aria-label="Markdown Workspace"]', { timeout: 60_000 })

    const webRtcAvailable = await page.evaluate(() => typeof window.RTCPeerConnection === 'function')
    if (!webRtcAvailable) {
      await failWithScreenshot(page, 'RTCPeerConnection is unavailable in the E2E browser')
    }

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('kg:mainPanelOpen', { detail: { tab: 'collaboration' } }))
    })
    await page.waitForSelector('#main-panel-collaboration-tab[aria-selected="true"]', { timeout: 30_000 })

    const panel = page.getByRole('complementary', { name: 'Main panel', exact: true })
    let panelText = await panel.innerText()
    for (const token of [
      'Session',
      'Runtime Status',
      'Host Session',
      'Start Host',
      'Invite Link',
      'Join Invite',
      'Guest Answer',
      'Apply Answer',
      'Peers',
      'Transport',
    ]) {
      assertIncludes(panelText, token)
    }

    await page.getByRole('button', { name: 'Start Host', exact: true }).click({ timeout: 30_000 })
    await page.waitForFunction(
      () => document.body.innerText.includes('Invite ready. Waiting for guest answer...'),
      null,
      { timeout: 20_000 },
    )
    panelText = await panel.innerText()
    for (const token of [
      'host',
      'awaiting-answer',
      'Invite ready. Waiting for guest answer...',
      'Generate Invite',
      'You',
      'connected',
      'docs/workspace-readme.md',
    ]) {
      assertIncludes(panelText, token)
    }

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true })
    console.log(`multi-user collaboration E2E passed: ${SCREENSHOT_PATH}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const suffix = pageErrors.length ? `\nPage errors:\n${pageErrors.join('\n')}` : ''
    await failWithScreenshot(page, `${message}${suffix}`)
  } finally {
    await browser.close()
  }
}

void main()
