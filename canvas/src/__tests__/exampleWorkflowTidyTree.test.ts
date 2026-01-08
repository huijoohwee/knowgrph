import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { deriveTidyTreeDerivation } from '@/components/GraphCanvas/simulation'

export function testExampleWorkflowSliceTidyTreeDerivationUsesWorkflowEdges() {
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
      mode: 'tidy-tree',
      tidyTree: {
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
  const derivation = deriveTidyTreeDerivation(edges, schema, nodeIds)
  if (!derivation) throw new Error('example workflow tidy-tree derivation is null')

  if (derivation.direction !== 'target-source') {
    throw new Error(`expected tidy-tree direction target-source, got ${derivation.direction}`)
  }

  const labels = Array.from(derivation.labelSet.values()).sort()
  if (labels.length !== 1 || labels[0] !== 'pplan:isPrecededBy') {
    throw new Error(`expected tidy-tree labelSet to be [pplan:isPrecededBy], got [${labels.join(', ')}]`)
  }

  const ids = new Set(derivation.candidateEdges.map(e => String(e.id)))
  if (!ids.has('e1') || !ids.has('e2') || ids.size !== 2) {
    throw new Error(
      `expected tidy-tree candidateEdges to include e1 and e2, got ids=[${Array.from(ids).join(', ')}]`,
    )
  }
}
