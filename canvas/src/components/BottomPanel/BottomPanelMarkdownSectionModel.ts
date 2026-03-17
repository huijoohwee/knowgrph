import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import { getSelectionInfo, getDefaultDocumentPath } from './markdownUtils'
import { useMarkdownLoader } from './useMarkdownLoader'
import { useBottomPanelMarkdownSplitView } from './useMarkdownSplitView'
import type { MarkdownSelectionInfo } from './markdownUtils'
import type { GraphSchema } from '@/lib/graph/schema'

export type { MarkdownSelectionInfo }
export { useBottomPanelMarkdownSplitView }

export function useBottomPanelMarkdownModel(args: {
  graphData: GraphData | null
  schema: GraphSchema | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  importedMarkdownText: string | null
  markdownDocumentName: string | null
  markdownDocumentSourceUrl: string | null
  setMarkdownDocument: (name: string | null, text: string | null) => void
  setMarkdownDocumentSourceUrl: (url: string | null) => void
}) {
  const {
    graphData,
    schema,
    selectedNodeId,
    selectedEdgeId,
    importedMarkdownText,
    markdownDocumentName,
    markdownDocumentSourceUrl,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
  } = args

  const selectionInfo = React.useMemo(
    () => getSelectionInfo(graphData, schema, selectedNodeId, selectedEdgeId),
    [graphData, schema, selectedNodeId, selectedEdgeId],
  )

  const selectionDocumentPath = selectionInfo?.documentPath || ''

  const defaultDocumentPath = React.useMemo(
    () => getDefaultDocumentPath(graphData),
    [graphData],
  )

  const [activeDocumentPath, setActiveDocumentPath] = React.useState('')

  React.useEffect(() => {
    if (!defaultDocumentPath) return
    setActiveDocumentPath(prev => (prev === defaultDocumentPath ? prev : defaultDocumentPath))
  }, [defaultDocumentPath])

  React.useEffect(() => {
    if (!selectionDocumentPath) return
    setActiveDocumentPath(prev => (prev === selectionDocumentPath ? prev : selectionDocumentPath))
  }, [selectionDocumentPath])

  React.useEffect(() => {
    const name = String(markdownDocumentName || '').trim()
    if (!name) return
    setActiveDocumentPath(prev => (prev === name ? prev : name))
  }, [markdownDocumentName])

  const { markdownText, setMarkdownText, isLoading, loadError } = useMarkdownLoader(
    activeDocumentPath,
    importedMarkdownText,
    markdownDocumentName,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
  )

  return {
    selectionInfo,
    selectionDocumentPath,
    activeDocumentPath,
    setActiveDocumentPath,
    markdownText,
    setMarkdownText,
    isLoading,
    loadError,
    previewBasePath: markdownDocumentSourceUrl || activeDocumentPath || markdownDocumentName || '',
  }
}
