import { LS_KEYS } from '@/lib/config'
import { readBoolFromStorage, writeBoolToStorage } from '@/lib/persistence'

export function clearOnboardingSpotlight(storage: Storage | null): void {
  if (!storage) return
  try {
    storage.removeItem(LS_KEYS.onboardingSpotlightEnabled)
  } catch {
    void 0
  }
}

export function getInitialLaunchSpotlightEnabled(storage: Storage | null, fallback = true): boolean {
  return readBoolFromStorage(storage, LS_KEYS.launchSpotlightEnabled, fallback)
}

export function persistLaunchSpotlightEnabled(storage: Storage | null, value: boolean): boolean {
  return writeBoolToStorage(storage, LS_KEYS.launchSpotlightEnabled, value)
}
