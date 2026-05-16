import { deriveFrontmatterFlowOverlayNodeIds } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { pickGraphDataForFlowRenderer } from '@/components/FlowCanvas'

export function testFlowCanvasDoesNotFilterGraphForOverlays(): void {
  const g = {
    nodes: [{ id: 'flow1', properties: { 'flow:widgetFormId': 'x' } }, { id: 'img1', type: 'Image', properties: { image: 'https://example.com/a.png' } }],
    edges: [],
  } as any

  const out = pickGraphDataForFlowRenderer({ graphData: g, effectiveFrontmatter: false, canvas2dRenderer: 'flowCanvas' })
  if (!out) throw new Error('Expected graph data')
  const nodes = Array.isArray(out.nodes) ? out.nodes : []
  if (nodes.length !== 2) throw new Error('Expected flow renderer to keep non-flow nodes for overlays')
}

export function testFlowCanvasFiltersFrontmatterFlowGraphForFlowEditorIsolation(): void {
  const g = {
    context: 'frontmatter-flow',
    metadata: { kind: 'frontmatter-flow' },
    nodes: [
      { id: 'flow1', type: 'TextGeneration', properties: { 'flow:widgetFormId': 'fm:flow1' } },
      { id: 'flow2', properties: { 'flow:widgetFormId': 'fm:flow2' } },
      { id: 'doc1', type: 'Section', properties: { title: 'Doc heading' } },
    ],
    edges: [
      { id: 'e1', source: 'flow1', target: 'flow2' },
      { id: 'e2', source: 'flow1', target: 'doc1' },
    ],
  } as any

  const out = pickGraphDataForFlowRenderer({
    graphData: g,
    effectiveFrontmatter: true,
    canvas2dRenderer: 'flowEditor',
  })
  if (!out) throw new Error('Expected filtered graph data')
  const nodeIds = Array.isArray(out.nodes) ? out.nodes.map((node: any) => String(node?.id || '')).filter(Boolean).sort() : []
  if (nodeIds.join('|') !== 'flow1|flow2') {
    throw new Error(`expected flow-editor frontmatter graph filter to keep only flow-widget-eligible nodes, got: ${nodeIds.join('|')}`)
  }
  const edgeIds = Array.isArray(out.edges) ? out.edges.map((edge: any) => String(edge?.id || '')).filter(Boolean).sort() : []
  if (edgeIds.join('|') !== 'e1') {
    throw new Error(`expected flow-editor frontmatter graph filter to keep only edges fully contained in flow-widget nodes, got: ${edgeIds.join('|')}`)
  }
}

export function testFlowCanvasFrontmatterFlowIsolationDoesNotDependOnFrontmatterToggle(): void {
  const g = {
    context: 'frontmatter-flow',
    metadata: { kind: 'frontmatter-flow' },
    nodes: [
      { id: 'flow1', type: 'TextGeneration', properties: { 'flow:widgetFormId': 'fm:flow1' } },
      { id: 'flow2', properties: { 'flow:widgetFormId': 'fm:flow2' } },
      { id: 'base1', type: 'Section', properties: { title: 'Base layer node' } },
    ],
    edges: [
      { id: 'e1', source: 'flow1', target: 'flow2' },
      { id: 'e2', source: 'flow2', target: 'base1' },
    ],
  } as any

  const out = pickGraphDataForFlowRenderer({
    graphData: g,
    effectiveFrontmatter: false,
    canvas2dRenderer: 'flowEditor',
  })
  if (!out) throw new Error('Expected filtered graph data')
  const nodeIds = Array.isArray(out.nodes) ? out.nodes.map((node: any) => String(node?.id || '')).filter(Boolean).sort() : []
  if (nodeIds.join('|') !== 'flow1|flow2') {
    throw new Error(`expected flow-editor frontmatter graph isolation to remain active even when effectiveFrontmatter toggles false, got: ${nodeIds.join('|')}`)
  }
  const edgeIds = Array.isArray(out.edges) ? out.edges.map((edge: any) => String(edge?.id || '')).filter(Boolean).sort() : []
  if (edgeIds.join('|') !== 'e1') {
    throw new Error(`expected flow-editor frontmatter graph isolation to keep only flow-widget-contained edges when effectiveFrontmatter toggles false, got: ${edgeIds.join('|')}`)
  }
}

export function testFrontmatterFlowOverlayIdsStayCompactToCanonicalBuiltIns(): void {
  const g = {
    context: 'frontmatter-flow',
    metadata: {
      kind: 'frontmatter-flow',
      flowWidgetRegistry: [
        {
          id: 'reg-text',
          isEnabled: true,
          nodeTypeId: 'TextGeneration',
          widgetTypeId: 'default',
          formId: 'fm:w-text',
          fields: [],
          ports: [],
          updatedAt: '2026-05-16T00:00:00.000Z',
        },
        {
          id: 'reg-flow',
          isEnabled: true,
          nodeTypeId: 'default',
          widgetTypeId: 'default',
          formId: 'fm:n-flow',
          fields: [],
          ports: [],
          updatedAt: '2026-05-16T00:00:00.000Z',
        },
      ],
    },
    nodes: [
      { id: 'w-text', type: 'TextGeneration', properties: { 'flow:widgetFormId': 'fm:w-text' } },
      { id: 'p-video', type: 'RichMediaPanel', properties: { 'flow:widgetFormId': 'fm:p-video' } },
      { id: 'n-flow', type: 'default', properties: { 'flow:widgetFormId': 'fm:n-flow' } },
      { id: 'doc1', type: 'Section', properties: { title: 'Doc heading' } },
    ],
    edges: [],
  } as any

  const overlayIds = deriveFrontmatterFlowOverlayNodeIds(g).sort()
  if (overlayIds.join('|') !== 'p-video|w-text') {
    throw new Error(`expected frontmatter overlay ids to stay compact to canonical built-in widget/media nodes, got: ${overlayIds.join('|')}`)
  }
}

export function testFrontmatterFlowOverlayIdsFallbackToEligibleNodesWithoutCanonicalCollective(): void {
  const g = {
    context: 'frontmatter-flow',
    metadata: { kind: 'frontmatter-flow', flowWidgetRegistry: [] },
    nodes: [
      { id: 'flow1', type: 'default', properties: { 'flow:widgetFormId': 'fm:flow1' } },
      { id: 'flow2', type: 'input', properties: { 'flow:widgetFormId': 'fm:flow2' } },
      { id: 'doc1', type: 'Section', properties: { title: 'Doc heading' } },
    ],
    edges: [],
  } as any

  const overlayIds = deriveFrontmatterFlowOverlayNodeIds(g).sort()
  if (overlayIds.join('|') !== 'flow1|flow2') {
    throw new Error(`expected frontmatter overlay ids to preserve the eligible-node fallback when no canonical built-ins exist, got: ${overlayIds.join('|')}`)
  }
}

export function testFrontmatterFlowOverlayIdsPreferWidgetBundleNodesRefOverExpandedTypedGraph(): void {
  const g = {
    context: 'frontmatter-flow',
    metadata: {
      kind: 'frontmatter-flow',
      frontmatterMeta: {
        widget_bundle: {
          graph: {
            nodes_ref: ['w-text-script', 'p-text-script', 'w-img-scene', 'p-img-scene', 'w-video-scene', 'p-video-scene'],
          },
        },
      },
    },
    nodes: [
      { id: 'w-text-script', type: 'TextGeneration', properties: { 'flow:widgetFormId': 'videoScript' } },
      { id: 'p-text-script', type: 'RichMediaPanel', properties: { 'flow:widgetFormId': 'richMediaPanel' } },
      { id: 'w-img-scene', type: 'ImageGeneration', properties: { 'flow:widgetFormId': 'imageGeneration' } },
      { id: 'p-img-scene', type: 'RichMediaPanel', properties: { 'flow:widgetFormId': 'richMediaPanel' } },
      { id: 'w-video-scene', type: 'VideoGeneration', properties: { 'flow:widgetFormId': 'videoGeneration' } },
      { id: 'p-video-scene', type: 'RichMediaPanel', properties: { 'flow:widgetFormId': 'richMediaPanel' } },
      { id: 'db-shot-S01-text', type: 'TextGeneration', properties: { 'flow:widgetFormId': 'textGeneration' } },
      { id: 'db-shot-S01-text-panel', type: 'RichMediaPanel', properties: { 'flow:widgetFormId': 'richMediaPanel' } },
      { id: 'db-shot-S01-image', type: 'ImageGeneration', properties: { 'flow:widgetFormId': 'imageGeneration' } },
      { id: 'db-shot-S01-image-panel', type: 'RichMediaPanel', properties: { 'flow:widgetFormId': 'richMediaPanel' } },
      { id: 'db-shot-S01-video', type: 'VideoGeneration', properties: { 'flow:widgetFormId': 'videoGeneration' } },
      { id: 'db-shot-S01-video-panel', type: 'RichMediaPanel', properties: { 'flow:widgetFormId': 'richMediaPanel' } },
    ],
    edges: [],
  } as any

  const overlayIds = deriveFrontmatterFlowOverlayNodeIds(g).sort()
  if (overlayIds.join('|') !== 'p-img-scene|p-text-script|p-video-scene|w-img-scene|w-text-script|w-video-scene') {
    throw new Error(`expected frontmatter overlay ids to honor widget_bundle.graph.nodes_ref instead of the expanded typed graph, got: ${overlayIds.join('|')}`)
  }
}
