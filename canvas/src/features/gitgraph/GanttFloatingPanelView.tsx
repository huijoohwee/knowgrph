import React from 'react'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'

export function GanttFloatingPanelView() {
  const { code, ganttModel, themeMode } = useMermaidGanttDocument()
  return (
    <section className="h-full min-h-0" data-kg-gantt-floating-panel="1">
      <MermaidDiagramPanelView
        code={code}
        model={ganttModel}
        kind="gantt"
        title="Gantt-Timeline"
        emptyLabel="No Gantt-Timeline Mermaid frontmatter."
        rootThemeMode={themeMode}
        surface="floatingPanel"
        renderMode="list"
      />
    </section>
  )
}
