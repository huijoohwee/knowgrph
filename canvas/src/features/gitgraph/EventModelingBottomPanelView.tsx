import React from 'react'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useMermaidStructuredDiagramDocument } from './useMermaidStructuredDiagramDocument'

export function EventModelingBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code, model, themeMode } = useMermaidStructuredDiagramDocument('eventmodeling')
  return (
    <MermaidDiagramPanelView
      code={code}
      model={model}
      kind="eventmodeling"
      title="Event Model"
      emptyLabel="No Event Modeling Mermaid frontmatter."
      rootThemeMode={themeMode}
      compact={compact}
      surface="bottomPanel"
      renderMode="diagram"
    />
  )
}
