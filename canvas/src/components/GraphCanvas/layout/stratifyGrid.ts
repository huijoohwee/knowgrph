import { forceSimulation, forceX, forceY } from 'd3'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createGroupKeyOfNode, type GroupKeyOfNode } from './grouping'
import { getNodeAabbHalfExtentsWithLabel, createBboxCollideForce } from './overlap'
import { createGroupBboxCollideForce } from './groupOverlap'
import { readCollisionConfig } from './collisionConfig'

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

  for (const arr of byDepth.values()) {
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

export function applyStratifyGridEnhancements(args: {
  nodes: GraphNode[]
  edgesForSim: GraphEdge[]
  schema: GraphSchema
  orientation: 'vertical' | 'horizontal'
  depthById: Map<string, number>
  breadthStep: number
  depthStep: number
  scale: number
  centerX: number
  centerY: number
  groupKeyOf?: GroupKeyOfNode
}): void {
  const {
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
  } = args

  const collisionForGrid = readCollisionConfig(schema)
  let maxHalfForGrid = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const ext = getNodeAabbHalfExtentsWithLabel(nodes[i], schema)
    maxHalfForGrid = Math.max(maxHalfForGrid, ext.halfW, ext.halfH)
  }
  const minSafeGridSize = 2 * (maxHalfForGrid + (collisionForGrid.nodeBbox.padding || 0)) + 2
  const autoGridSize = Math.max(12, Math.min(256, Math.floor(Math.min(breadthStep, depthStep) * scale)))
  const gridCfg = readStratifyGridConfig(schema, autoGridSize, minSafeGridSize)
  if (!gridCfg.enabled || !(gridCfg.steps > 0) || !(gridCfg.size > 0)) return

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
    chainLike ||
    ((antiLine.enabled &&
      (spanRatio > antiLine.maxAspectRatio || lineRatio > antiLine.maxAspectRatio)) ||
      false)

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
    const maxCol = maxDepth > 0 ? Math.floor(Math.max(0, maxDepth - 1) / wrapRows) : 0
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
