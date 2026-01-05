type NodeLite = { id: string; x?: number; y?: number };
type EdgeLite = { id: string; source: string; target: string };

import { LRUCache } from '@/lib/cache/LRUCache'

const edgePathCache = new LRUCache<string, string>(300, 60 * 1000)
const nodePathCache = new LRUCache<string, string>(300, 60 * 1000)

export const buildEdgesPathD = (
  nodes: NodeLite[],
  edges: EdgeLite[],
  bounds: { minX: number; minY: number },
  sx: number,
  graphId?: string | number
) => {
  if (!nodes || !edges || nodes.length === 0 || edges.length === 0) return '';
  const key = `g:${graphId ?? ''}|n:${nodes.length}|e:${edges.length}|bx:${bounds.minX}|by:${bounds.minY}|sx:${sx}`
  const cached = edgePathCache.get(key)
  if (cached) return cached
  const coord: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    coord[n.id] = { x: Number(n.x ?? 0), y: Number(n.y ?? 0) };
  }
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
  const key = `g:${graphId ?? ''}|n:${nodes.length}|bx:${bounds.minX}|by:${bounds.minY}|sx:${sx}|s:${size}`
  const cached = nodePathCache.get(key)
  if (cached) return cached
  const s = Math.max(1, size);
  let d = '';
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const x = (Number(n.x ?? 0) - bounds.minX) * sx;
    const y = (Number(n.y ?? 0) - bounds.minY) * sx;
    const hs = s / 2;
    d += `M${x - hs},${y - hs}h${s}v${s}h-${s}v-${s}Z`;
  }
  nodePathCache.set(key, d)
  return d;
};
