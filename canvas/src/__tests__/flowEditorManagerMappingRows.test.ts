import {
  applyMappingRowsToRegistryEntry,
  buildMappingRowsFromRegistryEntry,
  validateMappingRows,
} from '@/features/flow-editor-manager/mappingRows'

import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export function testFlowEditorManagerMappingRowsRoundTripPreservesLabels() {
  const entry: WidgetRegistryEntry = {
    id: 'qer_test',
    isEnabled: true,
    nodeTypeId: 'VideoGeneration',
    widgetTypeId: 'default',
    formId: 'videoGeneration',
    fields: [
      { fieldKey: 'prompt', fieldType: 'text', label: 'Prompt', schemaPath: 'properties.prompt', required: true },
      { fieldKey: 'fast', fieldType: 'boolean', label: 'Fast', schemaPath: 'properties.fast' },
    ],
    ports: [
      { portKey: 'reference_image', direction: 'input', schemaPath: 'properties.reference_image' },
      { portKey: 'videoUrl', direction: 'output', schemaPath: 'properties.videoUrl' },
    ],
    schemaMappings: [],
    updatedAt: '2026-02-06T00:00:00.000Z',
  }

  const rows = buildMappingRowsFromRegistryEntry(entry)
  const err = validateMappingRows(rows)
  if (err) throw new Error(`unexpected validation error: ${err}`)

  const next = applyMappingRowsToRegistryEntry({ entry, rows })
  const prompt = next.fields.find(f => f.fieldKey === 'prompt')
  if (!prompt) throw new Error('expected prompt field')
  if (prompt.label !== 'Prompt') throw new Error('expected prompt label preserved')
  const inPort = next.ports.find(p => p.direction === 'input' && p.portKey === 'reference_image')
  if (!inPort) throw new Error('expected reference_image input port')
}

export function testFlowEditorManagerMappingRowsValidationDetectsDuplicates() {
  const err = validateMappingRows([
    { id: '1', key: 'x', type: 'text', value: '', required: false, direction: 'default' },
    { id: '2', key: 'x', type: 'number', value: '', required: false, direction: 'default' },
  ])
  if (!err) throw new Error('expected duplicate key error')
}
