import type { GraphData } from '@/lib/graph/types'
import { GRAPH_DATA_LS_PERSIST_MAX_EDGES, GRAPH_DATA_LS_PERSIST_MAX_NODES, LS_KEYS } from '@/lib/config'
import { lsSetJson } from '@/lib/persistence'

export function shouldPersistGraphDataToLocalStorage(graphData: GraphData | null): boolean {
  if (!graphData) return true
  const nodesLen = (graphData.nodes || []).length
  const edgesLen = (graphData.edges || []).length
  if (nodesLen > GRAPH_DATA_LS_PERSIST_MAX_NODES) return false
  if (edgesLen > GRAPH_DATA_LS_PERSIST_MAX_EDGES) return false
  return true
}

export function persistGraphDataToLocalStorage(graphData: GraphData | null): void {
  try {
    if (!shouldPersistGraphDataToLocalStorage(graphData)) return
    lsSetJson(LS_KEYS.graphData, graphData)
  } catch {
    void 0
  }
}

