import type { GraphNode } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { defaultSchema } from '@/lib/graph/schema'
import { applyGroupGeometrySeedLayout } from '@/components/GraphCanvas/layout/groupGeometrySeed'

const bboxOf = (nodes: GraphNode[]): { minX: number; minY: number; maxX: number; maxY: number } => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}

export const testGroupGeometrySeedSeparatesGroupsAndNodes = () => {
  const nodes: GraphNode[] = []
  for (let i = 0; i < 10; i += 1) {
    const id = `n${i}`
    nodes.push({
      id,
      label: id,
      type: 'Entity',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      properties:
        i < 6
          ? {
              'visual:xIndex': i % 3,
              'visual:yIndex': Math.floor(i / 3),
            }
          : {},
    } as unknown as GraphNode)
  }

  const g1: GraphGroup = { id: 'subgraph:g1', label: 'g1', source: 'userSubgraph', depth: 0, memberNodeIds: ['n0', 'n1', 'n2', 'n3', 'n4'], style: {} }
  const g2: GraphGroup = { id: 'subgraph:g2', label: 'g2', source: 'userSubgraph', depth: 0, memberNodeIds: ['n5', 'n6', 'n7', 'n8', 'n9'], style: {} }

  applyGroupGeometrySeedLayout({ nodes, groups: [g1, g2], width: 900, height: 700, schema: defaultSchema })

  const bucket = new Map<string, number>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
    const key = `${Math.round(x / 20)},${Math.round(y / 20)}`
    bucket.set(key, (bucket.get(key) || 0) + 1)
  }
  let collisions = 0
  bucket.forEach(v => {
    if (v > 1) collisions += v
  })
  if (collisions > 2) throw new Error(`expected most nodes to be de-duplicated; collisions=${collisions}`)

  const a = bboxOf(nodes.filter(n => ['n0', 'n1', 'n2', 'n3', 'n4'].includes(String(n.id))))
  const b = bboxOf(nodes.filter(n => ['n5', 'n6', 'n7', 'n8', 'n9'].includes(String(n.id))))
  const sepX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX))
  const sepY = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY))
  if (sepX > 20 && sepY > 20) throw new Error('expected group bboxes to not substantially overlap')
}

