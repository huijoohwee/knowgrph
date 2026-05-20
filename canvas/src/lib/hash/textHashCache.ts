import { hashStringToHex } from '@/lib/hash/stringHash'

type TextHashCacheEntry = {
  text: string
  hash: string
}

const MAX_CACHE_ENTRIES = 220
const MAX_RETAINED_TEXT_CHARS = 1_200_000
const MAX_RETAINED_TEXT_CHARS_PER_ENTRY = MAX_RETAINED_TEXT_CHARS

const cacheByKey = new Map<string, TextHashCacheEntry>()
let retainedTextChars = 0

const removeKey = (key: string): void => {
  const existing = cacheByKey.get(key)
  if (!existing) return
  retainedTextChars = Math.max(0, retainedTextChars - existing.text.length)
  cacheByKey.delete(key)
}

const touchKey = (key: string): void => {
  const existing = cacheByKey.get(key)
  if (!existing) return
  cacheByKey.delete(key)
  cacheByKey.set(key, existing)
}

const prune = (): void => {
  const keys = cacheByKey.keys()
  while (cacheByKey.size > MAX_CACHE_ENTRIES || retainedTextChars > MAX_RETAINED_TEXT_CHARS) {
    const oldest = keys.next().value
    if (typeof oldest !== 'string') break
    removeKey(oldest)
  }
}

/**
 * Memoize `hashStringToHex(text)` by exact text value so repeated calls for the
 * same logical text do not rescan the full string.
 *
 * - Cache key should be stable (e.g. `source-file:${fileId}`).
 * - Large texts still get hashed correctly, but are not retained indefinitely.
 */
export const hashStringToHexCached = (cacheKey: string, rawText: string): string => {
  const key = String(cacheKey || '').trim() || 'default'
  const text = String(rawText ?? '')
  const existing = cacheByKey.get(key)
  if (existing && existing.text === text) {
    touchKey(key)
    return existing.hash
  }
  const hash = hashStringToHex(text)
  removeKey(key)
  if (text.length <= MAX_RETAINED_TEXT_CHARS_PER_ENTRY) {
    cacheByKey.set(key, { text, hash })
    retainedTextChars += text.length
  }
  prune()
  return hash
}

const buildSharedTextContentCacheKey = (rawText: string, scope?: string): string => {
  const text = String(rawText ?? '')
  const prefix = text.slice(0, 96)
  const suffix = text.length > 96 ? text.slice(-96) : ''
  const normalizedScope = String(scope || '').trim() || 'shared-text'
  return `${normalizedScope}:${text.length}:${prefix}:${suffix}`
}

export const hashStringToHexSharedContentCached = (rawText: string, scope?: string): string => {
  const text = String(rawText ?? '')
  return hashStringToHexCached(buildSharedTextContentCacheKey(text, scope), text)
}
