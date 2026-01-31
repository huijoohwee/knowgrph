import { stratify, tree, type HierarchyNode } from 'd3'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  DEFAULT_STRATIFY_REUSE_SEED_STRENGTH,
  DEFAULT_STRATIFY_SEPARATION,
  readFlowLayoutKnobs,
  readFitPadding,
} from '@/lib/graph/layoutDefaults'
import { relaxNodesWithCollision } from './relax'
import type { GroupKeyOfNode } from './grouping'
import { getNodeAabbHalfExtentsWithLabel } from './overlap'
import { applyStratifyGridEnhancements } from './stratifyGrid'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

type StratifyEdgeSelection = {
  parentByChildId: Map<string, string>
  hierarchyEdges: GraphEdge[]
  labelPriority: string[]
}

function pickUniqueId(idSet: Set<string>, base: string): string {
  if (!idSet.has(base)) return base
  let i = 1
  while (true) {
    const next = `${base}${i}`
    if (!idSet.has(next)) return next
    i += 1
  }
}

function pickUniquePrefix(idSet: Set<string>, basePrefix: string): string {
  const collides = (prefix: string) => {
    for (const id of idSet) {
      if (id.startsWith(prefix)) return true
    }
    return false
  }
  if (!collides(basePrefix)) return basePrefix
  let i = 1
  while (true) {
    const next = `${basePrefix}${i}:`
    if (!collides(next)) return next
    i += 1
  }
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

function selectParentByNodeProperties(nodes: GraphNode[]): Map<string, string> | null {
  const idSet = new Set<string>()
  for (const n of nodes) {
    const id = String(n.id || '').trim()
    if (id) idSet.add(id)
  }
  if (idSet.size === 0) return null

  let found = 0
  const parentByChildId = new Map<string, string>()
  for (const n of nodes) {
    const id = String(n.id || '').trim()
    if (!id) continue
    const props = n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties) ? (n.properties as Record<string, unknown>) : null
    if (!props) continue
    const p = props['visual:parentId']
    if (typeof p !== 'string') continue
    const parentId = p.trim()
    if (!parentId || !idSet.has(parentId) || parentId === id) continue
    if (parentByChildId.has(id)) continue
    parentByChildId.set(id, parentId)
    found += 1
  }
  return found > 0 ? parentByChildId : null
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
  const edgeLabelCfg = schema.layout?.stratify?.edgeLabels
  const preferEdges = Array.isArray(edgeLabelCfg) && edgeLabelCfg.some(v => typeof v === 'string' && v.trim())

  const idSet = new Set<string>()
  for (const n of nodes) {
    const id = String(n.id || '').trim()
    if (id) idSet.add(id)
  }

  const labelPriority = pickLabelPriority(nodes, edgesForSim, schema)
  const parentByChildId = preferEdges ? new Map<string, string>() : (selectParentByNodeProperties(nodes) ?? new Map<string, string>())

  if (preferEdges || parentByChildId.size === 0) {
    parentByChildId.clear()
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

function computeStratifySteps(nodes: GraphNode[], schema: GraphSchema, orientation: 'vertical' | 'horizontal') {
  let maxW = 0
  let maxH = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const ext = getNodeAabbHalfExtentsWithLabel(nodes[i], schema)
    maxW = Math.max(maxW, Math.max(8, ext.halfW * 2))
    maxH = Math.max(maxH, Math.max(8, ext.halfH * 2))
  }

  const nodeGapRaw = schema.layout?.stratify?.nodeGap
  const rankGapRaw = schema.layout?.stratify?.rankGap
  const flow = readFlowLayoutKnobs({ schema, rankdir: orientation === 'horizontal' ? 'LR' : 'TB' })
  const defaultNodeGap = flow.elk.nodeNodeSpacingPx
  const defaultRankGap = flow.elk.layerSpacingPx
  const nodeGap = isFiniteNumber(nodeGapRaw) ? Math.max(0, Math.min(512, nodeGapRaw)) : defaultNodeGap
  const rankGap = isFiniteNumber(rankGapRaw) ? Math.max(0, Math.min(1024, rankGapRaw)) : defaultRankGap

  const breadthStep = (orientation === 'vertical' ? maxW : maxH) + nodeGap
  const depthStep = (orientation === 'vertical' ? maxH : maxW) + rankGap
  return { breadthStep: Math.max(24, breadthStep), depthStep: Math.max(32, depthStep) }
}

export function applyStratifyLayout(
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
  groupKeyOf?: GroupKeyOfNode,
) {
  if (!nodes.length) return false

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

  const idSet = new Set<string>()
  for (const n of nodes) {
    const id = String(n.id || '').trim()
    if (id) idSet.add(id)
  }

  const { parentByChildId } = selectStratifyHierarchyEdges(nodes, edgesForSim, schema)
  const syntheticRootId = pickUniqueId(idSet, '__kg_stratify_root__')
  const groupRootsEnabled = schema.layout?.stratify?.groupRoots !== false
  const groupRootPrefix = pickUniquePrefix(idSet, '__kg_stratify_group__:')

  const data: Array<{ id: string; parentId: string | null }> = [{ id: syntheticRootId, parentId: null }]
  const groupRootIds = new Set<string>()
  for (const n of nodes) {
    const id = String(n.id || '').trim()
    if (!id) continue
    const parentFromHierarchy = parentByChildId.get(id) || ''
    const parentId = (() => {
      if (parentFromHierarchy) return parentFromHierarchy
      if (groupRootsEnabled && groupKeyOf) {
        const k = String(groupKeyOf(n) || '').trim()
        if (k) {
          const gid = `${groupRootPrefix}${k}`
          groupRootIds.add(gid)
          return gid
        }
      }
      return syntheticRootId
    })()
    data.push({ id, parentId })
  }
  for (const gid of groupRootIds) {
    data.push({ id: gid, parentId: syntheticRootId })
  }

  let root: HierarchyNode<{ id: string; parentId: string | null }> | null = null
  try {
    const stratified = stratify<{ id: string; parentId: string | null }>()
      .id(d => d.id)
      .parentId(d => d.parentId)
    root = stratified(data)
  } catch {
    return false
  }
  if (!root) return false

  const viewW = Math.max(1, width)
  const viewH = Math.max(1, height)
  const padding = readFitPadding(schema)
  const availableW = Math.max(1, viewW - padding * 2)
  const availableH = Math.max(1, viewH - padding * 2)

  const orientation = schema.layout?.stratify?.orientation === 'horizontal' ? 'horizontal' : 'vertical'
  const { breadthStep, depthStep } = computeStratifySteps(nodes, schema, orientation)

  const layout = tree<{ id: string; parentId: string | null }>()
    .nodeSize([breadthStep, depthStep])
    .separation(() => {
      const s = schema.layout?.stratify?.separation
      return isFiniteNumber(s) && s > 0 ? s : DEFAULT_STRATIFY_SEPARATION
    })

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

  layout(root)

  const positions = new Map<string, { x: number; y: number }>()
  const depthById = new Map<string, number>()
  for (const node of root.descendants()) {
    const id = String(node.id || '')
    if (!id || id === syntheticRootId || id.startsWith(groupRootPrefix)) continue
    const xRaw = node.x
    const yRaw = node.y
    if (typeof xRaw !== 'number' || typeof yRaw !== 'number') continue
    const x = orientation === 'horizontal' ? yRaw : xRaw
    const y = orientation === 'horizontal' ? xRaw : yRaw
    positions.set(id, { x, y })
    depthById.set(id, typeof node.depth === 'number' && Number.isFinite(node.depth) ? node.depth : 0)
  }
  if (positions.size === 0) return false

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
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const scale = Math.min(availableW / spanX, availableH / spanY)

  const scaled = new Map<string, { x: number; y: number }>()
  let sMinX = Infinity
  let sMinY = Infinity
  let sMaxX = -Infinity
  let sMaxY = -Infinity
  for (const [id, p] of positions.entries()) {
    const x = (p.x - minX) * scale + padding
    const y = (p.y - minY) * scale + padding
    scaled.set(id, { x, y })
    sMinX = Math.min(sMinX, x)
    sMinY = Math.min(sMinY, y)
    sMaxX = Math.max(sMaxX, x)
    sMaxY = Math.max(sMaxY, y)
  }

  const centerX = viewW / 2
  const centerY = viewH / 2
  const dx = centerX - (sMinX + sMaxX) / 2
  const dy = centerY - (sMinY + sMaxY) / 2

  const reuseRaw = schema.layout?.stratify?.reuseSeedStrength
  const reuseStrength =
    typeof reuseRaw === 'number' && Number.isFinite(reuseRaw)
      ? Math.max(0, Math.min(1, reuseRaw))
      : DEFAULT_STRATIFY_REUSE_SEED_STRENGTH

  for (const n of nodes) {
    const id = String(n.id || '')
    const p = scaled.get(id)
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
  applyStratifyGridEnhancements({
    nodes,
    edgesForSim,
    schema,
    orientation,
    depthById,
    breadthStep,
    depthStep,
    scale,
    centerX,
    centerY,
    groupKeyOf,
  })

  return true
}
