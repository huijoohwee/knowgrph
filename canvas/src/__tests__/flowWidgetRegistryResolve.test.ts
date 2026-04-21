import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'

export const testFlowWidgetRegistryResolvePrefersDefault = () => {
  const registry = [
    {
      id: 'a',
      isEnabled: true,
      nodeTypeId: 'Schema',
      widgetTypeId: 'other',
      formId: 'f1',
      fields: [{ fieldKey: 'name', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'b',
      isEnabled: true,
      nodeTypeId: 'Schema',
      widgetTypeId: 'default',
      formId: 'f0',
      fields: [{ fieldKey: 'title', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const entry = resolveWidgetRegistryEntry({ node: { type: 'Schema', properties: {} }, registry })
  if (!entry) throw new Error('expected a resolved entry')
  if (entry.id !== 'b') throw new Error(`expected default entry id=b, got ${String(entry.id)}`)
}

export const testFlowWidgetRegistryResolveHonorsNodeOverride = () => {
  const registry = [
    {
      id: 'a',
      isEnabled: true,
      nodeTypeId: 'Schema',
      widgetTypeId: 'default',
      formId: 'f0',
      fields: [{ fieldKey: 'title', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'b',
      isEnabled: true,
      nodeTypeId: 'Schema',
      widgetTypeId: 'special',
      formId: 'f2',
      fields: [{ fieldKey: 'name', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const entry = resolveWidgetRegistryEntry({
    node: { type: 'Schema', properties: { 'flow:widgetTypeId': 'special' } },
    registry,
  })
  if (!entry) throw new Error('expected a resolved entry')
  if (entry.id !== 'b') throw new Error(`expected override entry id=b, got ${String(entry.id)}`)
}

export const testFlowWidgetRegistryResolveHonorsFormOverrideOrFallsBack = () => {
  const registry = [
    {
      id: 'a',
      isEnabled: true,
      nodeTypeId: 'Schema',
      widgetTypeId: 'default',
      formId: 'f0',
      fields: [{ fieldKey: 'title', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'b',
      isEnabled: true,
      nodeTypeId: 'Schema',
      widgetTypeId: 'default',
      formId: 'f1',
      fields: [{ fieldKey: 'name', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  ]

  const byForm = resolveWidgetRegistryEntry({
    node: { type: 'Schema', properties: { 'flow:widgetFormId': 'f1' } },
    registry,
  })
  if (!byForm) throw new Error('expected a resolved entry for form=f1')
  if (byForm.id !== 'b') throw new Error(`expected form override entry id=b, got ${String(byForm.id)}`)

  const fallback = resolveWidgetRegistryEntry({
    node: { type: 'Schema', properties: { 'flow:widgetFormId': 'missing' } },
    registry,
  })
  if (!fallback) throw new Error('expected a resolved entry for missing form')
  if (fallback.id !== 'a') throw new Error(`expected fallback default entry id=a, got ${String(fallback.id)}`)
}

export const testFlowWidgetRegistryResolveFrontmatterFlowRequiresExactNodeForm = () => {
  const registry = [
    {
      id: 'pack',
      isEnabled: true,
      nodeTypeId: 'Schema',
      widgetTypeId: 'default',
      formId: 'fm:n-pack',
      fields: [{ fieldKey: 'title', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'other',
      isEnabled: true,
      nodeTypeId: 'Schema',
      widgetTypeId: 'default',
      formId: 'fm:n-other',
      fields: [{ fieldKey: 'name', fieldType: 'text' }],
      ports: [],
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  ]

  const match = resolveWidgetRegistryEntry({
    node: { id: 'n-pack', type: 'Schema', properties: {} },
    registry,
    graphMetaKind: 'frontmatter-flow',
  })
  if (!match) throw new Error('expected exact frontmatter-flow match for node id')
  if (match.id !== 'pack') throw new Error(`expected exact frontmatter-flow entry id=pack, got ${String(match.id)}`)

  const missing = resolveWidgetRegistryEntry({
    node: { id: 'n-missing', type: 'Schema', properties: {} },
    registry,
    graphMetaKind: 'frontmatter-flow',
  })
  if (missing) throw new Error(`expected no frontmatter-flow fallback for unmatched node id, got ${String(missing.id)}`)
}
