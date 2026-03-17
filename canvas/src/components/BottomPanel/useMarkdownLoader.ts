import React from 'react'
import { buildCodebaseTextUrlForRelPath, buildFsUrlForRelPath } from '@/features/panels/hooks/markdownPipelineActions'
import { UI_COPY, looksLikeViteDevIndexHtml } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { shouldPreferImportedMarkdown } from './markdownLoaderUtils'
import { coerceCodebaseRelPath } from '@/lib/codebase/relPath'

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
  const coercedBasePath = React.useMemo(() => coerceCodebaseRelPath(basePath) || basePath, [basePath])
  const preferImported = React.useMemo(() => {
    return shouldPreferImportedMarkdown({
      activeDocumentPath: coercedBasePath,
      importedMarkdownText: importedText,
      markdownDocumentName: importedName,
    })
  }, [coercedBasePath, importedName, importedText])
  const allowImportedWhenNoPath = React.useMemo(() => {
    return !activeDocumentPath.trim() && importedText.trim()
  }, [activeDocumentPath, importedText])

  const markdownText = preferImported || allowImportedWhenNoPath ? importedText : localMarkdownText

  const inferredDocumentName = React.useMemo(() => {
    const name = String(importedName || '').trim()
    if (name) return name
    if (!basePath.trim()) return ''
    const raw = basePath.split(/[/\\]/).pop() || ''
    const trimmed = raw.trim()
    return trimmed || 'document.md'
  }, [basePath, importedName])

  React.useEffect(() => {
    if (!activeDocumentPath) return
    let cancelled = false
    const url = buildCodebaseTextUrlForRelPath(coercedBasePath) || buildFsUrlForRelPath(coercedBasePath)
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
        try {
          const state = useGraphStore.getState()
          void state.setActiveMarkdownDocument({
            name: baseName,
            text,
            normalizeMermaidMmd: false,
            sourceUrl: null,
            jsonSourceText: null,
          })
        } catch {
          void 0
        }
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        const canFallbackToImported = shouldPreferImportedMarkdown({
          activeDocumentPath: coercedBasePath,
          importedMarkdownText: importedText,
          markdownDocumentName: importedName,
        })
        if (canFallbackToImported) {
          setLocalMarkdownText(importedText)
        } else if (!importedText.trim()) {
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
    coercedBasePath,
    importedText,
    preferImported,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
  ])

  const setMarkdownText = React.useCallback(
    (next: string) => {
      setLocalMarkdownText(next)
      const name = String(inferredDocumentName || '').trim()
      if (!name) return
      try {
        const state = useGraphStore.getState()
        void state.setActiveMarkdownDocument({ name, text: next, normalizeMermaidMmd: false })
      } catch {
        setMarkdownDocument(name, next)
      }
    },
    [inferredDocumentName, setMarkdownDocument],
  )

  return { markdownText, setMarkdownText, isLoading, loadError }
}
