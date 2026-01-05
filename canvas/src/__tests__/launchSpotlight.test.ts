import { LS_KEYS } from '@/lib/config'
import { getInitialLaunchSpotlightEnabled, persistLaunchSpotlightEnabled } from '@/features/spotlight/storage'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export function testLaunchSpotlightStorageHelpers() {
  if (LS_KEYS.launchSpotlightEnabled !== 'kg:ui:launchSpotlightEnabled') {
    throw new Error('launchSpotlightEnabled key mismatch')
  }

  const storage = new MemoryStorage()

  let value = getInitialLaunchSpotlightEnabled(storage, true)
  if (value !== true) {
    throw new Error('expected fallback true when storage empty')
  }

  value = getInitialLaunchSpotlightEnabled(storage, false)
  if (value !== false) {
    throw new Error('expected fallback false when storage empty')
  }

  storage.setItem(LS_KEYS.launchSpotlightEnabled, '0')
  value = getInitialLaunchSpotlightEnabled(storage, true)
  if (value !== false) {
    throw new Error('expected false when storage contains 0')
  }

  storage.setItem(LS_KEYS.launchSpotlightEnabled, 'false')
  value = getInitialLaunchSpotlightEnabled(storage, true)
  if (value !== false) {
    throw new Error('expected false when storage contains false')
  }

  storage.setItem(LS_KEYS.launchSpotlightEnabled, '1')
  value = getInitialLaunchSpotlightEnabled(storage, false)
  if (value !== true) {
    throw new Error('expected true when storage contains 1')
  }

  storage.setItem(LS_KEYS.launchSpotlightEnabled, 'true')
  value = getInitialLaunchSpotlightEnabled(storage, false)
  if (value !== true) {
    throw new Error('expected true when storage contains true')
  }

  storage.setItem(LS_KEYS.launchSpotlightEnabled, 'other')
  value = getInitialLaunchSpotlightEnabled(storage, false)
  if (value !== false) {
    throw new Error('expected fallback when storage contains invalid value')
  }

  const storage2 = new MemoryStorage()
  const persistedTrue = persistLaunchSpotlightEnabled(storage2, true)
  if (persistedTrue !== true) {
    throw new Error('expected persistLaunchSpotlightEnabled to return true')
  }
  const rawTrue = storage2.getItem(LS_KEYS.launchSpotlightEnabled)
  if (rawTrue !== '1') {
    throw new Error('expected storage to contain 1 for true')
  }

  const persistedFalse = persistLaunchSpotlightEnabled(storage2, false)
  if (persistedFalse !== false) {
    throw new Error('expected persistLaunchSpotlightEnabled to return false')
  }
  const rawFalse = storage2.getItem(LS_KEYS.launchSpotlightEnabled)
  if (rawFalse !== '0') {
    throw new Error('expected storage to contain 0 for false')
  }
}
