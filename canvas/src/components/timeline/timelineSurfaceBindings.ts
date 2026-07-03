import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import type { UiToastInput } from '@/hooks/store/store-types/core'

export type TimelineGanttSelectionStoreBinding = {
  selectedRowKey: string
  setSelectedRowKey: (rowKey: string) => void
}

export type TimelineDocumentMutationStoreBinding = {
  setMarkdownDocument: (
    name: string | null | undefined,
    markdownText: string,
    options?: { applyViewPreset?: boolean },
  ) => void
  upsertUiToast: (toast: UiToastInput) => void
}

export type TimelineDocumentSnapshot = {
  markdownDocumentName: string
  markdownText: string
}

export type TimelineDocumentSnapshotReader = () => TimelineDocumentSnapshot

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
  return useGraphStore(
    useShallow(state => ({
      setMarkdownDocument: state.setMarkdownDocument,
      upsertUiToast: state.upsertUiToast,
    })),
  )
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
