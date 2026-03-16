export type WebpageMeta = {
  url: string
  title: string
  siteName: string
  imageUrl: string
  fetchedAtMs: number
}

type CacheEntry = {
  value: WebpageMeta | null
  expiresAtMs: number
  inflight?: Promise<WebpageMeta | null>
}

const getGlobalCache = (): Map<string, CacheEntry> => {
  const g = globalThis as unknown as { __kgWebpageMetaCache?: Map<string, CacheEntry> }
  if (!g.__kgWebpageMetaCache) g.__kgWebpageMetaCache = new Map()
  return g.__kgWebpageMetaCache
}

export async function getOrFetchWebpageMeta(url: string, opts?: { ttlMs?: number; endpoint?: string }): Promise<WebpageMeta | null> {
  const normalized = String(url || '').trim()
  if (!normalized) return null
  const ttlMs = typeof opts?.ttlMs === 'number' && Number.isFinite(opts.ttlMs) ? Math.max(10_000, Math.floor(opts.ttlMs)) : 10 * 60_000
  const endpoint = String(opts?.endpoint || '/__webpage_meta').trim() || '/__webpage_meta'
  const key = normalized
  const now = Date.now()
  const cache = getGlobalCache()
  const existing = cache.get(key)
  if (existing && existing.expiresAtMs > now && existing.value !== undefined) {
    if (existing.value) return existing.value
    if (existing.inflight) return await existing.inflight
    return null
  }

  const inflight = (async (): Promise<WebpageMeta | null> => {
    try {
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(normalized)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return null
      const json = (await res.json()) as unknown
      if (!json || typeof json !== 'object' || Array.isArray(json)) return null
      const obj = json as { ok?: unknown; url?: unknown; title?: unknown; siteName?: unknown; imageUrl?: unknown }
      if (obj.ok !== true) return null
      const out: WebpageMeta = {
        url: String(obj.url || normalized),
        title: String(obj.title || ''),
        siteName: String(obj.siteName || ''),
        imageUrl: String(obj.imageUrl || ''),
        fetchedAtMs: Date.now(),
      }
      return out
    } catch {
      return null
    }
  })()

  cache.set(key, { value: null, expiresAtMs: now + ttlMs, inflight })
  const value = await inflight
  cache.set(key, { value: value || null, expiresAtMs: now + ttlMs })
  return value
}
