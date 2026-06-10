import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useMermaidStructuredDiagramDocument } from './useMermaidStructuredDiagramDocument'

export function EventModelingFloatingPanelView() {
  const { code, model, themeMode } = useMermaidStructuredDiagramDocument('eventmodeling')
  return (
    <section className="h-full min-h-0" data-kg-event-modeling-floating-panel="1">
      <MermaidDiagramPanelView
        code={code}
        model={model}
        kind="eventmodeling"
        title="Event Model"
        emptyLabel="No Event Modeling Mermaid frontmatter."
        rootThemeMode={themeMode}
        surface="floatingPanel"
        renderMode="split"
      />
    </section>
  )
}
