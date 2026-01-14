import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildMarkdownTokensKey, lexMarkdown, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'

export function useMarkdownPreviewTokens(
  markdownText: string,
  providedTokens: TokenWithLines[] | undefined,
  activeDocumentPath: string,
  shouldUpdateStore: boolean = true
) {
  const storedTokens = useGraphStore(s => s.markdownTokens)
  const storedTokensPath = useGraphStore(s => s.markdownTokensPath)
  const storedTokensKey = useGraphStore(s => s.markdownTokensKey)
  const setMarkdownTokens = useGraphStore(s => s.setMarkdownTokens)

  const currentTokensKey = React.useMemo(() => {
    return buildMarkdownTokensKey(markdownText || '')
  }, [markdownText])

  const tokens = React.useMemo(() => {
    if (providedTokens) return providedTokens
    
    if (storedTokens && storedTokensKey === currentTokensKey) {
      return storedTokens
    }

    const { tokens: parsedTokens } = lexMarkdown(markdownText || '')
    return parsedTokens
  }, [markdownText, providedTokens, storedTokens, storedTokensKey, currentTokensKey])

  React.useEffect(() => {
    if (!shouldUpdateStore) return
    if (!providedTokens && tokens && (tokens !== storedTokens || storedTokensKey !== currentTokensKey || storedTokensPath !== activeDocumentPath)) {
      setMarkdownTokens(tokens, activeDocumentPath, currentTokensKey)
    }
  }, [tokens, storedTokens, storedTokensKey, currentTokensKey, storedTokensPath, activeDocumentPath, providedTokens, setMarkdownTokens, shouldUpdateStore])

  return tokens
}
