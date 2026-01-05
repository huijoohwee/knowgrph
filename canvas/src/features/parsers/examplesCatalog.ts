import { toDatasetPath, toSchemaConfigPath } from '@/lib/graph/file'
import type { DatasetPath, SchemaConfigPath } from '@/lib/graph/file'

export type ExampleId =
  | 'sampleInvestorsTop3'
  | 'aiKgViz'
  | 'universalLeanStartup'
  | 'a0Investors'
  | 'ventureCapitalPortfolio'
  | 'aiCustomerVoiceManagement'

export type ExampleConfig = {
  id: ExampleId
  label: string
  datasetPath: DatasetPath
  schemaPath: SchemaConfigPath
}

export const EXAMPLE_DATASETS: ExampleConfig[] = [
  {
    id: 'sampleInvestorsTop3',
    label: 'Sample Investors Top-3 test graph',
    datasetPath: toDatasetPath('data/test-data/graph_202512091600.json'),
    schemaPath: toSchemaConfigPath('schema-config/knowgrph-universal-schema-config.jsonld'),
  },
  {
    id: 'aiKgViz',
    label: 'AI KG Visualization graph',
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
    id: 'a0Investors',
    label: 'A0 Investors JSON-LD graph',
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
    id: 'aiCustomerVoiceManagement',
    label: 'AI Customer Voice Management graph',
    datasetPath: toDatasetPath('data/test-data/ai-customer-voice-management.graph.json'),
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
