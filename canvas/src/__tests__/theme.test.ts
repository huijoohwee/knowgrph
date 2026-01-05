import { LS_KEYS } from '@/lib/config'
import { getInitialThemeMode, ThemeMode } from '@/lib/ui/theme'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

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
