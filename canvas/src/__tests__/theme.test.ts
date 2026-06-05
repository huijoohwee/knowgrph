import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LS_KEYS } from '@/lib/config'
import { applyThemeMode, getInitialThemeMode, getNextThemeMode, getThemeModeLabel, isThemeMode, subscribeToSystemThemeChanges, THEME_MODE_OPTIONS, ThemeMode } from '@/lib/ui/theme'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { JSDOM } from 'jsdom'

export function testThemeModePersistence() {
  if (LS_KEYS.themeMode !== 'kg:ui:themeMode') {
    throw new Error('themeMode key mismatch')
  }

  const optionModes = THEME_MODE_OPTIONS.map(option => option.mode).join(',')
  if (optionModes !== 'system,light,dark') {
    throw new Error('expected shared theme mode options to expose System, Light, Dark in toolbar order')
  }
  if (!THEME_MODE_OPTIONS.every(option => isThemeMode(option.mode))) {
    throw new Error('expected shared theme mode options to only contain valid theme modes')
  }
  if (getNextThemeMode('system') !== 'light' || getNextThemeMode('light') !== 'dark' || getNextThemeMode('dark') !== 'system') {
    throw new Error('expected single-button theme cycle to follow System, Light, Dark')
  }
  if (getThemeModeLabel('system') !== 'System' || getThemeModeLabel('light') !== 'Light' || getThemeModeLabel('dark') !== 'Dark') {
    throw new Error('expected theme mode labels to come from the shared theme mode options')
  }

  const storage = new MemoryStorage()

  storage.setItem(LS_KEYS.themeMode, 'light')
  let mode: ThemeMode = getInitialThemeMode(storage, 'system')
  if (mode !== 'light') {
    throw new Error('expected light when storage contains light')
  }

  storage.setItem(LS_KEYS.themeMode, 'dark')
  mode = getInitialThemeMode(storage, 'system')
  if (mode !== 'dark') {
    throw new Error('expected dark when storage contains dark')
  }

  storage.setItem(LS_KEYS.themeMode, 'system')
  mode = getInitialThemeMode(storage, 'light')
  if (mode !== 'system') {
    throw new Error('expected system when storage contains system')
  }

  storage.setItem(LS_KEYS.themeMode, 'other')
  mode = getInitialThemeMode(storage, 'dark')
  if (mode !== 'dark') {
    throw new Error('expected fallback for invalid value')
  }

  const emptyStorage = new MemoryStorage()
  const fallbackMode: ThemeMode = getInitialThemeMode(emptyStorage, 'light')
  if (fallbackMode !== 'light') {
    throw new Error('expected fallback when storage is empty')
  }
}

export function testThemeSystemModeApplyAndSubscribe() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  const prevWindow = g.window
  const prevDocument = g.document

  let mqListener: ((ev: Event) => void) | null = null
  const mq = {
    matches: false,
    addEventListener: (_: string, cb: (ev: Event) => void) => { mqListener = cb },
    removeEventListener: (_: string, cb: (ev: Event) => void) => { if (mqListener === cb) mqListener = null },
  }
  ;(dom.window as unknown as { matchMedia?: unknown }).matchMedia = () => mq as unknown as MediaQueryList

  g.window = dom.window
  g.document = dom.window.document

  const seen: string[] = []
  const unsub = subscribeToSystemThemeChanges((resolved) => {
    seen.push(resolved)
    applyThemeMode('system')
  })

  applyThemeMode('system')
  const root = dom.window.document.documentElement
  if (root.getAttribute('data-theme') !== 'light') {
    throw new Error('expected system-resolved theme to start as light')
  }
  if (root.classList.contains('dark')) {
    throw new Error('expected no dark class when resolved theme is light')
  }

  mq.matches = true
  if (mqListener) mqListener(new dom.window.Event('change'))

  if (!seen.includes('dark')) {
    throw new Error('expected system theme subscription to emit dark')
  }
  if (root.getAttribute('data-theme') !== 'dark') {
    throw new Error('expected system-resolved theme to update to dark')
  }
  if (!root.classList.contains('dark')) {
    throw new Error('expected dark class when resolved theme is dark')
  }

  unsub()

  g.window = prevWindow
  g.document = prevDocument
}

export function testToolbarThemeUsesSingleSharedCycleButton() {
  const root = process.cwd()
  const toolbar = readFileSync(resolve(root, 'src/components/Toolbar.tsx'), 'utf8')
  const actions = readFileSync(resolve(root, 'src/features/toolbar/hooks/useToolbarActions.ts'), 'utf8')

  if (!toolbar.includes('data-kg-theme-mode-control="toggle"') || !toolbar.includes('onClick={actions.handleToggleTheme}')) {
    throw new Error('expected Toolbar Theme to render one shared System/Light/Dark cycle button')
  }
  if (toolbar.includes('ThemeModeSegmentedControl') || toolbar.includes('data-kg-theme-mode-control="segmented"')) {
    throw new Error('expected Toolbar Theme to avoid the rejected segmented toolbar control')
  }
  if (!actions.includes('handleToggleTheme') || !actions.includes('getNextThemeMode(themeMode)') || actions.includes('handleSetThemeMode')) {
    throw new Error('expected toolbar theme actions to cycle through shared theme mode options')
  }
}
