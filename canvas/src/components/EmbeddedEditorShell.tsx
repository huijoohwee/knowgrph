import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MarkdownWorkspace } from './BottomPanel/markdownWorkspace/MarkdownWorkspace'

const GraphTableWorkspaceLazy = React.lazy(() => import('@/features/graph-table/ui/GraphTableWorkspace'))

export function EmbeddedEditorShell() {
  const pane = useGraphStore(s => s.editorWorkspacePane)
  if (pane === 'graphTable') {
    return (
      <React.Suspense fallback={null}>
        <GraphTableWorkspaceLazy />
      </React.Suspense>
    )
  }
  return <MarkdownWorkspace />
}
