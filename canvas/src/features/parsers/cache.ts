import { LRUCache } from '@/lib/cache/LRUCache'
import { PARSER_CACHE_MAX_GRAPH_ITEMS, PARSER_CACHE_MAX_SIZE, PARSER_CACHE_TTL_MS } from './config'
import { buildSourceFileParseIdentityHash } from '@/features/source-files/sourceFileParseIdentity'
import type { ParseResult, ParserId } from './types'

const cache = new LRUCache<string, ParseResult>(PARSER_CACHE_MAX_SIZE, PARSER_CACHE_TTL_MS)

const buildParserCacheKey = (args: { parserId: ParserId; name: string; text: string; cfgKey?: string }): string => {
  const parserId = String(args.parserId || '').trim()
  const name = String(args.name || '')
  const cfgKey = String(args.cfgKey || '').trim()
  const identityHash = buildSourceFileParseIdentityHash({
    cacheNamespace: `parser:${parserId}:${cfgKey || 'default'}`,
    name,
    text: String(args.text || ''),
  })
  return `${parserId}|${cfgKey}|${identityHash}`
}

export const getCachedParse = (parserId: ParserId, name: string, text: string, cfgKey?: string): ParseResult | undefined => {
  const key = buildParserCacheKey({ parserId, name, text, cfgKey })
  return cache.get(key)
}

export const setCachedParse = (parserId: ParserId, name: string, text: string, res: ParseResult, cfgKey?: string) => {
  const nodesLen = (res?.graphData?.nodes || []).length
  const edgesLen = (res?.graphData?.edges || []).length
  if (nodesLen + edgesLen > PARSER_CACHE_MAX_GRAPH_ITEMS) return
  const key = buildParserCacheKey({ parserId, name, text, cfgKey })
  cache.set(key, res)
}

export const invalidateParserCache = (parserId: ParserId) => {
  const prefix = `${parserId}|`
  cache.deleteWhere(key => typeof key === 'string' && (key as string).startsWith(prefix))
}
