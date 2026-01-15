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
  const storedTokens = useGraphStore(s => s.markdownTokens)
  const storedTokensPath = useGraphStore(s => s.markdownTokensPath)
  const storedTokensKey = useGraphStore(s => s.markdownTokensKey)
  const storedTokensMeta = useGraphStore(s => s.markdownTokensMeta)
  const storedTokensStartLineOffset = useGraphStore(s => s.markdownTokensStartLineOffset)
  const setMarkdownTokens = useGraphStore(s => s.setMarkdownTokens)

  const currentTokensKey = React.useMemo(() => {
    return buildMarkdownTokensKey(markdownText || '')
  }, [markdownText])

  const lexed = React.useMemo((): {
    tokens: TokenWithLines[]
    meta: MarkdownFrontmatter
    startLineOffset: number
  } => {
    if (providedTokens && providedTokens.length > 0) {
      const lines = splitMarkdownLines(markdownText || '')
      const { meta, startIndex } = parseMarkdownFrontmatter(lines)
      return { tokens: providedTokens, meta, startLineOffset: startIndex }
    }

    if (
      storedTokens &&
      storedTokensKey === currentTokensKey &&
      storedTokensMeta != null &&
      storedTokensStartLineOffset != null
    ) {
      return {
        tokens: storedTokens,
        meta: storedTokensMeta,
        startLineOffset: storedTokensStartLineOffset,
      }
    }

    const { tokens, meta, startLineOffset } = lexMarkdown(markdownText || '')
    return { tokens, meta, startLineOffset }
  }, [
    markdownText,
    providedTokens,
    storedTokens,
    storedTokensKey,
    storedTokensMeta,
    storedTokensStartLineOffset,
    currentTokensKey,
  ])

  React.useEffect(() => {
    if (!shouldUpdateStore) return
    if (
      !providedTokens &&
      lexed.tokens &&
      (lexed.tokens !== storedTokens ||
        storedTokensKey !== currentTokensKey ||
        storedTokensPath !== activeDocumentPath ||
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
    lexed,
    storedTokens,
    storedTokensKey,
    currentTokensKey,
    storedTokensPath,
    activeDocumentPath,
    providedTokens,
    setMarkdownTokens,
    shouldUpdateStore,
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
