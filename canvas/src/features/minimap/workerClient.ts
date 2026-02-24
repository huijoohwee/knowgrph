import { computeGraphBounds } from '@/features/minimap/math'
import { buildEdgesPathD, buildNodesPathD } from '@/features/minimap/renderer'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import { requestFromSingletonWorker } from '@/lib/workers/singletonWorkerClient'

type NodeLite = Pick<GraphNode, 'id' | 'x' | 'y'>
type EdgeLite = Pick<GraphEdge, 'id' | 'source' | 'target'>

export type MinimapPreviewBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export type MinimapPreviewData = {
  nodesPath: string
  edgesPath: string
  sx: number
  bounds: MinimapPreviewBounds
}

export type MinimapPreviewOptions = {
  pad?: number
  miniW?: number
  miniH?: number
  edgeLimit?: number
  graphId?: string | number
}

type PreviewResponse = { id: number; ok: boolean; value: MinimapPreviewData; error?: string }

function computeMinimapPreviewSync(
  nodes: NodeLite[],
  edges: EdgeLite[],
  opts?: MinimapPreviewOptions,
): MinimapPreviewData {
  const N = Array.isArray(nodes) ? nodes : []
  const E = Array.isArray(edges) ? edges : []
  const pad = typeof opts?.pad === 'number' ? opts.pad : 20
  const miniW = typeof opts?.miniW === 'number' ? opts.miniW : 160
  const miniH = typeof opts?.miniH === 'number' ? opts.miniH : 120
  const bounds = computeGraphBounds(N, pad)
  const scaleX = miniW / Math.max(1, bounds.width)
  const scaleY = miniH / Math.max(1, bounds.height)
  const sx = Math.min(scaleX, scaleY)
  const EDGE_LIMIT = typeof opts?.edgeLimit === 'number' ? opts.edgeLimit : 20000
  const edgesPath = E.length > EDGE_LIMIT ? '' : buildEdgesPathD(N, E, bounds, sx, opts?.graphId)
  const nodesPath = buildNodesPathD(N, bounds, sx, 3, opts?.graphId)
  return { nodesPath, edgesPath, sx, bounds }
}

export function computeMinimapPreviewInWorker(
  nodes: NodeLite[],
  edges: EdgeLite[],
  opts?: MinimapPreviewOptions,
  signal?: AbortSignal,
): Promise<MinimapPreviewData | null> {
  try {
    const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
    const isOffline = typeof navigator !== 'undefined' && navigator && 'onLine' in navigator && !navigator.onLine
    const hasWorker = typeof Worker !== 'undefined'
    if (isDev || isOffline || !hasWorker) {
      return Promise.resolve(computeMinimapPreviewSync(nodes, edges, opts))
    }
    return requestFromSingletonWorker<MinimapPreviewData | null>({
      globalStateKey: '__KG_MINIMAP_WORKER__',
      createWorker: () => new Worker(new URL('../../workers/minimap.worker.ts', import.meta.url), { type: 'module' }),
      timeoutMs: 12_000,
      signal,
      postMessage: (worker, id) => {
        worker.postMessage({ type: 'preview', id, nodes, edges, ...(opts || {}) })
      },
      readResponse: (data) => {
        const d = data as PreviewResponse | null | undefined
        if (!d || typeof d !== 'object') return null
        if (typeof d.id !== 'number') return null
        if (typeof d.ok !== 'boolean') return null
        return { id: d.id, ok: d.ok, value: d.ok ? d.value : null, error: d.error }
      },
    })
  } catch {
    try { return Promise.resolve(computeMinimapPreviewSync(nodes, edges, opts)) } catch { return Promise.resolve(null) }
  }
}
