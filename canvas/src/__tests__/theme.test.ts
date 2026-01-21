import { LS_KEYS } from '@/lib/config'
import { applyThemeMode, getInitialThemeMode, subscribeToSystemThemeChanges, ThemeMode } from '@/lib/ui/theme'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { JSDOM } from 'jsdom'

export function testThemeModePersistence() {
  if (LS_KEYS.themeMode !== 'kg:ui:themeMode') {
    throw new Error('themeMode key mismatch')
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
