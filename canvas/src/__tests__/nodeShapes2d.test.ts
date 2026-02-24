import * as d3 from 'd3'
import { JSDOM } from 'jsdom'
import type { MutableRefObject } from 'react'
import { createNodesLayer } from '@/components/GraphCanvas/layers/nodes'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { isNodePointerTarget } from '@/features/canvas/utils'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'

export function testNodesLayerRendersDiamondAndHexPaths() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  const prevWindow = g.window
  const prevDocument = g.document
  g.window = dom.window
  g.document = dom.window.document
  try {
    const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const root = d3.select(svg).append('g')

    const schema: GraphSchema = {
      ...defaultSchema,
      nodeShapes: { ...(defaultSchema.nodeShapes || {}), Entity: 'diamond', Subject: 'hex' },
      behavior: { ...defaultSchema.behavior, nodeShapeMode: 'circle' as const },
    }
    const tempLinkSelRef: MutableRefObject<TempLinkSelection> = { current: {} as TempLinkSelection }
    const linkDragRef: MutableRefObject<PendingLink | null> = { current: null }

    const nodes: GraphNode[] = [
      { id: 'n1', label: 'Entity 1', type: 'Entity', x: 10, y: 20, properties: {} },
      { id: 'n2', label: 'Subject 1', type: 'Subject', x: -30, y: 5, properties: {} },
    ]
    const edges: GraphEdge[] = []
    const graphData: GraphData = { type: 'graph', nodes, edges }

    const sim = d3.forceSimulation<GraphNode, GraphEdge>(nodes)

    createNodesLayer({
      g: root as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
      graphData,
      schema,
      zoomOnDoubleClick: false,
      renderMediaAsNodes: false,
      mediaPanelDensity: 'default',
      tempLinkSelRef,
      linkDragRef,
      simulation: sim,
      addEdge: () => {},
      updateEdge: () => {},
      getSelectedEdgeId: () => null,
      hoverEnabled: false,
      setHoverInfo: undefined,
      selectNode: () => {},
      selectEdge: () => {},
      setSelectionSource: () => {},
      requestZoomSelection: () => {},
      toggleGroupCollapsed: () => {},
    })

    const diamond = svg.querySelectorAll('path[data-kg-node-shape="diamond"]')
    const hex = svg.querySelectorAll('path[data-kg-node-shape="hex"]')
    if (diamond.length !== 1) throw new Error('expected 1 diamond path node')
    if (hex.length !== 1) throw new Error('expected 1 hex path node')
    const d1 = (diamond.item(0) as SVGPathElement).getAttribute('d') || ''
    const d2 = (hex.item(0) as SVGPathElement).getAttribute('d') || ''
    if (!d1.trim()) throw new Error('expected diamond path d to be set')
    if (!d2.trim()) throw new Error('expected hex path d to be set')
  } finally {
    g.window = prevWindow
    g.document = prevDocument
  }
}

export function testNodesLayerHonorsVisualShapeOverrides() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  const prevWindow = g.window
  const prevDocument = g.document
  g.window = dom.window
  g.document = dom.window.document
  try {
    const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const root = d3.select(svg).append('g')

    const schema: GraphSchema = {
      ...defaultSchema,
      behavior: { ...defaultSchema.behavior, nodeShapeMode: 'circle' as const },
    }
    const tempLinkSelRef: MutableRefObject<TempLinkSelection> = { current: {} as TempLinkSelection }
    const linkDragRef: MutableRefObject<PendingLink | null> = { current: null }

    const nodes: GraphNode[] = [
      { id: 'm1', label: 'Diamond', type: 'MermaidNode', x: 0, y: 0, properties: { 'visual:shape': 'diamond' } },
      { id: 'm2', label: 'Hex', type: 'MermaidNode', x: 40, y: 0, properties: { 'visual:shape': 'hex' } },
    ]
    const edges: GraphEdge[] = []
    const graphData: GraphData = { type: 'graph', nodes, edges }
    const sim = d3.forceSimulation<GraphNode, GraphEdge>(nodes)

    createNodesLayer({
      g: root as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
      graphData,
      schema,
      zoomOnDoubleClick: false,
      renderMediaAsNodes: false,
      mediaPanelDensity: 'default',
      tempLinkSelRef,
      linkDragRef,
      simulation: sim,
      addEdge: () => {},
      updateEdge: () => {},
      getSelectedEdgeId: () => null,
      hoverEnabled: false,
      setHoverInfo: undefined,
      selectNode: () => {},
      selectEdge: () => {},
      setSelectionSource: () => {},
      requestZoomSelection: () => {},
      toggleGroupCollapsed: () => {},
    })

    const diamond = svg.querySelectorAll('path[data-kg-node-shape="diamond"]')
    const hex = svg.querySelectorAll('path[data-kg-node-shape="hex"]')
    if (diamond.length !== 1) throw new Error('expected diamond path when visual:shape=diamond')
    if (hex.length !== 1) throw new Error('expected hex path when visual:shape=hex')
  } finally {
    g.window = prevWindow
    g.document = prevDocument
  }
}

export function testIsNodePointerTargetAcceptsPathNodes() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  const prevWindow = g.window
  const prevDocument = g.document
  g.window = dom.window
  g.document = dom.window.document
  try {
    const path = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'path')
    if (!isNodePointerTarget(path)) throw new Error('expected path to be a node pointer target')
  } finally {
    g.window = prevWindow
    g.document = prevDocument
  }
}
