import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { cleanTimelinePreviewDocumentKey } from '@/components/timeline/useTimelinePreviewBootstrap'
import { buildVideoSequenceGeneratedFrameThumbnails } from '@/components/timeline/videoSequenceGeneratedFrameThumbnails'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'

export function useGanttFloatingPanelSelectionTransportSync(args: {
  code: string
  onSelectedRowKeyChange: (rowKey: string | null) => void
}) {
  const { code, onSelectedRowKeyChange } = args
  const { markdownDocumentName, setTimelineTransportState } = useGraphStore(
    useShallow(state => ({
      markdownDocumentName: state.markdownDocumentName || '',
      setTimelineTransportState: state.setTimelineTransportState,
    })),
  )
  const documentKey = React.useMemo(() => cleanTimelinePreviewDocumentKey(markdownDocumentName), [markdownDocumentName])
  const taskSpans = React.useMemo(() => buildMermaidGanttTimelineModel(code).taskSpans, [code])
  const resolveSelectionPosition = React.useCallback((selectedRowKey: string): number | null => {
    const selectedSpan = taskSpans.find(span => span.rowKey === selectedRowKey)
    if (!selectedSpan) return null
    const exactFrameTimestamp = buildVideoSequenceGeneratedFrameThumbnails({
      sourceWindow: null,
      span: selectedSpan,
    })[0]?.timestampSeconds
    return Number.isFinite(exactFrameTimestamp) ? Math.max(0, Number(exactFrameTimestamp)) : Math.max(0, selectedSpan.startMinutes)
  }, [taskSpans])
  return React.useCallback((rowKey: string | null) => {
    onSelectedRowKeyChange(rowKey)
    const selectedRowKey = String(rowKey || '').trim()
    if (!selectedRowKey || !documentKey) return
    const position = resolveSelectionPosition(selectedRowKey)
    if (position == null) return
    setTimelineTransportState({
      documentKey,
      playing: false,
      position,
    })
  }, [documentKey, onSelectedRowKeyChange, resolveSelectionPosition, setTimelineTransportState])
}
