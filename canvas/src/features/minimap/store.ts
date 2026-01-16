import { computeGraphBounds, MINIMAP_HEIGHT, MINIMAP_WIDTH } from '@/features/minimap/math'
import { buildEdgesPathD, buildNodesPathD } from '@/features/minimap/renderer'
import { computeMinimapPreviewInWorkerWithHandle } from '@/features/minimap/workerClient'
import type { GraphState } from '@/hooks/useGraphStore'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { StoreApi } from 'zustand'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

const EDGE_LIMIT = 20000

export const createMinimapSlice = (set: SetGraph, get: GetGraph) => ({
  minimapPreview: {
    nodesPath: '',
    edgesPath: '',
    sx: 1,
    bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 },
  } as { nodesPath: string; edgesPath: string; sx: number; bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } },
  minimapWorkerRef: null as Worker | null,

  cancelMinimapWorker: () => {
    const w = get().minimapWorkerRef as Worker | null
    if (w) {
      try { w.terminate() } catch { void 0 }
      set({ minimapWorkerRef: null })
    }
  },

  computeMinimapPreviewQuick: () => {
    const { graphData, graphId } = get()
    const nodesAll = (graphData?.nodes || []) as GraphNode[]
    const edgesAll = (graphData?.edges || []) as GraphEdge[]
    const bounds = computeGraphBounds(nodesAll, 20)
    const miniW = MINIMAP_WIDTH
    const miniH = MINIMAP_HEIGHT
    const scaleX = miniW / Math.max(1, bounds.width)
    const scaleY = miniH / Math.max(1, bounds.height)
    const sx = Math.min(scaleX, scaleY)
    const edgesPath = edgesAll.length > EDGE_LIMIT ? '' : buildEdgesPathD(nodesAll, edgesAll, bounds, sx, graphId ?? '')
    const nodesPath = buildNodesPathD(nodesAll, bounds, sx, 3, graphId ?? '')
    set({ minimapPreview: { nodesPath, edgesPath, sx, bounds } })
    set({ lifecycleStage: 'minimapQuick' })
  },

  computeMinimapPreviewAsync: () => {
    const hasIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window
    const idle = hasIdleCallback
      ? (cb: () => void) => (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(cb)
      : (cb: () => void) => window.setTimeout(cb, 0)
    idle(() => {
      get().cancelMinimapWorker();
      const { graphData, graphId } = get()
      const nodes = (graphData?.nodes || []) as GraphNode[]
      const edges = (graphData?.edges || []) as GraphEdge[]
      const { worker, promise } = computeMinimapPreviewInWorkerWithHandle(nodes, edges, { pad: 20, miniW: MINIMAP_WIDTH, miniH: MINIMAP_HEIGHT, edgeLimit: EDGE_LIMIT })
      set({ minimapWorkerRef: worker })
      promise.then((res) => {
        // If a newer worker is registered, ignore this result
        const current = get().minimapWorkerRef
        if (current && current !== worker) return;
        set({ minimapWorkerRef: null })
        if (res) {
          set({ minimapPreview: res })
          set({ lifecycleStage: 'minimapAsync' })
          return
        }
        const bounds = computeGraphBounds(nodes, 20)
        const miniW = MINIMAP_WIDTH
        const miniH = MINIMAP_HEIGHT
        const scaleX = miniW / Math.max(1, bounds.width)
        const scaleY = miniH / Math.max(1, bounds.height)
        const sx = Math.min(scaleX, scaleY)
        const edgesPath = edges.length > EDGE_LIMIT ? '' : buildEdgesPathD(nodes, edges, bounds, sx, graphId ?? '')
        const nodesPath = buildNodesPathD(nodes, bounds, sx, 3, graphId ?? '')
        set({ minimapPreview: { nodesPath, edgesPath, sx, bounds } })
        set({ lifecycleStage: 'minimapAsync' })
      })
    })
  },
})
