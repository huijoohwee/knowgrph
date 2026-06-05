import React from 'react'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useMermaidGitGraphDocument } from './useMermaidGitGraphDocument'
import { parseMermaidDiagramCodeModel } from '@/lib/mermaid/mermaidDiagramCode'

export function GitGraphBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code, themeMode } = useMermaidGitGraphDocument()
  const model = React.useMemo(() => parseMermaidDiagramCodeModel(code, 'gitgraph'), [code])

  return (
    <MermaidDiagramPanelView
      code={code}
      model={model}
      kind="gitgraph"
      title="GitGraph"
      emptyLabel="No GitGraph Mermaid frontmatter."
      rootThemeMode={themeMode}
      compact={compact}
      surface="bottomPanel"
      renderMode="diagram"
    />
  )
}
