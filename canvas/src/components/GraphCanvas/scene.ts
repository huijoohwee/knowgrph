import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createZoom } from '@/components/GraphCanvas/zoom'
import { buildSimulation } from '@/components/GraphCanvas/simulation'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { relaxNodesWithCollision } from '@/components/GraphCanvas/layout/relax'
import { postFitNodesToViewport } from '@/components/GraphCanvas/layout/postFit'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { hideTempLink, cancelPendingEdge } from '@/features/edge-creation'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight'
import { createDefs, createGroupsLayer, createLinksHitLayer, createLinksLayer, createEdgeLabelsLayer, createNodesLayer, createTempLink, createLabelsLayer } from '@/components/GraphCanvas/sceneLayers'
import { attachGlobalHandlers, attachSimulationTick } from '@/components/GraphCanvas/sceneHandlers'
import { applyGraphCanvasZOrder } from '@/components/GraphCanvas/zOrder'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { readFitPadding } from '@/lib/graph/layoutDefaults'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

type SetupGraphSceneArgs = {
  svgEl: SVGSVGElement
  svgRef: RefObject<SVGSVGElement>
  graphData: GraphData
  graphDataRevision: number
  schema: GraphSchema
  edgesForSim: GraphEdge[]
  width: number
  height: number
  hoverEnabled: boolean
  zoomOnDoubleClick: boolean
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  fitToScreenMode?: boolean
  viewportControlsPreset: ViewportControlsPreset
  initialZoomTransform?: { k: number; x: number; y: number } | null
  layoutPositionsForMode?: Record<string, { x: number; y: number }> | null
  baselineLayoutPositions?: Record<string, { x: number; y: number }> | null
  prevPositions?: Record<string, { x: number; y: number }> | null
  skipInitialLayout?: boolean
  freezeSimulation?: boolean
  groupsForBboxCollide: GraphGroup[]
  layoutGroupKeyByNodeId: Record<string, string> | null
  gRef: MutableRefObject<GSelection | null>
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  groupChevronSelRef: MutableRefObject<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  portHandlesSelRef: MutableRefObject<
    d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null
  >
  linksHitSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  linksSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  beforeRenderFrameRef: MutableRefObject<(() => void) | null>
  selectedEdgeIdRef: MutableRefObject<string | null>
  selectedNodeIdRef: MutableRefObject<string | null>
  selectedNodeIdsRef: MutableRefObject<string[] | undefined>
  selectedEdgeIdsRef: MutableRefObject<string[] | undefined>
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  selectGroup: (id: string | null) => void
  selectGroupExpanded: (args: { id: string; nodeIds: string[]; edgeIds: string[] }) => void
  toggleGroupCollapsed: (id: string) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  addEdge: (e: GraphEdge) => void
  updateEdge: (id: string, u: Partial<GraphEdge>) => void
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setLifecycleStageRendering: () => void
  requestZoomSelection: () => void
  onZoomTransform: (t: { k: number; x: number; y: number }) => void
  edgeScrollEnabled?: () => boolean
  getSchema: () => GraphSchema
  getRenderMediaAsNodes: () => boolean
  layoutCacheKey: string | null
  setLayoutPositionsForMode: ((key: string, positions: Record<string, { x: number; y: number }> | null) => void) | null
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const hasFiniteXY = (n: GraphNode): boolean => isFiniteNumber((n as unknown as { x?: unknown }).x) && isFiniteNumber((n as unknown as { y?: unknown }).y)

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

const seedMissingNodePositions = (
  nodes: GraphNode[],
  width: number,
  height: number,
  seedCenter: { x: number; y: number } | null,
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
  const spacing = Math.max(64, Math.min(220, spacingBase * 1.6))

  const coerceCommunityKey = (n: GraphNode): string => {
    const props = (n.properties || {}) as Record<string, unknown>
    const raw = props['visual:community']
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
    return ''
  }

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

  const hasCommunities = missingByCommunity.size >= 2

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
  const clusterSpacing = Math.max(220, Math.min(560, spacing * 3.1))
  const aspect = innerW / Math.max(1, innerH)
  const idealClusterCols = Math.ceil(Math.sqrt(Math.max(1, clusterCount) * Math.max(0.55, aspect)))
  const maxClusterColsByWidth = Math.max(1, Math.floor(innerW / clusterSpacing))
  const clusterCols = Math.max(1, Math.min(maxClusterColsByWidth, idealClusterCols))
  const clusterRows = Math.max(1, Math.ceil(clusterCount / clusterCols))
  const clusterGridW = (clusterCols - 1) * clusterSpacing
  const clusterGridH = (clusterRows - 1) * clusterSpacing
  const clusterStartX = cx - clusterGridW / 2
  const clusterStartY = cy - clusterGridH / 2

  const microSpacing = Math.max(42, Math.min(160, spacing * 0.72))

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

const coerceEndpointId = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string') return id
  }
  return null
}

const applyBaselineDocumentPositionsToKeywordGraph = (args: {
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

  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    nodeById.set(String(nodes[i]!.id), nodes[i]!)
  }

  const neighborIdsByNodeId = (() => {
    const map = new Map<string, Set<string>>()
    const push = (a: string, b: string) => {
      if (!a || !b) return
      const s = map.get(a) || new Set<string>()
      s.add(b)
      map.set(a, s)
    }
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]!
      const s = coerceEndpointId((e as unknown as { source?: unknown }).source)
      const t = coerceEndpointId((e as unknown as { target?: unknown }).target)
      if (!s || !t) continue
      push(s, t)
      push(t, s)
    }
    return map
  })()

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

const keywordLayoutLooksUnstable = (args: { nodes: GraphNode[]; width: number; height: number }): boolean => {
  const { nodes, width, height } = args
  if (!nodes || nodes.length < 2) return false

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let valid = 0
  let extreme = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (!hasFiniteXY(n)) continue
    const x = n.x as number
    const y = n.y as number
    valid += 1
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
  const tooLarge = spanX > w * 6 || spanY > h * 6
  const tooSmall = spanX < Math.max(90, w * 0.12) && spanY < Math.max(90, h * 0.12)
  return tooLarge || tooSmall
}

const normalizeSeededLayoutToViewport = (args: { nodes: GraphNode[]; width: number; height: number }) => {
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
  if (!tooLarge && !tooSmall) return

  const desired = tooLarge
    ? Math.max(0.52, Math.min(0.92, scale))
    : Math.min(1.35, Math.max(1.05, scale))
  if (!Number.isFinite(desired) || desired <= 0) return
  if (Math.abs(desired - 1) < 0.02) return

  const cx = sumX / count
  const cy = sumY / count
  const tx = width / 2
  const ty = height / 2
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

export const setupGraphScene = (args: SetupGraphSceneArgs) => {
  const {
    svgEl,
    svgRef,
    graphData,
    schema,
    edgesForSim,
    width,
    height,
    hoverEnabled,
    zoomOnDoubleClick,
    renderMediaAsNodes,
    mediaPanelDensity,
    fitToScreenMode,
    viewportControlsPreset,
    initialZoomTransform,
    layoutPositionsForMode,
    baselineLayoutPositions,
    prevPositions,
    skipInitialLayout,
    gRef,
    nodesSelRef,
    groupChevronSelRef,
    mediaSelRef,
    portHandlesSelRef,
    linksHitSelRef,
    linksSelRef,
    labelsSelRef,
    zoomRef,
    tempLinkSelRef,
    linkDragRef,
    simulationRef,
    sceneGraphDataRef,
    beforeRenderFrameRef,
    selectedEdgeIdRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    selectNode,
    selectEdge,
    selectGroup,
    selectGroupExpanded,
    toggleGroupCollapsed,
    setSelectionSource,
    setHoverInfo,
    setLifecycleStageRendering,
    requestZoomSelection,
    onZoomTransform,
    getSchema,
    getRenderMediaAsNodes,
    layoutCacheKey,
    setLayoutPositionsForMode,
  } = args

  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()
  svg.attr('data-kg-layout-frozen', null)

  const g = svg.append('g')
  gRef.current = g

  createDefs(svg)

  const display = deriveSceneDisplayGraph({ graphData, edges: edgesForSim || [] })
  const graphDataForDisplay = display?.displayGraphData || graphData
  sceneGraphDataRef.current = graphDataForDisplay
  const displayNodes = Array.isArray(graphDataForDisplay.nodes) ? (graphDataForDisplay.nodes as GraphNode[]) : []
  const edgesForDisplay = Array.isArray(graphDataForDisplay.edges) ? (graphDataForDisplay.edges as GraphEdge[]) : []

  const zoom = createZoom(svg, g, labelsSelRef, schema, viewportControlsPreset, onZoomTransform, () => {
    if (!nodesSelRef.current && !labelsSelRef.current && !linksSelRef.current && !mediaSelRef.current) return
    const schemaValue = getSchema()
    applySelectionHighlight(
      nodesSelRef.current,
      mediaSelRef.current,
      labelsSelRef.current,
      linksSelRef.current,
          graphDataForDisplay,
          schemaValue,
          selectedNodeIdRef.current,
          selectedEdgeIdRef.current,
          selectedNodeIdsRef.current,
          selectedEdgeIdsRef.current,
          getRenderMediaAsNodes(),
        )
  })
  zoomRef.current = zoom
  const applyInitialTransform = (t: { k: number; x: number; y: number } | null) => {
    if (!t) return
    const k = typeof t.k === 'number' && Number.isFinite(t.k) ? t.k : 1
    const x = typeof t.x === 'number' && Number.isFinite(t.x) ? t.x : 0
    const y = typeof t.y === 'number' && Number.isFinite(t.y) ? t.y : 0
    const next = d3.zoomIdentity.translate(x, y).scale(k)
    svg.call(
      zoom.transform as unknown as (
        sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        t: d3.ZoomTransform,
      ) => void,
      next,
    )
  }

  const applyCachedPositions = () => {
    const cached = layoutPositionsForMode && Object.keys(layoutPositionsForMode).length > 0 ? layoutPositionsForMode : null
    const prev = prevPositions && Object.keys(prevPositions).length > 0 ? prevPositions : null
    const source = cached || prev

    if (!source) return
    for (let i = 0; i < displayNodes.length; i += 1) {
      const node = displayNodes[i]
      const p = source[String(node.id)]
      if (!p) continue
      const x = typeof p.x === 'number' ? p.x : null
      const y = typeof p.y === 'number' ? p.y : null
      if (x == null || y == null) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      node.x = x
      node.y = y
      node.vx = 0
      node.vy = 0
      node.fx = null
      node.fy = null
    }
  }

  if (skipInitialLayout) {
    applyCachedPositions()
  } else {
    // If not skipping layout, we still want to apply prev positions as initial guess for force layout
    // to avoid chaos when switching from tree -> force
    applyCachedPositions()
  }

  const isKeywordGraph = (() => {
    const meta = (graphDataForDisplay.metadata || {}) as Record<string, unknown>
    return meta.kind === 'keyword'
  })()

  if (isKeywordGraph && baselineLayoutPositions) {
    applyBaselineDocumentPositionsToKeywordGraph({
      nodes: displayNodes,
      edges: edgesForDisplay,
      baseline: baselineLayoutPositions,
      overwriteExisting: !skipInitialLayout || keywordLayoutLooksUnstable({ nodes: displayNodes, width, height }),
    })
  }

  const seedCenter = (() => {
    if (!initialZoomTransform) return null
    const k = typeof initialZoomTransform.k === 'number' && Number.isFinite(initialZoomTransform.k) && initialZoomTransform.k > 0 ? initialZoomTransform.k : 1
    const x = typeof initialZoomTransform.x === 'number' && Number.isFinite(initialZoomTransform.x) ? initialZoomTransform.x : 0
    const y = typeof initialZoomTransform.y === 'number' && Number.isFinite(initialZoomTransform.y) ? initialZoomTransform.y : 0
    return { x: (width / 2 - x) / k, y: (height / 2 - y) / k }
  })()

  seedMissingNodePositions(displayNodes, width, height, seedCenter)

  normalizeSeededLayoutToViewport({ nodes: displayNodes, width, height })

  const effectiveSkipInitialLayout = (() => {
    if (!skipInitialLayout) return false
    if (!isKeywordGraph) return true
    if (keywordLayoutLooksUnstable({ nodes: displayNodes, width, height })) return false
    return true
  })()

  const pendingInitialFitIntent: 'fitToScreen' | 'initialFit' | null = initialZoomTransform
    ? null
    : fitToScreenMode
      ? 'fitToScreen'
      : 'initialFit'

  const groupKeyByNodeId = args.layoutGroupKeyByNodeId
  const groupKeyOf = (n: GraphNode): string | null => {
    const id = String(n.id || '').trim()
    if (!id || !groupKeyByNodeId) return null
    return groupKeyByNodeId[id] || null
  }
  const simulation = buildSimulation(displayNodes, edgesForDisplay, Math.max(1, width), Math.max(1, Math.floor(height)), schema, {
    skipInitialLayout: !!effectiveSkipInitialLayout,
    groupKeyOf,
    groupsForBboxCollide: args.groupsForBboxCollide,
  })
  simulationRef.current = simulation

  if (!effectiveSkipInitialLayout && displayNodes.length > 1) {
    const dupCounts = new Map<string, number>()
    for (let i = 0; i < displayNodes.length; i += 1) {
      const n = displayNodes[i]
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
      n.x = x
      n.y = y
      const key = `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
      dupCounts.set(key, (dupCounts.get(key) || 0) + 1)
    }

    const jitterFor = (id: string): { dx: number; dy: number } => {
      let h = 0
      for (let i = 0; i < id.length; i += 1) {
        h = (h * 31 + id.charCodeAt(i)) >>> 0
      }
      const sx = ((h % 7) - 3) * 0.11
      const sy = (((h >>> 3) % 7) - 3) * 0.11
      return { dx: sx, dy: sy }
    }

    for (let i = 0; i < displayNodes.length; i += 1) {
      const n = displayNodes[i]
      const x = n.x as number
      const y = n.y as number
      const key = `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
      if ((dupCounts.get(key) || 0) <= 1) continue
      const j = jitterFor(String(n.id || ''))
      n.x = x + j.dx
      n.y = y + j.dy
    }

    relaxNodesWithCollision({
      nodes: displayNodes,
      edges: edgesForDisplay,
      schema,
      defaultSteps: (args.groupsForBboxCollide || []).length > 0 ? 18 : 12,
      groupKeyOf,
      groups: args.groupsForBboxCollide,
    })

    for (let i = 0; i < displayNodes.length; i += 1) {
      const n = displayNodes[i]
      n.vx = 0
      n.vy = 0
    }

    if (isKeywordGraph) {
      const padPx = Math.max(24, Math.floor(readFitPadding(schema)))
      postFitNodesToViewport({
        nodes: displayNodes,
        width: Math.max(1, width),
        height: Math.max(1, Math.floor(height)),
        paddingPx: padPx,
        minScale: 0.06,
        maxScale: 2.6,
      })
    }
  }

  if (initialZoomTransform) {
    applyInitialTransform(initialZoomTransform)
  } else if (pendingInitialFitIntent) {
    const intent = pendingInitialFitIntent
    const mode = readLayoutMode(schema)
    const opts = readFitAllOptions({ schema, mode, intent })
    const t = fitAllTransform(displayNodes, Math.max(1, width), Math.max(1, Math.floor(height)), opts)
    applyInitialTransform({ k: t.k, x: t.x, y: t.y })
  }

  if (args.freezeSimulation === true) {
    try {
      simulation.alpha(0)
      simulation.alphaTarget(0)
      simulation.stop()
    } catch {
      void 0
    }
    svg.attr('data-kg-layout-frozen', '1')
  }

  const groupsLayer = createGroupsLayer({
    g,
    graphData,
    edgesForDisplay,
    schema,
    simulation,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectGroup,
    selectGroupExpanded,
    toggleGroupCollapsed,
  })
  beforeRenderFrameRef.current = groupsLayer?.update ? () => groupsLayer.update() : null
  // Legacy layout sync removed to prevent infinite re-render loop in Force layout mode.

  const linkHitSel = createLinksHitLayer({
    g,
    edgesForDisplay,
    schema,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectEdge,
  })
  linksHitSelRef.current = linkHitSel

  const { nodeSel, mediaSel, portHandlesSel, groupChevronSel } = createNodesLayer({
    g,
    graphData: graphDataForDisplay,
    schema,
    renderMediaAsNodes,
    mediaPanelDensity,
    zoomOnDoubleClick,
    tempLinkSelRef,
    linkDragRef,
    simulation,
    hoverEnabled,
    setHoverInfo,
    selectNode,
    selectEdge,
    setSelectionSource,
    requestZoomSelection,
    toggleGroupCollapsed,
    edgeScroll: {
      enabled: () => (typeof args.edgeScrollEnabled === 'function' ? args.edgeScrollEnabled() : true),
      panByPx: (dx, dy) => {
        svg.call(
          zoom.translateBy as unknown as (
            sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
            x: number,
            y: number,
          ) => void,
          dx,
          dy,
        )
      },
    },
  })
  nodesSelRef.current = nodeSel
  groupChevronSelRef.current = groupChevronSel
  mediaSelRef.current = mediaSel
  portHandlesSelRef.current = portHandlesSel

  const linkSel = createLinksLayer({
    g,
    edgesForDisplay,
    schema,
  })
  linksSelRef.current = linkSel

  const edgeLabelSel = createEdgeLabelsLayer({
    g,
    edgesForDisplay,
    schema,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectEdge,
  })

  createTempLink(g, tempLinkSelRef)

  createLabelsLayer({
    g,
    nodes: graphDataForDisplay.nodes,
    schema,
    labelsSelRef,
    hoverEnabled,
    setHoverInfo,
    selectNode,
    selectEdge,
    setSelectionSource,
  })

  const isForceLayout = readLayoutMode(schema) === 'force'

  const storeLayoutPositions = () => {
    if (!layoutCacheKey || typeof setLayoutPositionsForMode !== 'function') return
    const positions: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < graphDataForDisplay.nodes.length; i += 1) {
      const node = graphDataForDisplay.nodes[i]
      const id = String(node.id)
      if (!id) continue
      const x = typeof node.x === 'number' ? node.x : null
      const y = typeof node.y === 'number' ? node.y : null
      if (x == null || y == null) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      positions[id] = { x, y }
    }
    if (Object.keys(positions).length > 0) {
      setLayoutPositionsForMode(layoutCacheKey, positions)
    }
  }
  if (labelsSelRef.current) {
    const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0
    const k = d3.zoomTransform(svgEl).k || 1
    const hidden = hideBelow > 0 && k < hideBelow
    labelsSelRef.current.attr('data-zoom-lod-hidden', hidden ? '1' : '0')

    let stableTicks = 0
    let finalFitApplied = false
    attachSimulationTick({
      svgEl,
      simulation,
      nodeSelRef: nodesSelRef,
      groupChevronSelRef,
      mediaSelRef,
      portHandlesSelRef,
      linkHitSelRef: linksHitSelRef,
      linkSelRef: linksSelRef,
      edgeLabelSel,
      labelsSelRef,
      nodes: graphDataForDisplay.nodes,
      nodeById: display?.nodeById || null,
      getSchema,
      width,
      height,
      beforeRenderFrameRef,
      afterRenderFrame: ({ alpha, tick }) => {
        if (!isForceLayout) return
        if (finalFitApplied) return
        if (args.freezeSimulation === true) return
        if (initialZoomTransform) return
        if (effectiveSkipInitialLayout) return
        if (tick < 20) return

        if (alpha < 0.045) {
          stableTicks += 1
        } else {
          stableTicks = 0
        }
        if (stableTicks < 12) return

        if (isKeywordGraph) {
          const padPx = Math.max(24, Math.floor(readFitPadding(getSchema())))
          postFitNodesToViewport({
            nodes: displayNodes,
            width: Math.max(1, width),
            height: Math.max(1, Math.floor(height)),
            paddingPx: padPx,
            minScale: 0.04,
            maxScale: 1.6,
          })
        }

        const intent = fitToScreenMode ? 'fitToScreen' : 'fitToView'
        const schemaValue = getSchema()
        const mode = readLayoutMode(schemaValue)
        const baseOpts = readFitAllOptions({ schema: schemaValue, mode, intent })
        const opts = isKeywordGraph && intent === 'fitToView' ? { ...baseOpts, detectClusters: true } : baseOpts
        const t = fitAllTransform(displayNodes, Math.max(1, width), Math.max(1, Math.floor(height)), opts)
        applyInitialTransform({ k: t.k, x: t.x, y: t.y })
        finalFitApplied = true

        try {
          simulation.alphaTarget(0)
          simulation.alpha(0)
          simulation.stop()
        } catch {
          void 0
        }
        svg.attr('data-kg-layout-frozen', '1')
        storeLayoutPositions()
      },
    })
  }

  applyGraphCanvasZOrder(g, args.schema)

  simulation.on('end.layoutCache', storeLayoutPositions)

  const layoutMode = readLayoutMode(schema)
  if (layoutMode === 'radial') {
    simulation.stop()
    storeLayoutPositions()
    svg.attr('data-kg-layout-frozen', '1')
  }

  setLifecycleStageRendering()

  const cleanupHandlers = attachGlobalHandlers({
    svgRef,
    svg,
    tempLinkSelRef,
    linkDragRef,
    selectNode,
    hideTemp: () => hideTempLink(tempLinkSelRef),
    cancelPending: () => cancelPendingEdge(linkDragRef),
  })

  return () => {
    storeLayoutPositions()
    simulation.on('end.layoutCache', null)
    simulation.stop()
    simulationRef.current = null
    sceneGraphDataRef.current = null
    beforeRenderFrameRef.current = null
    cleanupHandlers()
  }
}

export const updateGraphSceneNodesPresentation = (args: {
  svgEl: SVGSVGElement
  gRef: MutableRefObject<GSelection | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  edgeScrollEnabled?: () => boolean
  schema: GraphSchema
  hoverEnabled: boolean
  zoomOnDoubleClick: boolean
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  groupChevronSelRef: MutableRefObject<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  portHandlesSelRef: MutableRefObject<
    d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null
  >
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  requestZoomSelection: () => void
  toggleGroupCollapsed: (id: string) => void
}) => {
  const g = args.gRef.current
  const sim = args.simulationRef.current
  const graphData = args.sceneGraphDataRef.current
  if (!g || !sim || !graphData) return

  const zoom = args.zoomRef.current
  const svgEl = args.svgEl
  const svg = d3.select(svgEl)

  g.selectAll('[data-kg-layer="media"]').remove()
  g.selectAll('[data-kg-layer="nodes"]').remove()
  g.selectAll('[data-kg-layer="node-chevrons"]').remove()
  g.selectAll('[data-kg-layer="port-handles"]').remove()
  g.selectAll('[data-kg-layer="labels"]').remove()

  const { nodeSel, mediaSel, portHandlesSel, groupChevronSel } = createNodesLayer({
    g,
    graphData,
    schema: args.schema,
    renderMediaAsNodes: args.renderMediaAsNodes,
    mediaPanelDensity: args.mediaPanelDensity,
    zoomOnDoubleClick: args.zoomOnDoubleClick,
    tempLinkSelRef: args.tempLinkSelRef,
    linkDragRef: args.linkDragRef,
    simulation: sim,
    hoverEnabled: args.hoverEnabled,
    setHoverInfo: args.setHoverInfo,
    selectNode: args.selectNode,
    selectEdge: args.selectEdge,
    setSelectionSource: args.setSelectionSource,
    requestZoomSelection: args.requestZoomSelection,
    toggleGroupCollapsed: args.toggleGroupCollapsed,
    edgeScroll:
      zoom && svgEl
        ? {
            enabled: () => (typeof args.edgeScrollEnabled === 'function' ? args.edgeScrollEnabled() : true),
            panByPx: (dx, dy) => {
              svg.call(
                zoom.translateBy as unknown as (
                  sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
                  x: number,
                  y: number,
                ) => void,
                dx,
                dy,
              )
            },
          }
        : undefined,
  })

  args.nodesSelRef.current = nodeSel
  args.groupChevronSelRef.current = groupChevronSel
  args.mediaSelRef.current = mediaSel
  args.portHandlesSelRef.current = portHandlesSel

  createLabelsLayer({
    g,
    nodes: graphData.nodes,
    schema: args.schema,
    labelsSelRef: args.labelsSelRef,
    hoverEnabled: args.hoverEnabled,
    setHoverInfo: args.setHoverInfo,
    selectNode: args.selectNode,
    selectEdge: args.selectEdge,
    setSelectionSource: args.setSelectionSource,
  })

  applyGraphCanvasZOrder(g, args.schema)
}

export const updateGraphSceneGroupsPresentation = (args: {
  gRef: MutableRefObject<GSelection | null>
  schema: GraphSchema
  graphData: GraphData
  beforeRenderFrameRef: MutableRefObject<(() => void) | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  hoverEnabled: boolean
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  selectNode: (id: string | null) => void
  selectGroup: (id: string | null) => void
  selectGroupExpanded: (args: { id: string; nodeIds: string[]; edgeIds: string[] }) => void
  toggleGroupCollapsed: (id: string) => void
}) => {
  const g = args.gRef.current
  if (!g) return
  g.selectAll('[data-kg-layer="groups"]').remove()
  g.selectAll('[data-kg-layer="group-labels"]').remove()
  const display = deriveSceneDisplayGraph({ graphData: args.graphData })
  const edgesForDisplay = display ? display.displayEdges : ([] as GraphEdge[])

  const sim = args.simulationRef.current
  const groupsLayer = createGroupsLayer({
    g,
    graphData: args.graphData,
    edgesForDisplay,
    schema: args.schema,
    simulation: sim,
    hoverEnabled: args.hoverEnabled,
    setHoverInfo: args.setHoverInfo,
    setSelectionSource: args.setSelectionSource,
    selectNode: args.selectNode,
    selectGroup: args.selectGroup,
    selectGroupExpanded: args.selectGroupExpanded,
    toggleGroupCollapsed: args.toggleGroupCollapsed,
  })
  args.beforeRenderFrameRef.current = groupsLayer?.update ? () => groupsLayer.update() : null
  
  applyGraphCanvasZOrder(g, args.schema)
}
