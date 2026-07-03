import React from 'react'
import { TimelineVideoSequenceEmptyState } from '@/components/timeline/VideoSequenceTimelineRuler'
import { readVideoSequenceTimelineModelFromMarkdown } from '@/components/timeline/videoSequenceTimeline'
import { useGraphStore } from '@/hooks/useGraphStore'
import { GanttTimelineTransportPanel } from './GanttTimelineTransportPanel'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useGanttTimelineTransportRouteModel } from './useGanttTimelineTransportRouteModel'
import { useStoryboardWidgetDiagramSelectionBridge } from './useStoryboardWidgetDiagramSelectionBridge'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'
import { useMermaidTimelineDocument } from './useMermaidTimelineDocument'

function TimelineVideoSequenceEmptyDropState({
  code,
  compact,
}: {
  code: string
  compact: boolean
}) {
  const transportRouteModel = useGanttTimelineTransportRouteModel({ code, compact })
  const rulerModel = transportRouteModel.surfaceModel.rulerModel.ruler
  return (
    <TimelineVideoSequenceEmptyState
      compact={compact}
      maxMinutes={Math.max(1, rulerModel.maxMinutes)}
      onDropMedia={rulerModel.onDropMedia}
    />
  )
}

export function TimelineBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const markdownDocumentText = useGraphStore(state => state.markdownDocumentText)
  const { code: timelineCode, graphData, themeMode, timelineModel } = useMermaidTimelineDocument()
  const { code: ganttCode } = useMermaidGanttDocument()
  const videoSequenceModel = React.useMemo(() => readVideoSequenceTimelineModelFromMarkdown(markdownDocumentText), [markdownDocumentText])
  const { handleDiagramSelectedRowKeyChange } = useStoryboardWidgetDiagramSelectionBridge({
    graphData,
    diagramModel: timelineModel,
    kind: 'timeline',
  })
  if ((videoSequenceModel?.enabled || !timelineCode) && ganttCode) {
    return <GanttTimelineTransportPanel code={ganttCode} compact={compact} />
  }
  if (!timelineCode) {
    return <TimelineVideoSequenceEmptyDropState code={ganttCode} compact={compact} />
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
