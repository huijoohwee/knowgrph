import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { normalizeComposedSourcePath, readComposedSourceFilePath, resolvePreferredComposedSourceRawText } from '@/features/source-files/composedSourceSelection'
import { buildStructuredSourceDataViewProjection } from './sourceStructuredDataViewTable'

export function useCanvasWorkspaceDataViewSource(fallbackDocumentName: string) {
  const { markdownDocumentName, markdownDocumentText, jsonSourceDocumentText, sourceFiles, setMarkdownDocument, setSourceFiles } = useGraphStore(
    useShallow(s => ({
      markdownDocumentName: s.markdownDocumentName || null,
      markdownDocumentText: s.markdownDocumentText || '',
      jsonSourceDocumentText: s.jsonSourceDocumentText || '',
      sourceFiles: s.sourceFiles || [],
      setMarkdownDocument: s.setMarkdownDocument,
      setSourceFiles: s.setSourceFiles,
    })),
  )
  const activeDocumentPath = String(markdownDocumentName || '').trim() || fallbackDocumentName
  const sourceMarkdownText = React.useMemo(() => (
    resolvePreferredComposedSourceRawText({ sourceFiles, markdownDocumentName, fallbackName: markdownDocumentName }) || String(markdownDocumentText || '')
  ), [markdownDocumentName, markdownDocumentText, sourceFiles])
  const sourceStructuredProjection = React.useMemo(
    () => buildStructuredSourceDataViewProjection(sourceMarkdownText),
    [sourceMarkdownText],
  )
  const sourceStructuredTableText = sourceStructuredProjection?.markdownText || ''
  const sourceBackedMarkdownText = sourceStructuredTableText || sourceMarkdownText
  const title = activeDocumentPath.split('/').filter(Boolean).pop() || 'Workspace'

  return {
    activeDocumentPath,
    jsonSourceDocumentText,
    markdownDocumentName,
    setMarkdownDocument,
    setSourceFiles,
    sourceBackedMarkdownText,
    sourceFiles,
    sourceMarkdownText,
    sourceStructuredProjection,
    title,
    normalizeActivePath: () => normalizeComposedSourcePath(markdownDocumentName || activeDocumentPath),
    readSourceFilePath: readComposedSourceFilePath,
  }
}
