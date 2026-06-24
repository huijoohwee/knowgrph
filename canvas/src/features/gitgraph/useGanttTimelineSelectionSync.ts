import React from 'react'
import type { MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'

export function useGanttTimelineSelectionSync(args: {
  playing: boolean
  selectedRowKey: string
  setTransportPlaybackPosition: (position: number) => void
  taskSpans: readonly MermaidGanttTimelineTaskSpan[]
}) {
  const previousSelectedRowKeyRef = React.useRef(args.selectedRowKey)

  React.useEffect(() => {
    const previousSelectedRowKey = previousSelectedRowKeyRef.current
    if (previousSelectedRowKey === args.selectedRowKey) return
    previousSelectedRowKeyRef.current = args.selectedRowKey
    if (!args.selectedRowKey || args.playing) return
    const selectedSpan = args.taskSpans.find(span => span.rowKey === args.selectedRowKey)
    if (!selectedSpan) return
    args.setTransportPlaybackPosition(selectedSpan.startMinutes)
  }, [args])
}
