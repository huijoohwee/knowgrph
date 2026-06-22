import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useFlowEditorDiagramSelectionBridge } from './useFlowEditorDiagramSelectionBridge'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'
import { useMermaidTimelineDocument } from './useMermaidTimelineDocument'

export function TimelineFloatingPanelView() {
  const { code: timelineCode, graphData, themeMode, timelineModel } = useMermaidTimelineDocument()
  const { code: ganttCode, ganttModel, themeMode: ganttThemeMode } = useMermaidGanttDocument()
  const { handleDiagramSelectedRowKeyChange } = useFlowEditorDiagramSelectionBridge({
    graphData,
    diagramModel: timelineModel,
    kind: 'timeline',
  })
  if (!timelineCode && ganttCode) {
    return (
      <section className="h-full min-h-0" data-kg-timeline-floating-panel="1">
        <MermaidDiagramPanelView
          code={ganttCode}
          model={ganttModel}
          kind="gantt"
          title="Gantt-Timeline"
          emptyLabel="No Gantt-Timeline Mermaid frontmatter."
          rootThemeMode={ganttThemeMode}
          surface="floatingPanel"
          renderMode="list"
        />
      </section>
    )
  }
  return (
    <section className="h-full min-h-0" data-kg-timeline-floating-panel="1">
      <MermaidDiagramPanelView
        code={timelineCode}
        model={timelineModel}
        kind="timeline"
        title="Timeline"
        emptyLabel="No Timeline Mermaid frontmatter."
        rootThemeMode={themeMode}
        surface="floatingPanel"
        renderMode="list"
        onSelectedRowKeyChange={handleDiagramSelectedRowKeyChange}
      />
    </section>
  )
}
