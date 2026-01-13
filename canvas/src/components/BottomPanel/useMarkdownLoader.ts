import React from 'react'
import { buildFsUrlForRelPath } from '@/features/panels/hooks/markdownPipelineActions'
import { UI_COPY, looksLikeViteDevIndexHtml } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

export function useMarkdownLoader(
  activeDocumentPath: string,
  importedMarkdownText: string | null | undefined,
  markdownDocumentName: string | null | undefined,
  setMarkdownDocument: (name: string, content: string) => void,
  setMarkdownDocumentSourceUrl: (url: string | null) => void,
) {
  const [localMarkdownText, setLocalMarkdownText] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const importedText = React.useMemo(
    () => (typeof importedMarkdownText === 'string' ? importedMarkdownText : ''),
    [importedMarkdownText],
  )
  const importedName = React.useMemo(
    () => (typeof markdownDocumentName === 'string' ? markdownDocumentName : ''),
    [markdownDocumentName],
  )
  const basePath = React.useMemo(
    () => activeDocumentPath.split('#')[0],
    [activeDocumentPath],
  )
  const preferImported = React.useMemo(() => {
    return (
      importedText.trim()
      && importedName.trim()
      && basePath.trim()
      && basePath.trim() === importedName.trim()
    )
  }, [basePath, importedName, importedText])
  const allowImportedWhenNoPath = React.useMemo(() => {
    return !activeDocumentPath.trim() && importedText.trim()
  }, [activeDocumentPath, importedText])

  const markdownText = preferImported || allowImportedWhenNoPath ? importedText : localMarkdownText

  React.useEffect(() => {
    if (!activeDocumentPath) return
    let cancelled = false
    const url = buildFsUrlForRelPath(basePath)
    if (preferImported) {
      setIsLoading(false)
      setLoadError(null)
      setLocalMarkdownText(importedText)
      return
    }
    if (!url) {
      if (importedText.trim()) {
        setIsLoading(false)
        setLoadError(null)
        setLocalMarkdownText(importedText)
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
        setLocalMarkdownText(text)
        setMarkdownDocument(baseName, text)
        try {
          const state = useGraphStore.getState()
          state.setJsonSourceDocument(baseName, null)
        } catch {
          void 0
        }
        setMarkdownDocumentSourceUrl(null)
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        if (!importedText.trim()) {
          setLocalMarkdownText('')
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
    basePath,
    importedText,
    preferImported,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
  ])

  const setMarkdownText = React.useCallback((next: string) => {
    setLocalMarkdownText(next)
  }, [])

  return { markdownText, setMarkdownText, isLoading, loadError }
}
