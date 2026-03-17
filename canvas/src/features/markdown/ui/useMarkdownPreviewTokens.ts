import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildMarkdownTokensKey, lexMarkdown, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { parseMarkdownFrontmatter, splitMarkdownLines, type MarkdownFrontmatter } from '@/lib/markdown'

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
    return buildMarkdownTokensKey(text)
  }, [canCacheInStore, text])

  const lexedLarge = React.useMemo((): {
    tokens: TokenWithLines[]
    meta: MarkdownFrontmatter
    startLineOffset: number
  } => {
    if (providedTokens && providedTokens.length > 0) {
      const lines = splitMarkdownLines(text)
      const { meta, startIndex } = parseMarkdownFrontmatter(lines)
      return { tokens: providedTokens, meta, startLineOffset: startIndex }
    }
    const { tokens, meta, startLineOffset } = lexMarkdown(text)
    return { tokens, meta, startLineOffset }
  }, [text, providedTokens])

  const lexedSmall = React.useMemo((): {
    tokens: TokenWithLines[]
    meta: MarkdownFrontmatter
    startLineOffset: number
  } => {
    if (providedTokens && providedTokens.length > 0) {
      const lines = splitMarkdownLines(text)
      const { meta, startIndex } = parseMarkdownFrontmatter(lines)
      return { tokens: providedTokens, meta, startLineOffset: startIndex }
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

    const { tokens, meta, startLineOffset } = lexMarkdown(text)
    return { tokens, meta, startLineOffset }
  }, [
    text,
    providedTokens,
    storedTokens,
    storedTokensKey,
    storedTokensMeta,
    storedTokensStartLineOffset,
    currentTokensKey,
    storedTokensPath,
    activeDocumentPath,
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
