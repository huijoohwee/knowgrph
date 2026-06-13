import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useMermaidStructuredDiagramDocument } from './useMermaidStructuredDiagramDocument'

export function FlowchartBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code, model, themeMode } = useMermaidStructuredDiagramDocument('flowchart')
  return (
    <MermaidDiagramPanelView
      code={code}
      model={model}
      kind="flowchart"
      title="Flowchart"
      emptyLabel="No Flowchart Mermaid frontmatter."
      rootThemeMode={themeMode}
      compact={compact}
      surface="bottomPanel"
      renderMode="diagram"
    />
  )
}
