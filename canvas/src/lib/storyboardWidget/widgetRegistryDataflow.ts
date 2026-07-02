import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { hashArrayOfObjectsSignature, hashSignatureParts } from '@/lib/hash/signature'

const DATAFLOW_WIDGET_REGISTRY_CACHE_LIMIT = 32
const dataflowWidgetRegistryCache = new Map<string, WidgetRegistryEntry[]>()

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

function buildRegistrySourceSignature(
  scope: string,
  value: ReadonlyArray<WidgetRegistryEntry> | null | undefined,
): string {
  const entries = normalizeRegistry(value)
  return hashSignatureParts([
    scope,
    entries.length,
    hashArrayOfObjectsSignature(entries, {
      maxItems: Math.max(24, entries.length),
      maxKeysPerItem: 8,
    }),
  ])
}

function readCachedDataflowWidgetRegistry(signature: string): WidgetRegistryEntry[] | null {
  const cached = dataflowWidgetRegistryCache.get(signature) || null
  if (!cached) return null
  dataflowWidgetRegistryCache.delete(signature)
  dataflowWidgetRegistryCache.set(signature, cached)
  return cached
}

function writeCachedDataflowWidgetRegistry(signature: string, registry: WidgetRegistryEntry[]): WidgetRegistryEntry[] {
  dataflowWidgetRegistryCache.set(signature, registry)
  if (dataflowWidgetRegistryCache.size > DATAFLOW_WIDGET_REGISTRY_CACHE_LIMIT) {
    const oldestKey = dataflowWidgetRegistryCache.keys().next().value
    if (typeof oldestKey === 'string') {
      dataflowWidgetRegistryCache.delete(oldestKey)
    }
  }
  return registry
}

export function buildDataflowWidgetRegistry(args: {
  documentWidgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
  effectiveWidgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
  widgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
}): WidgetRegistryEntry[] {
  const registrySignature = hashSignatureParts([
    'dataflow-widget-registry',
    buildRegistrySourceSignature('document', args.documentWidgetRegistry),
    buildRegistrySourceSignature('effective', args.effectiveWidgetRegistry),
    buildRegistrySourceSignature('base', args.widgetRegistry),
  ])
  const cached = readCachedDataflowWidgetRegistry(registrySignature)
  if (cached) return cached
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
  return writeCachedDataflowWidgetRegistry(
    registrySignature,
    orderedKeys.map(key => byKey.get(key)).filter((entry): entry is WidgetRegistryEntry => !!entry),
  )
}
