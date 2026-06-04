import { LRUCache } from '@/lib/cache/LRUCache'
import { hashSignatureParts } from '@/lib/hash/signature'
import { readMinimapNodeCenter, readMinimapNodeExtent, type MinimapBounds } from '@/features/minimap/math'

type NodeLite = { id: string; x?: number; y?: number; width?: number; height?: number };
type EdgeLite = { id: string; source: string; target: string };

const edgePathCache = new LRUCache<string, string>(300, 60 * 1000)
const nodePathCache = new LRUCache<string, string>(300, 60 * 1000)

const roundSignatureNumber = (value: number): number => {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0
}

const buildMinimapNodeGeometrySignature = (nodes: NodeLite[]): string => {
  const parts: Array<string | number> = ['minimap:nodes', nodes.length]
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const extent = readMinimapNodeExtent(node)
    parts.push(String(node?.id || ''))
    if (!extent) {
      parts.push('missing')
      continue
    }
    parts.push(
      roundSignatureNumber(extent.minX),
      roundSignatureNumber(extent.minY),
      roundSignatureNumber(extent.maxX),
      roundSignatureNumber(extent.maxY),
    )
  }
  return hashSignatureParts(parts)
}

const buildMinimapEdgeGeometrySignature = (
  nodes: Record<string, { x: number; y: number }>,
  edges: EdgeLite[],
): string => {
  const parts: Array<string | number> = ['minimap:edges', edges.length]
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    const source = nodes[String(edge?.source || '')]
    const target = nodes[String(edge?.target || '')]
    parts.push(String(edge?.id || ''), String(edge?.source || ''), String(edge?.target || ''))
    if (!source || !target) {
      parts.push('missing')
      continue
    }
    parts.push(
      roundSignatureNumber(source.x),
      roundSignatureNumber(source.y),
      roundSignatureNumber(target.x),
      roundSignatureNumber(target.y),
    )
  }
  return hashSignatureParts(parts)
}

const buildMinimapPathCacheKey = (
  scope: string,
  args: {
    graphId?: string | number
    bounds: Pick<MinimapBounds, 'minX' | 'minY'>
    sx: number
    size?: number
    signature: string
  },
): string => {
  return hashSignatureParts([
    scope,
    String(args.graphId ?? ''),
    roundSignatureNumber(args.bounds.minX),
    roundSignatureNumber(args.bounds.minY),
    roundSignatureNumber(args.sx),
    typeof args.size === 'number' ? roundSignatureNumber(args.size) : '',
    args.signature,
  ])
}

export const buildEdgesPathD = (
  nodes: NodeLite[],
  edges: EdgeLite[],
  bounds: { minX: number; minY: number },
  sx: number,
  graphId?: string | number
) => {
  if (!nodes || !edges || nodes.length === 0 || edges.length === 0) return '';
  const needed = new Set<string>()
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    needed.add(String(e.source))
    needed.add(String(e.target))
  }
  const coord: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < nodes.length; i++) {
    if (needed.size === 0) break
    const n = nodes[i];
    const id = String(n.id)
    if (!needed.has(id)) continue
    needed.delete(id)
    const center = readMinimapNodeCenter(n)
    if (!center) continue
    coord[id] = center;
  }
  const key = buildMinimapPathCacheKey('edges', {
    graphId,
    bounds,
    sx,
    signature: buildMinimapEdgeGeometrySignature(coord, edges),
  })
  const cached = edgePathCache.get(key)
  if (cached) return cached
  let d = '';
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const s = coord[e.source];
    const t = coord[e.target];
    if (!s || !t) continue;
    const x1 = (s.x - bounds.minX) * sx;
    const y1 = (s.y - bounds.minY) * sx;
    const x2 = (t.x - bounds.minX) * sx;
    const y2 = (t.y - bounds.minY) * sx;
    d += `M${x1},${y1}L${x2},${y2}`;
  }
  edgePathCache.set(key, d)
  return d;
};

export const buildNodesPathD = (
  nodes: NodeLite[],
  bounds: { minX: number; minY: number },
  sx: number,
  size: number,
  graphId?: string | number
) => {
  if (!nodes || nodes.length === 0) return '';
  const key = buildMinimapPathCacheKey('nodes', {
    graphId,
    bounds,
    sx,
    size,
    signature: buildMinimapNodeGeometrySignature(nodes),
  })
  const cached = nodePathCache.get(key)
  if (cached) return cached
  const s = Math.max(1, size);
  let d = '';
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const extent = readMinimapNodeExtent(n)
    if (!extent) continue
    if (extent.maxX > extent.minX && extent.maxY > extent.minY) {
      const x = (extent.minX - bounds.minX) * sx;
      const y = (extent.minY - bounds.minY) * sx;
      const w = Math.max(1, (extent.maxX - extent.minX) * sx);
      const h = Math.max(1, (extent.maxY - extent.minY) * sx);
      d += `M${x},${y}h${w}v${h}h-${w}v-${h}Z`;
      continue
    }
    const x = (extent.minX - bounds.minX) * sx;
    const y = (extent.minY - bounds.minY) * sx;
    const hs = s / 2;
    d += `M${x - hs},${y - hs}h${s}v${s}h-${s}v-${s}Z`;
  }
  nodePathCache.set(key, d)
  return d;
};
