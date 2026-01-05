import { getBottomTabLabel, type BottomTabRoleKey, type WorkflowStepId } from '@/features/panels/config'
import { ORCHESTRATOR_TRAVERSAL_TOOLTIP, GRAPH_FIELDS_ICON_LEGEND_TOOLTIP } from '@/lib/config'

export type SpotlightStepVariant = 'primary' | 'secondary'

export type SpotlightRequirementKey =
  | 'parserOpen'
  | 'schemaOpen'
  | 'renderOpen'
  | 'orchestratorOpen'
  | 'traversalRan'
  | 'datasetLoaded'

export type SpotlightRequirementStatus = Record<SpotlightRequirementKey, boolean>

export type SpotlightBottomTabRequirementKey = Extract<
  SpotlightRequirementKey,
  'parserOpen' | 'schemaOpen' | 'renderOpen' | 'orchestratorOpen'
>

export type SpotlightBottomTabRequirementMap = Record<SpotlightBottomTabRequirementKey, BottomTabRoleKey>

export interface SpotlightStepConfig {
  id: WorkflowStepId
  title: string
  body: string
  targetSelector: string | null
  variant: SpotlightStepVariant
  requires?: SpotlightRequirementKey[]
}

const graphJsonTabLabel = getBottomTabLabel('data')
const validateTabLabel = getBottomTabLabel('table')
const curatorTabLabel = getBottomTabLabel('curation')

export const SPOTLIGHT_STEPS: SpotlightStepConfig[] = [
  {
    id: 1,
    title: 'Step 1 – Load Data',
    body:
      '1. Click **Load Data** button → 2. Select source type → 3. Loader validates JSON syntax → 4. Parser validates structure against the active schema with no domain assumptions → 5. Graph structure loaded: `{nodes[], edges[], metadata{}}` with zero references to specific files or datasets.',
    targetSelector: '[data-kg-spotlight-tab="load-data"]',
    variant: 'primary',
  },
  {
    id: 2,
    title: 'Step 2 – Validate & Inspect',
    body:
      `Review parsed graph structure in the ${graphJsonTabLabel} and ${validateTabLabel} tabs. Use ${curatorTabLabel} to curate nodes, edges, and metadata upstream of the Loader and Parser. ${curatorTabLabel} provides a unified grid over the current in-memory GraphData. Check node and edge counts, inspect metadata summaries, read validation reports for errors and warnings, and preview sample nodes and edges so you can verify node ID uniqueness, edge references, schema conformance, and quality metrics.`,
    targetSelector: '[data-kg-spotlight="load-data"]',
    variant: 'secondary',
    requires: ['datasetLoaded'],
  },
  {
    id: 3,
    title: 'Step 3 – Configure Visualization',
    body:
      'Apply styling and layout rules in the Schema Configurator tab. Use schema templates to configure node styling, edge styling, layout algorithms, and interaction behavior, customize rules in the Schema UI Editor, and keep templates reusable and domain-agnostic across datasets.',
    targetSelector: '[data-kg-spotlight-tab="schema"]',
    variant: 'secondary',
    requires: ['schemaOpen'],
  },
  {
    id: 4,
    title: 'Step 4 – Orchestrate Agentic Traversal',
    body: `${ORCHESTRATOR_TRAVERSAL_TOOLTIP} Start from graphRAGPath.traverse metadata or generic traversal queries so multi-hop paths stay grounded in the current GraphData, schema, and Orchestrator selection state.`,
    targetSelector: '[data-kg-spotlight-tab="orchestrator"]',
    variant: 'secondary',
    requires: ['orchestratorOpen'],
  },
  {
    id: 5,
    title: 'Step 5 – Visualize & Explore',
    body:
      'Renderer → explore 2D/3D layouts with GraphRAG traversal overlays, selection filters, and minimap navigation → inspect and export AgenticRAG-ready subgraphs and screenshots for sharing and downstream graph analysis.',
    targetSelector: '[data-kg-spotlight-tab="render"]',
    variant: 'secondary',
    requires: ['traversalRan'],
  },
  {
    id: 6,
    title: 'Graph Fields Icon Library',
    body:
      GRAPH_FIELDS_ICON_LEGEND_TOOLTIP,
    targetSelector: '[data-kg-anchor="graph-fields:icons"]',
    variant: 'secondary',
  },
]
