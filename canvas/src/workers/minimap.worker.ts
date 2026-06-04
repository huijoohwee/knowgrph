import {
  MINIMAP_EDGE_LIMIT_DEFAULT,
  MINIMAP_GRAPH_PAD_DEFAULT,
  MINIMAP_HEIGHT,
  MINIMAP_NODE_SIZE_DEFAULT,
  MINIMAP_WIDTH,
  computeGraphBounds,
  computeMinimapProjection,
} from '@/features/minimap/math'
import { buildEdgesPathD, buildNodesPathD } from '@/features/minimap/renderer'

type NodeLite = { id: string; x?: number; y?: number; width?: number; height?: number };
type EdgeLite = { id: string; source: string; target: string };
type BoundsLite = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
type PreviewRequest = { type: 'preview'; id: number; nodes: NodeLite[]; edges: EdgeLite[]; pad?: number; miniW?: number; miniH?: number; edgeLimit?: number; graphId?: string | number; boundsOverride?: BoundsLite };
type PreviewValue = { nodesPath: string; edgesPath: string; sx: number; bounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } };
type PreviewResponse = { id: number; ok: boolean; value: PreviewValue; error?: string };

self.onmessage = (e: MessageEvent<PreviewRequest>) => {
  const msg = e.data
  if (!msg || msg.type !== 'preview' || typeof msg.id !== 'number') return
  try {
    const nodes = Array.isArray(msg.nodes) ? msg.nodes : []
    const edges = Array.isArray(msg.edges) ? msg.edges : []
    const pad = typeof msg.pad === 'number' ? msg.pad : MINIMAP_GRAPH_PAD_DEFAULT
    const miniW = typeof msg.miniW === 'number' ? msg.miniW : MINIMAP_WIDTH
    const miniH = typeof msg.miniH === 'number' ? msg.miniH : MINIMAP_HEIGHT
    const bounds = msg.boundsOverride || computeGraphBounds(nodes, pad)
    const { sx } = computeMinimapProjection(bounds, { w: miniW, h: miniH })
    const EDGE_LIMIT = typeof msg.edgeLimit === 'number' ? msg.edgeLimit : MINIMAP_EDGE_LIMIT_DEFAULT
    const edgesPath = edges.length > EDGE_LIMIT ? '' : buildEdgesPathD(nodes, edges, bounds, sx, msg.graphId)
    const nodesPath = buildNodesPathD(nodes, bounds, sx, MINIMAP_NODE_SIZE_DEFAULT, msg.graphId)
    const global = self as unknown as { postMessage: (data: PreviewResponse) => void }
    global.postMessage({ id: msg.id, ok: true, value: { nodesPath, edgesPath, sx, bounds } } as PreviewResponse)
  } catch (err) {
    const global = self as unknown as { postMessage: (data: PreviewResponse) => void }
    const msg = String((err as Error)?.message || err as unknown as string)
    global.postMessage({ id: (e.data && typeof e.data.id === 'number') ? e.data.id : -1, ok: false, value: null as unknown as PreviewValue, error: msg } as PreviewResponse)
  }
}
