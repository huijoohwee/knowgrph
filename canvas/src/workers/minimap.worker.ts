import { computeGraphBounds } from '@/features/minimap/math'
import { buildEdgesPathD, buildNodesPathD } from '@/features/minimap/renderer'

type NodeLite = { id: string; x?: number; y?: number };
type EdgeLite = { id: string; source: string; target: string };
type PreviewRequest = { type: 'preview'; nodes: NodeLite[]; edges: EdgeLite[]; pad?: number; miniW?: number; miniH?: number; edgeLimit?: number };
type PreviewResponse = { ok: boolean; data?: { nodesPath: string; edgesPath: string; sx: number; bounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } }; error?: string };

self.onmessage = (e: MessageEvent<PreviewRequest>) => {
  const msg = e.data
  if (!msg || msg.type !== 'preview') return
  try {
    const nodes = Array.isArray(msg.nodes) ? msg.nodes : []
    const edges = Array.isArray(msg.edges) ? msg.edges : []
    const pad = typeof msg.pad === 'number' ? msg.pad : 20
    const miniW = typeof msg.miniW === 'number' ? msg.miniW : 160
    const miniH = typeof msg.miniH === 'number' ? msg.miniH : 120
    const bounds = computeGraphBounds(nodes, pad)
    const scaleX = miniW / Math.max(1, bounds.width)
    const scaleY = miniH / Math.max(1, bounds.height)
    const sx = Math.min(scaleX, scaleY)
    const EDGE_LIMIT = typeof msg.edgeLimit === 'number' ? msg.edgeLimit : 20000
    const edgesPath = edges.length > EDGE_LIMIT ? '' : buildEdgesPathD(nodes, edges, bounds, sx)
    const nodesPath = buildNodesPathD(nodes, bounds, sx, 3)
    const global = self as unknown as DedicatedWorkerGlobalScope;
    global.postMessage({ ok: true, data: { nodesPath, edgesPath, sx, bounds } } as PreviewResponse)
  } catch (err) {
    const global = self as unknown as DedicatedWorkerGlobalScope;
    const msg = String((err as Error)?.message || err as unknown as string)
    global.postMessage({ ok: false, error: msg } as PreviewResponse)
  }
}
