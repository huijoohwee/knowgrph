import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
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
  snapshotRef.current = snapshot
  return React.useCallback(() => snapshotRef.current, [])
}
