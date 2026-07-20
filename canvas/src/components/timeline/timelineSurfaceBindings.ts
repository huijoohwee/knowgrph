import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import type { UiToastInput } from '@/hooks/store/store-types/core'
import {
  findSourceFileForMarkdownDocument,
  writeActiveMarkdownDocumentTextIfPresent,
  writeWorkspaceSourceTextIfPresent,
} from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'

export type TimelineGanttSelectionStoreBinding = {
  selectedRowKey: string
  setSelectedRowKey: (rowKey: string) => void
}

export type TimelineDocumentMutationStoreBinding = {
  commitMarkdownDocument: (
    name: string | null | undefined,
    markdownText: string,
    options?: { applyViewPreset?: boolean; historyLabel?: string },
  ) => boolean
  upsertUiToast: (toast: UiToastInput) => void
}

export type TimelineDocumentSnapshot = {
  markdownDocumentName: string
  markdownText: string
}

export type TimelineDocumentSnapshotReader = () => TimelineDocumentSnapshot

export function commitTimelineDocumentMutation(args: {
  name: string | null | undefined
  markdownText: string
  applyViewPreset?: boolean
  historyLabel?: string
}): boolean {
  const store = useGraphStore.getState()
  const name = String(args.name || '').trim()
  const markdownText = String(args.markdownText || '')
  if (String(store.markdownDocumentName || '') === name && String(store.markdownDocumentText || '') === markdownText) {
    return false
  }

  const historyLabel = String(args.historyLabel || 'Gantt Timeline edit').trim() || 'Gantt Timeline edit'
  store.addHistory(`Before ${historyLabel}`)
  const sourceFiles = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const matchedSourceFile = findSourceFileForMarkdownDocument(store, name)
  const matchedSourceFileIndex = matchedSourceFile
    ? sourceFiles.findIndex(file => file.id === matchedSourceFile.id)
    : -1

  store.setMarkdownDocument(name || null, markdownText, {
    applyViewPreset: args.applyViewPreset !== false,
  })

  const stateAfterDocumentUpdate = useGraphStore.getState()
  const latestSourceFiles = Array.isArray(stateAfterDocumentUpdate.sourceFiles)
    ? stateAfterDocumentUpdate.sourceFiles
    : []
  const nextSourceFiles = matchedSourceFileIndex >= 0
    ? latestSourceFiles.map((file, index) => index === matchedSourceFileIndex
      ? { ...file, text: markdownText, parsedTextHash: '' }
      : file)
    : latestSourceFiles
  const nextMatchedSourceFile = matchedSourceFileIndex >= 0
    ? nextSourceFiles[matchedSourceFileIndex] || null
    : null

  useGraphStore.setState(state => ({
    ...(nextMatchedSourceFile ? { sourceFiles: nextSourceFiles } : {}),
    graphContentRevision: (state.graphContentRevision || 0) + 1,
    docLocationRevision: (state.docLocationRevision || 0) + 1,
  }))

  if (nextMatchedSourceFile) {
    void writeWorkspaceSourceTextIfPresent(nextMatchedSourceFile, markdownText, historyLabel)
  } else {
    void writeActiveMarkdownDocumentTextIfPresent({
      state: stateAfterDocumentUpdate,
      sourceFiles: latestSourceFiles,
      text: markdownText,
      label: historyLabel,
    })
  }
  useGraphStore.getState().scheduleHistory(historyLabel)
  return true
}

export function useTimelineGanttSelectionStoreBinding(): TimelineGanttSelectionStoreBinding {
  const { selectedRowKey, setMermaidDiagramSelectedRowKey } = useGraphStore(
    useShallow(state => ({
      selectedRowKey: state.mermaidDiagramSelectedRowKeyByKind.gantt || '',
      setMermaidDiagramSelectedRowKey: state.setMermaidDiagramSelectedRowKey,
    })),
  )
  const setSelectedRowKey = (rowKey: string) => {
    setMermaidDiagramSelectedRowKey('gantt', rowKey)
  }
  return {
    selectedRowKey,
    setSelectedRowKey,
  }
}

export function useTimelineDocumentMutationStoreBinding(): TimelineDocumentMutationStoreBinding {
  const upsertUiToast = useGraphStore(state => state.upsertUiToast)
  return React.useMemo(() => ({
    commitMarkdownDocument: (name, markdownText, options) => commitTimelineDocumentMutation({
      name,
      markdownText,
      applyViewPreset: options?.applyViewPreset,
      historyLabel: options?.historyLabel,
    }),
    upsertUiToast,
  }), [upsertUiToast])
}

export function useTimelineDocumentSnapshotReader(args: TimelineDocumentSnapshot): TimelineDocumentSnapshotReader {
  const snapshot = React.useMemo(() => ({
    markdownDocumentName: String(args.markdownDocumentName || ''),
    markdownText: String(args.markdownText || ''),
  }), [args.markdownDocumentName, args.markdownText])
  const snapshotRef = React.useRef(snapshot)
  const storeMarkdownDocumentNameRef = useGraphStoreKeyRef('markdownDocumentName')
  const storeMarkdownDocumentTextRef = useGraphStoreKeyRef('markdownDocumentText')
  snapshotRef.current = snapshot
  return React.useCallback(() => {
    const markdownDocumentName = String(storeMarkdownDocumentNameRef.current || '')
    if (!markdownDocumentName) return snapshotRef.current
    return {
      markdownDocumentName,
      markdownText: String(storeMarkdownDocumentTextRef.current || ''),
    }
  }, [storeMarkdownDocumentNameRef, storeMarkdownDocumentTextRef])
}
