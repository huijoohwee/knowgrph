import { LS_KEYS } from '@/lib/config'
import { createGeospatialSlice } from '@/hooks/store/geospatialSlice'
import { createMemoryStorage } from '@/tests/lib/memoryStorage'

export function testGeospatialFetchLimitsPersistence() {
  const anyWindow = globalThis as unknown as { window?: Record<string, unknown> }
  if (!anyWindow.window) anyWindow.window = {}
  const storage = createMemoryStorage({
    [LS_KEYS.geospatialDatasetTimeoutMs]: String(45_000),
    [LS_KEYS.geospatialDatasetMaxBytes]: String(9 * 1024 * 1024),
  })
  anyWindow.window.localStorage = storage as unknown as Storage

  const slice = createGeospatialSlice(
    () => ({}),
    () => ({ geospatialDatasets: [] } as never),
  )

  if (slice.geospatialDatasetTimeoutMs !== 45_000) {
    throw new Error('expected dataset timeout to hydrate from localStorage')
  }
  if (slice.geospatialDatasetMaxBytes !== 9 * 1024 * 1024) {
    throw new Error('expected dataset max bytes to hydrate from localStorage')
  }

  slice.setGeospatialDatasetTimeoutMs(999_999)
  const clampedTimeout = Number(storage.getItem(LS_KEYS.geospatialDatasetTimeoutMs) || '')
  if (clampedTimeout !== 60_000) {
    throw new Error('expected dataset timeout to clamp to 60_000ms')
  }

  slice.setGeospatialDatasetMaxBytes(999_999_999)
  const clampedBytes = Number(storage.getItem(LS_KEYS.geospatialDatasetMaxBytes) || '')
  if (clampedBytes !== 20 * 1024 * 1024) {
    throw new Error('expected dataset max bytes to clamp to 20MiB')
  }
}
