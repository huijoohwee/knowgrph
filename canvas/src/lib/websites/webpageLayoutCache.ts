import type { WebpageLayoutSnapshot } from './webpageLayoutExport'

const CACHE_MAX = 8
const CACHE = new Map<string, WebpageLayoutSnapshot>()

export function getCachedWebpageLayoutSnapshot(url: string): WebpageLayoutSnapshot | null {
  const key = String(url || '').trim()
  if (!key) return null
  return CACHE.get(key) || null
}

export function setCachedWebpageLayoutSnapshot(url: string, snap: WebpageLayoutSnapshot): void {
  const key = String(url || '').trim()
  if (!key) return
  CACHE.set(key, snap)
  if (CACHE.size > CACHE_MAX) {
    const oldest = CACHE.keys().next().value as string | undefined
    if (oldest) CACHE.delete(oldest)
  }
}

export function clearCachedWebpageLayoutSnapshots(): void {
  CACHE.clear()
}

