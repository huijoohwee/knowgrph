import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useMermaidStructuredDiagramDocument } from './useMermaidStructuredDiagramDocument'

export function ArchitectureFloatingPanelView() {
  const { code, model, themeMode } = useMermaidStructuredDiagramDocument('architecture')
  return (
    <section className="h-full min-h-0" data-kg-architecture-floating-panel="1">
      <MermaidDiagramPanelView
        code={code}
        model={model}
        kind="architecture"
        title="Architecture"
        emptyLabel="No Architecture Mermaid frontmatter."
        rootThemeMode={themeMode}
        surface="floatingPanel"
        renderMode="list"
      />
    </section>
  )
}
