import React from 'react'
import { useActiveGraphData } from '@/hooks/useActiveGraphData'
import type { GraphData } from '@/lib/graph/types'
import BottomPanelCuratorTab from '@/components/BottomPanel/BottomPanelCuratorTab'

export default function GraphDataTableWorkspace() {
  const graph = useActiveGraphData() as GraphData | null
  const nodes = React.useMemo(() => (graph?.nodes ?? []), [graph])
  const edges = React.useMemo(() => (graph?.edges ?? []), [graph])

  return (
    <main className="flex-1 min-h-0 overflow-hidden" aria-label="Graph Data Table Workspace">
      <article className="h-full min-h-0 overflow-hidden" aria-label="Graph Data Table">
        <BottomPanelCuratorTab nodes={nodes} edges={edges} />
      </article>
    </main>
  )
}

