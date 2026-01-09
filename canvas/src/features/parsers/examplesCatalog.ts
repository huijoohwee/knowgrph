import { toDatasetPath, toSchemaConfigPath } from '@/lib/graph/file'
import type { DatasetPath, SchemaConfigPath } from '@/lib/graph/file'

export type ExampleId =
  | 'sampleTop3Portfolio'
  | 'genericKgVisualization'
  | 'universalLeanStartup'
  | 'investorsJsonLd'
  | 'ventureCapitalPortfolio'
  | 'customerVoiceManagement'
  | 'exampleWorkflow'
  | 'multiOntologyWorkflow'
  | 'edaMlpPipeline'

export type ExampleConfig = {
  id: ExampleId
  label: string
  datasetPath: DatasetPath
  schemaPath: SchemaConfigPath
}

export const EXAMPLE_DATASETS: ExampleConfig[] = [
  {
    id: 'sampleTop3Portfolio',
    label: 'Sample Top-3 portfolio test graph',
    datasetPath: toDatasetPath('data/test-data/graph_202512091600.json'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-universal-schema-config.jsonld'),
  },
  {
    id: 'genericKgVisualization',
    label: 'Knowledge graph visualization',
    datasetPath: toDatasetPath('data/test-data/ai-kg-viz_1500.json'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-universal-schema-config.jsonld'),
  },
  {
    id: 'universalLeanStartup',
    label: 'Universal Lean Startup Knowledge Graph',
    datasetPath: toDatasetPath('data/test-data/universal-lean-startup-kg.json'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-universal-schema-config.jsonld'),
  },
  {
    id: 'investorsJsonLd',
    label: 'Investors JSON-LD graph',
    datasetPath: toDatasetPath('data/test-data/a0.jsonld'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-universal-schema-config.jsonld'),
  },
  {
    id: 'ventureCapitalPortfolio',
    label: 'Venture capital portfolio graph',
    datasetPath: toDatasetPath('data/test-data/graph_202512091600.json'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-universal-schema-config.jsonld'),
  },
  {
    id: 'customerVoiceManagement',
    label: 'Customer voice management graph',
    datasetPath: toDatasetPath('data/test-data/ai-customer-voice-management.graph.json'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-universal-schema-config.jsonld'),
  },
  {
    id: 'exampleWorkflow',
    label: 'Example workflow graph',
    datasetPath: toDatasetPath('docs/assets/example-workflow.jsonld'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-example-workflow-schema-config.jsonld'),
  },
  {
    id: 'multiOntologyWorkflow',
    label: 'Multi-ontology assessment graph',
    datasetPath: toDatasetPath('docs/assets/multi-ontology-kg.jsonld'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-interviewer-schema-config.jsonld'),
  },
  {
    id: 'edaMlpPipeline',
    label: 'EDA→MLP pipeline path graph',
    datasetPath: toDatasetPath('data/test-data/eda-mlp-path.json'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-universal-schema-config.jsonld'),
  },
]

export const EXAMPLES_BY_ID: Record<ExampleId, ExampleConfig> = EXAMPLE_DATASETS.reduce(
  (acc, cfg) => {
    acc[cfg.id] = cfg
    return acc
  },
  {} as Record<ExampleId, ExampleConfig>,
)
