import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData } from '@/lib/graph/types'

export function useStoryboardEdgeCreationRequest(args: {
  active: boolean
  beginEdge: (nodeId: string, portKey?: string | null) => void
  graphData: GraphData | null
}) {
  const { active, beginEdge, graphData } = args
  React.useEffect(() => {
    if (!active) return
    const consumeRequest = () => {
      const state = useGraphStore.getState()
      const request = state.edgeCreationRequest
      if (!request || request.type !== 'create') return
      const sourceId = String(request.fromId || '').trim()
      if (!sourceId || !resolveGraphNodeByCanonicalId(graphData, sourceId)) return
      beginEdge(sourceId, null)
      state.clearEdgeCreationRequest()
    }
    consumeRequest()
    return useGraphStore.subscribe(state => state.edgeCreationRequest, consumeRequest)
  }, [active, beginEdge, graphData])
}
