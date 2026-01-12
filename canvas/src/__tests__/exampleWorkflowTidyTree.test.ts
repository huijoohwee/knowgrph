import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { deriveTidyTreeDerivation } from '@/components/GraphCanvas/simulation'
import { computeTidyTreeCollapseHiddenNodes } from '@/components/GraphCanvas/tidyTreeLabelLod'
import { type GetGraph } from '@/hooks/store/graphDataSlice'
import { applyLayoutAutosuggestFromMetadata } from '@/hooks/store/graphDataSliceUtils'
import { computeNextSchemaForTidyPreset } from '@/features/toolbar/tidyTreePreset'

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

export function testTidyTreeDepthCollapseHidesDeepNodes() {
  const nodes: GraphNode[] = [
    { id: 'root', label: 'Root', type: 'node', properties: {} },
    { id: 'child1', label: 'Child 1', type: 'node', properties: {} },
    { id: 'child2', label: 'Child 2', type: 'node', properties: {} },
  ]

  const edges: GraphEdge[] = [
    { id: 'e1', source: 'root', label: 'hasChild', target: 'child1', properties: {} },
    { id: 'e2', source: 'child1', label: 'hasChild', target: 'child2', properties: {} },
  ]

  const lod: NonNullable<NonNullable<NonNullable<GraphSchema['performance']>['lod']>['tidyTree']> = {
    collapseMode: 'depth',
    maxDepth: 1,
  }

  const hidden = computeTidyTreeCollapseHiddenNodes({
    nodes,
    edgesForDisplay: edges,
    direction: 'source-target',
    lod,
  })

  if (!hidden.has('child2') || hidden.has('root') || hidden.has('child1')) {
    throw new Error(
      `expected only child2 to be hidden at depth>1, got [${Array.from(hidden.values()).join(', ')}]`,
    )
  }
}

export function testTidyTreeDensityAutosuggestSeedsCollapseDefaults() {
  const baseSchema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      lod: {
        ...(defaultSchema.performance?.lod || {}),
      },
      caps: {
        ...(defaultSchema.performance?.caps || {}),
      },
    },
  }

  const state = {
    schema: baseSchema,
    setSchema(next: GraphSchema) {
      ;(state as { schema: GraphSchema }).schema = next
    },
  }

  const get: GetGraph = () => state as never

  const metadata = {
    tidyTree: {
      mermaidDensity: {
        density: 'dense',
        statementCount: 42,
      },
    },
  }

  applyLayoutAutosuggestFromMetadata(get, metadata)

  const next = state.schema
  const lod = next.performance?.lod?.tidyTree
  if (!lod) {
    throw new Error('expected performance.lod.tidyTree to be initialized from autosuggest')
  }
  if (lod.collapseMode !== 'depth') {
    throw new Error(`expected collapseMode "depth" from dense density, got ${String(lod.collapseMode)}`)
  }
  if (lod.maxDepth !== 2) {
    throw new Error(`expected maxDepth 2 from dense density, got ${String(lod.maxDepth)}`)
  }
}

export function testTidyTreeDensityAutosuggestNoopForSparseOrMissingCount() {
  const baseSchema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      lod: {
        ...(defaultSchema.performance?.lod || {}),
      },
      caps: {
        ...(defaultSchema.performance?.caps || {}),
      },
    },
  }

  const state = {
    schema: baseSchema,
    setSchema(next: GraphSchema) {
      ;(state as { schema: GraphSchema }).schema = next
    },
  }

  const get: GetGraph = () => state as never

  const metaSparse = {
    tidyTree: {
      mermaidDensity: {
        density: 'sparse',
        statementCount: 50,
      },
    },
  }

  applyLayoutAutosuggestFromMetadata(get, metaSparse)

  const afterSparse = state.schema
  const sparseLod = afterSparse.performance?.lod?.tidyTree
  if (sparseLod && (sparseLod.collapseMode === 'depth' || sparseLod.maxDepth != null)) {
    throw new Error(
      `expected no collapse defaults for sparse density, got collapseMode=${String(
        sparseLod.collapseMode,
      )}, maxDepth=${String(sparseLod.maxDepth)}`,
    )
  }

  const metaMissingCount = {
    tidyTree: {
      mermaidDensity: {
        density: 'medium',
      },
    },
  }

  applyLayoutAutosuggestFromMetadata(get, metaMissingCount)

  const afterMissingCount = state.schema
  const missingLod = afterMissingCount.performance?.lod?.tidyTree
  if (missingLod && (missingLod.collapseMode === 'depth' || missingLod.maxDepth != null)) {
    throw new Error(
      `expected no collapse defaults when statementCount is missing, got collapseMode=${String(
        missingLod.collapseMode,
      )}, maxDepth=${String(missingLod.maxDepth)}`,
    )
  }
}

export function testTidyTreeDensityAutosuggestRespectsExplicitCollapseConfig() {
  const baseSchema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      lod: {
        ...(defaultSchema.performance?.lod || {}),
        tidyTree: {
          collapseMode: 'depth',
          maxDepth: 5,
        },
      },
      caps: {
        ...(defaultSchema.performance?.caps || {}),
      },
    },
  }

  const state = {
    schema: baseSchema,
    setSchema(next: GraphSchema) {
      ;(state as { schema: GraphSchema }).schema = next
    },
  }

  const get: GetGraph = () => state as never

  const metadata = {
    tidyTree: {
      mermaidDensity: {
        density: 'dense',
        statementCount: 120,
      },
    },
  }

  applyLayoutAutosuggestFromMetadata(get, metadata)

  const next = state.schema
  const lod = next.performance?.lod?.tidyTree
  if (!lod) {
    throw new Error('expected performance.lod.tidyTree to remain initialized when explicit config is present')
  }
  if (lod.collapseMode !== 'depth') {
    throw new Error(`expected collapseMode to remain "depth", got ${String(lod.collapseMode)}`)
  }
  if (lod.maxDepth !== 5) {
    throw new Error(`expected maxDepth to remain 5, got ${String(lod.maxDepth)}`)
  }
}

export function testTidyTreePresetPreservesSchemaOverridesForOrientationAndSeparation() {
  const base: GraphSchema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      mode: 'tidy-tree',
      tidyTree: {
        ...(defaultSchema.layout?.tidyTree || {}),
        orientation: 'vertical',
        separation: 2.5,
        direction: 'source-target',
      },
    },
    metadata: {
      ...(defaultSchema.metadata || {}),
      tidyTree: {
        orientation: 'horizontal',
        separation: 1.1,
        direction: 'target-source',
      },
    },
  }

  const next = computeNextSchemaForTidyPreset(base, 'mermaid', [
    'hasSection',
    'hasBlock',
    'hasItem',
    'hasMermaid',
    'hasMermaidNode',
    'hasAnchor',
    'hasInternalLink',
  ])

  const tidy = next.layout?.tidyTree
  if (!tidy) {
    throw new Error('expected layout.tidyTree to be present after preset toggle')
  }
  if (tidy.orientation !== 'vertical') {
    throw new Error(`expected schema orientation "vertical" to be preserved, got ${String(tidy.orientation)}`)
  }
  if (tidy.separation !== 2.5) {
    throw new Error(`expected schema separation 2.5 to be preserved, got ${String(tidy.separation)}`)
  }
  if (tidy.direction !== 'source-target') {
    throw new Error(`expected schema direction "source-target" to be preserved, got ${String(tidy.direction)}`)
  }
}

export function testTidyTreePresetUsesMetadataWhenSchemaOrientationAndSeparationUnset() {
  const base: GraphSchema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      mode: 'tidy-tree',
      tidyTree: {
        ...(defaultSchema.layout?.tidyTree || {}),
      },
    },
    metadata: {
      ...(defaultSchema.metadata || {}),
      tidyTree: {
        orientation: 'vertical',
        separation: 1.7,
      },
    },
  }

  const next = computeNextSchemaForTidyPreset(base, 'mermaid', [
    'hasSection',
    'hasBlock',
    'hasItem',
    'hasMermaid',
    'hasMermaidNode',
    'hasAnchor',
    'hasInternalLink',
  ])

  const tidy = next.layout?.tidyTree
  if (!tidy) {
    throw new Error('expected layout.tidyTree to be present after preset toggle')
  }
  if (tidy.orientation !== 'vertical') {
    throw new Error(`expected metadata orientation "vertical" to be applied, got ${String(tidy.orientation)}`)
  }
  if (tidy.separation !== 1.7) {
    throw new Error(`expected metadata separation 1.7 to be applied, got ${String(tidy.separation)}`)
  }
}
