import { validateGraphDataWithSchema } from '@/lib/graph/validation'
import type { GraphData } from '@/lib/graph/types'
import { defaultSchema } from '@/lib/graph/schema'
import { validateSchema } from '@/features/schema/validation'
import { rawToGraphData } from '@/lib/graph/rawToGraph'

export const testGraphValidationEmptyGraphSummary = () => {
  const data: GraphData = {
    context: '',
    type: 'Graph',
    nodes: [],
    edges: [],
  }
  const summary = validateGraphDataWithSchema(data, defaultSchema)
  if (summary.metrics.nodeCount !== 0) throw new Error('expected nodeCount 0')
  if (summary.metrics.edgeCount !== 0) throw new Error('expected edgeCount 0')
  if (summary.metrics.duplicateNodeIdCount !== 0) throw new Error('expected duplicateNodeIdCount 0')
  if (summary.metrics.danglingEdgeCount !== 0) throw new Error('expected danglingEdgeCount 0')
  if (summary.metrics.maxDegree !== 0) throw new Error('expected maxDegree 0')
  if (summary.metrics.nodesWithoutTypeCount !== 0) throw new Error('expected nodesWithoutTypeCount 0')
  if (summary.metrics.edgesWithoutLabelCount !== 0) throw new Error('expected edgesWithoutLabelCount 0')
  if (Object.keys(summary.metrics.nodeTypeCounts).length !== 0) throw new Error('expected no nodeTypeCounts')
  if (Object.keys(summary.metrics.edgeLabelCounts).length !== 0) throw new Error('expected no edgeLabelCounts')
  if (summary.metrics.degreeHistogram.length !== 0) throw new Error('expected empty degreeHistogram')
  if (summary.errors.length !== 0) throw new Error('expected no errors')
  if (summary.warnings.length !== 0) throw new Error('expected no warnings')
}

export const testGraphValidationDuplicateNodeIdsAndDanglingEdges = () => {
  const data: GraphData = {
    context: '',
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A1', type: 'entity', properties: {} },
      { id: 'a', label: 'A2', type: 'entity', properties: {} },
      { id: 'b', label: 'B', type: 'entity', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', label: 'link', properties: {} },
      { id: 'e2', source: 'missing', target: 'b', label: 'link', properties: {} },
    ],
  }
  const summary = validateGraphDataWithSchema(data, defaultSchema)
  if (summary.metrics.nodeCount !== 3) throw new Error('expected nodeCount 3')
  if (summary.metrics.edgeCount !== 2) throw new Error('expected edgeCount 2')
  if (summary.metrics.duplicateNodeIdCount !== 1) throw new Error('expected one duplicate node id')
  if (summary.metrics.danglingEdgeCount !== 1) throw new Error('expected one dangling edge')
  if (summary.metrics.nodesWithoutTypeCount !== 0) throw new Error('expected nodesWithoutTypeCount 0')
  if (summary.metrics.edgesWithoutLabelCount !== 0) throw new Error('expected edgesWithoutLabelCount 0')
  if (summary.metrics.nodeTypeCounts.entity !== 3) throw new Error('expected entity nodeTypeCount 3')
  if (summary.metrics.edgeLabelCounts.link !== 2) throw new Error('expected link edgeLabelCount 2')
  if (summary.metrics.degreeHistogram[1] !== 1 || summary.metrics.degreeHistogram[2] !== 1) {
    throw new Error('expected degree histogram 1:1, 2:1')
  }
  if (!summary.errors.some(e => e.startsWith('Duplicate node IDs detected'))) {
    throw new Error('expected duplicate node id error')
  }
  if (!summary.warnings.some(w => w.startsWith('Edges with missing endpoints detected'))) {
    throw new Error('expected dangling edge warning')
  }
}

export const testGraphValidationNodeRulesApplied = () => {
  const schema = validateSchema({
    ...defaultSchema,
    validation: {
      ...(defaultSchema.validation || {}),
      node: {
        ...(defaultSchema.validation?.node || {}),
        entity: {
          required: ['name'],
          severity: 'error' as const,
        },
      },
      edge: defaultSchema.validation?.edge || {},
    },
  })
  const data: GraphData = {
    context: '',
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'entity', properties: {} },
      { id: 'b', label: 'B', type: 'entity', properties: { name: 'ok' } },
    ],
    edges: [],
  }
  const summary = validateGraphDataWithSchema(data, schema)
  if (!summary.errors.some(e => e.includes('Node validation failed for type "entity"'))) {
    throw new Error('expected node validation error for entity')
  }
}

export const testGraphValidationMetricsWithSyntheticRawDataset = () => {
  const raw: unknown = {
    nodes: [
      { id: 'a', name: 'A', type: 'Entity', data: { group: 'alpha' } },
      { id: 'b', name: 'B', type: 'Entity', data: { group: 'alpha' } },
      { id: 'c', name: 'C', type: 'Entity', data: { group: 'beta' } },
      { id: 'd', name: 'D', type: 'Entity', data: { group: 'beta' } },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', type: 'relatedTo', data: {} },
      { id: 'e2', source: 'a', target: 'c', type: 'relatedTo', data: {} },
      { id: 'e3', source: 'a', target: 'd', type: 'relatedTo', data: {} },
      { id: 'e4', source: 'b', target: 'c', type: 'relatedTo', data: {} },
    ],
  }
  const data: GraphData = rawToGraphData(raw)
  const summary = validateGraphDataWithSchema(data, defaultSchema)
  if (summary.metrics.nodeCount !== data.nodes.length) throw new Error('nodeCount mismatch for synthetic raw dataset')
  if (summary.metrics.edgeCount !== data.edges.length) throw new Error('edgeCount mismatch for synthetic raw dataset')
  if (summary.metrics.nodeCount === 0) throw new Error('expected nodes in synthetic raw dataset')
  if (summary.metrics.edgeCount === 0) throw new Error('expected edges in synthetic raw dataset')
  const nodeTypeSum = Object.values(summary.metrics.nodeTypeCounts).reduce((acc, v) => acc + v, 0)
  if (nodeTypeSum !== summary.metrics.nodeCount) throw new Error('nodeTypeCounts sum mismatch')
  const edgeLabelSum = Object.values(summary.metrics.edgeLabelCounts).reduce((acc, v) => acc + v, 0)
  if (edgeLabelSum !== summary.metrics.edgeCount) throw new Error('edgeLabelCounts sum mismatch')
  if (summary.metrics.maxDegree <= 0) throw new Error('expected maxDegree > 0 for synthetic raw dataset')
  if (!Array.isArray(summary.metrics.degreeHistogram) || summary.metrics.degreeHistogram.length === 0) {
    throw new Error('expected non-empty degreeHistogram for unicorn dataset')
  }
  const degreeFromData = (() => {
    const counts = new Map<string, number>()
    data.edges.forEach(e => {
      const s = String(e.source)
      const t = String(e.target)
      counts.set(s, (counts.get(s) || 0) + 1)
      counts.set(t, (counts.get(t) || 0) + 1)
    })
    let max = 0
    let nodesWithDegree = 0
    counts.forEach(v => {
      if (v > 0) {
        nodesWithDegree += 1
        if (v > max) max = v
      }
    })
    return { max, nodesWithDegree }
  })()
  if (degreeFromData.max !== summary.metrics.maxDegree) {
    throw new Error('maxDegree mismatch between summary and computed values')
  }
  const histogramNodeCount = summary.metrics.degreeHistogram
    .map((count, degree) => (degree > 0 && count ? count : 0))
    .reduce((acc, v) => acc + v, 0)
  if (histogramNodeCount !== degreeFromData.nodesWithDegree) {
    throw new Error('degreeHistogram node count mismatch')
  }
  if (data.nodes.length === 0 || data.edges.length === 0) return
  const firstNode = { ...data.nodes[0], type: '' }
  const firstEdge = { ...data.edges[0], label: '' }
  const mutated: GraphData = {
    ...data,
    nodes: [firstNode, ...data.nodes.slice(1)],
    edges: [firstEdge, ...data.edges.slice(1)],
  }
  const mutatedSummary = validateGraphDataWithSchema(mutated, defaultSchema)
  if (mutatedSummary.metrics.nodesWithoutTypeCount < 1) {
    throw new Error('expected at least one node without type after mutation')
  }
  if (mutatedSummary.metrics.edgesWithoutLabelCount < 1) {
    throw new Error('expected at least one edge without label after mutation')
  }
}
