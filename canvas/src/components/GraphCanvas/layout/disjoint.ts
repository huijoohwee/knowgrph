import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema, getNodeRadiusFromSchema } from '@/lib/graph/schema'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'

export type DisjointComponentTargets = {
  componentByNodeId: Map<string, number>
  targetsByComponent: Map<number, { x: number; y: number }>
}

const endpointId = (v: GraphEdge['source'] | GraphEdge['target']): string | null => {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') return (v as { id: string }).id
  return null
}

const hash01 = (id: string): number => {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

export const computeDisjointComponentTargets = (args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  schema: GraphSchema
  padding: number
}): DisjointComponentTargets | null => {
  const { nodes, edges, width, height, schema, padding } = args
  if (!nodes.length) return null

  const nodeIds = nodes.map(n => String(n.id))
  const nodeIdSet = new Set(nodeIds)
  const adjacency = new Map<string, string[]>()
  for (let i = 0; i < nodeIds.length; i += 1) adjacency.set(nodeIds[i], [])
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const s = endpointId(e.source)
    const t = endpointId(e.target)
    if (!s || !t) continue
    if (!nodeIdSet.has(s) || !nodeIdSet.has(t)) continue
    adjacency.get(s)?.push(t)
    adjacency.get(t)?.push(s)
  }

  const componentByNodeId = new Map<string, number>()
  const components: Array<{ ids: string[]; size: number; minId: string; index: number }> = []
  for (let i = 0; i < nodeIds.length; i += 1) {
    const id = nodeIds[i]
    if (componentByNodeId.has(id)) continue
    const compIndex = components.length
    const stack = [id]
    const ids: string[] = []
    componentByNodeId.set(id, compIndex)
    while (stack.length) {
      const cur = stack.pop() as string
      ids.push(cur)
      const neighbors = adjacency.get(cur) || []
      for (let j = 0; j < neighbors.length; j += 1) {
        const next = neighbors[j]
        if (componentByNodeId.has(next)) continue
        componentByNodeId.set(next, compIndex)
        stack.push(next)
      }
    }
    const minId = ids.reduce((acc, v) => (acc === '' || v < acc ? v : acc), '')
    components.push({ ids, size: ids.length, minId, index: compIndex })
  }

  if (components.length <= 1) return null

  const meanRadius = (() => {
    let sum = 0
    let count = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (String(n.type || '') === 'MermaidSubgraph') continue
      const extents = getNodeHalfExtents2d(n, schema)
      const base = Math.max(extents.halfW, extents.halfH, getNodeRadiusFromSchema(n, schema) || 20)
      if (Number.isFinite(base)) {
        sum += base
        count += 1
      }
    }
    return count > 0 ? sum / count : 20
  })()

  const spacing = Math.max(120, meanRadius * 6)
  const componentRadius = (n: number) => spacing * (0.65 + Math.sqrt(Math.max(1, n)))

  const ordered = [...components].sort((a, b) => {
    if (b.size !== a.size) return b.size - a.size
    return a.minId.localeCompare(b.minId)
  })

  const cx = Math.max(1, width) / 2
  const cy = Math.max(1, height) / 2

  const placed: Array<{ x: number; y: number; r: number }> = []
  const targetsByComponent = new Map<number, { x: number; y: number }>()

  const overlaps = (x: number, y: number, r: number): boolean => {
    for (let i = 0; i < placed.length; i += 1) {
      const p = placed[i]
      const dx = x - p.x
      const dy = y - p.y
      const rr = r + p.r + padding
      if (dx * dx + dy * dy < rr * rr) return true
    }
    return false
  }

  for (let idx = 0; idx < ordered.length; idx += 1) {
    const comp = ordered[idx]
    const r = componentRadius(comp.size)
    if (idx === 0) {
      targetsByComponent.set(comp.index, { x: cx, y: cy })
      placed.push({ x: cx, y: cy, r })
      continue
    }

    const aspect = width / height
    const scaleX = Math.sqrt(Math.max(0.1, aspect))
    const scaleY = 1 / scaleX

    const baseAngle = hash01(comp.minId) * Math.PI * 2
    let angle = baseAngle
    let spiralR = r + spacing * 0.5
    const maxIter = 2400
    const angleStep = 0.42
    const radialStep = Math.max(18, padding) * 0.35
    let chosen: { x: number; y: number } | null = null

    for (let it = 0; it < maxIter; it += 1) {
      const x = cx + Math.cos(angle) * spiralR * scaleX
      const y = cy + Math.sin(angle) * spiralR * scaleY
      if (!overlaps(x, y, r)) {
        chosen = { x, y }
        break
      }
      angle += angleStep
      spiralR += radialStep
    }

    const finalPos = chosen || { x: cx + (idx % 2 === 0 ? 1 : -1) * spiralR * scaleX, y: cy + (idx % 3 - 1) * spiralR * scaleY }
    targetsByComponent.set(comp.index, finalPos)
    placed.push({ x: finalPos.x, y: finalPos.y, r })
  }

  return { componentByNodeId, targetsByComponent }
}

