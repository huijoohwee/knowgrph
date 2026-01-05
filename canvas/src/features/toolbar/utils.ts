import { searchGraph } from '@/features/search'
import { LRUCache } from '@/lib/cache/LRUCache'
import type { SearchResult } from '@/features/search/types'

export type ToolbarSearchCacheKey = string

const searchCache = new LRUCache<ToolbarSearchCacheKey, SearchResult[]>(500, 2 * 60 * 1000)

export const buildToolbarSearchCacheKey = (
  query: string,
  limit: number,
  versionKey: string | undefined,
  nodesLen: number,
  edgesLen: number,
): ToolbarSearchCacheKey =>
  `${versionKey ? `v:${versionKey}|` : ''}n:${nodesLen}|e:${edgesLen}|q:${query}|l:${limit}`

export const computeSearchResults = (data: unknown, query: string, limit: number, versionKey?: string): SearchResult[] => {
  const maybe = data as { nodes?: unknown[]; edges?: unknown[] } | null | undefined
  const nodesLen = Array.isArray(maybe?.nodes) ? maybe!.nodes!.length : 0
  const edgesLen = Array.isArray(maybe?.edges) ? maybe!.edges!.length : 0
  const key = buildToolbarSearchCacheKey(query, limit, versionKey, nodesLen, edgesLen)
  const cached = searchCache.get(key)
  if (cached) return cached
  const res = searchGraph((data as import('@/lib/graph/types').GraphData | null) ?? null, query, limit)
  searchCache.set(key, res)
  return res
}

export const scheduleDebouncedSearch = (
  data: unknown,
  query: string,
  limit: number,
  delayMs: number,
  versionKey: string | undefined,
  onDone: (results: SearchResult[]) => void,
): (() => void) => {
  const h: ReturnType<typeof setTimeout> = setTimeout(() => {
    const res = computeSearchResults(data, query, limit, versionKey)
    onDone(res)
  }, delayMs)
  return () => clearTimeout(h)
}
