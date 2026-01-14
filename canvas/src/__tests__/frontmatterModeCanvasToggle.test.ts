import React from 'react'
import type { MutableRefObject } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useGraphStore } from '@/hooks/useGraphStore'
import App from '@/App'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { deriveGraphDataForLayers, filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { applyGraphLayerCentroidDelta, buildNodeGroupsFromSchema, createGraphLayersLayer } from '@/components/GraphCanvas/graphLayers'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import { createNodesLayer } from '@/components/GraphCanvas/sceneLayers'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import * as d3 from 'd3'

const readMarkdownSlideDemo = (): string => {
  const path = resolve(new URL('.', import.meta.url).pathname, 'demo/markdown-slide-demo.md')
  return readFileSync(path, 'utf8')
}

const buildGraphFromMarkdown = (markdown: string): GraphData => {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))
  const jsonld = buildMarkdownJsonLd('file://markdown-slide-demo.md', markdown)
  const res = applyParser(toParserId('jsonld'), {
    name: 'markdown-slide-demo.jsonld',
    text: JSON.stringify(jsonld),
  })
  if (!res) {
    throw new Error('jsonld parse returned null for markdown-slide-demo')
  }
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }
  return res.graphData as GraphData
}

const waitForNextFrame = (win: Window): Promise<void> => {
  const anyWindow = win as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
  return new Promise<void>((resolve) => {
    const raf = anyWindow.requestAnimationFrame
    if (raf) {
      raf(() => resolve())
      return
    }
    setTimeout(() => resolve(), 0)
  })
}

export async function testFrontmatterModeCanvasToggleFiltersNodesAndEdgesFor2dAnd3d() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdown = readMarkdownSlideDemo()
    const graphData = buildGraphFromMarkdown(markdown)

    const state = useGraphStore.getState()
    state.setGraphData(graphData as never)
    state.setMarkdownDocument('docs/demo/markdown-slide-demo.md', markdown)
    state.setFrontmatterModeEnabled(false)
    state.setGraphLayersVisible(true)
    state.setSchema({
      nodeStyles: {},
      edgeStyles: {},
      metadata: {},
      labelStyles: {},
      behavior: { allowEdgeCreation: true, allowNodeDrag: true },
      layout: { mode: 'force', forces: {} },
      endpointMatrix: {},
      cardinality: { nodeType: {}, edgeLabel: {} },
      templates: { node: {}, edge: {} },
      performance: { lod: {}, caps: {} },
      accessibility: {},
      legend: {},
      rules: [],
      nodeShapes: {},
      nodeSizes: {},
      nodeStroke: {},
      edgeRouting: { curvatureByLabel: {}, mode: 'straight' },
      layers: {
        mode: 'semantic',
        documentStructure: { minGroupSize: 2 },
        semantic: {
          similarityEdgeLabel: 'pointsTo',
          textKeys: [],
          topKEdgesPerNode: 0,
          minSimilarity: 0,
        },
      },
    } as never)

    root.render(React.createElement(App))

    await waitForNextFrame(dom.window)
    await waitForNextFrame(dom.window)

    const initialGraph = useGraphStore.getState().graphData as GraphData | null
    if (!initialGraph || !Array.isArray(initialGraph.nodes) || !Array.isArray(initialGraph.edges)) {
      throw new Error('expected initial graphData to be present')
    }

    const initialNodeCount = initialGraph.nodes.length
    if (initialNodeCount === 0) {
      throw new Error('expected initial graphData to contain nodes')
    }

    useGraphStore.getState().setFrontmatterModeEnabled(true)

    await waitForNextFrame(dom.window)
    await waitForNextFrame(dom.window)

    const schemaValue = useGraphStore.getState().schema as GraphSchema | null
    if (!schemaValue) {
      throw new Error('expected schema to be present for frontmatter graph derivation')
    }

    const baseRenderGraph = deriveGraphDataForLayers(initialGraph, schemaValue)
    if (!baseRenderGraph || !Array.isArray(baseRenderGraph.nodes) || !Array.isArray(baseRenderGraph.edges)) {
      throw new Error('expected base render graphData to be present')
    }

    const baseRenderNodeCount = baseRenderGraph.nodes.length
    const baseRenderEdgeCount = baseRenderGraph.edges.length

    const scopedRawGraph = filterGraphToFrontmatterMermaid(
      initialGraph,
      'docs/demo/markdown-slide-demo.md',
    )
    if (!scopedRawGraph || !Array.isArray(scopedRawGraph.nodes) || !Array.isArray(scopedRawGraph.edges)) {
      throw new Error('expected scoped raw frontmatter graphData to be present')
    }

    const scopedRenderGraph = deriveGraphDataForLayers(scopedRawGraph, schemaValue)
    if (!scopedRenderGraph || !Array.isArray(scopedRenderGraph.nodes) || !Array.isArray(scopedRenderGraph.edges)) {
      throw new Error('expected scoped render graphData to be present')
    }

    const scopedNodeCount = scopedRenderGraph.nodes.length
    const scopedEdgeCount = scopedRenderGraph.edges.length
    if (!(scopedNodeCount > 0 && scopedNodeCount < baseRenderNodeCount)) {
      throw new Error(
        `expected frontmatter mode to reduce node count, got initial=${baseRenderNodeCount} scoped=${scopedNodeCount}`,
      )
    }
    if (!(scopedEdgeCount >= 0 && scopedEdgeCount <= baseRenderEdgeCount)) {
      throw new Error(
        `expected frontmatter mode to not increase edge count, got initial=${baseRenderEdgeCount} scoped=${scopedEdgeCount}`,
      )
    }

    let diagramCount = 0
    let nodeCount = 0
    let subgraphCount = 0
    scopedRenderGraph.nodes.forEach((n) => {
      const type = String(n.type || '')
      if (type === 'MermaidDiagram') diagramCount += 1
      else if (type === 'MermaidNode') nodeCount += 1
      else if (type === 'MermaidSubgraph') subgraphCount += 1
      else {
        throw new Error(`frontmatter render graph kept non-Mermaid node type ${type}`)
      }
    })

    if (diagramCount === 0) {
      throw new Error('frontmatter render graph produced no MermaidDiagram nodes')
    }
    if (nodeCount === 0) {
      throw new Error('frontmatter render graph produced no MermaidNode nodes')
    }
    if (subgraphCount === 0) {
      throw new Error('frontmatter render graph produced no MermaidSubgraph nodes')
    }
  } finally {
    restoreWindow()
    restoreDom()
  }
}

export async function testFrontmatterModeHullMicrobenchmarkForMarkdownSlideDemo() {
  const markdown = readMarkdownSlideDemo()
  const baseGraph = buildGraphFromMarkdown(markdown)
  const baseSchema: GraphSchema = {
    ...defaultSchema,
    layers: {
      mode: 'property',
      documentStructure: { minGroupSize: 2 },
      semantic: {
        ...(defaultSchema.layers?.semantic || {}),
        similarityEdgeLabel: 'pointsTo',
        textKeys: [],
        topKEdgesPerNode: 0,
        minSimilarity: 0,
      },
    },
  }
  const modes: Array<'property' | 'document-structure' | 'semantic'> = [
    'property',
    'document-structure',
    'semantic',
  ]
  const results: Array<{
    mode: string
    groupCount: number
    totalPointCount: number
    maxPointsPerGroup: number
  }> = []
  modes.forEach((mode) => {
    const schemaForMode: GraphSchema = {
      ...baseSchema,
      layers: {
        ...(baseSchema.layers || {}),
        mode,
      },
    }
    const graph = deriveGraphDataForLayers(baseGraph, schemaForMode)
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      throw new Error(`expected graphData for layer mode ${mode}`)
    }
    const nodeById = new Map<string, typeof graph.nodes[number]>()
    graph.nodes.forEach((n) => {
      nodeById.set(String(n.id), n)
    })
    const nodeGroups = buildNodeGroupsFromSchema(graph, schemaForMode)
    let totalPointCount = 0
    let maxPointsPerGroup = 0
    const step = Math.PI / 4
    nodeGroups.forEach((group) => {
      const ids = group.memberIds || []
      const points: [number, number][] = []
      ids.forEach((id) => {
        const node = nodeById.get(String(id))
        if (!node) return
        const x = typeof node.x === 'number' ? node.x : null
        const y = typeof node.y === 'number' ? node.y : null
        if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return
        const r = getRenderNodeRadius2d(node as never, schemaForMode)
        const radius = Number.isFinite(r) && r > 0 ? r : 10
        for (let angle = 0; angle < Math.PI * 2; angle += step) {
          const px = x + radius * Math.cos(angle)
          const py = y + radius * Math.sin(angle)
          if (!Number.isFinite(px) || !Number.isFinite(py)) continue
          points.push([px, py])
        }
      })
      if (points.length < 3) {
        return
      }
      const hull = d3.polygonHull(points) ?? points
      if (!hull || hull.length === 0) {
        return
      }
      const count = points.length
      totalPointCount += count
      if (count > maxPointsPerGroup) {
        maxPointsPerGroup = count
      }
    })
    results.push({
      mode,
      groupCount: nodeGroups.length,
      totalPointCount,
      maxPointsPerGroup,
    })
  })
  if (!results.length) {
    throw new Error('expected hull micro-benchmark to produce results')
  }
  results.forEach((r) => {
    if (r.groupCount < 0) {
      throw new Error(`expected non-negative groupCount for mode ${r.mode}`)
    }
    if (r.totalPointCount < 0) {
      throw new Error(`expected non-negative totalPointCount for mode ${r.mode}`)
    }
    if (r.maxPointsPerGroup < 0) {
      throw new Error(`expected non-negative maxPointsPerGroup for mode ${r.mode}`)
    }
  })
  const summary = results
    .map(
      r =>
        `mode=${r.mode}, groups=${r.groupCount}, totalPoints=${r.totalPointCount}, maxPointsPerGroup=${r.maxPointsPerGroup}`,
    )
    .join(' | ')
  console.log(`frontmatter markdown-slide-demo hull micro-benchmark: ${summary}`)
}

export async function testFrontmatterModeGraphLayersHideMermaidSubgraphNodesIn2dLayer() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const gEl = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    svg.appendChild(gEl)

    const gSel = d3.select(gEl) as unknown as d3.Selection<SVGGElement, unknown, null, undefined>

    const nodes: GraphNode[] = [
      { id: 'diagram', type: 'MermaidDiagram', label: 'Diagram', properties: {}, x: 0, y: 0 } as GraphNode,
      { id: 'subgraph', type: 'MermaidSubgraph', label: 'Subgraph', properties: {}, x: 10, y: 10 } as GraphNode,
      { id: 'node', type: 'MermaidNode', label: 'Node', properties: {}, x: 20, y: 20 } as GraphNode,
    ]
    const edges: GraphEdge[] = []
    const graphData: GraphData = { type: 'graph', nodes, edges }

    const schema: GraphSchema = {
      ...defaultSchema,
      behavior: { allowEdgeCreation: false, allowNodeDrag: false },
      layout: { ...(defaultSchema.layout || {}), mode: 'force' },
    }

    const isEditModeRef: MutableRefObject<boolean> = { current: false }
    const selectedEdgeIdRef: MutableRefObject<string | null> = { current: null }
    const tempLinkSelRef: MutableRefObject<TempLinkSelection> = { current: null }
    const linkDragRef: MutableRefObject<PendingLink | null> = { current: null }

    const simulation = d3.forceSimulation<GraphNode, GraphEdge>() as unknown as d3.Simulation<GraphNode, GraphEdge>

    const { nodeSel } = createNodesLayer({
      g: gSel,
      graphData,
      edgesForDisplay: edges,
      schema,
      treeDerivation: null,
      hoverEnabled: false,
      zoomOnDoubleClick: false,
      renderMediaAsNodes: false,
      mediaPanelDensity: 'default',
      isEditModeRef,
      selectedEdgeIdRef,
      tempLinkSelRef,
      linkDragRef,
      simulation,
      selectNode: () => {},
      selectEdge: () => {},
      setSelectionSource: () => {},
      addEdge: () => {},
      updateEdge: () => {},
      setHoverInfo: () => {},
      requestZoomSelection: () => {},
      graphLayersVisible: true,
    })

    const renderedNodes = nodeSel.data() as GraphNode[]
    if (!Array.isArray(renderedNodes) || renderedNodes.length === 0) {
      throw new Error('expected nodes layer to render some nodes')
    }
    const types = new Set(renderedNodes.map(n => String(n.type || '')))
    if (types.has('MermaidSubgraph')) {
      throw new Error('expected 2d nodes layer to hide MermaidSubgraph nodes when graphLayersVisible is true')
    }
  } finally {
    restoreDom()
  }
}

export async function testFrontmatterModeGraphLayersShowMermaidSubgraphNodesIn2dLayerWhenOff() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const gEl = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    svg.appendChild(gEl)

    const gSel = d3.select(gEl) as unknown as d3.Selection<SVGGElement, unknown, null, undefined>

    const nodes: GraphNode[] = [
      { id: 'diagram', type: 'MermaidDiagram', label: 'Diagram', properties: {}, x: 0, y: 0 } as GraphNode,
      { id: 'subgraph', type: 'MermaidSubgraph', label: 'Subgraph', properties: {}, x: 10, y: 10 } as GraphNode,
      { id: 'node', type: 'MermaidNode', label: 'Node', properties: {}, x: 20, y: 20 } as GraphNode,
    ]
    const edges: GraphEdge[] = []
    const graphData: GraphData = { type: 'graph', nodes, edges }

    const schema: GraphSchema = {
      ...defaultSchema,
      behavior: { allowEdgeCreation: false, allowNodeDrag: false },
      layout: { ...(defaultSchema.layout || {}), mode: 'force' },
    }

    const isEditModeRef: MutableRefObject<boolean> = { current: false }
    const selectedEdgeIdRef: MutableRefObject<string | null> = { current: null }
    const tempLinkSelRef: MutableRefObject<TempLinkSelection> = { current: null }
    const linkDragRef: MutableRefObject<PendingLink | null> = { current: null }

    const simulation = d3.forceSimulation<GraphNode, GraphEdge>() as unknown as d3.Simulation<GraphNode, GraphEdge>

    const { nodeSel } = createNodesLayer({
      g: gSel,
      graphData,
      edgesForDisplay: edges,
      schema,
      treeDerivation: null,
      hoverEnabled: false,
      zoomOnDoubleClick: false,
      renderMediaAsNodes: false,
      mediaPanelDensity: 'default',
      isEditModeRef,
      selectedEdgeIdRef,
      tempLinkSelRef,
      linkDragRef,
      simulation,
      selectNode: () => {},
      selectEdge: () => {},
      setSelectionSource: () => {},
      addEdge: () => {},
      updateEdge: () => {},
      setHoverInfo: () => {},
      requestZoomSelection: () => {},
      graphLayersVisible: false,
    })

    const renderedNodes = nodeSel.data() as GraphNode[]
    if (!Array.isArray(renderedNodes) || renderedNodes.length === 0) {
      throw new Error('expected nodes layer to render some nodes')
    }
    const types = new Set(renderedNodes.map(n => String(n.type || '')))
    if (!types.has('MermaidSubgraph')) {
      throw new Error('expected 2d nodes layer to show MermaidSubgraph nodes when graphLayersVisible is false')
    }
  } finally {
    restoreDom()
  }
}

export async function testGraphLayerCentroidDragMovesMemberNodes() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const gEl = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    svg.appendChild(gEl)

    const gSel = d3.select(gEl) as unknown as d3.Selection<SVGGElement, unknown, null, undefined>

    const nodes: GraphNode[] = [
      {
        id: 'layer',
        type: 'MermaidSubgraph',
        label: 'Layer',
        properties: { layers: ['n1', 'n2'] },
        x: 0,
        y: 0,
      } as GraphNode,
      { id: 'n1', type: 'MermaidNode', label: 'N1', properties: {}, x: 10, y: 10 } as GraphNode,
      { id: 'n2', type: 'MermaidNode', label: 'N2', properties: {}, x: 20, y: 20 } as GraphNode,
    ]
    const edges: GraphEdge[] = []
    const graphData: GraphData = { type: 'graph', nodes, edges }

    const schema: GraphSchema = {
      ...defaultSchema,
      layers: { mode: 'property' },
      behavior: { allowEdgeCreation: false, allowNodeDrag: false },
      layout: { ...(defaultSchema.layout || {}), mode: 'force' },
    }

    const nodeGroups = buildNodeGroupsFromSchema(graphData, schema)
    if (!Array.isArray(nodeGroups) || nodeGroups.length === 0) {
      throw new Error('expected buildNodeGroupsFromSchema to produce at least one group')
    }
    const group = nodeGroups[0]!

    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      nodeById.set(String(n.id), n)
    }

    const { hullSel, centroidSel } = createGraphLayersLayer({
      g: gSel,
      nodeGroups,
      graphData,
      schema,
      graphLayersVisible: true,
      hoverEnabled: false,
      setHoverInfo: () => {},
      simulation: d3.forceSimulation<GraphNode, GraphEdge>() as unknown as d3.Simulation<GraphNode, GraphEdge>,
    })

    if (!hullSel || !centroidSel) {
      throw new Error('expected createGraphLayersLayer to return hull and centroid selections')
    }

    const centroidNode = centroidSel.node()
    if (!centroidNode) {
      throw new Error('expected at least one centroid circle to be rendered')
    }

    const cxBefore = Number(centroidNode.getAttribute('cx') || 'NaN')
    const cyBefore = Number(centroidNode.getAttribute('cy') || 'NaN')

    const n1 = nodeById.get('n1') as GraphNode
    const n2 = nodeById.get('n2') as GraphNode
    const n1xBefore = n1.x
    const n1yBefore = n1.y
    const n2xBefore = n2.x
    const n2yBefore = n2.y

    const dx = 5
    const dy = -3

    applyGraphLayerCentroidDelta({
      group,
      dx,
      dy,
      nodeById,
      hullSel,
      centroidSel,
      schema,
    })

    const n1xAfter = n1.x
    const n1yAfter = n1.y
    const n2xAfter = n2.x
    const n2yAfter = n2.y

    if (!(n1xAfter === n1xBefore + dx && n1yAfter === n1yBefore + dy)) {
      throw new Error('expected centroid drag to move first member node by the drag delta')
    }
    if (!(n2xAfter === n2xBefore + dx && n2yAfter === n2yBefore + dy)) {
      throw new Error('expected centroid drag to move second member node by the drag delta')
    }

    const cxAfter = Number(centroidNode.getAttribute('cx') || 'NaN')
    const cyAfter = Number(centroidNode.getAttribute('cy') || 'NaN')
    if (!Number.isFinite(cxBefore) || !Number.isFinite(cyBefore)) {
      throw new Error('expected centroid to have valid initial position')
    }
    if (!Number.isFinite(cxAfter) || !Number.isFinite(cyAfter)) {
      throw new Error('expected centroid to have valid position after drag')
    }
    if (!(cxAfter !== cxBefore || cyAfter !== cyBefore)) {
      throw new Error('expected centroid position to change after drag')
    }
  } finally {
    restoreDom()
  }
}
