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
