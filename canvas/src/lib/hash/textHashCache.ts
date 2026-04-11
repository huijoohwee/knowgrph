import { hashStringToHex } from '@/lib/hash/stringHash'

type TextHashCacheEntry = {
  signature: string
  hash: string
}

const DEFAULT_HEAD_CHARS = 384
const DEFAULT_MID_CHARS = 256
const DEFAULT_TAIL_CHARS = 384
const MAX_CACHE_ENTRIES = 220

const cacheByKey = new Map<string, TextHashCacheEntry>()

const buildFastTextSignature = (text: string): string => {
  const len = text.length
  if (len <= DEFAULT_HEAD_CHARS + DEFAULT_TAIL_CHARS + 64) {
    return `len:${len}|full:${text}`
  }
  const head = text.slice(0, DEFAULT_HEAD_CHARS)
  const midStart = Math.max(DEFAULT_HEAD_CHARS, Math.floor(len / 2) - Math.floor(DEFAULT_MID_CHARS / 2))
  const mid = text.slice(midStart, midStart + DEFAULT_MID_CHARS)
  const tail = text.slice(Math.max(0, len - DEFAULT_TAIL_CHARS))
  return `len:${len}|head:${head}|mid@${midStart}:${mid}|tail:${tail}`
}

const touchKey = (key: string): void => {
  const existing = cacheByKey.get(key)
  if (!existing) return
  cacheByKey.delete(key)
  cacheByKey.set(key, existing)
}

const prune = (): void => {
  if (cacheByKey.size <= MAX_CACHE_ENTRIES) return
  const overflow = cacheByKey.size - MAX_CACHE_ENTRIES
  const keys = cacheByKey.keys()
  for (let i = 0; i < overflow; i += 1) {
    const oldest = keys.next().value
    if (typeof oldest !== 'string') break
    cacheByKey.delete(oldest)
  }
}

/**
 * Memoize `hashStringToHex(text)` behind a cheap signature so repeated calls for the
 * same logical text (common during rapid workspace switching) do not rescan the
 * full string.
 *
 * - Cache key should be stable (e.g. `source-file:${fileId}`).
 * - Signature uses length + head/mid/tail sampling; if it matches, we reuse the
 *   cached full hash.
 */
export const hashStringToHexCached = (cacheKey: string, rawText: string): string => {
  const key = String(cacheKey || '').trim() || 'default'
  const text = String(rawText ?? '')
  const signature = buildFastTextSignature(text)
  const existing = cacheByKey.get(key)
  if (existing && existing.signature === signature) {
    touchKey(key)
    return existing.hash
  }
  const hash = hashStringToHex(text)
  cacheByKey.set(key, { signature, hash })
  prune()
  return hash
}

