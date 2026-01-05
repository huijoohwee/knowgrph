import { LRUCache } from '@/lib/cache/LRUCache'
import { PARSER_CACHE_MAX_SIZE, PARSER_CACHE_TTL_MS } from './config'
import { hashText } from './hash'
import type { ParseResult, ParserId } from './types'

const cache = new LRUCache<string, ParseResult>(PARSER_CACHE_MAX_SIZE, PARSER_CACHE_TTL_MS)

export const getCachedParse = (parserId: ParserId, name: string, text: string, cfgKey?: string): ParseResult | undefined => {
  const key = `${parserId}|${name}|${hashText(text)}|${String(cfgKey || '')}`
  return cache.get(key)
}

export const setCachedParse = (parserId: ParserId, name: string, text: string, res: ParseResult, cfgKey?: string) => {
  const key = `${parserId}|${name}|${hashText(text)}|${String(cfgKey || '')}`
  cache.set(key, res)
}

export const invalidateParserCache = (parserId: ParserId) => {
  const prefix = `${parserId}|`
  cache.deleteWhere(key => typeof key === 'string' && (key as string).startsWith(prefix))
}
