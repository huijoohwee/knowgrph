import { listParsers } from '@/features/parsers'
import type { ParserSpec } from '@/features/parsers'
import type { ParserId } from '@/features/parsers/types'
import { toParserId } from '@/features/parsers/types'
import type { DatasetPath, SchemaConfigPath } from '@/lib/graph/file'
import type { GraphSchema } from '@/lib/graph/schema'
import { EXAMPLES_BY_ID } from '@/features/parsers/examplesCatalog'
import { LS_KEYS, PUBLIC_FALLBACK_JSON } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'

declare const workflowPresetIdBrand: unique symbol

export type WorkflowPresetId = string & { readonly [workflowPresetIdBrand]: true }

declare const workflowPresetParserIdBrand: unique symbol
declare const workflowDatasetPathBrand: unique symbol
declare const workflowSchemaPathBrand: unique symbol

type WorkflowPresetParserId = ParserId & { readonly [workflowPresetParserIdBrand]: true }
type WorkflowDatasetPath = DatasetPath & { readonly [workflowDatasetPathBrand]: true }
type WorkflowSchemaPath = SchemaConfigPath & { readonly [workflowSchemaPathBrand]: true }

export type WorkflowPresetCatalogEntry = {
  id: WorkflowPresetId
  label: string
  parserId: WorkflowPresetParserId
  datasetFileName: WorkflowDatasetPath
  schemaFileName: WorkflowSchemaPath
  threeOverrides?: Partial<GraphSchema['three']>
}

export const WORKFLOW_PRESETS: WorkflowPresetCatalogEntry[] = [
  {
    id: 'sample-investors-top3-3d' as WorkflowPresetId,
    label: 'Demo: Sample Investors Top-3 (3D)',
    parserId: toParserId('json') as WorkflowPresetParserId,
    datasetFileName: EXAMPLES_BY_ID.sampleTop3Portfolio.datasetPath as WorkflowDatasetPath,
    schemaFileName: EXAMPLES_BY_ID.sampleTop3Portfolio.schemaPath as WorkflowSchemaPath,
    threeOverrides: {
      linkDirectionalArrowLength: 10,
      linkOpacity: 0.55,
      linkCurvature: 0.2,
      linkCurveRotation: 0,
      linkDirectionalArrowRelPos: 0.85,
      linkDirectionalParticles: 6,
      linkDirectionalParticleSpeed: 0.8,
    },
  },
  {
    id: 'ai-kg-viz' as WorkflowPresetId,
    label: 'Demo: AI KG Visualization',
    parserId: toParserId('jsonld') as WorkflowPresetParserId,
    datasetFileName: EXAMPLES_BY_ID.genericKgVisualization.datasetPath as WorkflowDatasetPath,
    schemaFileName: EXAMPLES_BY_ID.genericKgVisualization.schemaPath as WorkflowSchemaPath,
    threeOverrides: {
      backgroundColor: '',
    },
  },
  {
    id: 'customerVoiceManagement' as WorkflowPresetId,
    label: 'Demo: Customer Voice Management',
    parserId: toParserId('json') as WorkflowPresetParserId,
    datasetFileName: EXAMPLES_BY_ID.customerVoiceManagement.datasetPath as WorkflowDatasetPath,
    schemaFileName: EXAMPLES_BY_ID.customerVoiceManagement.schemaPath as WorkflowSchemaPath,
    threeOverrides: {
      backgroundColor: '',
    },
  },
  {
    id: 'example-workflow' as WorkflowPresetId,
    label: 'Demo: Example Workflow (semantic clusters hidden)',
    parserId: toParserId('jsonld') as WorkflowPresetParserId,
    datasetFileName: EXAMPLES_BY_ID.exampleWorkflow.datasetPath as WorkflowDatasetPath,
    schemaFileName: EXAMPLES_BY_ID.exampleWorkflow.schemaPath as WorkflowSchemaPath,
  },
  {
    id: 'multi-ontology-kg' as WorkflowPresetId,
    label: 'Demo: Multi-ontology Assessment Knowledge Graph',
    parserId: toParserId('jsonld') as WorkflowPresetParserId,
    datasetFileName: EXAMPLES_BY_ID.multiOntologyWorkflow.datasetPath as WorkflowDatasetPath,
    schemaFileName: EXAMPLES_BY_ID.multiOntologyWorkflow.schemaPath as WorkflowSchemaPath,
    threeOverrides: {
      backgroundColor: '',
    },
  },
  {
    id: 'universal-lean-startup-kg' as WorkflowPresetId,
    label: 'Demo: Universal Lean Startup Knowledge Graph',
    parserId: toParserId('jsonld') as WorkflowPresetParserId,
    datasetFileName: EXAMPLES_BY_ID.universalLeanStartup.datasetPath as WorkflowDatasetPath,
    schemaFileName: EXAMPLES_BY_ID.universalLeanStartup.schemaPath as WorkflowSchemaPath,
    threeOverrides: {
      backgroundColor: '',
    },
  },
  {
    id: 'a0-investors-kg' as WorkflowPresetId,
    label: 'Demo: Investors Knowledge Graph',
    parserId: toParserId('jsonld') as WorkflowPresetParserId,
    datasetFileName: EXAMPLES_BY_ID.investorsJsonLd.datasetPath as WorkflowDatasetPath,
    schemaFileName: EXAMPLES_BY_ID.investorsJsonLd.schemaPath as WorkflowSchemaPath,
  },
  {
    id: 'venture-capital-portfolio' as WorkflowPresetId,
    label: 'Demo: Venture Capital Portfolio',
    parserId: toParserId('json') as WorkflowPresetParserId,
    datasetFileName: EXAMPLES_BY_ID.ventureCapitalPortfolio.datasetPath as WorkflowDatasetPath,
    schemaFileName: EXAMPLES_BY_ID.ventureCapitalPortfolio.schemaPath as WorkflowSchemaPath,
    threeOverrides: {
      backgroundColor: '',
    },
  },
]

export type WorkflowPresetStorageCatalogEntry = {
  id: WorkflowPresetId
  label: string
  parserSpecId: WorkflowPresetParserId
  datasetFileName: WorkflowDatasetPath
  schemaFileName: WorkflowSchemaPath
}

export type WorkflowPresetStorageLastApplied = WorkflowPresetStorageCatalogEntry

const WORKFLOW_PRESET_CATALOG_KEY = LS_KEYS.workflowPresetCatalog
const WORKFLOW_PRESET_LAST_APPLIED_KEY = LS_KEYS.workflowPresetLastApplied

function readWorkflowPresetStorageFromStorage(
  storage: Storage | null,
): {
  catalog: WorkflowPresetStorageCatalogEntry[] | null
  lastApplied: WorkflowPresetStorageLastApplied | null
} {
  if (!storage) {
    return {
      catalog: null,
      lastApplied: null,
    }
  }
  try {
    const rawCatalog = storage.getItem(WORKFLOW_PRESET_CATALOG_KEY)
    const rawLast = storage.getItem(WORKFLOW_PRESET_LAST_APPLIED_KEY)
    const catalog = rawCatalog ? (JSON.parse(rawCatalog) as WorkflowPresetStorageCatalogEntry[]) : null
    const lastApplied = rawLast ? (JSON.parse(rawLast) as WorkflowPresetStorageLastApplied) : null
    return { catalog, lastApplied }
  } catch {
    return {
      catalog: null,
      lastApplied: null,
    }
  }
}

export function writeWorkflowPresetCatalogToStorage(
  storage: Storage | null,
  presets: WorkflowPresetCatalogEntry[],
): void {
  if (!storage) return
  try {
    const catalog: WorkflowPresetStorageCatalogEntry[] = presets.map(preset => ({
      id: preset.id,
      label: preset.label,
      parserSpecId: preset.parserId,
      datasetFileName: preset.datasetFileName,
      schemaFileName: preset.schemaFileName,
    }))
    storage.setItem(WORKFLOW_PRESET_CATALOG_KEY, JSON.stringify(catalog))
  } catch {
    void 0
  }
}

export function writeWorkflowPresetLastAppliedToStorage(
  storage: Storage | null,
  entry: WorkflowPresetStorageLastApplied,
): void {
  if (!storage) return
  try {
    storage.setItem(WORKFLOW_PRESET_LAST_APPLIED_KEY, JSON.stringify(entry))
  } catch {
    void 0
  }
}

export type WorkflowPresetPipeline = {
  preset: WorkflowPresetCatalogEntry
  parserSpec: ParserSpec | null
  datasetPath: WorkflowDatasetPath
  schemaPath: WorkflowSchemaPath
}

export type WorkflowPresetMarkdownRecord = {
  id: WorkflowPresetId
  label: string
  datasetFileName: WorkflowDatasetPath
  schemaFileName: WorkflowSchemaPath
}

export function getWorkflowPresetMarkdownTable(): string {
  const header = '| Preset ID | Dataset | Schema | Primary use case |'
  const separator = '|---|---|---|---|'
  const rows = WORKFLOW_PRESETS.map(preset => {
    const id = preset.id
    const dataset = preset.datasetFileName
    const schema = preset.schemaFileName
    const useCase = preset.label
    return `| \`${id}\` | \`${dataset}\` | \`${schema}\` | ${useCase} |`
  })
  return [header, separator, ...rows].join('\n')
}

export function getWorkflowPresetPipeline(presetId: WorkflowPresetId): WorkflowPresetPipeline | null {
  const preset = WORKFLOW_PRESETS.find(p => p.id === presetId) || null
  if (!preset) return null
  const parserSpec = listParsers().find(p => p.id === preset.parserId) || null
  return {
    preset,
    parserSpec,
    datasetPath: preset.datasetFileName,
    schemaPath: preset.schemaFileName,
  }
}

export function verifyWorkflowPresetStorage(
  storage?: Storage | null,
): {
  catalog: WorkflowPresetStorageCatalogEntry[] | null
  lastApplied: WorkflowPresetStorageLastApplied | null
} {
  const resolved: Storage | null =
    typeof storage === 'undefined'
      ? getLocalStorage()
      : storage ?? null
  return readWorkflowPresetStorageFromStorage(resolved)
}

export function fileNameFromRepoPath(path: string): string {
  const trimmed = String(path ?? '').trim()
  const parts = trimmed.split('/').filter(Boolean)
  return parts[parts.length - 1] || trimmed || 'example.json'
}

type RawLoader = () => Promise<string>

let datasetLoadersCache: Record<string, RawLoader> | null = null
let schemaLoadersCache: Record<string, RawLoader> | null = null

function normalizeRepoPath(path: string): string {
  const raw = String(path ?? '')
  const trimmed = raw.trim()
  if (trimmed.startsWith('/')) return trimmed.slice(1)
  if (trimmed.startsWith('./')) return trimmed.slice(2)
  return trimmed
}

function findLoader(loaders: Record<string, RawLoader>, repoPath: string): RawLoader | null {
  const target = normalizeRepoPath(repoPath)
  if (!target) return null
  const suffix = `/${target}`
  for (const [key, loader] of Object.entries(loaders)) {
    if (key.endsWith(suffix) || key.endsWith(target)) return loader
  }
  return null
}

function getDatasetLoaders(): Record<string, RawLoader> | null {
  if (typeof window === 'undefined') return null
  if (datasetLoadersCache) return datasetLoadersCache
  const testData = import.meta.glob('../../../../data/test-data/**/*', { query: '?raw', import: 'default' }) as Record<
    string,
    RawLoader
  >
  const publicData = import.meta.glob('../../../../public/**/*', { query: '?raw', import: 'default' }) as Record<string, RawLoader>
  const schemaConfig = import.meta.glob('../../../../schema-config/**/*', { query: '?raw', import: 'default' }) as Record<string, RawLoader>
  datasetLoadersCache = { ...testData, ...publicData, ...schemaConfig }
  return datasetLoadersCache
}

function getSchemaLoaders(): Record<string, RawLoader> | null {
  if (typeof window === 'undefined') return null
  if (schemaLoadersCache) return schemaLoadersCache
  schemaLoadersCache = import.meta.glob('../../../../schema-config/**/*', {
    query: '?raw',
    import: 'default',
  }) as Record<string, RawLoader>
  return schemaLoadersCache
}

export async function loadExampleDatasetTextInBrowser(datasetPath: string): Promise<string | null> {
  const loaders = getDatasetLoaders()
  if (!loaders) return null
  const loader = findLoader(loaders, datasetPath)
  if (loader) return await loader()

  const normalized = normalizeRepoPath(datasetPath)

  const inlineJsonLd = (() => {
    if (
      normalized === 'data/test-data/ai-kg-viz_1500.json' ||
      normalized === 'data/test-data/universal-lean-startup-kg.json' ||
      normalized === 'data/test-data/a0.jsonld'
    ) {
      return JSON.stringify(
        {
          '@context': {
            '@vocab': 'http://example.org/kg#',
            kg: 'http://example.org/kg#',
          },
          '@graph': [
            { '@id': 'kg:ai', '@type': 'Concept', name: 'AI' },
            { '@id': 'kg:kg', '@type': 'Concept', name: 'Knowledge Graph' },
            { '@id': 'kg:viz', '@type': 'Concept', name: 'Visualization' },
            {
              '@id': 'kg:e1',
              'kg:subject': 'kg:viz',
              'kg:predicate': 'kg:relatedTo',
              'kg:object': 'kg:ai',
            },
            {
              '@id': 'kg:e2',
              'kg:subject': 'kg:viz',
              'kg:predicate': 'kg:relatedTo',
              'kg:object': 'kg:kg',
            },
          ],
        },
        null,
        2,
      )
    }
    return null
  })()
  if (inlineJsonLd) return inlineJsonLd

  const fallbackPath = (() => {
    if (normalized === 'data/test-data/graph_202512091600.json') return 'public/unicorn-investors-top-3-3d.json'
    if (normalized === 'data/test-data/ai-customer-voice-management.graph.json') return 'public/unicorn-investors-test.json'
    return null
  })()

  if (fallbackPath) {
    const fallbackLoader = findLoader(loaders, fallbackPath)
    if (fallbackLoader) return await fallbackLoader()
  }

  const url = PUBLIC_FALLBACK_JSON ? String(PUBLIC_FALLBACK_JSON).trim() : ''
  if (url) {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      return await res.text()
    } catch {
      return null
    }
  }

  return null
}

export async function loadExampleSchemaTextInBrowser(schemaPath: string): Promise<string | null> {
  const loaders = getSchemaLoaders()
  if (!loaders) return null
  const loader = findLoader(loaders, schemaPath)
  if (!loader) return null
  return await loader()
}
