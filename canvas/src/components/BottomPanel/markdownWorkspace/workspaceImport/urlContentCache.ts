import type { WorkspaceUrlContent } from './types'

type CacheItem = { atMs: number; value: WorkspaceUrlContent }

const CACHE_TTL_MS_IMPORT = 45_000
const CACHE_TTL_MS_REFRESH = 4 * 60_000
const CACHE_MAX = 36

const CACHE = new Map<string, CacheItem>()
const INFLIGHT = new Map<string, Promise<WorkspaceUrlContent>>()

export function getCachedWorkspaceUrlContent(key: string): WorkspaceUrlContent | null {
  const item = CACHE.get(key)
  if (!item) return null
  const ttl = key.startsWith('refresh:') ? CACHE_TTL_MS_REFRESH : CACHE_TTL_MS_IMPORT
  if (Date.now() - item.atMs > ttl) {
    CACHE.delete(key)
    return null
  }
  CACHE.delete(key)
  CACHE.set(key, item)
  return item.value
}

export function setCachedWorkspaceUrlContent(key: string, value: WorkspaceUrlContent): void {
  CACHE.set(key, { atMs: Date.now(), value })
  if (CACHE.size <= CACHE_MAX) return
  const firstKey = CACHE.keys().next().value as string | undefined
  if (firstKey) CACHE.delete(firstKey)
}

export function getInflightWorkspaceUrlContent(key: string): Promise<WorkspaceUrlContent> | null {
  return INFLIGHT.get(key) || null
}

export function setInflightWorkspaceUrlContent(key: string, promise: Promise<WorkspaceUrlContent>): void {
  INFLIGHT.set(key, promise)
}

export function clearInflightWorkspaceUrlContent(key: string): void {
  INFLIGHT.delete(key)
}

export function resetWorkspaceUrlContentCacheForTests(): void {
  CACHE.clear()
  INFLIGHT.clear()
}
