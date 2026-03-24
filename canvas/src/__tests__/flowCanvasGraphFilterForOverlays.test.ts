import { pickGraphDataForFlowRenderer } from '@/components/FlowCanvas'

export function testFlowCanvasDoesNotFilterGraphForOverlays(): void {
  const g = {
    nodes: [{ id: 'flow1', properties: { 'flow:quickEditorFormId': 'x' } }, { id: 'img1', type: 'Image', properties: { image: 'https://example.com/a.png' } }],
    edges: [],
  } as any

  const out = pickGraphDataForFlowRenderer({ graphData: g, effectiveFrontmatter: false })
  if (!out) throw new Error('Expected graph data')
  const nodes = Array.isArray(out.nodes) ? out.nodes : []
  if (nodes.length !== 2) throw new Error('Expected flow renderer to keep non-flow nodes for overlays')
}

