import * as d3 from 'd3'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { createNodesLayer } from '@/components/GraphCanvas/layers/nodes'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'

export async function testGraphCanvasIframeNodesHideBodyWhenRichMediaOn() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    doc.body.appendChild(svg)
    const g = d3.select(svg).append('g') as unknown as d3.Selection<SVGGElement, unknown, null, undefined>

    const graphData: GraphData = {
      type: 'Graph',
      nodes: [
        {
          id: 'n1',
          label: 'Webpage',
          type: 'Entity',
          x: 10,
          y: 20,
          properties: {
            media_kind: 'iframe',
            iframe_url: 'https://example.com/',
            media_interactive: true,
          },
        },
        {
          id: 'n2',
          label: 'Image',
          type: 'Entity',
          x: 40,
          y: 50,
          properties: {
            media_kind: 'image',
            media_url: 'https://example.com/image.png',
            image: 'https://example.com/image.png',
          },
        },
        {
          id: 'n3',
          label: 'Map props',
          type: 'Entity',
          x: 70,
          y: 80,
          properties: new Map<string, unknown>([
            ['media_kind', 'iframe'],
            ['iframe_url', 'https://example.com/'],
            ['media_interactive', true],
          ]) as unknown as any,
        },
      ],
      edges: [],
    }

    const tempLinkSelRef = { current: null }
    const linkDragRef = { current: null }
    const sim = d3.forceSimulation(graphData.nodes as unknown as any).stop()

    const renderGraphData = cloneGraphDataForRender(graphData)
    const { nodeSel } = createNodesLayer({
      g,
      graphData: renderGraphData,
      schema: defaultSchema,
      zoomOnDoubleClick: false,
      renderMediaAsNodes: true,
      mediaPanelDensity: 'default',
      tempLinkSelRef,
      linkDragRef,
      simulation: sim as unknown as d3.Simulation<any, any>,
      addEdge: () => {},
      updateEdge: () => {},
      getSelectedEdgeId: () => null,
      enableEditorGestures: false,
      selectNode: () => {},
      selectEdge: () => {},
      setSelectionSource: () => {},
      requestZoomSelection: () => {},
      toggleGroupCollapsed: () => {},
    })

    for (const id of ['n1', 'n2', 'n3']) {
      const el = nodeSel.filter(d => String((d as unknown as { id?: unknown }).id) === id).node() as SVGElement | null
      if (!el) throw new Error(`expected media node element to be created: ${id}`)
      const fill = String(el.getAttribute('fill') || '')
      const stroke = String(el.getAttribute('stroke') || '')
      if (fill !== 'transparent') throw new Error(`expected media node fill to be transparent (${id}), got "${fill}"`)
      if (stroke !== 'transparent') throw new Error(`expected media node stroke to be transparent (${id}), got "${stroke}"`)
    }

    await Promise.resolve()
  } finally {
    restore()
  }
}

export async function testGraphCanvasMediaNodesKeepBodyWhenOverlayPoolClips() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    doc.body.appendChild(svg)
    const g = d3.select(svg).append('g') as unknown as d3.Selection<SVGGElement, unknown, null, undefined>

    const graphData: GraphData = {
      type: 'Graph',
      nodes: [
        {
          id: 'n1',
          label: 'Webpage',
          type: 'Entity',
          x: 10,
          y: 20,
          properties: { media_kind: 'iframe', iframe_url: 'https://example.com/', media_interactive: true },
        },
        {
          id: 'n2',
          label: 'Image',
          type: 'Entity',
          x: 40,
          y: 50,
          properties: { media_kind: 'image', media_url: 'https://example.com/image.png', image: 'https://example.com/image.png' },
        },
      ],
      edges: [],
    }

    const tempLinkSelRef = { current: null }
    const linkDragRef = { current: null }
    const sim = d3.forceSimulation(graphData.nodes as unknown as any).stop()

    const renderGraphData = cloneGraphDataForRender(graphData)
    const { nodeSel } = createNodesLayer({
      g,
      graphData: renderGraphData,
      schema: defaultSchema,
      zoomOnDoubleClick: false,
      renderMediaAsNodes: true,
      mediaOverlayNodeIdSet: new Set(['n1']),
      preferDomMediaOverlays: true,
      mediaPanelDensity: 'default',
      tempLinkSelRef,
      linkDragRef,
      simulation: sim as unknown as d3.Simulation<any, any>,
      addEdge: () => {},
      updateEdge: () => {},
      getSelectedEdgeId: () => null,
      enableEditorGestures: false,
      selectNode: () => {},
      selectEdge: () => {},
      setSelectionSource: () => {},
      requestZoomSelection: () => {},
      toggleGroupCollapsed: () => {},
    })

    const node1 = nodeSel.filter(d => String((d as unknown as { id?: unknown }).id) === 'n1').node() as SVGElement | null
    const node2 = nodeSel.filter(d => String((d as unknown as { id?: unknown }).id) === 'n2').node() as SVGElement | null
    if (!node1 || !node2) throw new Error('expected nodes to be rendered')

    const fill1 = String(node1.getAttribute('fill') || '')
    const fill2 = String(node2.getAttribute('fill') || '')
    if (fill1 !== 'transparent') throw new Error(`expected overlayed media node to be transparent, got "${fill1}"`)
    if (fill2 === 'transparent') throw new Error('expected clipped media node to keep visible body')

    await Promise.resolve()
  } finally {
    restore()
  }
}
