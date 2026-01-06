import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveGraphDataForLayers } from '@/lib/graph/layerDerivation'
import { normalizeSelectionIds } from '@/components/GraphCanvas/highlight'
import { buildSelectionSubgraphForAnchorIds } from '@/lib/graph/file'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { SelectionSnapshot } from '@/components/BottomPanel/stats/types'

export function useStatsSelection() {
  const data = useGraphStore(s => s.graphData)
  const schema = useGraphStore(s => s.schema) as GraphSchema
  const zoomK = useGraphStore(s => s.zoomState?.k ?? 1)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds || [])
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds || [])

  const derivedGraph = React.useMemo(
    () => deriveGraphDataForLayers(data as GraphData | null, schema),
    [data, schema],
  )

  const polygonSelectionSnapshotRef = React.useRef<SelectionSnapshot | null>(null)
  const edgeSelectionSnapshotRef = React.useRef<SelectionSnapshot | null>(null)
  const communitySelectionSnapshotRef = React.useRef<SelectionSnapshot | null>(null)

  const [pinnedPolygonId, setPinnedPolygonId] = React.useState<string | null>(null)
  const [pinnedEdgeId, setPinnedEdgeId] = React.useState<string | null>(null)
  const [pinnedCommunityId, setPinnedCommunityId] = React.useState<number | null>(null)

  const selectionInputsForStats = React.useMemo(() => {
    const snap =
      pinnedPolygonId != null
        ? polygonSelectionSnapshotRef.current
        : pinnedEdgeId != null
          ? edgeSelectionSnapshotRef.current
          : pinnedCommunityId != null
            ? communitySelectionSnapshotRef.current
            : null
    if (snap) return snap
    return { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds }
  }, [pinnedCommunityId, pinnedEdgeId, pinnedPolygonId, selectedEdgeId, selectedEdgeIds, selectedNodeId, selectedNodeIds])

  const selectionSubgraph = React.useMemo<GraphData | null>(() => {
    const graph = derivedGraph as GraphData | null
    if (!graph) return null
    const selectionAnchorIds = normalizeSelectionIds({
      selectedNodeId: selectionInputsForStats.selectedNodeId,
      selectedEdgeId: selectionInputsForStats.selectedEdgeId,
      selectedNodeIds: selectionInputsForStats.selectedNodeIds,
      selectedEdgeIds: selectionInputsForStats.selectedEdgeIds,
    })
    if (selectionAnchorIds.selectionNodeIds.length === 0 && selectionAnchorIds.selectionEdgeIds.length === 0) {
      return null
    }
    return buildSelectionSubgraphForAnchorIds(graph, selectionAnchorIds)
  }, [derivedGraph, selectionInputsForStats])

  const hasSelectionSubgraph = !!(
    selectionSubgraph &&
    Array.isArray(selectionSubgraph.nodes) &&
    selectionSubgraph.nodes.length > 0 &&
    Array.isArray(selectionSubgraph.edges)
  )

  const [statsScope, setStatsScope] = React.useState<'auto' | 'dataset' | 'selection'>('auto')
  const [statsLod, setStatsLod] = React.useState<'auto' | 'low' | 'medium' | 'high'>('auto')

  const effectiveGraph = React.useMemo<GraphData | null>(() => {
    const graph = derivedGraph as GraphData | null
    if (!graph) return null
    if (statsScope === 'dataset') return graph
    if (statsScope === 'selection') return selectionSubgraph && hasSelectionSubgraph ? selectionSubgraph : graph
    if (statsScope === 'auto' && hasSelectionSubgraph && selectionSubgraph) return selectionSubgraph
    return graph
  }, [derivedGraph, hasSelectionSubgraph, selectionSubgraph, statsScope])

  const effectiveLod: 'low' | 'medium' | 'high' = React.useMemo(() => {
    if (statsLod === 'low' || statsLod === 'medium' || statsLod === 'high') return statsLod
    if (zoomK < 0.7) return 'low'
    if (zoomK < 1.5) return 'medium'
    return 'high'
  }, [statsLod, zoomK])

  const captureSelectionSnapshot = React.useCallback(() => {
    const st = useGraphStore.getState()
    return {
      selectedNodeId: st.selectedNodeId,
      selectedEdgeId: st.selectedEdgeId,
      selectedNodeIds: st.selectedNodeIds || [],
      selectedEdgeIds: st.selectedEdgeIds || [],
    }
  }, [])

  const restoreSelectionSnapshot = React.useCallback((snap: SelectionSnapshot | null) => {
    if (!snap) return
    useGraphStore.setState({
      selectedNodeId: snap.selectedNodeId,
      selectedEdgeId: snap.selectedEdgeId,
      selectedNodeIds: snap.selectedNodeIds,
      selectedEdgeIds: snap.selectedEdgeIds,
    })
  }, [])

  const selectNodeIds = React.useCallback((nodeIds: string[]) => {
    const unique = Array.from(new Set((nodeIds || []).map(String))).filter(Boolean)
    const active = unique.length ? unique[0] : null
    const st = useGraphStore.getState()
    st.setSelectionSource('table')
    useGraphStore.setState({
      selectedNodeId: active,
      selectedEdgeId: null,
      selectedNodeIds: unique,
      selectedEdgeIds: [],
    })
  }, [])

  const selectEdgeIds = React.useCallback((edgeIds: string[]) => {
    const unique = Array.from(new Set((edgeIds || []).map(String))).filter(Boolean)
    const active = unique.length ? unique[0] : null
    const st = useGraphStore.getState()
    st.setSelectionSource('table')
    useGraphStore.setState({
      selectedNodeId: null,
      selectedEdgeId: active,
      selectedNodeIds: [],
      selectedEdgeIds: unique,
    })
  }, [])

  return {
    data,
    schema,
    effectiveGraph,
    statsScope,
    setStatsScope,
    statsLod,
    setStatsLod,
    effectiveLod,
    pinnedPolygonId,
    setPinnedPolygonId,
    pinnedEdgeId,
    setPinnedEdgeId,
    pinnedCommunityId,
    setPinnedCommunityId,
    polygonSelectionSnapshotRef,
    edgeSelectionSnapshotRef,
    communitySelectionSnapshotRef,
    captureSelectionSnapshot,
    restoreSelectionSnapshot,
    selectNodeIds,
    selectEdgeIds,
  }
}
