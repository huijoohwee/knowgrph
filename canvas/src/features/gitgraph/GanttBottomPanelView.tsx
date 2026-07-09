import React from 'react'
import { GanttTimelineTransportPanel } from './GanttTimelineTransportPanel'
import { useStoryboardWidgetDiagramSelectionBridge } from './useStoryboardWidgetDiagramSelectionBridge'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'

export function GanttBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code: workflowGanttCode, ganttModel, graphData } = useMermaidGanttDocument({ purpose: 'workflow' })
  const { handleDiagramSelectedRowKeyChange } = useStoryboardWidgetDiagramSelectionBridge({
    graphData,
    diagramModel: ganttModel,
    kind: 'gantt',
  })
  return (
    <GanttTimelineTransportPanel
      code={workflowGanttCode}
      compact={compact}
      mode="workflow"
      onSelectedRowKeyChange={handleDiagramSelectedRowKeyChange}
    />
  )
}
