import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

function normalizeRegistry(
  value: ReadonlyArray<WidgetRegistryEntry> | null | undefined,
): WidgetRegistryEntry[] {
  return Array.isArray(value) ? (value as WidgetRegistryEntry[]) : []
}

function buildEntryKey(entry: WidgetRegistryEntry): string {
  const nodeTypeId = String(entry?.nodeTypeId || '').trim()
  const widgetTypeId = String(entry?.widgetTypeId || '').trim()
  const formId = String(entry?.formId || '').trim()
  if (nodeTypeId && widgetTypeId && formId) {
    return `shape:${nodeTypeId}|${widgetTypeId}|${formId}`
  }
  const id = String(entry?.id || '').trim()
  if (id) return `id:${id}`
  const updatedAt = String(entry?.updatedAt || '').trim()
  return `shape:${nodeTypeId}|${widgetTypeId}|${formId}|${updatedAt}`
}

function entryQualityScore(entry: WidgetRegistryEntry): number {
  const ports = Array.isArray(entry.ports) ? entry.ports.length : 0
  const schemaMappings = Array.isArray(entry.schemaMappings) ? entry.schemaMappings.length : 0
  const fields = Array.isArray(entry.fields) ? entry.fields.length : 0
  return ports * 100 + schemaMappings * 20 + fields * 5
}

export function buildDataflowWidgetRegistry(args: {
  documentWidgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
  effectiveWidgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
  widgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
}): WidgetRegistryEntry[] {
  const ordered = [
    ...normalizeRegistry(args.documentWidgetRegistry),
    ...normalizeRegistry(args.effectiveWidgetRegistry),
    ...normalizeRegistry(args.widgetRegistry),
  ]
  if (ordered.length === 0) return []
  const byKey = new Map<string, WidgetRegistryEntry>()
  const orderedKeys: string[] = []
  for (let i = 0; i < ordered.length; i += 1) {
    const entry = ordered[i]
    if (!entry) continue
    const key = buildEntryKey(entry)
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, entry)
      orderedKeys.push(key)
      continue
    }
    if (entryQualityScore(entry) > entryQualityScore(prev)) {
      byKey.set(key, entry)
    }
  }
  return orderedKeys.map(key => byKey.get(key)).filter((entry): entry is WidgetRegistryEntry => !!entry)
}
