import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config.storyboard-widget'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : ''

export function readAuthoredWidgetRegistryEntries(meta: Record<string, unknown>): unknown[] {
  const direct = Array.isArray(meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]) ? (meta[FLOW_WIDGET_REGISTRY_METADATA_KEY] as unknown[]) : []
  const widgetBundle = isRecord(meta.widget_bundle) ? meta.widget_bundle : null
  const bundled = widgetBundle && Array.isArray(widgetBundle.registry) ? widgetBundle.registry : []
  return [...direct, ...bundled]
}

function widgetRegistryEntrySignature(entry: unknown): string {
  if (!isRecord(entry)) return ''
  const nodeTypeId = asString(entry.nodeTypeId)
  const widgetTypeId = asString(entry.widgetTypeId)
  const formId = asString(entry.formId)
  if (nodeTypeId && widgetTypeId && formId) return `${nodeTypeId}\u0000${widgetTypeId}\u0000${formId}`
  return asString(entry.id)
}

export function mergeWidgetRegistryEntries(...groups: unknown[][]): unknown[] {
  const out: unknown[] = []
  const seen = new Set<string>()
  for (let i = 0; i < groups.length; i += 1) {
    const group = Array.isArray(groups[i]) ? groups[i] : []
    for (let j = 0; j < group.length; j += 1) {
      const entry = group[j]
      const signature = widgetRegistryEntrySignature(entry)
      if (!signature || seen.has(signature)) continue
      seen.add(signature)
      out.push(entry)
    }
  }
  return out
}
