
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { applyForceModeSeeds } from '@/components/GraphCanvas/layout/seeding'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { postFitNodesToViewport } from '@/components/GraphCanvas/layout/postFit'
import { applyCollectiveGraphLayout } from '@/components/GraphCanvas/layout/collectiveFit'
import { buildNodeNeighborSetFromIncidentEdges } from '@/components/GraphCanvas/layout/graphConnectivity'
import { readFitPadding } from '@/lib/graph/layoutDefaults'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { hashScopedStringArraySignature } from '@/lib/hash/signature'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const hasFiniteXY = (n: GraphNode): boolean =>
  isFiniteNumber((n as unknown as { x?: unknown }).x) && isFiniteNumber((n as unknown as { y?: unknown }).y)

const isFixedNode = (n: GraphNode): boolean => {
  const fx = (n as unknown as { fx?: unknown }).fx
  const fy = (n as unknown as { fy?: unknown }).fy
  return isFiniteNumber(fx) || isFiniteNumber(fy)
}

const hash01 = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

export const seedMissingNodePositions = (
  nodes: GraphNode[],
  width: number,
  height: number,
  seedCenter: { x: number; y: number } | null,
  options?: { ignoreCommunities?: boolean },
) => {
  if (!nodes || nodes.length === 0) return
  const sorted = [...nodes].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
  const existing = sorted.filter(hasFiniteXY)
  const missing = sorted.filter(n => !hasFiniteXY(n))
  if (missing.length === 0) return

  let cx = 0
  let cy = 0
  if (existing.length > 0) {
    let sx = 0
    let sy = 0
    for (let i = 0; i < existing.length; i += 1) {
      const n = existing[i]!
      sx += (n.x as number)
      sy += (n.y as number)
    }
    cx = sx / existing.length
    cy = sy / existing.length
  } else if (seedCenter) {
    const x = typeof seedCenter.x === 'number' && Number.isFinite(seedCenter.x) ? seedCenter.x : 0
    const y = typeof seedCenter.y === 'number' && Number.isFinite(seedCenter.y) ? seedCenter.y : 0
    cx = x
    cy = y
  } else {
    cx = width / 2
    cy = height / 2
  }

  const pad = 40
  const innerW = Math.max(1, Math.floor(width) - pad * 2)
  const innerH = Math.max(1, Math.floor(height) - pad * 2)
  const area = innerW * innerH
  const spacingBase = Math.sqrt(area / Math.max(1, sorted.length))
  const spacing = Math.max(72, Math.min(320, spacingBase * 1.9))

  const coerceCommunityKey = (n: GraphNode): string => {
    const props = (n.properties || {}) as Record<string, unknown>
    const raw = props['visual:community']
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
    return ''
  }

  const ignoreCommunities = options?.ignoreCommunities === true

  const missingByCommunity = (() => {
    const map = new Map<string, GraphNode[]>()
    for (let i = 0; i < missing.length; i += 1) {
      const n = missing[i]!
      const key = coerceCommunityKey(n)
      if (!key) continue
      const arr = map.get(key) || []
      arr.push(n)
      map.set(key, arr)
    }
    return map
  })()

  const hasCommunities = !ignoreCommunities && missingByCommunity.size >= 2

  if (!hasCommunities) {
    const aspect = innerW / Math.max(1, innerH)
    const idealCols = Math.ceil(Math.sqrt(Math.max(1, missing.length) * Math.max(0.35, aspect)))
    const maxColsByWidth = Math.max(1, Math.floor(innerW / spacing))
    const cols = Math.max(1, Math.min(maxColsByWidth, idealCols))
    const rows = Math.max(1, Math.ceil(missing.length / cols))
    const gridW = (cols - 1) * spacing
    const gridH = (rows - 1) * spacing
    const startX = cx - gridW / 2
    const startY = cy - gridH / 2
    for (let i = 0; i < missing.length; i += 1) {
      const n = missing[i]!
      const col = i % cols
      const row = Math.floor(i / cols)
      const jx = (hash01(`${String(n.id)}:x`) - 0.5) * Math.min(18, spacing * 0.15)
      const jy = (hash01(`${String(n.id)}:y`) - 0.5) * Math.min(18, spacing * 0.15)
      n.x = startX + col * spacing + jx
      n.y = startY + row * spacing + jy
      n.vx = 0
      n.vy = 0
      n.fx = null
      n.fy = null
    }
    return
  }

  const communityKeys = Array.from(missingByCommunity.keys()).sort((a, b) => a.localeCompare(b))
  const clusterCount = communityKeys.length
  const clusterSpacing = Math.max(260, Math.min(720, spacing * 3.1))
  const aspect = innerW / Math.max(1, innerH)
  const idealClusterCols = Math.ceil(Math.sqrt(Math.max(1, clusterCount) * Math.max(0.55, aspect)))
  const maxClusterColsByWidth = Math.max(1, Math.floor(innerW / clusterSpacing))
  const clusterCols = Math.max(1, Math.min(maxClusterColsByWidth, idealClusterCols))
  const clusterRows = Math.max(1, Math.ceil(clusterCount / clusterCols))
  const clusterGridW = (clusterCols - 1) * clusterSpacing
  const clusterGridH = (clusterRows - 1) * clusterSpacing
  const clusterStartX = cx - clusterGridW / 2
  const clusterStartY = cy - clusterGridH / 2

  const microSpacing = Math.max(48, Math.min(200, spacing * 0.72))

  for (let gi = 0; gi < communityKeys.length; gi += 1) {
    const key = communityKeys[gi]!
    const members = missingByCommunity.get(key) || []
    if (members.length === 0) continue
    const cc = gi % clusterCols
    const rr = Math.floor(gi / clusterCols)
    const centerX = clusterStartX + cc * clusterSpacing
    const centerY = clusterStartY + rr * clusterSpacing

    const localAspect = 1
    const localIdealCols = Math.ceil(Math.sqrt(Math.max(1, members.length) * Math.max(0.55, localAspect)))
    const maxColsLocal = Math.max(1, Math.floor(clusterSpacing / microSpacing))
    const cols = Math.max(1, Math.min(maxColsLocal, localIdealCols))
    const rows = Math.max(1, Math.ceil(members.length / cols))
    const gridW = (cols - 1) * microSpacing
    const gridH = (rows - 1) * microSpacing
    const startX = centerX - gridW / 2
    const startY = centerY - gridH / 2

    for (let i = 0; i < members.length; i += 1) {
      const n = members[i]!
      const col = i % cols
      const row = Math.floor(i / cols)
      const jx = (hash01(`${String(n.id)}:x`) - 0.5) * Math.min(16, microSpacing * 0.18)
      const jy = (hash01(`${String(n.id)}:y`) - 0.5) * Math.min(16, microSpacing * 0.18)
      n.x = startX + col * microSpacing + jx
      n.y = startY + row * microSpacing + jy
      n.vx = 0
      n.vy = 0
      n.fx = null
      n.fy = null
    }
  }
}

export const normalizeSeededLayoutToViewport = (args: { nodes: GraphNode[]; width: number; height: number; viewportCenter?: { x: number; y: number } | null }) => {
  const { nodes, width, height } = args
  if (!nodes || nodes.length < 2) return

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let sumX = 0
  let sumY = 0
  let count = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (!hasFiniteXY(n)) continue
    const x = n.x as number
    const y = n.y as number
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    sumX += x
    sumY += y
    count += 1
  }
  if (count < 2 || minX === Infinity) return
  const spanX = Math.max(1e-6, maxX - minX)
  const spanY = Math.max(1e-6, maxY - minY)
  const targetW = Math.max(1, width - 80)
  const targetH = Math.max(1, height - 80)
  const sx = targetW / spanX
  const sy = targetH / spanY
  const scale = Math.min(sx, sy)

  const tooLarge = spanX > width * 1.6 || spanY > height * 1.6
  const tooSmall = spanX < width * 0.22 && spanY < height * 0.22
  const cx = sumX / count
  const cy = sumY / count
  const tx = args.viewportCenter ? args.viewportCenter.x : width / 2
  const ty = args.viewportCenter ? args.viewportCenter.y : height / 2
  const translateDist = Math.hypot(cx - tx, cy - ty)
  const needsRecenter = translateDist > Math.max(width, height) * 0.26

  if (!tooLarge && !tooSmall && !needsRecenter) return

  const desired = tooLarge
    ? Math.max(0.52, Math.min(0.92, scale))
    : tooSmall
      ? Math.min(1.35, Math.max(1.05, scale))
      : 1
  if (!Number.isFinite(desired) || desired <= 0) return
  if (!needsRecenter && Math.abs(desired - 1) < 0.02) return
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (!hasFiniteXY(n)) continue
    const x = n.x as number
    const y = n.y as number
    n.x = tx + (x - cx) * desired
    n.y = ty + (y - cy) * desired
    n.vx = 0
    n.vy = 0
  }
}

export const distributeComponents = (nodes: GraphNode[], edges: GraphEdge[], width: number, height: number, schema: GraphSchema) => {
  applyCollectiveGraphLayout({ nodes, edges, width, height, schema })
}

export const initializeGraphLayout = (args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  schema: GraphSchema
  seedCenter?: { x: number; y: number } | null
  groupKeyOf?: (n: GraphNode) => string | null
  layoutPositions?: Record<string, { x: number; y: number }> | null
  groupsForBboxCollide?: GraphGroup[]
}) => {
  const { nodes, edges, width, height, schema, seedCenter, groupKeyOf, layoutPositions } = args

  const postFitEnabled = schema.layout?.forces?.postFitForce === true

  if (!nodes || nodes.length < 2) return

  const needsRepair = (): boolean => {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let valid = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      if (!hasFiniteXY(n)) continue
      const x = n.x as number
      const y = n.y as number
      valid += 1
      if (Math.abs(x) > 120000 || Math.abs(y) > 120000) return true
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    if (valid < 2 || minX === Infinity) return false
    const spanX = maxX - minX
    const spanY = maxY - minY
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    const ratio = Math.max(spanX / Math.max(1e-6, spanY), spanY / Math.max(1e-6, spanX))
    const tooFlat = ratio > 12 && Math.max(spanX, spanY) > Math.max(w, h) * 1.5
    const tooLarge = spanX > w * 6 || spanY > h * 6
    return tooFlat || tooLarge
  }

  const usedLayoutPositions = !!layoutPositions

  if (layoutPositions) {
    let applied = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n.id)
      const pos = layoutPositions[id]
      if (!pos) continue
      n.x = pos.x
      n.y = pos.y
      n.vx = 0
      n.vy = 0
      applied += 1
    }

    if (applied >= 3 && applied / Math.max(1, nodes.length) >= 0.2) {
      seedMissingNodePositions(nodes, width, height, seedCenter)
      return
    }

    if (applied >= nodes.length * 0.8) {
      seedMissingNodePositions(nodes, width, height, seedCenter)
      return
    }
  }

  let missing = 0
  for (let i = 0; i < nodes.length; i += 1) {
    if (!hasFiniteXY(nodes[i]!)) missing += 1
  }

  const disjointForceMode = schema.layout?.forces?.disjointComponents !== false
  if (disjointForceMode) {
    const repair = needsRepair()
    if (repair || missing > 0) {
      applyForceModeSeeds({
        nodes,
        edges,
        width,
        height,
        schema,
        groupKeyOf,
        groupsForBboxCollide: Array.isArray(args.groupsForBboxCollide) ? args.groupsForBboxCollide : [],
      })
    }
    if (missing > 0) seedMissingNodePositions(nodes, width, height, seedCenter)
    return
  }

  const repair = needsRepair()
  if (!repair) {
    if (missing === 0) {
      return
    }
    seedMissingNodePositions(nodes, width, height, seedCenter)
    if (missing < nodes.length) {
      return
    }
  }

  applyForceModeSeeds({
    nodes,
    edges,
    width,
    height,
    schema,
    groupKeyOf,
    groupsForBboxCollide: Array.isArray(args.groupsForBboxCollide) ? args.groupsForBboxCollide : [],
  })
  seedMissingNodePositions(nodes, width, height, seedCenter)

  applyCollectiveGraphLayout({ nodes, edges, width, height, schema })

  const padPx = Math.max(24, Math.floor(readFitPadding(schema)))
  if (postFitEnabled) {
    postFitNodesToViewport({
      nodes,
      width: Math.max(1, width),
      height: Math.max(1, Math.floor(height)),
      paddingPx: padPx,
      minScale: 0.06,
      maxScale: 2.2,
      viewportCenter: seedCenter || undefined,
    })
  }
}

const coerceEndpointId = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string') return id
  }
  return null
}

const getInitializationGraphLookup = (args: {
  cacheScope: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}) => {
  const { cacheScope, nodes, edges } = args
  return getCachedGraphLookup({
    cacheScope,
    graphData: { type: 'application/json', nodes, edges },
    graphSemanticKey: hashScopedStringArraySignature(
      cacheScope,
      [
        ...nodes.map(node => {
          const id = String(node?.id || '').trim()
          const x = typeof node?.x === 'number' && Number.isFinite(node.x) ? node.x : ''
          const y = typeof node?.y === 'number' && Number.isFinite(node.y) ? node.y : ''
          return `${id}:${String(node?.type || '').trim()}:${x}:${y}`
        }),
        ...edges.map(edge => {
          const sourceId = coerceEndpointId(edge?.source) || ''
          const targetId = coerceEndpointId(edge?.target) || ''
          return `${String(edge?.id || '').trim()}:${sourceId}:${targetId}:${String(edge?.label || '').trim()}`
        }),
      ],
    ),
  })
}

export const applyBaselineDocumentPositionsToKeywordGraph = (args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  baseline: Record<string, { x: number; y: number }>
  overwriteExisting?: boolean
}) => {
  const { nodes, edges, baseline } = args
  if (!nodes || nodes.length === 0) return
  if (!baseline || Object.keys(baseline).length === 0) return
  const overwriteExisting = args.overwriteExisting === true

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (isFixedNode(n)) continue
    if (!overwriteExisting && hasFiniteXY(n)) continue
    const id = String(n.id || '').trim()
    if (!id) continue

    const direct = baseline[id]
    if (direct) {
      n.x = direct.x
      n.y = direct.y
      n.vx = 0
      n.vy = 0
      if (!isFixedNode(n)) {
        n.fx = null
        n.fy = null
      }
      continue
    }

    if (!id.startsWith('doc:')) continue
    const props = (n.properties || {}) as Record<string, unknown>
    const srcId = typeof props['source:id'] === 'string' ? props['source:id'].trim() : ''
    if (!srcId) continue
    const p = baseline[srcId]
    if (!p) continue
    n.x = p.x
    n.y = p.y
    n.vx = 0
    n.vy = 0
    if (!isFixedNode(n)) {
      n.fx = null
      n.fy = null
    }
  }

  const graphLookup = getInitializationGraphLookup({
    cacheScope: 'graph-canvas-layout-baseline-keyword-graph',
    nodes,
    edges,
  })
  const nodeById = graphLookup?.nodeById || new Map<string, GraphNode>()
  const incidentEdgesByNodeId = graphLookup?.incidentEdgesByNodeId || new Map<string, GraphEdge[]>()
  const neighborIdsByNodeId = buildNodeNeighborSetFromIncidentEdges({
    nodes,
    nodeById,
    incidentEdgesByNodeId,
  })

  const jitter = (id: string, mag: number) => {
    const a = hash01(`${id}:a`) * Math.PI * 2
    const r = (0.4 + 0.6 * hash01(`${id}:r`)) * mag
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r }
  }

  for (let pass = 0; pass < 3; pass += 1) {
    let placed = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      if (hasFiniteXY(n)) continue
      const id = String(n.id || '').trim()
      if (!id) continue
      const neigh = neighborIdsByNodeId.get(id)
      if (!neigh || neigh.size === 0) continue
      let sx = 0
      let sy = 0
      let c = 0
      neigh.forEach(nid => {
        const nn = nodeById.get(nid)
        if (!nn || !hasFiniteXY(nn)) return
        sx += nn.x as number
        sy += nn.y as number
        c += 1
      })
      if (c === 0) continue
      const j = jitter(id, 42 + pass * 22)
      n.x = sx / c + j.dx
      n.y = sy / c + j.dy
      n.vx = 0
      n.vy = 0
      if (!isFixedNode(n)) {
        n.fx = null
        n.fy = null
      }
      placed += 1
    }
    if (placed === 0) break
  }
}

export const seedKeywordEntityNodesFromBaselineSources = (args: {
  keywordNodes: GraphNode[]
  allNodes: GraphNode[]
  allEdges: GraphEdge[]
  baseline: Record<string, { x: number; y: number }>
  overwriteExisting: boolean
}) => {
  const { keywordNodes, allNodes, allEdges, baseline, overwriteExisting } = args
  if (!keywordNodes.length) return
  if (!allNodes.length) return
  if (!allEdges.length) return
  if (!baseline || Object.keys(baseline).length === 0) return

  const graphLookup = getInitializationGraphLookup({
    cacheScope: 'graph-canvas-layout-keyword-source-baseline',
    nodes: allNodes,
    edges: allEdges,
  })
  const nodeById = graphLookup?.nodeById || new Map<string, GraphNode>()

  for (let i = 0; i < allNodes.length; i += 1) {
    const n = allNodes[i]!
    const id = String(n.id || '').trim()
    if (!id.startsWith('doc:')) continue
    const props = (n.properties || {}) as Record<string, unknown>
    const srcId = typeof props['source:id'] === 'string' ? props['source:id'].trim() : ''
    if (!srcId) continue
    const p = baseline[srcId]
    if (!p) continue
    n.x = p.x
    n.y = p.y
    n.vx = 0
    n.vy = 0
    if (!isFixedNode(n)) {
      n.fx = null
      n.fy = null
    }
  }

  const sourceIdsByKeywordId = (() => {
    const map = new Map<string, string[]>()
    const push = (kwId: string, docId: string) => {
      if (!kwId || !docId) return
      const arr = map.get(kwId) || []
      if (arr.includes(docId)) return
      arr.push(docId)
      map.set(kwId, arr)
    }
    for (let i = 0; i < allEdges.length; i += 1) {
      const e = allEdges[i] as unknown as { label?: unknown; source?: unknown; target?: unknown; properties?: unknown }
      if (!e) continue
      if (String(e.label || '') !== 'mentions') continue
      const s = coerceEndpointId(e.source)
      const t = coerceEndpointId(e.target)
      if (!s || !t) continue
      if (!s.startsWith('doc:')) continue
      if (!t.startsWith('kw:')) continue
      push(t, s)
    }
    return map
  })()

  const jitter = (id: string, mag: number) => {
    const a = hash01(`${id}:kwseed:a`) * Math.PI * 2
    const r = (0.25 + 0.75 * hash01(`${id}:kwseed:r`)) * mag
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r }
  }

  for (let i = 0; i < keywordNodes.length; i += 1) {
    const n = keywordNodes[i]!
    if (isFixedNode(n)) continue
    if (!overwriteExisting && hasFiniteXY(n)) continue
    const id = String(n.id || '').trim()
    if (!id.startsWith('kw:')) continue
    const srcs = sourceIdsByKeywordId.get(id)
    if (!srcs || srcs.length === 0) continue

    let sx = 0
    let sy = 0
    let c = 0
    for (let j = 0; j < srcs.length; j += 1) {
      const docId = srcs[j]!
      const dn = nodeById.get(docId)
      if (!dn || !hasFiniteXY(dn)) continue
      sx += dn.x as number
      sy += dn.y as number
      c += 1
    }
    if (c === 0) continue

    const j = jitter(id, 46)
    n.x = sx / c + j.dx
    n.y = sy / c + j.dy
    n.vx = 0
    n.vy = 0
    if (!isFixedNode(n)) {
      n.fx = null
      n.fy = null
    }
  }
}

export const layoutLooksUnstableForViewport = (args: {
  nodes: GraphNode[]
  width: number
  height: number
  viewportCenter?: { x: number; y: number } | null
}): boolean => {
  const { nodes, width, height } = args
  if (!nodes || nodes.length < 2) return false

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let valid = 0
  let extreme = 0
  let sumX = 0
  let sumY = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (!hasFiniteXY(n)) continue
    const x = n.x as number
    const y = n.y as number
    valid += 1
    sumX += x
    sumY += y
    if (Math.abs(x) > 120000 || Math.abs(y) > 120000) extreme += 1
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (valid < 2 || minX === Infinity) return false
  if (extreme > 0) return true

  const spanX = maxX - minX
  const spanY = maxY - minY
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const ratio = Math.max(spanX / Math.max(1e-6, spanY), spanY / Math.max(1e-6, spanX))
  const tooFlat = ratio > 12 && Math.max(spanX, spanY) > Math.max(w, h) * 1.5
  const tooLarge = spanX > w * 6 || spanY > h * 6
  const tooSmall = spanX < Math.max(90, w * 0.12) && spanY < Math.max(90, h * 0.12)

  const cx = sumX / valid
  const cy = sumY / valid
  const tx = args.viewportCenter ? args.viewportCenter.x : w / 2
  const ty = args.viewportCenter ? args.viewportCenter.y : h / 2
  const dist = Math.hypot(cx - tx, cy - ty)
  const offCenter = dist > Math.max(w, h) * 0.42

  const bboxArea = Math.max(1e-6, spanX * spanY)
  const viewportArea = Math.max(1, w * h)
  const coverage = bboxArea / viewportArea
  const tooClustered = coverage < 0.014 && Math.max(spanX, spanY) < Math.max(w, h) * 0.45
  const tooLiney = ratio > 14 && Math.max(spanX, spanY) < Math.max(w, h) * 0.7

  return tooLarge || tooSmall || tooFlat || offCenter || tooClustered || tooLiney
}
