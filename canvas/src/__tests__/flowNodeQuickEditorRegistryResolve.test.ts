import { resolveNodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'

export const testFlowNodeQuickEditorRegistryResolvePrefersDefault = () => {
  const registry = [
    {
      id: 'a',
      isEnabled: true,
      nodeTypeId: 'Schema',
      quickEditorTypeId: 'other',
      formId: 'f1',
      fields: [{ fieldKey: 'name', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'b',
      isEnabled: true,
      nodeTypeId: 'Schema',
      quickEditorTypeId: 'default',
      formId: 'f0',
      fields: [{ fieldKey: 'title', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const entry = resolveNodeQuickEditorRegistryEntry({ node: { type: 'Schema', properties: {} }, registry })
  if (!entry) throw new Error('expected a resolved entry')
  if (entry.id !== 'b') throw new Error(`expected default entry id=b, got ${String(entry.id)}`)
}

export const testFlowNodeQuickEditorRegistryResolveHonorsNodeOverride = () => {
  const registry = [
    {
      id: 'a',
      isEnabled: true,
      nodeTypeId: 'Schema',
      quickEditorTypeId: 'default',
      formId: 'f0',
      fields: [{ fieldKey: 'title', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'b',
      isEnabled: true,
      nodeTypeId: 'Schema',
      quickEditorTypeId: 'special',
      formId: 'f2',
      fields: [{ fieldKey: 'name', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const entry = resolveNodeQuickEditorRegistryEntry({
    node: { type: 'Schema', properties: { 'flow:quickEditorTypeId': 'special' } },
    registry,
  })
  if (!entry) throw new Error('expected a resolved entry')
  if (entry.id !== 'b') throw new Error(`expected override entry id=b, got ${String(entry.id)}`)
}

export const testFlowNodeQuickEditorRegistryResolveHonorsFormOverrideOrFallsBack = () => {
  const registry = [
    {
      id: 'a',
      isEnabled: true,
      nodeTypeId: 'Schema',
      quickEditorTypeId: 'default',
      formId: 'f0',
      fields: [{ fieldKey: 'title', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'b',
      isEnabled: true,
      nodeTypeId: 'Schema',
      quickEditorTypeId: 'default',
      formId: 'f1',
      fields: [{ fieldKey: 'name', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  ]

  const byForm = resolveNodeQuickEditorRegistryEntry({
    node: { type: 'Schema', properties: { 'flow:quickEditorFormId': 'f1' } },
    registry,
  })
  if (!byForm) throw new Error('expected a resolved entry for form=f1')
  if (byForm.id !== 'b') throw new Error(`expected form override entry id=b, got ${String(byForm.id)}`)

  const fallback = resolveNodeQuickEditorRegistryEntry({
    node: { type: 'Schema', properties: { 'flow:quickEditorFormId': 'missing' } },
    registry,
  })
  if (!fallback) throw new Error('expected a resolved entry for missing form')
  if (fallback.id !== 'a') throw new Error(`expected fallback default entry id=a, got ${String(fallback.id)}`)
}
