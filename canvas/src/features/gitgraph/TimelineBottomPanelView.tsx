import React from 'react'
import { TimelineVideoSequenceEmptyState } from '@/components/timeline/VideoSequenceTimelineRuler'
import { GanttTimelineTransportPanel } from './GanttTimelineTransportPanel'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useFlowEditorDiagramSelectionBridge } from './useFlowEditorDiagramSelectionBridge'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'
import { useMermaidTimelineDocument } from './useMermaidTimelineDocument'

export function TimelineBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code: timelineCode, graphData, themeMode, timelineModel } = useMermaidTimelineDocument()
  const { code: ganttCode } = useMermaidGanttDocument()
  const { handleDiagramSelectedRowKeyChange } = useFlowEditorDiagramSelectionBridge({
    graphData,
    diagramModel: timelineModel,
    kind: 'timeline',
  })
  if (!timelineCode && ganttCode) {
    return <GanttTimelineTransportPanel code={ganttCode} compact={compact} />
  }
  if (!timelineCode) {
    return <TimelineVideoSequenceEmptyState compact={compact} />
  }
  return (
    <MermaidDiagramPanelView
      code={timelineCode}
      model={timelineModel}
      kind="timeline"
      title="Timeline"
      emptyLabel="No Timeline Mermaid frontmatter."
      rootThemeMode={themeMode}
      compact={compact}
      surface="bottomPanel"
      renderMode="diagram"
      onSelectedRowKeyChange={handleDiagramSelectedRowKeyChange}
    />
  )
}
