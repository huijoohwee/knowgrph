import { MemoryStorage } from '@/tests/lib/memoryStorage'
import {
  normalizeNodeQuickEditorRegistryEntries,
  ensureDefaultGenerateVideoRegistryEntry,
  readNodeQuickEditorRegistryFromStorage,
  validateNodeQuickEditorRegistryEntry,
  writeNodeQuickEditorRegistryToStorage,
} from '@/hooks/store/flowEditorManagerSlice'
import { FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config'

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

export function testFlowEditorManagerSeedsGenerateVideoRegistryEntry() {
  const empty = ensureDefaultGenerateVideoRegistryEntry([], '2026-02-06T00:00:00.000Z')
  if (!empty.changed) throw new Error('expected seeding to report changed=true')
  const seeded = empty.entries
  const found = seeded.find(
    e => e.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID && e.quickEditorTypeId === 'default' && e.formId === 'videoGeneration',
  )
  if (!found) throw new Error('expected Generate Video mapping')

  const stable = ensureDefaultGenerateVideoRegistryEntry(seeded, '2026-02-06T00:00:00.000Z')
  if (stable.changed) throw new Error('expected seeding to be idempotent')
}
