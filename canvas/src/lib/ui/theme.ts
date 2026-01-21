import { LS_KEYS } from '@/lib/config'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedThemeMode = Exclude<ThemeMode, 'system'>

export function getInitialThemeMode(storage: Storage | null, fallback: ThemeMode = 'system'): ThemeMode {
  if (!storage) return fallback
  try {
    const stored = storage.getItem(LS_KEYS.themeMode)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    void 0
  }
  return fallback
}

export function persistThemeMode(storage: Storage | null, mode: ThemeMode): void {
  if (!storage) return
  try {
    storage.setItem(LS_KEYS.themeMode, mode)
  } catch {
    void 0
  }
}

export function getNextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === 'system') return 'light'
  if (mode === 'light') return 'dark'
  return 'system'
}

export function getSystemTheme(): ResolvedThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  return mq.matches ? 'dark' : 'light'
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolved = mode === 'system' ? getSystemTheme() : mode
  root.setAttribute('data-theme', resolved)
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function resolveThemeMode(mode: ThemeMode): ResolvedThemeMode {
  return mode === 'system' ? getSystemTheme() : mode
}

export function subscribeToSystemThemeChanges(onChange: (resolved: ResolvedThemeMode) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => void 0
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange(mq.matches ? 'dark' : 'light')
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }
  mq.addListener(handler)
  return () => mq.removeListener(handler)
}
