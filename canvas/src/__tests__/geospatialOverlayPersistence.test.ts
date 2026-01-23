import { LS_KEYS } from '@/lib/config'
import { createGeospatialOverlaySlice } from '@/hooks/store/geospatialOverlaySlice'
import { createMemoryStorage } from '@/tests/lib/memoryStorage'

export function testGeospatialOverlayPersistenceHydratesAndWrites() {
  const anyWindow = globalThis as unknown as { window?: Record<string, unknown> }
  if (!anyWindow.window) anyWindow.window = {}
  const storage = createMemoryStorage({ [LS_KEYS.geospatialOverlayEnabled]: '1' })
  anyWindow.window.localStorage = storage as unknown as Storage

  const updates: Array<Record<string, unknown>> = []
  const slice = createGeospatialOverlaySlice((fn) => {
    updates.push(fn({} as never) as unknown as Record<string, unknown>)
    return void 0
  }, () => ({ geospatialOverlayOpacity: 0 } as never))

  if (slice.geospatialOverlayEnabled !== true) {
    throw new Error('expected geospatialOverlayEnabled to hydrate from localStorage')
  }

  slice.setGeospatialOverlayEnabled(false)
  const raw = storage.getItem(LS_KEYS.geospatialOverlayEnabled)
  if (raw !== '0') {
    throw new Error('expected geospatialOverlayEnabled to persist as 0')
  }
  const last = updates[updates.length - 1]
  if (!last || (last as Record<string, unknown>).geospatialOverlayEnabled !== false) {
    throw new Error('expected set to update store state')
  }
}
