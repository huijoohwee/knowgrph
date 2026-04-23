import type { GraphNode, JSONValue } from '@/lib/graph/types'

import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export const FLOW_WIDGET_TYPE_ID_KEY = 'flow:widgetTypeId' as const
export const FLOW_WIDGET_FORM_ID_KEY = 'flow:widgetFormId' as const

const pickString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

type RegistryIndex = {
  byNodeType: Map<string, ReadonlyArray<WidgetRegistryEntry>>
}

const registryIndexCache = new WeakMap<object, RegistryIndex>()

const getRegistryIndex = (registry: ReadonlyArray<WidgetRegistryEntry>): RegistryIndex => {
  const cached = registryIndexCache.get(registry as unknown as object)
  if (cached) return cached
  const byNodeType = new Map<string, WidgetRegistryEntry[]>()
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

const entryRichnessScore = (entry: WidgetRegistryEntry): number => {
  const ports = Array.isArray(entry.ports) ? entry.ports.length : 0
  const schemaMappings = Array.isArray(entry.schemaMappings) ? entry.schemaMappings.length : 0
  const fields = Array.isArray(entry.fields) ? entry.fields.length : 0
  return ports * 100 + schemaMappings * 20 + fields * 5
}

const compareRegistryEntries = (a: WidgetRegistryEntry, b: WidgetRegistryEntry): number => {
  const t = a.widgetTypeId.localeCompare(b.widgetTypeId)
  if (t !== 0) return t
  const f = a.formId.localeCompare(b.formId)
  if (f !== 0) return f
  const richnessDelta = entryRichnessScore(b) - entryRichnessScore(a)
  if (richnessDelta !== 0) return richnessDelta
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
}

export function resolveWidgetRegistryEntry(args: {
  node: Pick<GraphNode, 'id' | 'type' | 'properties'> | null | undefined
  registry: ReadonlyArray<WidgetRegistryEntry> | null | undefined
  graphMetaKind?: string | null | undefined
}): WidgetRegistryEntry | null {
  const nodeType = pickString(args.node?.type)
  if (!nodeType) return null
  const reg = Array.isArray(args.registry) ? args.registry : []
  if (reg.length === 0) return null

  const props = (args.node?.properties || {}) as Record<string, JSONValue | undefined>
  const wantType = pickString(props[FLOW_WIDGET_TYPE_ID_KEY])
  const wantForm = pickString(props[FLOW_WIDGET_FORM_ID_KEY])
  const nodeId = pickString(args.node?.id)
  const isFrontmatterFlow = pickString(args.graphMetaKind) === 'frontmatter-flow' || (wantForm && wantForm.startsWith('fm:'))

  const candidatesAll = getRegistryIndex(reg).byNodeType.get(nodeType) || []
  if (candidatesAll.length === 0) return null

  if (isFrontmatterFlow) {
    const expectedForm = wantForm || (nodeId ? `fm:${nodeId}` : '')
    if (!expectedForm) return null
    let bestMatch: WidgetRegistryEntry | null = null
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const e = candidatesAll[i]
      if (!e) continue
      if (wantType && e.widgetTypeId !== wantType) continue
      if (e.formId !== expectedForm) continue
      if (!bestMatch) {
        bestMatch = e
        continue
      }
      if (compareRegistryEntries(e, bestMatch) < 0) bestMatch = e
    }
    return bestMatch
  }

  const restrictByType = (() => {
    if (!wantType) return null
    for (let i = 0; i < candidatesAll.length; i += 1) {
      if (candidatesAll[i]?.widgetTypeId === wantType) return wantType
    }
    return null
  })()

  const restrictByForm = (() => {
    if (!wantForm) return null
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const e = candidatesAll[i]
      if (!e) continue
      if (restrictByType && e.widgetTypeId !== restrictByType) continue
      if (e.formId === wantForm) return wantForm
    }
    return null
  })()

  const prefer = (typeId: string, formId?: string) => {
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const e = candidatesAll[i]
      if (!e) continue
      if (restrictByType && e.widgetTypeId !== restrictByType) continue
      if (restrictByForm && e.formId !== restrictByForm) continue
      if (e.widgetTypeId !== typeId) continue
      if (formId && e.formId !== formId) continue
      return e
    }
    return null
  }

  const preferred = prefer('default', wantForm || undefined) || prefer('default')
  if (preferred) return preferred

  let best: WidgetRegistryEntry | null = null
  for (let i = 0; i < candidatesAll.length; i += 1) {
    const e = candidatesAll[i]
    if (!e) continue
    if (restrictByType && e.widgetTypeId !== restrictByType) continue
    if (restrictByForm && e.formId !== restrictByForm) continue
    if (!best) {
      best = e
      continue
    }
    if (compareRegistryEntries(e, best) < 0) best = e
  }
  return best
}
