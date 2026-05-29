export function readFlowEditorRuntimeCacheEntry<T>(
  cache: Map<string, T>,
  cacheKey: string,
): T | null {
  if (!cache.has(cacheKey)) return null
  const cached = cache.get(cacheKey) as T
  cache.delete(cacheKey)
  cache.set(cacheKey, cached)
  return cached
}

export function writeFlowEditorRuntimeCacheEntry<T>(
  cache: Map<string, T>,
  cacheKey: string,
  value: T,
  limit: number,
): T {
  cache.delete(cacheKey)
  cache.set(cacheKey, value)
  const maxEntries = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) break
    cache.delete(oldestKey)
  }
  return value
}
