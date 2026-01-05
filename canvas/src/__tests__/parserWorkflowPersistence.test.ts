import { LS_KEYS } from '@/lib/config'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export function testParserWorkflowPresetStorage() {
  const storage = new MemoryStorage()
  const empty = verifyWorkflowPresetStorage(storage)
  if (empty.catalog !== null) {
    throw new Error('expected catalog to be null when storage empty')
  }
  if (empty.lastApplied !== null) {
    throw new Error('expected lastApplied to be null when storage empty')
  }
  const catalog = [
    {
      id: 'preset-1',
      label: 'Demo Preset',
      parserSpecId: 'json',
      datasetFileName: 'dataset.json',
      schemaFileName: 'schema.json',
    },
  ]
  const lastApplied = catalog[0]
  storage.setItem(LS_KEYS.workflowPresetCatalog, JSON.stringify(catalog))
  storage.setItem(LS_KEYS.workflowPresetLastApplied, JSON.stringify(lastApplied))
  const after = verifyWorkflowPresetStorage(storage)
  if (!after.catalog || after.catalog.length !== 1) {
    throw new Error('expected catalog with one entry')
  }
  if (!after.lastApplied) {
    throw new Error('expected lastApplied entry')
  }
  if (after.lastApplied.id !== 'preset-1') {
    throw new Error('lastApplied id mismatch')
  }
  if (after.catalog[0].datasetFileName !== 'dataset.json') {
    throw new Error('catalog datasetFileName mismatch')
  }
}
