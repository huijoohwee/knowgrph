import { readFileSync } from 'node:fs'

export function testMobileKeyboardBrowserSmokeContract() {
  const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
  const smokePageSource = readFileSync(new URL('../features/testing/MobileKeyboardBrowserSmokePage.tsx', import.meta.url), 'utf8')
  const packageJson = readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
  const runnerSource = readFileSync(new URL('../../scripts/run_mobile_keyboard_browser_smoke.mjs', import.meta.url), 'utf8')
  const verifierSource = readFileSync(new URL('../../scripts/verify_mobile_keyboard_browser_smoke.py', import.meta.url), 'utf8')

  for (const snippet of [
    "pathname === '/__smoke__/mobile-keyboard'",
    "kgPath === '/__smoke__/mobile-keyboard'",
    'MobileKeyboardBrowserSmokePageLazy',
  ]) {
    if (!appSource.includes(snippet)) {
      throw new Error(`expected App smoke route wiring for mobile keyboard browser smoke: ${snippet}`)
    }
  }

  for (const snippet of [
    'data-kg-mobile-keyboard-smoke-page="1"',
    'data-kg-mobile-chat-stream-button="true"',
    'FloatingPanelChatComposer',
    'MarkdownBlockContainer',
    'data-kg-mobile-keyboard-shell="chat"',
    'data-kg-mobile-keyboard-shell="workspace"',
    'data-kg-mobile-workspace-inline-host="true"',
  ]) {
    if (!smokePageSource.includes(snippet)) {
      throw new Error(`expected mobile keyboard smoke page to mount shared chat/workspace owners: ${snippet}`)
    }
  }

  if (!packageJson.includes('"test:smoke:mobile-keyboard:browser": "node ./scripts/run_mobile_keyboard_browser_smoke.mjs"')) {
    throw new Error('expected package.json to expose mobile keyboard browser smoke command')
  }

  for (const snippet of [
    'const devServerUrl = `${devServerBaseUrl}/__smoke__/mobile-keyboard`',
    "python3', ['scripts/verify_mobile_keyboard_browser_smoke.py']",
    'KG_MOBILE_KEYBOARD_SMOKE_BASE_URL',
  ]) {
    if (!runnerSource.includes(snippet)) {
      throw new Error(`expected mobile keyboard smoke runner to target the mobile keyboard route and verifier: ${snippet}`)
    }
  }

  for (const snippet of [
    'TARGET_URL = f"{BASE_URL}/__smoke__/mobile-keyboard"',
    'MOBILE_VIEWPORT = {"width": 390, "height": 844}',
    'KEYBOARD_VIEWPORT = {"width": 390, "height": 520}',
    "page.set_viewport_size(KEYBOARD_VIEWPORT)",
    "'[data-kg-chat-grammar-quick-bar=\"true\"]'",
    "'[data-kg-markdown-mobile-grammar-quick-bar=\"true\"]'",
    "'section[aria-label=\"Chat slash commands\"]'",
    "'section[aria-label=\"Semantic commands\"]'",
    "'section[aria-label=\"Variable toolbar\"]'",
  ]) {
    if (!verifierSource.includes(snippet)) {
      throw new Error(`expected mobile keyboard browser verifier to assert viewport shrink and quick-bar reachability: ${snippet}`)
    }
  }
}
