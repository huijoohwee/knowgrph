import { useEffect } from 'react'
import { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  startEdgeFromNode,
  startUpdateEdgeEndpoint,
  PendingLink,
  TempLinkSelection,
} from '@/features/edge-creation'

interface UseEdgeCreationEffectProps {
  paused?: boolean
  tempLinkSelRef: React.MutableRefObject<TempLinkSelection>
  linkDragRef: React.MutableRefObject<PendingLink | null>
}

export function useEdgeCreationEffect({
  paused,
  tempLinkSelRef,
  linkDragRef,
}: UseEdgeCreationEffectProps) {
  useEffect(() => {
    if (paused) return
    const unsub = useGraphStore.subscribe(
      s => s.edgeCreationRequest,
      edgeCreationRequest => {
        const state = useGraphStore.getState()
        const graphData = state.graphData as GraphData | null
        if (!edgeCreationRequest || !graphData) return
        const n = graphData.nodes.find(x => x.id === edgeCreationRequest.fromId)
        if (!n) {
          state.clearEdgeCreationRequest()
          return
        }
        if (edgeCreationRequest.type === 'create') {
          startEdgeFromNode(n, tempLinkSelRef, linkDragRef)
          state.clearEdgeCreationRequest()
          return
        }
        const selectedEdgeId = state.selectedEdgeId
        const sel = selectedEdgeId ? graphData.edges.find(e => e.id === selectedEdgeId) : null
        if (sel) {
          startUpdateEdgeEndpoint(
            sel,
            n,
            edgeCreationRequest.type,
            tempLinkSelRef,
            linkDragRef,
            id => state.selectEdge(id),
            src => state.setSelectionSource(src),
          )
        } else {
          startEdgeFromNode(n, tempLinkSelRef, linkDragRef)
        }
        state.clearEdgeCreationRequest()
      },
    )
    return () => {
      unsub()
    }
  }, [paused, tempLinkSelRef, linkDragRef])
}
