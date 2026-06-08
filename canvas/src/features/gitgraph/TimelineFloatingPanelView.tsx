import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useFlowEditorDiagramSelectionBridge } from './useFlowEditorDiagramSelectionBridge'
import { useMermaidTimelineDocument } from './useMermaidTimelineDocument'

export function TimelineFloatingPanelView() {
  const { code, graphData, themeMode, timelineModel } = useMermaidTimelineDocument()
  const { handleDiagramSelectedRowKeyChange } = useFlowEditorDiagramSelectionBridge({
    graphData,
    diagramModel: timelineModel,
    kind: 'timeline',
  })
  return (
    <section className="h-full min-h-0" data-kg-timeline-floating-panel="1">
      <MermaidDiagramPanelView
        code={code}
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
