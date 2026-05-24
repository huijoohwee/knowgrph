import { applyCanvasRenderBudget, resolveCanvasRenderBudgetSurface } from '@/lib/graph/canvasRenderBudget'
import type { GraphData } from '@/lib/graph/types'

const buildLargeGraph = (nodeCount: number, edgeFanout: number): GraphData => {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `node:${i}`,
    label: i === 0 ? 'Document Root' : `Section ${i}`,
    type: i === 0 ? 'Document' : i % 17 === 0 ? 'Heading' : 'Element',
    properties: {
      'visual:importance': i === 0 ? 100 : nodeCount - i,
      text: `Section ${i} imported content`,
    },
  }))
  const edges: GraphData['edges'] = []
  for (let i = 0; i < nodeCount; i += 1) {
    for (let j = 1; j <= edgeFanout; j += 1) {
      const target = (i + j) % nodeCount
      if (target === i) continue
      edges.push({
        id: `edge:${i}:${target}`,
        source: `node:${i}`,
        target: `node:${target}`,
        label: 'linksTo',
        properties: { 'visual:width': Math.max(1, edgeFanout - j + 1) },
      })
    }
  }
  return {
    type: 'Graph',
    nodes,
    edges,
    metadata: { sourceLayerHash: 'test:large-graph' },
  } as GraphData
}

export const testCanvasRenderBudgetCompactsD3GraphOnly = () => {
  const graph = buildLargeGraph(720, 8)
  const surface = resolveCanvasRenderBudgetSurface({ canvasRenderMode: '2d', canvas2dRenderer: 'd3' })
  if (surface !== 'd3Graph') throw new Error('expected d3 renderer to use d3Graph budget surface')
  const budgeted = applyCanvasRenderBudget({
    graphData: graph,
    graphRevision: 1,
    surface,
    documentSemanticMode: 'document',
  })
  if (!budgeted) throw new Error('expected budgeted graph')
  if (budgeted === graph) throw new Error('expected large d3 graph to compact')
  if ((budgeted.nodes || []).length > 420) throw new Error('d3 graph node budget exceeded')
  if ((budgeted.edges || []).length > 1800) throw new Error('d3 graph edge budget exceeded')
  const ids = new Set((budgeted.nodes || []).map(node => String(node.id)))
  if (!ids.has('node:0')) throw new Error('important document node should be retained')
  const meta = (budgeted.metadata || {}) as Record<string, unknown>
  if (meta.canvasRenderBudgetSurface !== 'd3Graph') throw new Error('expected d3 graph budget metadata')
  if (typeof meta.canvasRenderNodePrunedCount !== 'number' || meta.canvasRenderNodePrunedCount <= 0) {
    throw new Error('expected d3 graph node pruning metadata')
  }
  const cached = applyCanvasRenderBudget({
    graphData: graph,
    graphRevision: 1,
    surface,
    documentSemanticMode: 'document',
  })
  if (cached !== budgeted) throw new Error('expected render-budget cache reuse for unchanged semantic key')
}

export const testCanvasRenderBudgetCompactsSurface3dMoreAggressively = () => {
  const graph = buildLargeGraph(720, 8)
  const surface = resolveCanvasRenderBudgetSurface({ canvasRenderMode: '3d', canvas2dRenderer: 'd3' })
  if (surface !== 'surface3d') throw new Error('expected 3d surface budget')
  const budgeted = applyCanvasRenderBudget({
    graphData: graph,
    graphRevision: 2,
    surface,
    documentSemanticMode: 'document',
  })
  if (!budgeted) throw new Error('expected budgeted graph')
  if ((budgeted.nodes || []).length > 320) throw new Error('3d graph node budget exceeded')
  if ((budgeted.edges || []).length > 1200) throw new Error('3d graph edge budget exceeded')
  const meta = (budgeted.metadata || {}) as Record<string, unknown>
  if (meta.canvasRenderBudgetSurface !== 'surface3d') throw new Error('expected 3d budget metadata')
}

export const testCanvasRenderBudgetLeavesOther2dRenderersUntouched = () => {
  const graph = buildLargeGraph(720, 8)
  for (const renderer of ['flowchart', 'flow', 'animation', 'flowEditor', 'design']) {
    const surface = resolveCanvasRenderBudgetSurface({ canvasRenderMode: '2d', canvas2dRenderer: renderer })
    if (surface !== 'none') throw new Error(`expected ${renderer} to bypass shared d3/3d budget`)
    const out = applyCanvasRenderBudget({
      graphData: graph,
      graphRevision: 3,
      surface,
      documentSemanticMode: 'document',
    })
    if (out !== graph) throw new Error(`expected ${renderer} graph data to remain untouched`)
  }
}

export const testCanvasRenderBudgetPreservesStructuralTreeEdges = () => {
  const graph = {
    type: 'Graph',
    nodes: [
      { id: 'root', label: 'Root', type: 'Document', properties: { 'visual:importance': 100 } },
      ...Array.from({ length: 700 }, (_, i) => ({
        id: `block:${i}`,
        label: `Block ${i}`,
        type: 'Block',
        properties: { 'visual:importance': 700 - i },
      })),
    ],
    edges: Array.from({ length: 700 }, (_, i) => ({
      id: `root:block:${i}`,
      source: 'root',
      target: `block:${i}`,
      label: 'hasBlock',
      properties: {},
    })),
  } as GraphData
  const budgeted = applyCanvasRenderBudget({
    graphData: graph,
    graphRevision: 4,
    surface: 'd3Graph',
    documentSemanticMode: 'document',
  })
  if (!budgeted) throw new Error('expected budgeted graph')
  const structuralEdges = (budgeted.edges || []).filter(edge => String(edge.label || '') === 'hasBlock')
  if (structuralEdges.length < 300) {
    throw new Error(`expected structural document edges to survive render budgeting, got ${structuralEdges.length}`)
  }
  if ((budgeted.nodes || []).length > 420) throw new Error('d3 graph node budget exceeded')
  if ((budgeted.edges || []).length > 1800) throw new Error('d3 graph edge budget exceeded')
}
