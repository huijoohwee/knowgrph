import { applyStratifyLayout } from '@/components/GraphCanvas/layout/stratify'
import { determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { parseJsonLd } from '@/lib/graph/jsonld/index'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { readFitPadding } from '@/lib/graph/layoutDefaults'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoDocumentPath } from '@/tests/lib/markdownSlideDemo'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { pickEdgeLabelPlacement } from '@/components/GraphCanvas/layout/utils'
import { readFlowConfig } from '@/components/FlowCanvas/config'

export const testStratifyLayoutProducesStableLayering = () => {
  const schema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      mode: 'stratify' as const,
      stratify: {
        ...(defaultSchema.layout?.stratify || {}),
        orientation: 'vertical' as const,
        groupRoots: true,
      },
    },
  }

  const nodes: GraphNode[] = [
    { id: 'root', label: 'Root', type: 'T', properties: {} },
    { id: 'a', label: 'Alpha Child With A Longer Label', type: 'T', properties: {} },
    { id: 'b', label: 'Beta', type: 'T', properties: {} },
    { id: 'c', label: 'Gamma Grandchild', type: 'T', properties: {} },
  ]

  const edges: GraphEdge[] = [
    { id: 'e1', label: 'pointsTo', source: 'root', target: 'a', properties: {} },
    { id: 'e2', label: 'pointsTo', source: 'root', target: 'b', properties: {} },
    { id: 'e3', label: 'pointsTo', source: 'a', target: 'c', properties: {} },
  ]

  const ok = applyStratifyLayout(nodes, edges, 900, 600, schema, () => '')
  if (!ok) throw new Error('expected stratify layout to succeed')

  const byId = new Map(nodes.map(n => [String(n.id), n] as const))
  const root = byId.get('root')
  const a = byId.get('a')
  const b = byId.get('b')
  const c = byId.get('c')
  if (!root || !a || !b || !c) throw new Error('missing nodes after layout')

  const isFiniteXY = (n: GraphNode) =>
    typeof n.x === 'number' && Number.isFinite(n.x) && typeof n.y === 'number' && Number.isFinite(n.y)
  if (!isFiniteXY(root) || !isFiniteXY(a) || !isFiniteXY(b) || !isFiniteXY(c)) {
    throw new Error('expected stratify layout to assign finite x/y for all nodes')
  }

  if (!(a.y! > root.y!)) throw new Error('expected child to have greater y than parent in vertical stratify')
  if (!(b.y! > root.y!)) throw new Error('expected child to have greater y than parent in vertical stratify')
  if (!(c.y! > a.y!)) throw new Error('expected grandchild to have greater y than parent in vertical stratify')

  const siblingSep = Math.abs((a.x ?? 0) - (b.x ?? 0))
  if (!(siblingSep > 8)) throw new Error(`expected siblings to be separated; got |dx|=${siblingSep}`)

  const slideText = readMarkdownSlideDemo()
  if (!slideText) throw new Error('expected markdown slide demo fixture to be available')
  const docPath = resolveMarkdownSlideDemoDocumentPath() ?? 'markdown-slide-demo.md'
  const jsonld = buildMarkdownJsonLd(docPath, slideText)
  const graph = parseJsonLd(jsonld)
  const filtered = filterGraphToFrontmatterMermaid(graph)
  const demoNodes = Array.isArray(filtered.nodes) ? filtered.nodes : []
  const demoEdges = Array.isArray(filtered.edges) ? filtered.edges : []
  if (demoNodes.length === 0) throw new Error('expected slide demo to yield non-empty frontmatter mermaid graph')
  const ok2 = applyStratifyLayout(demoNodes, demoEdges, 1200, 700, schema, () => '')
  if (!ok2) throw new Error('expected stratify layout to succeed on slide demo graph')
  const coverage = (() => {
    let ok = 0
    for (let i = 0; i < demoNodes.length; i += 1) {
      const n = demoNodes[i]
      if (typeof n.x === 'number' && Number.isFinite(n.x) && typeof n.y === 'number' && Number.isFinite(n.y)) ok += 1
    }
    return ok / Math.max(1, demoNodes.length)
  })()
  if (coverage < 0.95) throw new Error(`expected stratify layout to position most demo nodes; got coverage=${coverage}`)
}

export const testStratifyLayoutDefaultsMatchFlowSpacing = () => {
  const schema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      fitPadding: 24,
      mode: 'stratify' as const,
      forces: {
        ...(defaultSchema.layout?.forces || {}),
        structuredRelaxSteps: 0,
        bboxCollide: false,
        groupBboxCollide: false,
      },
      stratify: {
        ...(defaultSchema.layout?.stratify || {}),
        orientation: 'vertical' as const,
        grid: { enabled: false },
      },
    },
  }

  const padding = readFitPadding(schema)
  const flow = readFlowConfig({ schema, rankdir: 'TB' })

  const nodes: GraphNode[] = [
    { id: 'root', label: 'X', type: 'T', properties: {} },
    { id: 'a', label: 'X', type: 'T', properties: {} },
    { id: 'b', label: 'X', type: 'T', properties: {} },
  ]

  const edges: GraphEdge[] = [
    { id: 'e1', label: 'pointsTo', source: 'root', target: 'a', properties: {} },
    { id: 'e2', label: 'pointsTo', source: 'root', target: 'b', properties: {} },
  ]

  let maxW = 0
  let maxH = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const ext = getNodeAabbHalfExtentsWithLabel(nodes[i], schema)
    maxW = Math.max(maxW, Math.max(8, ext.halfW * 2))
    maxH = Math.max(maxH, Math.max(8, ext.halfH * 2))
  }

  const expectedNodeGap = flow.elk.nodeNodeSpacingPx
  const expectedRankGap = flow.elk.layerSpacingPx
  const breadthStep = Math.max(24, maxW + expectedNodeGap)
  const depthStep = Math.max(32, maxH + expectedRankGap)

  const width = padding * 2 + breadthStep
  const height = padding * 2 + depthStep
  const ok = applyStratifyLayout(nodes, edges, width, height, schema, () => '')
  if (!ok) throw new Error('expected stratify layout to succeed')

  const ax = nodes.find(n => n.id === 'a')?.x
  const bx = nodes.find(n => n.id === 'b')?.x
  if (typeof ax !== 'number' || !Number.isFinite(ax)) throw new Error('expected node a to have numeric x')
  if (typeof bx !== 'number' || !Number.isFinite(bx)) throw new Error('expected node b to have numeric x')

  const sep = Math.abs(ax - bx)
  const eps = 1e-3
  if (Math.abs(sep - breadthStep) > eps) {
    throw new Error(`expected sibling separation ~${breadthStep}, got ${sep}`)
  }
}

export const testStratifyLayoutDoesNotReuseForceCacheKey = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
    { id: 'b', label: 'b', type: 'T', x: 30, y: 40, properties: {} },
  ]

  const cache = {
    'document:default:force:2d:d3': {
      a: { x: 1, y: 2 },
      b: { x: 3, y: 4 },
    },
  }

  const res = determineLayoutPositions({
    mode: 'stratify',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevMode: 'force',
    prevFrontmatterMode: false,
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    nodes,
    layoutPositionCacheByMode: cache,
  })

  if (res.cacheKey !== 'document:default:stratify:2d:d3') {
    throw new Error(`expected cacheKey document:default:stratify:2d:d3, got ${res.cacheKey}`)
  }
  if (res.layoutPositionsForMode !== null) {
    throw new Error('expected stratify mode not to reuse force cache')
  }
  if (res.skipInitialLayout !== false) {
    throw new Error('expected stratify to run initial layout when switching from force without cache')
  }
}

export const testStratifyLayoutSnapsToGrid = () => {
  const schema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      mode: 'stratify' as const,
      stratify: {
        ...(defaultSchema.layout?.stratify || {}),
        orientation: 'vertical' as const,
        grid: { enabled: true, size: 200, strength: 0.9, steps: 30 },
      },
    },
  }

  const nodes: GraphNode[] = [
    { id: 'root', label: 'Root', type: 'T', properties: {} },
    { id: 'a', label: 'A', type: 'T', properties: {} },
    { id: 'b', label: 'B', type: 'T', properties: {} },
    { id: 'c', label: 'C', type: 'T', properties: {} },
    { id: 'd', label: 'D', type: 'T', properties: {} },
  ]

  const edges: GraphEdge[] = [
    { id: 'e1', label: 'pointsTo', source: 'root', target: 'a', properties: {} },
    { id: 'e2', label: 'pointsTo', source: 'root', target: 'b', properties: {} },
    { id: 'e3', label: 'pointsTo', source: 'a', target: 'c', properties: {} },
    { id: 'e4', label: 'pointsTo', source: 'a', target: 'd', properties: {} },
  ]

  const ok = applyStratifyLayout(nodes, edges, 1000, 700, schema, () => '')
  if (!ok) throw new Error('expected stratify grid layout to succeed')

  const isSnapped = (v: unknown) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return false
    const k = v / 200
    return Math.abs(k - Math.round(k)) < 1e-6
  }

  for (const n of nodes) {
    if (!isSnapped(n.x) || !isSnapped(n.y)) {
      throw new Error(`expected node ${String(n.id)} to snap to 50px grid; got x=${String(n.x)} y=${String(n.y)}`)
    }
  }
}

export const testStratifyLayoutNoOverlapAfterGridSnap = () => {
  const schema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      mode: 'stratify' as const,
      stratify: {
        ...(defaultSchema.layout?.stratify || {}),
        orientation: 'vertical' as const,
        grid: { enabled: true, size: 220, strength: 0.85, steps: 35 },
      },
    },
  }

  const nodes: GraphNode[] = [
    { id: 'root', label: 'Root root root root root', type: 'T', properties: {} },
    { id: 'a', label: 'A label label label label', type: 'T', properties: {} },
    { id: 'b', label: 'B label label label label', type: 'T', properties: {} },
    { id: 'c', label: 'C label label label label', type: 'T', properties: {} },
    { id: 'd', label: 'D label label label label', type: 'T', properties: {} },
    { id: 'e', label: 'E label label label label', type: 'T', properties: {} },
  ]
  const edges: GraphEdge[] = [
    { id: 'e1', label: 'pointsTo', source: 'root', target: 'a', properties: {} },
    { id: 'e2', label: 'pointsTo', source: 'root', target: 'b', properties: {} },
    { id: 'e3', label: 'pointsTo', source: 'a', target: 'c', properties: {} },
    { id: 'e4', label: 'pointsTo', source: 'a', target: 'd', properties: {} },
    { id: 'e5', label: 'pointsTo', source: 'b', target: 'e', properties: {} },
  ]

  const ok = applyStratifyLayout(nodes, edges, 1400, 900, schema, () => '')
  if (!ok) throw new Error('expected stratify grid layout to succeed')

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const na = nodes[i]
      const nb = nodes[j]
      const ax = typeof na.x === 'number' && Number.isFinite(na.x) ? na.x : 0
      const ay = typeof na.y === 'number' && Number.isFinite(na.y) ? na.y : 0
      const bx = typeof nb.x === 'number' && Number.isFinite(nb.x) ? nb.x : 0
      const by = typeof nb.y === 'number' && Number.isFinite(nb.y) ? nb.y : 0
      const aExt = getNodeAabbHalfExtentsWithLabel(na, schema)
      const bExt = getNodeAabbHalfExtentsWithLabel(nb, schema)
      const ox = aExt.halfW + bExt.halfW - Math.abs(ax - bx)
      const oy = aExt.halfH + bExt.halfH - Math.abs(ay - by)
      if (ox > 0 && oy > 0) {
        throw new Error(`expected no overlap after grid snap; overlap between ${String(na.id)} and ${String(nb.id)}`)
      }
    }
  }
}

export const testStratifyLayoutAntiLineWrapsChains = () => {
  const schema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      mode: 'stratify' as const,
      stratify: {
        ...(defaultSchema.layout?.stratify || {}),
        orientation: 'vertical' as const,
        antiLine: { enabled: true, maxAspectRatio: 3, wrapRows: 5 },
        grid: { enabled: true, size: 180, strength: 0.9, steps: 35 },
      },
    },
  }

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const n = 18
  for (let i = 0; i < n; i += 1) {
    nodes.push({ id: `n${i}`, label: `Node ${i}`, type: 'T', properties: {} })
    if (i > 0) {
      edges.push({ id: `e${i}`, label: 'pointsTo', source: `n${i - 1}`, target: `n${i}`, properties: {} })
    }
  }

  const ok = applyStratifyLayout(nodes, edges, 1400, 900, schema, () => '')
  if (!ok) throw new Error('expected stratify antiLine chain layout to succeed')

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : null
    const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : null
    if (x == null || y == null) continue
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const ratio = Math.max(spanX / spanY, spanY / spanX)
  if (ratio > 3.5) {
    throw new Error(`expected antiLine to prevent long single-axis layout; got span ratio ${ratio}`)
  }
}

export const testStratifyEdgeLabelPlacementAvoidsOverlap = () => {
  const aabbOverlaps = (a: { x: number; y: number; halfW: number; halfH: number }, b: { x: number; y: number; halfW: number; halfH: number }) =>
    Math.abs(a.x - b.x) < a.halfW + b.halfW && Math.abs(a.y - b.y) < a.halfH + b.halfH

  const srcRect = { x: 0, y: 0, halfW: 40, halfH: 30 }
  const tgtRect = { x: 200, y: 0, halfW: 40, halfH: 30 }
  const blockerRects = [{ x: 100, y: -12, halfW: 90, halfH: 18 }]
  const placedLabelRects: Array<{ x: number; y: number; halfW: number; halfH: number }> = []

  const p1 = { x: 0, y: 0 }
  const p2 = { x: 200, y: 0 }

  const first = pickEdgeLabelPlacement({
    p1,
    p2,
    text: 'edge-label',
    fontSize: 12,
    srcRect,
    tgtRect,
    blockerRects,
    placedLabelRects,
  })
  if (!first) throw new Error('expected first edge label placement to exist')
  if (aabbOverlaps(first, srcRect) || aabbOverlaps(first, tgtRect)) throw new Error('expected first placement not to overlap endpoints')
  if (aabbOverlaps(first, blockerRects[0])) throw new Error('expected first placement to avoid blockers')
  placedLabelRects.push(first)

  const second = pickEdgeLabelPlacement({
    p1,
    p2,
    text: 'edge-label',
    fontSize: 12,
    srcRect,
    tgtRect,
    blockerRects,
    placedLabelRects,
  })
  if (!second) throw new Error('expected second edge label placement to exist')
  if (aabbOverlaps(second, first)) throw new Error('expected second placement not to overlap first placement')
}
