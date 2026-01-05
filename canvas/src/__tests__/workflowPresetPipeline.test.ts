import { WORKFLOW_PRESETS, getWorkflowPresetPipeline } from '@/features/parsers/workflowPresets'
import { registerParser, applyParserAsync } from '@/features/parsers/registry'
import { builtInParsers } from '@/features/parsers/default'
import { toParserId } from '@/features/parsers'
import type { GraphData } from '@/lib/graph/types'
import { exportGraphAsJSON, exportGraphAsCombinedCSV, saveGraphFile, toDatasetPath } from '@/lib/graph/file'

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
