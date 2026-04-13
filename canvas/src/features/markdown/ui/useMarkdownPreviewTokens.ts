import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildMarkdownTokensKey, lexMarkdown, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { parseMarkdownFrontmatter, splitMarkdownLines, type MarkdownFrontmatter } from '@/lib/markdown'

type LexedMarkdownResult = {
  tokens: TokenWithLines[]
  meta: MarkdownFrontmatter
  startLineOffset: number
}

type CachedFrontmatterResult = {
  meta: MarkdownFrontmatter
  startLineOffset: number
}

const TOKEN_KEY_CACHE_LIMIT = 6
const FRONTMATTER_CACHE_LIMIT = 6
const LEXED_CACHE_LIMIT = 6

const tokenKeyCache = new Map<string, string>()
const frontmatterCache = new Map<string, CachedFrontmatterResult>()
const lexedMarkdownCache = new Map<string, LexedMarkdownResult>()

const readCachedValue = <T,>(cache: Map<string, T>, key: string): T | null => {
  const cached = cache.get(key)
  if (cached == null) return null
  cache.delete(key)
  cache.set(key, cached)
  return cached
}

const writeCachedValue = <T,>(cache: Map<string, T>, key: string, value: T, limit: number): T => {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  if (cache.size > limit) {
    const oldest = cache.keys().next().value
    if (typeof oldest === 'string') cache.delete(oldest)
  }
  return value
}

const getMarkdownTokensKeyCached = (text: string): string => {
  const cached = readCachedValue(tokenKeyCache, text)
  if (cached != null) return cached
  return writeCachedValue(tokenKeyCache, text, buildMarkdownTokensKey(text), TOKEN_KEY_CACHE_LIMIT)
}

const getParsedFrontmatterCached = (text: string): CachedFrontmatterResult => {
  const cached = readCachedValue(frontmatterCache, text)
  if (cached) return cached
  if (!text.startsWith('---')) {
    return writeCachedValue(frontmatterCache, text, { meta: {}, startLineOffset: 0 }, FRONTMATTER_CACHE_LIMIT)
  }
  const lines = splitMarkdownLines(text)
  const { meta, startIndex } = parseMarkdownFrontmatter(lines)
  return writeCachedValue(frontmatterCache, text, { meta, startLineOffset: startIndex }, FRONTMATTER_CACHE_LIMIT)
}

const getLexedMarkdownCached = (text: string): LexedMarkdownResult => {
  const cached = readCachedValue(lexedMarkdownCache, text)
  if (cached) return cached
  return writeCachedValue(lexedMarkdownCache, text, lexMarkdown(text), LEXED_CACHE_LIMIT)
}

export function useMarkdownPreviewLexedMarkdown(
  markdownText: string,
  providedTokens: TokenWithLines[] | undefined,
  activeDocumentPath: string,
  shouldUpdateStore: boolean = true
) {
  const text = String(markdownText || '')
  const canCacheInStore = text.length <= 120_000

  const storedTokens = useGraphStore(s => s.markdownTokens)
  const storedTokensPath = useGraphStore(s => s.markdownTokensPath)
  const storedTokensKey = useGraphStore(s => s.markdownTokensKey)
  const storedTokensMeta = useGraphStore(s => s.markdownTokensMeta)
  const storedTokensStartLineOffset = useGraphStore(s => s.markdownTokensStartLineOffset)
  const setMarkdownTokens = useGraphStore(s => s.setMarkdownTokens)

  const currentTokensKey = React.useMemo(() => {
    if (!canCacheInStore) return `nocache:${text.length}`
    return getMarkdownTokensKeyCached(text)
  }, [canCacheInStore, text])

  const providedTokensFrontmatter = React.useMemo(() => {
    if (!providedTokens || providedTokens.length === 0) return null
    return getParsedFrontmatterCached(text)
  }, [providedTokens, text])

  const lexedLarge = React.useMemo((): LexedMarkdownResult => {
    if (providedTokens && providedTokens.length > 0 && providedTokensFrontmatter) {
      return {
        tokens: providedTokens,
        meta: providedTokensFrontmatter.meta,
        startLineOffset: providedTokensFrontmatter.startLineOffset,
      }
    }
    return getLexedMarkdownCached(text)
  }, [providedTokens, providedTokensFrontmatter, text])

  const lexedSmall = React.useMemo((): LexedMarkdownResult => {
    if (providedTokens && providedTokens.length > 0 && providedTokensFrontmatter) {
      return {
        tokens: providedTokens,
        meta: providedTokensFrontmatter.meta,
        startLineOffset: providedTokensFrontmatter.startLineOffset,
      }
    }

    if (
      storedTokens &&
      storedTokensKey === currentTokensKey &&
      storedTokensPath === activeDocumentPath &&
      storedTokensMeta != null &&
      storedTokensStartLineOffset != null
    ) {
      return {
        tokens: storedTokens,
        meta: storedTokensMeta,
        startLineOffset: storedTokensStartLineOffset,
      }
    }

    return getLexedMarkdownCached(text)
  }, [
    providedTokens,
    providedTokensFrontmatter,
    storedTokens,
    storedTokensKey,
    storedTokensMeta,
    storedTokensStartLineOffset,
    currentTokensKey,
    storedTokensPath,
    activeDocumentPath,
    text,
  ])

  const lexed = canCacheInStore ? lexedSmall : lexedLarge

  React.useEffect(() => {
    if (!shouldUpdateStore) return
    if (providedTokens && providedTokens.length > 0) return
    if (!canCacheInStore) return

    const keysMatch = storedTokensKey === currentTokensKey
    const pathMatches = storedTokensPath === activeDocumentPath
    const metaMatches = storedTokensMeta != null && storedTokensMeta === lexed.meta
    const offsetMatches =
      storedTokensStartLineOffset != null && storedTokensStartLineOffset === lexed.startLineOffset

    if (keysMatch && pathMatches && metaMatches && offsetMatches) return

    if (
      lexed.tokens &&
      (!keysMatch ||
        !pathMatches ||
        storedTokensMeta !== lexed.meta ||
        storedTokensStartLineOffset !== lexed.startLineOffset)
    ) {
      setMarkdownTokens({
        tokens: lexed.tokens,
        path: activeDocumentPath,
        key: currentTokensKey,
        meta: lexed.meta,
        startLineOffset: lexed.startLineOffset,
      })
    }
  }, [
    lexed.tokens,
    lexed.meta,
    lexed.startLineOffset,
    storedTokensKey,
    currentTokensKey,
    storedTokensPath,
    activeDocumentPath,
    providedTokens,
    setMarkdownTokens,
    shouldUpdateStore,
    canCacheInStore,
    storedTokensMeta,
    storedTokensStartLineOffset,
  ])

  return lexed
}

export function useMarkdownPreviewTokens(
  markdownText: string,
  providedTokens: TokenWithLines[] | undefined,
  activeDocumentPath: string,
  shouldUpdateStore: boolean = true
) {
  return useMarkdownPreviewLexedMarkdown(
    markdownText,
    providedTokens,
    activeDocumentPath,
    shouldUpdateStore,
  ).tokens
}
