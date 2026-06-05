import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { WORKFLOW_PRESETS, getWorkflowPresetPipeline } from '@/features/parsers/workflowPresets'
import { registerParser, applyParserAsync } from '@/features/parsers/registry'
import { builtInParsers } from '@/features/parsers/default'
import { toParserId } from '@/features/parsers'
import type { GraphData } from '@/lib/graph/types'
import { exportGraphAsJSON, exportGraphAsCombinedCSV, saveGraphFile, toDatasetPath } from '@/lib/graph/file'

const CANVAS_ROOT = process.cwd()
const REPO_ROOT = resolve(CANVAS_ROOT, '..')

function resolvePresetDatasetPath(datasetPath: string): string {
  if (datasetPath.startsWith('public/')) return resolve(CANVAS_ROOT, datasetPath)
  return resolve(REPO_ROOT, datasetPath)
}

function ensureParsersRegistered() {
  for (const p of builtInParsers) registerParser(p)
}

export async function testWorkflowPresetPipelinesAreSelfConsistent() {
  ensureParsersRegistered()
  for (const preset of WORKFLOW_PRESETS) {
    const pipeline = getWorkflowPresetPipeline(preset.id)
    if (!pipeline) throw new Error('pipeline not found')
    if (!pipeline.parserSpec) throw new Error('parser spec missing')
    if (pipeline.parserSpec.id !== preset.parserId) throw new Error('preset parserId mismatch')
    if (String(pipeline.schemaPath) !== String(preset.schemaFileName)) throw new Error('preset schemaPath mismatch')
    if (String(pipeline.datasetPath) !== String(preset.datasetFileName)) throw new Error('preset datasetPath mismatch')
    await Promise.resolve()
  }
}

export function testWorkflowPresetDatasetsExistWithoutLegacyFallbacks() {
  for (const preset of WORKFLOW_PRESETS) {
    const datasetPath = String(preset.datasetFileName)
    if (!existsSync(resolvePresetDatasetPath(datasetPath))) {
      throw new Error(`workflow preset dataset is missing: ${datasetPath}`)
    }
  }

  const workflowPresetsPath = resolve(CANVAS_ROOT, 'src', 'features', 'parsers', 'workflowPresets.ts')
  const workflowPresetsText = readFileSync(workflowPresetsPath, 'utf8')
  if (workflowPresetsText.includes('DATASET_FALLBACK_MAPPINGS') || workflowPresetsText.includes('inlineJsonLd')) {
    throw new Error('workflow presets must load real dataset files instead of stale fallback mappings or inline fixtures')
  }

  const fallbackMappingsPath = resolve(CANVAS_ROOT, 'src', 'features', 'parsers', 'config', 'fallbackMappings.ts')
  if (existsSync(fallbackMappingsPath)) {
    throw new Error('legacy workflow dataset fallbackMappings.ts should stay removed')
  }
}

export async function testExportFunctionsAcceptBrandedPaths() {
  ensureParsersRegistered()
  const parsed = await applyParserAsync(toParserId('json'), {
    name: 'synthetic.json',
    text: JSON.stringify({
      nodes: [{ id: 'n1', name: 'A', type: 'Entity', data: {} }],
      edges: [],
    }),
  })
  if (!parsed) throw new Error('parse failed')
  const data: GraphData = parsed.graphData
  await Promise.resolve()
  const suggested = toDatasetPath('graph.jsonld')
  await Promise.resolve(saveGraphFile(data, suggested))
  await Promise.resolve(exportGraphAsJSON(data, suggested))
  await Promise.resolve(exportGraphAsCombinedCSV(data, suggested))
}
