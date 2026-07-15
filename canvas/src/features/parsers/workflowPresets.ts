import { listParsers } from './registry'
import type { ParserSpec } from './types'
import type { ParserId } from './types'
import { toParserId } from './types'
import type { DatasetPath, SchemaConfigPath } from '@/lib/graph/file'
import type { GraphSchema } from '@/lib/graph/schema'
import { EXAMPLES_BY_ID } from '@/features/parsers/examplesCatalog'
import { LS_KEYS, PUBLIC_FALLBACK_JSON } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'
import { serializeMarkdownPipeTable } from '@/features/markdown/ui/markdownDataViewSerialize'

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
    id: 'eda-mlp-pipeline-path' as WorkflowPresetId,
    label: 'Demo: EDA→MLP pipeline path inspector',
    parserId: toParserId('json') as WorkflowPresetParserId,
    datasetFileName: EXAMPLES_BY_ID.edaMlpPipeline.datasetPath as WorkflowDatasetPath,
    schemaFileName: EXAMPLES_BY_ID.edaMlpPipeline.schemaPath as WorkflowSchemaPath,
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
  return serializeMarkdownPipeTable({
    columns: ['Preset ID', 'Dataset', 'Schema', 'Primary use case'],
    rows: WORKFLOW_PRESETS.map(preset => [
      `\`${preset.id}\``,
      `\`${preset.datasetFileName}\``,
      `\`${preset.schemaFileName}\``,
      preset.label,
    ]),
  }).join('\n')
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
  const schemaConfig = import.meta.glob('../../../../data/config/schema/**/*', { query: '?raw', import: 'default' }) as Record<string, RawLoader>
  datasetLoadersCache = { ...testData, ...publicData, ...schemaConfig }
  return datasetLoadersCache
}

function getSchemaLoaders(): Record<string, RawLoader> | null {
  if (typeof window === 'undefined') return null
  if (schemaLoadersCache) return schemaLoadersCache
  schemaLoadersCache = import.meta.glob('../../../../data/config/schema/**/*', {
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
