import React from 'react'
import { buildFsUrlForRelPath } from '@/features/panels/hooks/markdownPipelineActions'
import { UI_COPY, looksLikeViteDevIndexHtml } from '@/lib/config'

export function useMarkdownLoader(
  activeDocumentPath: string,
  importedMarkdownText: string | null | undefined,
  markdownDocumentName: string | null | undefined,
  setMarkdownDocument: (name: string, content: string) => void,
  setMarkdownDocumentSourceUrl: (url: string | null) => void,
) {
  const [markdownText, setMarkdownText] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!activeDocumentPath) return
    let cancelled = false
    const basePath = activeDocumentPath.split('#')[0]
    const url = buildFsUrlForRelPath(basePath)
    const importedText = typeof importedMarkdownText === 'string' ? importedMarkdownText : ''
    const importedName = typeof markdownDocumentName === 'string' ? markdownDocumentName : ''
    const preferImported =
      importedText.trim()
      && importedName.trim()
      && basePath.trim()
      && basePath.trim() === importedName.trim()
    if (preferImported) {
      setIsLoading(false)
      setLoadError(null)
      setMarkdownText(importedText)
      return
    }
    if (!url) {
      if (importedText.trim()) {
        setIsLoading(false)
        setLoadError(null)
        setMarkdownText(importedText)
        return
      }
      setIsLoading(false)
      setLoadError(UI_COPY.bottomPanelMarkdownMissingPathError)
      return
    }
    setIsLoading(true)
    setLoadError(null)
    const load = async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(UI_COPY.requestFailedStatus(res.status))
        }
        const text = await res.text()
        if (looksLikeViteDevIndexHtml(text)) {
          throw new Error(UI_COPY.bottomPanelMarkdownLoadFailedError)
        }
        if (cancelled) return
        const baseName = (() => {
          const raw = basePath.split(/[/\\]/).pop() || ''
          const trimmed = raw.trim()
          return trimmed || 'document.md'
        })()
        setMarkdownText(text)
        setMarkdownDocument(baseName, text)
        setMarkdownDocumentSourceUrl(null)
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        if (!importedText.trim()) {
          setMarkdownText('')
        }
        setLoadError(message || UI_COPY.bottomPanelMarkdownLoadFailedError)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [
    activeDocumentPath,
    importedMarkdownText,
    markdownDocumentName,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
  ])

  React.useEffect(() => {
    const text = typeof importedMarkdownText === 'string' ? importedMarkdownText : ''
    if (!text.trim()) return
    setIsLoading(false)
    setLoadError(null)
    setMarkdownText(text)
  }, [importedMarkdownText])

  return { markdownText, setMarkdownText, isLoading, loadError }
}
