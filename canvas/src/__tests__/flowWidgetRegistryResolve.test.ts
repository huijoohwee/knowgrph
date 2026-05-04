import {
  deriveWidgetCandidateNodeIds,
  isFrontmatterWidgetRegistryNode,
  isNodeOwnedFrontmatterWidgetRegistryEntry,
  isWidgetCandidateNode,
  listScopedWidgetRegistryEntries,
  resolveFrontmatterWidgetRegistrySectionState,
  resolveExpectedFrontmatterWidgetFormId,
  resolveNodeWidgetIdentity,
  resolveWidgetRegistryEntry,
} from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { GraphNode } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export const testFlowWidgetRegistryResolvePrefersDefault = () => {
  const registry: WidgetRegistryEntry[] = [
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

  const entry = resolveWidgetRegistryEntry({ node: { id: 'node-default', type: 'Schema', properties: {} }, registry })
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
    node: { id: 'node-special', type: 'Schema', properties: { 'flow:widgetTypeId': 'special' } },
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
    node: { id: 'node-form', type: 'Schema', properties: { 'flow:widgetFormId': 'f1' } },
    registry,
  })
  if (!byForm) throw new Error('expected a resolved entry for form=f1')
  if (byForm.id !== 'b') throw new Error(`expected form override entry id=b, got ${String(byForm.id)}`)

  const fallback = resolveWidgetRegistryEntry({
    node: { id: 'node-missing', type: 'Schema', properties: { 'flow:widgetFormId': 'missing' } },
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

export const testIsWidgetCandidateNodeRequiresWidgetHintOrRegistryAndSkipsHeadingSections = () => {
  const registry = [
    {
      id: 'text-default',
      isEnabled: true,
      nodeTypeId: 'TextGeneration',
      widgetTypeId: 'default',
      formId: 'textGeneration',
      fields: [{ fieldKey: 'prompt', fieldType: 'textarea' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  if (!isWidgetCandidateNode({ node: { id: 'n1', type: 'TextGeneration', properties: {} }, registry })) {
    throw new Error('expected registry-backed flow node to count as a widget candidate')
  }
  if (!isWidgetCandidateNode({ node: { id: 'n2', type: 'Unknown', properties: { 'flow:widgetFormId': 'custom' } }, registry })) {
    throw new Error('expected explicit widget hint to count as a widget candidate without a registry entry')
  }
  if (isWidgetCandidateNode({ node: { id: 'h1', type: 'Section', properties: { level: 2, 'flow:widgetFormId': 'custom' } }, registry })) {
    throw new Error('expected markdown heading sections to stay excluded from widget candidates')
  }
}

export const testDeriveWidgetCandidateNodeIdsKeepsOpenWidgetsAndAppendsSelectedWidget = () => {
  const registry = [
    {
      id: 'text-default',
      isEnabled: true,
      nodeTypeId: 'TextGeneration',
      widgetTypeId: 'default',
      formId: 'textGeneration',
      fields: [{ fieldKey: 'prompt', fieldType: 'textarea' }],
      ports: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]
  const nodeById = new Map<string, Pick<GraphNode, 'id' | 'type' | 'properties'>>([
    ['open-a', { id: 'open-a', type: 'TextGeneration', properties: {} }],
    ['heading-1', { id: 'heading-1', type: 'Section', properties: { level: 1 } }],
    ['sel-a', { id: 'sel-a', type: 'Unknown', properties: { 'flow:widgetTypeId': 'custom' } }],
  ])

  const ids = deriveWidgetCandidateNodeIds({
    nodeById,
    openWidgetNodeIds: ['open-a', 'heading-1', 'open-a'],
    selectedNodeId: 'sel-a',
    registry,
  })

  if (ids.length !== 2) throw new Error(`expected open widgets plus selected widget candidate, got ${ids.length}`)
  if (ids[0] !== 'open-a' || ids[1] !== 'sel-a') {
    throw new Error(`expected candidate ids [open-a, sel-a], got [${ids.join(', ')}]`)
  }
}

export const testResolveNodeWidgetIdentityPrefersRegistryThenFallsBackToProps = () => {
  const fromRegistry = resolveNodeWidgetIdentity({
    node: {
      properties: {
        'flow:widgetTypeId': 'stale-type',
        'flow:widgetFormId': 'stale-form',
      },
    },
    registryEntry: {
      widgetTypeId: 'default',
      formId: 'textGeneration.openai',
    },
  })
  if (fromRegistry.widgetTypeId !== 'default' || fromRegistry.formId !== 'textGeneration.openai') {
    throw new Error(`expected registry identity to win, got ${fromRegistry.widgetTypeId}/${fromRegistry.formId}`)
  }

  const fromProps = resolveNodeWidgetIdentity({
    node: {
      properties: {
        'flow:widgetTypeId': 'custom',
        'flow:widgetFormId': 'textGeneration.custom',
      },
    },
  })
  if (fromProps.widgetTypeId !== 'custom' || fromProps.formId !== 'textGeneration.custom') {
    throw new Error(`expected raw node widget identity fallback, got ${fromProps.widgetTypeId}/${fromProps.formId}`)
  }
}

export const testResolveExpectedFrontmatterWidgetFormIdFallsBackToNodeId = () => {
  const explicit = resolveExpectedFrontmatterWidgetFormId({
    id: 'node-a',
    properties: { 'flow:widgetFormId': 'fm:custom-form' },
  })
  if (explicit !== 'fm:custom-form') {
    throw new Error(`expected explicit frontmatter widget form id to win, got ${explicit}`)
  }

  const fallback = resolveExpectedFrontmatterWidgetFormId({
    id: 'node-b',
    properties: {},
  })
  if (fallback !== 'fm:node-b') {
    throw new Error(`expected node-id fallback frontmatter widget form id, got ${fallback}`)
  }
}

export const testListScopedWidgetRegistryEntriesRestrictsFrontmatterNodesToExpectedForm = () => {
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

  const scoped = listScopedWidgetRegistryEntries({
    node: { id: 'n-pack', type: 'Schema', properties: {} },
    registry,
    graphMetaKind: 'frontmatter-flow',
  })
  if (scoped.length !== 1 || scoped[0]?.id !== 'pack') {
    throw new Error(`expected frontmatter scoped registry entries [pack], got [${scoped.map(entry => String(entry.id || '')).join(', ')}]`)
  }
}

export const testIsFrontmatterWidgetRegistryNodeRecognizesCanonicalWidgetNodeTypes = () => {
  if (!isFrontmatterWidgetRegistryNode({ type: 'TextGeneration' })) {
    throw new Error('expected TextGeneration to qualify as a frontmatter widget registry node')
  }
  if (!isFrontmatterWidgetRegistryNode({ type: 'RichMediaPanel' })) {
    throw new Error('expected RichMediaPanel to qualify as a frontmatter widget registry node')
  }
  if (isFrontmatterWidgetRegistryNode({ type: 'Schema' })) {
    throw new Error('expected non-widget node types to stay outside frontmatter widget registry gating')
  }
}

export const testIsNodeOwnedFrontmatterWidgetRegistryEntryMatchesExpectedFormId = () => {
  if (!isNodeOwnedFrontmatterWidgetRegistryEntry({
    node: { id: 'n-pack', properties: {} },
    registryEntry: { formId: 'fm:n-pack' },
  })) {
    throw new Error('expected matching fm:<nodeId> registry entry to belong to the frontmatter node')
  }
  if (isNodeOwnedFrontmatterWidgetRegistryEntry({
    node: { id: 'n-pack', properties: {} },
    registryEntry: { formId: 'fm:n-other' },
  })) {
    throw new Error('expected mismatched frontmatter widget registry entry to stay excluded')
  }
}

export const testResolveFrontmatterWidgetRegistrySectionStateReturnsVisibilityAndCanonicalLabel = () => {
  const visible = resolveFrontmatterWidgetRegistrySectionState({
    node: { id: 'n-pack', type: 'TextGeneration', properties: {} },
    registryEntry: {
      nodeTypeId: 'TextGeneration',
      widgetTypeId: 'default',
      formId: 'fm:n-pack',
    },
    graphMetaKind: 'frontmatter-flow',
  })
  if (visible.visible !== true || visible.hideFlowContractRows !== true) {
    throw new Error('expected owned frontmatter widget registry entry to enable the shared registry section state')
  }
  if (!String(visible.identityLabel || '').trim()) {
    throw new Error('expected visible frontmatter widget registry section state to include a canonical identity label')
  }

  const hidden = resolveFrontmatterWidgetRegistrySectionState({
    node: { id: 'n-pack', type: 'Schema', properties: {} },
    registryEntry: {
      nodeTypeId: 'Schema',
      widgetTypeId: 'default',
      formId: 'fm:n-pack',
    },
    graphMetaKind: 'frontmatter-flow',
  })
  if (hidden.visible || hidden.hideFlowContractRows || hidden.identityLabel) {
    throw new Error('expected non-widget frontmatter nodes to keep the shared registry section hidden')
  }
}
