import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  DEFAULT_STRATIFY_REUSE_SEED_STRENGTH,
  DEFAULT_STRATIFY_SEPARATION,
  readFitPadding,
} from '@/lib/graph/layoutDefaults'
import { relaxNodesWithCollision } from './relax'
import type { GroupKeyOfNode } from './grouping'

type StratifyEdgeSelection = {
  parentByChildId: Map<string, string>
  hierarchyEdges: GraphEdge[]
  labelPriority: string[]
}

function coerceEndpointId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

function pickLabelPriority(nodes: GraphNode[], edges: GraphEdge[], schema: GraphSchema): string[] {
  const configured = schema.layout?.stratify?.edgeLabels
  if (Array.isArray(configured) && configured.some(v => typeof v === 'string' && v.trim())) {
    const out: string[] = []
    for (const v of configured) {
      if (typeof v !== 'string') continue
      const s = v.trim()
      if (!s || out.includes(s)) continue
      out.push(s)
    }
    if (out.length > 0) return out
  }

  const typeCounts = new Map<string, number>()
  for (const n of nodes) {
    const t = String(n.type || '').trim()
    if (!t) continue
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1)
  }
  const hasMermaidNodes = (typeCounts.get('MermaidNode') || 0) > 0
  if (hasMermaidNodes) return ['pointsTo']

  const labelCounts = new Map<string, number>()
  for (const e of edges) {
    const lbl = String(e.label || '').trim()
    if (!lbl) continue
    labelCounts.set(lbl, (labelCounts.get(lbl) || 0) + 1)
  }
  const sorted = Array.from(labelCounts.entries()).sort((a, b) => b[1] - a[1])
  const mostCommon = sorted.length > 0 ? sorted[0][0] : ''
  return mostCommon ? [mostCommon] : ['pointsTo']
}

function breakCycles(parentByChildId: Map<string, string>): void {
  const visited = new Set<string>()
  const stack = new Set<string>()

  const visit = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    stack.add(id)
    const parent = parentByChildId.get(id)
    if (parent) {
      if (stack.has(parent)) {
        parentByChildId.delete(id)
      } else {
        visit(parent)
      }
    }
    stack.delete(id)
  }

  for (const id of parentByChildId.keys()) {
    visit(id)
  }
}

export function selectStratifyHierarchyEdges(
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  schema: GraphSchema,
): StratifyEdgeSelection {
  const idSet = new Set<string>()
  for (const n of nodes) {
    const id = String(n.id || '').trim()
    if (id) idSet.add(id)
  }

  const labelPriority = pickLabelPriority(nodes, edgesForSim, schema)
  const parentByChildId = new Map<string, string>()

  for (const label of labelPriority) {
    for (const e of edgesForSim) {
      if (String(e.label || '') !== label) continue
      const src = coerceEndpointId(e.source)
      const tgt = coerceEndpointId(e.target)
      if (!src || !tgt) continue
      if (!idSet.has(src) || !idSet.has(tgt)) continue
      if (src === tgt) continue
      if (parentByChildId.has(tgt)) continue
      parentByChildId.set(tgt, src)
    }
  }

  breakCycles(parentByChildId)

  const hierarchyEdges: GraphEdge[] = []
  for (const e of edgesForSim) {
    const lbl = String(e.label || '')
    if (!labelPriority.includes(lbl)) continue
    const src = coerceEndpointId(e.source)
    const tgt = coerceEndpointId(e.target)
    if (!src || !tgt) continue
    if (parentByChildId.get(tgt) !== src) continue
    hierarchyEdges.push(e)
  }

  return { parentByChildId, hierarchyEdges, labelPriority }
}

export function applyStratifyLayout(
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
  groupKeyOf?: GroupKeyOfNode,
) {
  if (!nodes.length) return

  const prevPos = new Map<string, { x: number; y: number }>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    prevPos.set(id, { x, y })
  }

  const { parentByChildId } = selectStratifyHierarchyEdges(nodes, edgesForSim, schema)
  const syntheticRootId = '__root__'

  const data: Array<{ id: string; parentId: string | null }> = [{ id: syntheticRootId, parentId: null }]
  for (const n of nodes) {
    const id = String(n.id || '').trim()
    if (!id) continue
    const parentId = parentByChildId.get(id) || syntheticRootId
    data.push({ id, parentId })
  }

  let root: d3.HierarchyNode<{ id: string; parentId: string | null }> | null = null
  try {
    const stratified = d3
      .stratify<{ id: string; parentId: string | null }>()
      .id(d => d.id)
      .parentId(d => d.parentId)
    root = stratified(data)
  } catch {
    return
  }
  if (!root) return

  const viewW = Math.max(1, width)
  const viewH = Math.max(1, height)
  const padding = readFitPadding(schema)
  const availableW = Math.max(1, viewW - padding * 2)
  const availableH = Math.max(1, viewH - padding * 2)

  const tree = d3
    .tree<{ id: string; parentId: string | null }>()
    .size([availableH, availableW])
    .separation(() => {
      const s = schema.layout?.stratify?.separation
      return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : DEFAULT_STRATIFY_SEPARATION
    })

  const orientation = schema.layout?.stratify?.orientation === 'horizontal' ? 'horizontal' : 'vertical'
  root.each(n => {
    if (!n.children || n.children.length <= 1) return
    n.children.sort((a, b) => {
      const pa = prevPos.get(String(a.id || ''))
      const pb = prevPos.get(String(b.id || ''))
      const va = pa ? (orientation === 'horizontal' ? pa.y : pa.x) : null
      const vb = pb ? (orientation === 'horizontal' ? pb.y : pb.x) : null
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return va - vb
    })
  })

  tree(root)

  const positions = new Map<string, { x: number; y: number }>()
  for (const node of root.descendants()) {
    const id = String(node.id || '')
    if (!id || id === syntheticRootId) continue
    const xRaw = node.x
    const yRaw = node.y
    if (typeof xRaw !== 'number' || typeof yRaw !== 'number') continue
    const x = orientation === 'horizontal' ? yRaw : xRaw
    const y = orientation === 'horizontal' ? xRaw : yRaw
    positions.set(id, { x, y })
  }
  if (positions.size === 0) return

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const centerX = viewW / 2
  const centerY = viewH / 2
  const dx = centerX - (minX + maxX) / 2
  const dy = centerY - (minY + maxY) / 2

  const reuseRaw = schema.layout?.stratify?.reuseSeedStrength
  const reuseStrength =
    typeof reuseRaw === 'number' && Number.isFinite(reuseRaw)
      ? Math.max(0, Math.min(1, reuseRaw))
      : DEFAULT_STRATIFY_REUSE_SEED_STRENGTH

  for (const n of nodes) {
    const id = String(n.id || '')
    const p = positions.get(id)
    if (!p) continue
    const nextX = p.x + dx
    const nextY = p.y + dy
    const px = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const py = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    n.x = px == null ? nextX : px * (1 - reuseStrength) + nextX * reuseStrength
    n.y = py == null ? nextY : py * (1 - reuseStrength) + nextY * reuseStrength
    n.vx = 0
    n.vy = 0
    n.fx = null
    n.fy = null
  }

  const groupsEnabled = schema.layout?.groups?.enabled !== false
  relaxNodesWithCollision({ nodes, edges: edgesForSim, schema, defaultSteps: groupsEnabled ? 7 : 5, groupKeyOf })
}
