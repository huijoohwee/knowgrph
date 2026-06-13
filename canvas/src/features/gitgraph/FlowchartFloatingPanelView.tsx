import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useMermaidStructuredDiagramDocument } from './useMermaidStructuredDiagramDocument'

export function FlowchartFloatingPanelView() {
  const { code, model, themeMode } = useMermaidStructuredDiagramDocument('flowchart')
  return (
    <section className="h-full min-h-0" data-kg-flowchart-floating-panel="1">
      <MermaidDiagramPanelView
        code={code}
        model={model}
        kind="flowchart"
        title="Flowchart"
        emptyLabel="No Flowchart Mermaid frontmatter."
        rootThemeMode={themeMode}
        surface="floatingPanel"
        renderMode="list"
      />
    </section>
  )
}
