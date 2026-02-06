import { MemoryStorage } from '@/tests/lib/memoryStorage'
import {
  normalizeNodeQuickEditorRegistryEntries,
  readNodeQuickEditorRegistryFromStorage,
  validateNodeQuickEditorRegistryEntry,
  writeNodeQuickEditorRegistryToStorage,
} from '@/hooks/store/flowEditorManagerSlice'

export function testFlowEditorManagerRegistryValidatesAndNormalizes() {
  const valid = validateNodeQuickEditorRegistryEntry({
    id: 'e1',
    isEnabled: true,
    nodeTypeId: 'Schema',
    quickEditorTypeId: 'NodeQuickEditor',
    formId: 'default',
    fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
    ports: [],
    updatedAt: new Date().toISOString(),
  })
  if (!valid) throw new Error('expected entry to validate')

  const invalidEmpty = validateNodeQuickEditorRegistryEntry({
    id: 'e2',
    isEnabled: true,
    nodeTypeId: 'Schema',
    quickEditorTypeId: 'NodeQuickEditor',
    formId: 'default',
    fields: [],
    ports: [],
    updatedAt: new Date().toISOString(),
  })
  if (invalidEmpty) throw new Error('expected entry with no fields/ports to be rejected')

  const normalized = normalizeNodeQuickEditorRegistryEntries([
    {
      id: 'e1',
      isEnabled: true,
      nodeTypeId: 'B',
      quickEditorTypeId: 'NodeQuickEditor',
      formId: 'default',
      fields: [{ fieldKey: 'label', fieldType: 'text' }],
      ports: [],
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'e0',
      isEnabled: true,
      nodeTypeId: 'A',
      quickEditorTypeId: 'NodeQuickEditor',
      formId: 'default',
      fields: [{ fieldKey: 'label', fieldType: 'text' }],
      ports: [],
      updatedAt: new Date().toISOString(),
    },
  ])
  if (normalized.length !== 2) throw new Error('expected two entries after normalization')
  if (normalized[0].nodeTypeId !== 'A') throw new Error('expected normalization to sort by nodeTypeId')
}

export function testFlowEditorManagerRegistryStorageRoundTrip() {
  const storage = new MemoryStorage()
  const entries = [
    {
      id: 'e1',
      isEnabled: true,
      nodeTypeId: 'Schema',
      quickEditorTypeId: 'NodeQuickEditor',
      formId: 'default',
      fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
      ports: [{ direction: 'input' as const, portKey: 'field:id' }],
      updatedAt: new Date().toISOString(),
    },
  ]

  writeNodeQuickEditorRegistryToStorage(storage, entries)
  const reread = readNodeQuickEditorRegistryFromStorage(storage)
  if (reread.length !== 1) throw new Error('expected one entry after read')
  if (reread[0].id !== 'e1') throw new Error('expected id to round trip')
  if (reread[0].ports.length !== 1) throw new Error('expected ports to round trip')
}
