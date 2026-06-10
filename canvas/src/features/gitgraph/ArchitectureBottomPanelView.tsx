import React from 'react'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useMermaidStructuredDiagramDocument } from './useMermaidStructuredDiagramDocument'

export function ArchitectureBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code, model, themeMode } = useMermaidStructuredDiagramDocument('architecture')
  return (
    <MermaidDiagramPanelView
      code={code}
      model={model}
      kind="architecture"
      title="Architecture"
      emptyLabel="No Architecture Mermaid frontmatter."
      rootThemeMode={themeMode}
      compact={compact}
      surface="bottomPanel"
      renderMode="diagram"
    />
  )
}
