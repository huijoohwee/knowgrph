import { LS_KEYS } from '@/lib/config'

export function loadSettingsCollapsedByArea(storage: Storage | null): Record<string, boolean> {
  if (!storage) return {}
  try {
    const stored = storage.getItem(LS_KEYS.settingsCollapsedByArea)
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, boolean>
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {
    void 0
  }
  return {}
}

export function persistSettingsCollapsedByArea(storage: Storage | null, next: Record<string, boolean>): void {
  if (!storage) return
  try {
    storage.setItem(LS_KEYS.settingsCollapsedByArea, JSON.stringify(next))
  } catch {
    void 0
  }
}

