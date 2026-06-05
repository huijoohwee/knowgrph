import React from 'react'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'

export function GanttBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code, ganttModel, themeMode } = useMermaidGanttDocument()
  return (
    <MermaidDiagramPanelView
      code={code}
      model={ganttModel}
      kind="gantt"
      title="Gantt"
      emptyLabel="No Gantt Mermaid frontmatter."
      rootThemeMode={themeMode}
      compact={compact}
      surface="bottomPanel"
      renderMode="diagram"
    />
  )
}
