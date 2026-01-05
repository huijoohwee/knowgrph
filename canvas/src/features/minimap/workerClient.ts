import { computeGraphBounds } from '@/features/minimap/math'
import { buildEdgesPathD, buildNodesPathD } from '@/features/minimap/renderer'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'

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
}

type PreviewResponse = { ok: boolean; data?: MinimapPreviewData; error?: string }

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
  const edgesPath = E.length > EDGE_LIMIT ? '' : buildEdgesPathD(N, E, bounds, sx)
  const nodesPath = buildNodesPathD(N, bounds, sx, 3)
  return { nodesPath, edgesPath, sx, bounds }
}

export function computeMinimapPreviewInWorker(
  nodes: NodeLite[],
  edges: EdgeLite[],
  opts?: MinimapPreviewOptions,
): Promise<MinimapPreviewData | null> {
  try {
    const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
    const isOffline = typeof navigator !== 'undefined' && navigator && 'onLine' in navigator && !navigator.onLine
    const hasWorker = typeof Worker !== 'undefined'
    if (isDev || isOffline || !hasWorker) {
      return Promise.resolve(computeMinimapPreviewSync(nodes, edges, opts))
    }
    const worker = new Worker(new URL('../../workers/minimap.worker.ts', import.meta.url), { type: 'module' })
    return new Promise<MinimapPreviewData | null>((resolve) => {
      const cleanup = () => { try { worker.terminate() } catch { void 0 } }
      worker.onmessage = (e: MessageEvent<PreviewResponse>) => {
        const { ok, data } = e.data || { ok: false as const }
        cleanup()
        resolve(ok && data ? data : null)
      }
      worker.onerror = () => { cleanup(); resolve(null) }
      worker.postMessage({ type: 'preview', nodes, edges, ...(opts || {}) })
    })
  } catch {
    try { return Promise.resolve(computeMinimapPreviewSync(nodes, edges, opts)) } catch { return Promise.resolve(null) }
  }
}

export function computeMinimapPreviewInWorkerWithHandle(
  nodes: NodeLite[],
  edges: EdgeLite[],
  opts?: MinimapPreviewOptions,
): { worker: Worker | null; promise: Promise<MinimapPreviewData | null> } {
  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
  const isOffline = typeof navigator !== 'undefined' && navigator && 'onLine' in navigator && !navigator.onLine
  const hasWorker = typeof Worker !== 'undefined'
  if (isDev || isOffline || !hasWorker) {
    const result = computeMinimapPreviewSync(nodes, edges, opts)
    const promise = Promise.resolve(result)
    return { worker: null, promise }
  }
  const worker = new Worker(new URL('../../workers/minimap.worker.ts', import.meta.url), { type: 'module' })
  const promise = new Promise<MinimapPreviewData | null>((resolve) => {
    const finish = (val: MinimapPreviewData | null) => { try { worker.terminate() } catch { void 0 } ; resolve(val) }
    worker.onmessage = (e: MessageEvent<PreviewResponse>) => {
      const { ok, data } = e.data || { ok: false as const }
      finish(ok && data ? data : null)
    }
    worker.onerror = () => finish(null)
    worker.postMessage({ type: 'preview', nodes, edges, ...(opts || {}) })
  })
  return { worker, promise }
}
