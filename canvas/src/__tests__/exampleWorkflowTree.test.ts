import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { deriveTreeDerivation } from '@/components/GraphCanvas/layout/treeHelpers'
import { computeTreeCollapseHiddenNodes } from '@/components/GraphCanvas/treeLabelLod'
import { computeNextSchemaForTreePreset } from '@/features/toolbar/treePreset'

export function testExampleWorkflowSliceTreeDerivationUsesWorkflowEdges() {
  const nodes: GraphNode[] = [
    { id: 'ex:pplan-step-eda', label: 'EDA', type: 'pplan:Step', properties: {} },
    { id: 'ex:pplan-step-preprocessing', label: 'Preprocessing', type: 'pplan:Step', properties: {} },
    { id: 'ex:pplan-step-feature-engineering', label: 'Feature Engineering', type: 'pplan:Step', properties: {} },
  ]

  const edges: GraphEdge[] = [
    {
      id: 'e1',
      source: 'ex:pplan-step-eda',
      target: 'ex:pplan-step-preprocessing',
      label: 'pplan:isPrecededBy',
      properties: {},
    },
    {
      id: 'e2',
      source: 'ex:pplan-step-preprocessing',
      target: 'ex:pplan-step-feature-engineering',
      label: 'pplan:isPrecededBy',
      properties: {},
    },
  ]

  const schema: GraphSchema = {
    nodeStyles: {},
    edgeStyles: {},
    metadata: {},
    labelStyles: {},
    behavior: { allowEdgeCreation: true, allowNodeDrag: true },
    layout: {
      mode: 'tree',
      tree: {
        edgeLabels: ['pplan:isPrecededBy'],
        direction: 'target-source',
      },
      forces: {},
    },
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
    catalog: { nodeTypes: [], edgeLabels: [] },
    propertySchemas: { node: {}, edge: {} },
    serialization: {},
  }

  const nodeIds = new Set<string>(nodes.map(n => String(n.id)))
  const derivation = deriveTreeDerivation(edges, schema, nodeIds)
  if (!derivation) throw new Error('example workflow tree derivation is null')

  if (derivation.direction !== 'target-source') {
    throw new Error(`expected tree direction target-source, got ${derivation.direction}`)
  }

  const labels = Array.from(derivation.labelSet.values()).sort()
  if (labels.length !== 1 || labels[0] !== 'pplan:isPrecededBy') {
    throw new Error(`expected tree labelSet to be [pplan:isPrecededBy], got [${labels.join(', ')}]`)
  }

  const ids = new Set(derivation.candidateEdges.map(e => String(e.id)))
  if (!ids.has('e1') || !ids.has('e2') || ids.size !== 2) {
    throw new Error(
      `expected tree candidateEdges to include e1 and e2, got ids=[${Array.from(ids).join(', ')}]`,
    )
  }
}

export function testTreeDepthCollapseHidesDeepNodes() {
  const nodes: GraphNode[] = [
    { id: 'root', label: 'Root', type: 'node', properties: {} },
    { id: 'child1', label: 'Child 1', type: 'node', properties: {} },
    { id: 'child2', label: 'Child 2', type: 'node', properties: {} },
  ]

  const edges: GraphEdge[] = [
    { id: 'e1', source: 'root', label: 'hasChild', target: 'child1', properties: {} },
    { id: 'e2', source: 'child1', label: 'hasChild', target: 'child2', properties: {} },
  ]

  const lod: NonNullable<NonNullable<NonNullable<GraphSchema['performance']>['lod']>['tree']> = {
    collapseMode: 'depth',
    maxDepth: 1,
  }

  const hidden = computeTreeCollapseHiddenNodes({
    nodes,
    edgesForDisplay: edges,
    direction: 'source-target',
    lod,
  })

  if (!hidden.has('child2')) {
    throw new Error('expected child2 to be hidden (depth 2 > maxDepth 1)')
  }
  if (hidden.has('root')) {
    throw new Error('expected root to be visible')
  }
  if (hidden.has('child1')) {
    throw new Error('expected child1 to be visible (depth 1 <= maxDepth 1)')
  }
}

