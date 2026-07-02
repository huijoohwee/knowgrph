import React from 'react'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useStoryboardWidgetDiagramSelectionBridge } from './useStoryboardWidgetDiagramSelectionBridge'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'

export function GanttBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code, ganttModel, graphData, themeMode } = useMermaidGanttDocument()
  const { handleDiagramSelectedRowKeyChange } = useStoryboardWidgetDiagramSelectionBridge({
    graphData,
    diagramModel: ganttModel,
    kind: 'gantt',
  })
  return (
    <MermaidDiagramPanelView
      code={code}
      model={ganttModel}
      kind="gantt"
      title="Gantt-Timeline"
      emptyLabel="No Gantt-Timeline Mermaid frontmatter."
      rootThemeMode={themeMode}
      compact={compact}
      surface="bottomPanel"
      renderMode="diagram"
      onSelectedRowKeyChange={handleDiagramSelectedRowKeyChange}
    />
  )
}
