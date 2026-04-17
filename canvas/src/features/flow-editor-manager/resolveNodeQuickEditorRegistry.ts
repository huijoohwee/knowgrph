import type { GraphNode, JSONValue } from '@/lib/graph/types'

import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'

export const FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY = 'flow:quickEditorTypeId' as const
export const FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY = 'flow:quickEditorFormId' as const

const pickString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

type RegistryIndex = {
  byNodeType: Map<string, ReadonlyArray<NodeQuickEditorRegistryEntry>>
}

const registryIndexCache = new WeakMap<object, RegistryIndex>()

const getRegistryIndex = (registry: ReadonlyArray<NodeQuickEditorRegistryEntry>): RegistryIndex => {
  const cached = registryIndexCache.get(registry as unknown as object)
  if (cached) return cached
  const byNodeType = new Map<string, NodeQuickEditorRegistryEntry[]>()
  for (let i = 0; i < registry.length; i += 1) {
    const e = registry[i]
    if (!e || e.isEnabled !== true) continue
    const nt = String(e.nodeTypeId || '').trim()
    if (!nt) continue
    const list = byNodeType.get(nt) || []
    list.push(e)
    byNodeType.set(nt, list)
  }
  const idx: RegistryIndex = { byNodeType }
  registryIndexCache.set(registry as unknown as object, idx)
  return idx
}

const compareRegistryEntries = (a: NodeQuickEditorRegistryEntry, b: NodeQuickEditorRegistryEntry): number => {
  const t = a.quickEditorTypeId.localeCompare(b.quickEditorTypeId)
  if (t !== 0) return t
  const f = a.formId.localeCompare(b.formId)
  if (f !== 0) return f
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
}

export function resolveNodeQuickEditorRegistryEntry(args: {
  node: Pick<GraphNode, 'id' | 'type' | 'properties'> | null | undefined
  registry: ReadonlyArray<NodeQuickEditorRegistryEntry> | null | undefined
  graphMetaKind?: string | null | undefined
}): NodeQuickEditorRegistryEntry | null {
  const nodeType = pickString(args.node?.type)
  if (!nodeType) return null
  const reg = Array.isArray(args.registry) ? args.registry : []
  if (reg.length === 0) return null

  const props = (args.node?.properties || {}) as Record<string, JSONValue | undefined>
  const wantType = pickString(props[FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY])
  const wantForm = pickString(props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY])
  const nodeId = pickString(args.node?.id)
  const isFrontmatterFlow = pickString(args.graphMetaKind) === 'frontmatter-flow' || (wantForm && wantForm.startsWith('fm:'))

  const candidatesAll = getRegistryIndex(reg).byNodeType.get(nodeType) || []
  if (candidatesAll.length === 0) return null

  if (isFrontmatterFlow) {
    const expectedForm = wantForm || (nodeId ? `fm:${nodeId}` : '')
    if (!expectedForm) return null
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const e = candidatesAll[i]
      if (!e) continue
      if (wantType && e.quickEditorTypeId !== wantType) continue
      if (e.formId === expectedForm) return e
    }
    return null
  }

  const restrictByType = (() => {
    if (!wantType) return null
    for (let i = 0; i < candidatesAll.length; i += 1) {
      if (candidatesAll[i]?.quickEditorTypeId === wantType) return wantType
    }
    return null
  })()

  const restrictByForm = (() => {
    if (!wantForm) return null
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const e = candidatesAll[i]
      if (!e) continue
      if (restrictByType && e.quickEditorTypeId !== restrictByType) continue
      if (e.formId === wantForm) return wantForm
    }
    return null
  })()

  const prefer = (typeId: string, formId?: string) => {
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const e = candidatesAll[i]
      if (!e) continue
      if (restrictByType && e.quickEditorTypeId !== restrictByType) continue
      if (restrictByForm && e.formId !== restrictByForm) continue
      if (e.quickEditorTypeId !== typeId) continue
      if (formId && e.formId !== formId) continue
      return e
    }
    return null
  }

  const preferred = prefer('default', wantForm || undefined) || prefer('default')
  if (preferred) return preferred

  let best: NodeQuickEditorRegistryEntry | null = null
  for (let i = 0; i < candidatesAll.length; i += 1) {
    const e = candidatesAll[i]
    if (!e) continue
    if (restrictByType && e.quickEditorTypeId !== restrictByType) continue
    if (restrictByForm && e.formId !== restrictByForm) continue
    if (!best) {
      best = e
      continue
    }
    if (compareRegistryEntries(e, best) < 0) best = e
  }
  return best
}
