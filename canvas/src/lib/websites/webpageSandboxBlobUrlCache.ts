const CACHE = new Map<string, { url: string; atMs: number; bytes: number }>()

const CACHE_MAX = 12
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_TOTAL_BYTES = 36 * 1024 * 1024

function canCreateObjectUrl(): boolean {
  try {
    return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof URL.revokeObjectURL === 'function'
  } catch {
    return false
  }
}

function pruneExpired(nowMs: number): void {
  for (const [key, entry] of CACHE.entries()) {
    const ageMs = nowMs - entry.atMs
    if (!(ageMs >= 0 && ageMs <= CACHE_TTL_MS)) {
      CACHE.delete(key)
      try {
        URL.revokeObjectURL(entry.url)
      } catch {
        void 0
      }
    }
  }
}

function totalBytes(): number {
  let sum = 0
  for (const entry of CACHE.values()) sum += entry.bytes
  return sum
}

function evictUntilWithinLimit(): void {
  while (CACHE.size > CACHE_MAX || totalBytes() > CACHE_MAX_TOTAL_BYTES) {
    const oldestKey = CACHE.keys().next().value
    if (typeof oldestKey !== 'string') break
    const entry = CACHE.get(oldestKey)
    CACHE.delete(oldestKey)
    if (entry) {
      try {
        URL.revokeObjectURL(entry.url)
      } catch {
        void 0
      }
    }
  }
}

export function clearWebpageSandboxBlobUrlCache(): void {
  for (const entry of CACHE.values()) {
    try {
      URL.revokeObjectURL(entry.url)
    } catch {
      void 0
    }
  }
  CACHE.clear()
}

export function getOrCreateWebpageSandboxBlobUrl(args: { key: string; html: string }): string {
  const key = String(args.key || '').trim()
  const html = String(args.html || '')
  if (!key || !html) return ''
  if (!canCreateObjectUrl()) return ''

  const nowMs = Date.now()
  pruneExpired(nowMs)

  const existing = CACHE.get(key)
  if (existing) {
    CACHE.delete(key)
    CACHE.set(key, { ...existing, atMs: nowMs })
    return existing.url
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const bytes = blob.size
  CACHE.set(key, { url, atMs: nowMs, bytes })
  evictUntilWithinLimit()
  return url
}

