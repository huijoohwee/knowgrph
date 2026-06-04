import {
  MINIMAP_EDGE_LIMIT_DEFAULT,
  MINIMAP_GRAPH_PAD_DEFAULT,
  MINIMAP_HEIGHT,
  MINIMAP_NODE_LIMIT_DEFAULT,
  MINIMAP_NODE_SIZE_DEFAULT,
  MINIMAP_WIDTH,
  computeGraphBounds,
  computeMinimapProjection,
} from '@/features/minimap/math'
import { buildEdgesPathD, buildNodesPathD } from '@/features/minimap/renderer'
import { computeMinimapPreviewInWorker } from '@/features/minimap/workerClient'
import type { GraphState } from '@/hooks/useGraphStore'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { StoreApi } from 'zustand'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

const EDGE_LIMIT = MINIMAP_EDGE_LIMIT_DEFAULT
const NODE_LIMIT = MINIMAP_NODE_LIMIT_DEFAULT

function sampleNodes<T>(nodes: T[], limit: number): T[] {
  const max = Math.max(0, Math.floor(limit))
  if (max === 0) return []
  if (nodes.length <= max) return nodes
  const out: T[] = []
  const stride = Math.max(1, Math.floor(nodes.length / max))
  for (let i = 0; i < nodes.length && out.length < max; i += stride) {
    out.push(nodes[i] as T)
  }
  if (out.length >= max) return out
  const seen = new Set(out)
  for (let i = nodes.length - 1; i >= 0 && out.length < max; i -= 1) {
    const n = nodes[i] as T
    if (seen.has(n)) continue
    out.push(n)
  }
  return out
}

export const createMinimapSlice = (set: SetGraph, get: GetGraph) => ({
  minimapPreview: {
    nodesPath: '',
    edgesPath: '',
    sx: 1,
    bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 },
  } as { nodesPath: string; edgesPath: string; sx: number; bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } },
  minimapAbortController: null as AbortController | null,

  cancelMinimapWorker: () => {
    const c = get().minimapAbortController
    if (!c) return
    try { c.abort() } catch { void 0 }
    set({ minimapAbortController: null })
  },

  computeMinimapPreviewQuick: () => {
    const { graphData, graphId } = get()
    const nodesAll = (graphData?.nodes || []) as GraphNode[]
    const edgesAll = (graphData?.edges || []) as GraphEdge[]
    const bounds = computeGraphBounds(nodesAll, MINIMAP_GRAPH_PAD_DEFAULT)
    const miniW = MINIMAP_WIDTH
    const miniH = MINIMAP_HEIGHT
    const { sx } = computeMinimapProjection(bounds, { w: miniW, h: miniH })
    const edgesPath = edgesAll.length > EDGE_LIMIT ? '' : buildEdgesPathD(nodesAll, edgesAll, bounds, sx, graphId ?? '')
    const nodesPath = buildNodesPathD(sampleNodes(nodesAll, NODE_LIMIT), bounds, sx, MINIMAP_NODE_SIZE_DEFAULT, graphId ?? '')
    set({ minimapPreview: { nodesPath, edgesPath, sx, bounds } })
    set({ lifecycleStage: 'minimapQuick' })
  },

  computeMinimapPreviewAsync: () => {
    const hasIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window
    const idle = hasIdleCallback
      ? (cb: () => void) => (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(cb)
      : (cb: () => void) => globalThis.setTimeout(cb, 0)
    idle(() => {
      get().cancelMinimapWorker();
      const { graphData, graphId } = get()
      const nodes = (graphData?.nodes || []) as GraphNode[]
      const edges = (graphData?.edges || []) as GraphEdge[]
      const controller = new AbortController()
      set({ minimapAbortController: controller })
      const promise = computeMinimapPreviewInWorker(
        nodes,
        edges,
        {
          pad: MINIMAP_GRAPH_PAD_DEFAULT,
          miniW: MINIMAP_WIDTH,
          miniH: MINIMAP_HEIGHT,
          edgeLimit: EDGE_LIMIT,
          nodeLimit: NODE_LIMIT,
          graphId: graphId ?? '',
          boundsOverride: get().minimapPreview?.bounds,
        },
        controller.signal,
      )
      promise.then((res) => {
        const current = get().minimapAbortController
        if (current && current !== controller) return;
        set({ minimapAbortController: null })
        if (res) {
          set({ minimapPreview: res })
          set({ lifecycleStage: 'minimapAsync' })
          return
        }
        const bounds = computeGraphBounds(nodes, MINIMAP_GRAPH_PAD_DEFAULT)
        const miniW = MINIMAP_WIDTH
        const miniH = MINIMAP_HEIGHT
        const { sx } = computeMinimapProjection(bounds, { w: miniW, h: miniH })
        const edgesPath = edges.length > EDGE_LIMIT ? '' : buildEdgesPathD(nodes, edges, bounds, sx, graphId ?? '')
        const nodesPath = buildNodesPathD(sampleNodes(nodes, NODE_LIMIT), bounds, sx, MINIMAP_NODE_SIZE_DEFAULT, graphId ?? '')
        set({ minimapPreview: { nodesPath, edgesPath, sx, bounds } })
        set({ lifecycleStage: 'minimapAsync' })
      })
    })
  },
})
