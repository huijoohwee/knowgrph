import type { GraphData } from '@/lib/graph/types'
import { GRAPH_DATA_LS_PERSIST_MAX_EDGES, GRAPH_DATA_LS_PERSIST_MAX_NODES, LS_KEYS } from '@/lib/config'
import { lsSetJsonCoalesced } from '@/lib/persistence'

const GRAPH_DATA_LS_PERSIST_DELAY_MS = 160

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
    lsSetJsonCoalesced(LS_KEYS.graphData, graphData, { delayMs: GRAPH_DATA_LS_PERSIST_DELAY_MS })
  } catch {
    void 0
  }
}
