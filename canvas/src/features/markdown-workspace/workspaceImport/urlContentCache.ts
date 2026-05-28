import type { WorkspaceUrlContent } from './types'

type CacheItem = { atMs: number; chars: number; value: WorkspaceUrlContent }
type InflightItem = { startedAt: number; promise: Promise<WorkspaceUrlContent> }

const CACHE_TTL_MS_IMPORT = 3 * 60_000
const CACHE_TTL_MS_REFRESH = 10 * 60_000
const INFLIGHT_TTL_MS_IMPORT = 20_000
const INFLIGHT_TTL_MS_REFRESH = 45_000

const CACHE_MAX_ENTRIES = 48
const CACHE_MAX_TOTAL_CHARS_IMPORT = 5_000_000
const CACHE_MAX_TOTAL_CHARS_REFRESH = 16_000_000
const CACHE_MAX_ITEM_CHARS = 2_500_000

const CACHE = new Map<string, CacheItem>()
const INFLIGHT = new Map<string, InflightItem>()
let cacheTotalChars = 0

function cacheLimitsForKey(key: string): { ttlMs: number; maxTotalChars: number } {
  const isRefresh = key.startsWith('refresh:')
  return {
    ttlMs: isRefresh ? CACHE_TTL_MS_REFRESH : CACHE_TTL_MS_IMPORT,
    maxTotalChars: isRefresh ? CACHE_MAX_TOTAL_CHARS_REFRESH : CACHE_MAX_TOTAL_CHARS_IMPORT,
  }
}

function inflightTtlMsForKey(key: string): number {
  return key.startsWith('refresh:') ? INFLIGHT_TTL_MS_REFRESH : INFLIGHT_TTL_MS_IMPORT
}

function readChars(value: WorkspaceUrlContent): number {
  const text = String(value?.text || '')
  return text ? text.length : 0
}

function deleteKey(key: string) {
  const prev = CACHE.get(key)
  if (prev) cacheTotalChars = Math.max(0, cacheTotalChars - (Number.isFinite(prev.chars) ? prev.chars : 0))
  CACHE.delete(key)
}

export function getCachedWorkspaceUrlContent(key: string): WorkspaceUrlContent | null {
  const item = CACHE.get(key)
  if (!item) return null
  const { ttlMs } = cacheLimitsForKey(key)
  if (Date.now() - item.atMs > ttlMs) {
    deleteKey(key)
    return null
  }
  CACHE.delete(key)
  CACHE.set(key, item)
  return item.value
}

export function setCachedWorkspaceUrlContent(key: string, value: WorkspaceUrlContent): void {
  const chars = readChars(value)
  if (chars > CACHE_MAX_ITEM_CHARS) return
  deleteKey(key)
  CACHE.set(key, { atMs: Date.now(), chars, value })
  cacheTotalChars += chars

  const { maxTotalChars } = cacheLimitsForKey(key)
  while (cacheTotalChars > maxTotalChars || CACHE.size > CACHE_MAX_ENTRIES) {
    const oldestKey = CACHE.keys().next().value as string | undefined
    if (!oldestKey) break
    deleteKey(oldestKey)
  }
}

export function getInflightWorkspaceUrlContent(key: string): Promise<WorkspaceUrlContent> | null {
  const item = INFLIGHT.get(key)
  if (!item) return null
  if (Date.now() - item.startedAt > inflightTtlMsForKey(key)) {
    INFLIGHT.delete(key)
    return null
  }
  return item.promise
}

export function setInflightWorkspaceUrlContent(key: string, promise: Promise<WorkspaceUrlContent>): void {
  INFLIGHT.set(key, { startedAt: Date.now(), promise })
}

export function clearInflightWorkspaceUrlContent(key: string): void {
  INFLIGHT.delete(key)
}

export function resetWorkspaceUrlContentCacheForTests(): void {
  CACHE.clear()
  INFLIGHT.clear()
  cacheTotalChars = 0
}
