import { stratify, tree, forceSimulation, forceX, forceY, type HierarchyNode } from 'd3'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  DEFAULT_STRATIFY_REUSE_SEED_STRENGTH,
  DEFAULT_STRATIFY_SEPARATION,
  readFitPadding,
} from '@/lib/graph/layoutDefaults'
import { relaxNodesWithCollision } from './relax'
import { createGroupKeyOfNode, type GroupKeyOfNode } from './grouping'
import { getNodeAabbHalfExtentsWithLabel, createBboxCollideForce } from './overlap'
import { createGroupBboxCollideForce } from './groupOverlap'
import { readCollisionConfig } from './collisionConfig'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

type StratifyEdgeSelection = {
  parentByChildId: Map<string, string>
  hierarchyEdges: GraphEdge[]
  labelPriority: string[]
}

type StratifyGridConfig = {
  enabled: boolean
  size: number
  strength: number
  steps: number
}

type StratifyAntiLineConfig = {
  enabled: boolean
  maxAspectRatio: number
  wrapRows: number
}

function snapToGrid(value: number, size: number): number {
  if (!Number.isFinite(value) || !(size > 0)) return value
  return Math.round(value / size) * size
}

function readStratifyAntiLineConfig(schema: GraphSchema): StratifyAntiLineConfig {
  const raw = schema.layout?.stratify?.antiLine
  const enabled = raw?.enabled !== false
  const maxAspectRatioRaw = raw?.maxAspectRatio
  const maxAspectRatio =
    typeof maxAspectRatioRaw === 'number' && Number.isFinite(maxAspectRatioRaw)
      ? Math.max(2, Math.min(40, maxAspectRatioRaw))
      : 6
  const wrapRowsRaw = raw?.wrapRows
  const wrapRows =
    typeof wrapRowsRaw === 'number' && Number.isFinite(wrapRowsRaw)
      ? Math.max(0, Math.min(80, Math.floor(wrapRowsRaw)))
      : 0
  return { enabled, maxAspectRatio, wrapRows }
}

function readStratifyGridConfig(schema: GraphSchema, autoSize: number, minSafeSize: number): StratifyGridConfig {
  const raw = schema.layout?.stratify?.grid
  const enabled = raw?.enabled !== false
  const sizeRaw = raw?.size
  const requested =
    typeof sizeRaw === 'number' && Number.isFinite(sizeRaw) && sizeRaw > 4
      ? Math.floor(sizeRaw)
      : Math.max(12, Math.min(256, Math.floor(autoSize)))
  const size = Math.max(requested, Math.max(12, Math.floor(minSafeSize)))
  const strengthRaw = raw?.strength
  const strength =
    typeof strengthRaw === 'number' && Number.isFinite(strengthRaw)
      ? Math.max(0, Math.min(1, strengthRaw))
      : 0.7
  const stepsRaw = raw?.steps
  const steps =
    typeof stepsRaw === 'number' && Number.isFinite(stepsRaw)
      ? Math.max(0, Math.min(80, Math.floor(stepsRaw)))
      : 24
  return { enabled, size, strength, steps }
}

function enforceRowUniqueGridColumns(args: {
  nodes: GraphNode[]
  rowKeyById: Map<string, number>
  orientation: 'vertical' | 'horizontal'
  gridSize: number
}): void {
  const { nodes, rowKeyById, orientation, gridSize } = args
  if (!(gridSize > 0)) return

  const byDepth = new Map<number, GraphNode[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    const d = rowKeyById.get(id) ?? 0
    const arr = byDepth.get(d)
    if (arr) arr.push(n)
    else byDepth.set(d, [n])
  }

  for (const [depth, arr] of byDepth.entries()) {
    void depth
    arr.sort((a, b) => {
      const ax = typeof a.x === 'number' && Number.isFinite(a.x) ? a.x : 0
      const ay = typeof a.y === 'number' && Number.isFinite(a.y) ? a.y : 0
      const bx = typeof b.x === 'number' && Number.isFinite(b.x) ? b.x : 0
      const by = typeof b.y === 'number' && Number.isFinite(b.y) ? b.y : 0
      const ap = orientation === 'horizontal' ? ay : ax
      const bp = orientation === 'horizontal' ? by : bx
      if (ap !== bp) return ap - bp
      const aid = String(a.id || '')
      const bid = String(b.id || '')
      return aid < bid ? -1 : aid > bid ? 1 : 0
    })

    const used = new Set<number>()
    for (let i = 0; i < arr.length; i += 1) {
      const n = arr[i]
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
      const col = orientation === 'horizontal' ? Math.round(y / gridSize) : Math.round(x / gridSize)
      if (!used.has(col)) {
        used.add(col)
        continue
      }
      let delta = 1
      while (true) {
        const left = col - delta
        if (!used.has(left)) {
          used.add(left)
          if (orientation === 'horizontal') n.y = left * gridSize
          else n.x = left * gridSize
          break
        }
        const right = col + delta
        if (!used.has(right)) {
          used.add(right)
          if (orientation === 'horizontal') n.y = right * gridSize
          else n.x = right * gridSize
          break
        }
        delta += 1
        if (delta > 5000) break
      }
      n.x = snapToGrid(typeof n.x === 'number' ? n.x : x, gridSize)
      n.y = snapToGrid(typeof n.y === 'number' ? n.y : y, gridSize)
      n.vx = 0
      n.vy = 0
    }
  }
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
  const nodeGap = isFiniteNumber(nodeGapRaw) ? Math.max(0, Math.min(512, nodeGapRaw)) : 16
  const rankGap = isFiniteNumber(rankGapRaw) ? Math.max(0, Math.min(1024, rankGapRaw)) : 36

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

  const collisionForGrid = readCollisionConfig(schema)
  let maxHalfForGrid = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const ext = getNodeAabbHalfExtentsWithLabel(nodes[i], schema)
    maxHalfForGrid = Math.max(maxHalfForGrid, ext.halfW, ext.halfH)
  }
  const minSafeGridSize = 2 * (maxHalfForGrid + (collisionForGrid.nodeBbox.padding || 0)) + 2
  const autoGridSize = Math.max(12, Math.min(256, Math.floor(Math.min(breadthStep, depthStep) * scale)))
  const gridCfg = readStratifyGridConfig(schema, autoGridSize, minSafeGridSize)
  if (gridCfg.enabled && gridCfg.steps > 0 && gridCfg.size > 0) {
    const size = gridCfg.size

    const antiLine = readStratifyAntiLineConfig(schema)
    let pMinX = Infinity
    let pMinY = Infinity
    let pMaxX = -Infinity
    let pMaxY = -Infinity
    let sumX = 0
    let sumY = 0
    let nCount = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
      if (x == null || y == null) continue
      pMinX = Math.min(pMinX, x)
      pMinY = Math.min(pMinY, y)
      pMaxX = Math.max(pMaxX, x)
      pMaxY = Math.max(pMaxY, y)
      sumX += x
      sumY += y
      nCount += 1
    }
    const spanX = Math.max(1e-9, pMaxX - pMinX)
    const spanY = Math.max(1e-9, pMaxY - pMinY)
    const spanRatio = Math.max(spanX / spanY, spanY / spanX)

    let sxx = 0
    let syy = 0
    let sxy = 0
    if (nCount > 0) {
      const mx = sumX / nCount
      const my = sumY / nCount
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x == null || y == null) continue
        const dx = x - mx
        const dy = y - my
        sxx += dx * dx
        syy += dy * dy
        sxy += dx * dy
      }
    }
    const tr = sxx + syy
    const detTerm = (sxx - syy) * (sxx - syy) + 4 * sxy * sxy
    const disc = Math.sqrt(Math.max(0, detTerm))
    const l1 = (tr + disc) / 2
    const l2 = (tr - disc) / 2
    const lineRatio = l2 > 1e-9 ? l1 / l2 : l1 > 0 ? Infinity : 0

    const depthCounts = new Map<number, number>()
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i].id || '')
      if (!id) continue
      const d = depthById.get(id) ?? 0
      depthCounts.set(d, (depthCounts.get(d) || 0) + 1)
    }
    let uniqueDepths = 0
    let maxPerDepth = 0
    let singleDepths = 0
    depthCounts.forEach(v => {
      uniqueDepths += 1
      maxPerDepth = Math.max(maxPerDepth, v)
      if (v <= 1) singleDepths += 1
    })
    const mostlySingle = uniqueDepths > 0 ? singleDepths / uniqueDepths > 0.85 : false
    const chainLike = (maxPerDepth <= 1 && nodes.length >= 6) || mostlySingle

    const shouldWrap =
      antiLine.enabled &&
      (chainLike || spanRatio > antiLine.maxAspectRatio || lineRatio > antiLine.maxAspectRatio)

    const targetXById = new Map<string, number>()
    const targetYById = new Map<string, number>()
    const rowKeyById = new Map<string, number>()

    if (shouldWrap) {
      const depths = Array.from(depthCounts.keys())
        .filter(d => Number.isFinite(d) && d > 0)
        .sort((a, b) => a - b)
      const maxDepth = depths.length > 0 ? depths[depths.length - 1] : 0
      const autoWrap = Math.max(4, Math.min(24, Math.ceil(Math.sqrt(Math.max(1, maxDepth)))))
      const wrapRows = antiLine.wrapRows > 0 ? Math.max(2, Math.min(80, antiLine.wrapRows)) : autoWrap
      const maxCol = maxDepth > 0 ? Math.floor((Math.max(0, maxDepth - 1)) / wrapRows) : 0
      const midRow = (wrapRows - 1) / 2
      const midCol = maxCol / 2
      const xVals: number[] = []
      const yVals: number[] = []
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x == null || y == null) continue
        xVals.push(snapToGrid(x, size))
        yVals.push(snapToGrid(y, size))
      }
      xVals.sort((a, b) => a - b)
      yVals.sort((a, b) => a - b)
      const anchorX = xVals.length ? xVals[Math.floor(xVals.length / 2)] : centerX
      const anchorY = yVals.length ? yVals[Math.floor(yVals.length / 2)] : centerY

      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n.id || '')
        if (!id) continue
        const depth = depthById.get(id) ?? 0
        const idx = Math.max(0, Math.floor(depth) - 1)
        const row = wrapRows > 0 ? idx % wrapRows : idx
        const col = wrapRows > 0 ? Math.floor(idx / wrapRows) : 0
        rowKeyById.set(id, row)
        if (orientation === 'horizontal') {
          targetXById.set(id, snapToGrid(anchorX + (row - midRow) * size, size))
          targetYById.set(id, snapToGrid(anchorY + (col - midCol) * size * 2, size))
        } else {
          targetXById.set(id, snapToGrid(anchorX + (col - midCol) * size * 2, size))
          targetYById.set(id, snapToGrid(anchorY + (row - midRow) * size, size))
        }
      }
    } else {
      const primaryByDepth = new Map<number, number[]>()
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n.id || '')
        if (!id) continue
        const depth = depthById.get(id) ?? 0
        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x == null || y == null) continue
        const primary = orientation === 'horizontal' ? x : y
        const arr = primaryByDepth.get(depth)
        if (arr) arr.push(primary)
        else primaryByDepth.set(depth, [primary])
      }

      const rowTargetByDepth = new Map<number, number>()
      for (const [depth, values] of primaryByDepth.entries()) {
        const sorted = values.slice().sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0
        rowTargetByDepth.set(depth, snapToGrid(median, size))
      }

      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n.id || '')
        if (!id) continue
        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
        const depth = depthById.get(id) ?? 0
        rowKeyById.set(id, depth)
        const rowTarget = rowTargetByDepth.get(depth)
        if (orientation === 'horizontal') {
          targetXById.set(id, typeof rowTarget === 'number' ? rowTarget : snapToGrid(x, size))
          targetYById.set(id, snapToGrid(y, size))
        } else {
          targetXById.set(id, snapToGrid(x, size))
          targetYById.set(id, typeof rowTarget === 'number' ? rowTarget : snapToGrid(y, size))
        }
      }
    }

    const collision = collisionForGrid
    const groupKey = groupKeyOf || createGroupKeyOfNode({ nodes, edges: edgesForSim })
    const nodeForce = collision.nodeBbox.enabled
      ? createBboxCollideForce({
          schema,
          padding: collision.nodeBbox.padding,
          strength: collision.nodeBbox.strength,
          iterations: collision.nodeBbox.iterations,
        })
      : null
    const groupForce = collision.groupBbox.enabled
      ? createGroupBboxCollideForce({
          schema,
          padding: collision.groupBbox.padding,
          strength: collision.groupBbox.strength,
          iterations: collision.groupBbox.iterations,
          groupKeyOf: groupKey,
        })
      : null

    const readTargetX = (n: GraphNode) => targetXById.get(String(n.id || '')) ?? 0
    const readTargetY = (n: GraphNode) => targetYById.get(String(n.id || '')) ?? 0

    const sim = forceSimulation(nodes)
      .alpha(1)
      .alphaMin(0.001)
      .alphaDecay(0.08)
      .velocityDecay(0.45)
      .force('gridX', forceX(readTargetX).strength(gridCfg.strength))
      .force('gridY', forceY(readTargetY).strength(gridCfg.strength))

    if (nodeForce) sim.force('bbox', nodeForce)
    if (groupForce) sim.force('gbbox', groupForce)

    sim.stop()
    for (let i = 0; i < gridCfg.steps; i += 1) {
      sim.tick()
    }
    sim.stop()

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
      n.x = snapToGrid(x, size)
      n.y = snapToGrid(y, size)
      n.vx = 0
      n.vy = 0
    }

    enforceRowUniqueGridColumns({ nodes, rowKeyById, orientation, gridSize: size })

    let gMinX = Infinity
    let gMinY = Infinity
    let gMaxX = -Infinity
    let gMaxY = -Infinity
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
      if (x == null || y == null) continue
      gMinX = Math.min(gMinX, x)
      gMinY = Math.min(gMinY, y)
      gMaxX = Math.max(gMaxX, x)
      gMaxY = Math.max(gMaxY, y)
    }
    if (Number.isFinite(gMinX) && Number.isFinite(gMinY) && Number.isFinite(gMaxX) && Number.isFinite(gMaxY)) {
      const gDx = centerX - (gMinX + gMaxX) / 2
      const gDy = centerY - (gMinY + gMaxY) / 2
      const qx = snapToGrid(gDx, size)
      const qy = snapToGrid(gDy, size)
      if (qx !== 0 || qy !== 0) {
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i]
          const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
          const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
          n.x = x + qx
          n.y = y + qy
        }
      }
    }
  }

  return true
}
