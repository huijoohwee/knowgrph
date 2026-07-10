import type { GraphEdge } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/storyboardWidget/flowDataflow'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { readEdgeEndpointId } from '@/lib/graph/edgeEndpoints'
import { hashArrayOfObjectsSignature, hashRecordSignature32, hashSignatureParts } from '@/lib/hash/signature'

export function buildWidgetRegistryEntrySemanticSignature(entry: WidgetRegistryEntry | null | undefined): string {
  if (!entry) return hashSignatureParts(['widget-registry-entry', 0])
  return hashSignatureParts([
    'widget-registry-entry',
    String(entry.id || '').trim(),
    String(entry.nodeTypeId || '').trim(),
    String(entry.widgetTypeId || '').trim(),
    String(entry.formId || '').trim(),
    String(entry.updatedAt || '').trim(),
    hashArrayOfObjectsSignature(entry.fields ?? [], {
      maxItems: Math.max(16, Array.isArray(entry.fields) ? entry.fields.length : 0),
      maxKeysPerItem: 8,
    }),
    hashArrayOfObjectsSignature(entry.ports ?? [], {
      maxItems: Math.max(16, Array.isArray(entry.ports) ? entry.ports.length : 0),
      maxKeysPerItem: 8,
    }),
  ])
}

export function buildWidgetRegistryEntriesSemanticSignature(
  registryEntries: ReadonlyArray<WidgetRegistryEntry> | null | undefined,
): string {
  const entries = Array.isArray(registryEntries) ? registryEntries : []
  return hashArrayOfObjectsSignature(
    entries.map(entry => ({
      id: String(entry?.id || '').trim(),
      nodeTypeId: String(entry?.nodeTypeId || '').trim(),
      widgetTypeId: String(entry?.widgetTypeId || '').trim(),
      formId: String(entry?.formId || '').trim(),
      updatedAt: String(entry?.updatedAt || '').trim(),
      entrySignature: buildWidgetRegistryEntrySemanticSignature(entry),
    })),
    { maxItems: Math.max(24, entries.length), maxKeysPerItem: 6 },
  )
}

export function buildGraphEdgesSemanticSignature(edges: ReadonlyArray<GraphEdge> | null | undefined): string {
  const edgeList = Array.isArray(edges) ? edges : []
  return hashArrayOfObjectsSignature(
    edgeList.map(edge => {
      const props =
        edge && typeof edge === 'object' && !Array.isArray(edge)
          ? ((edge as { properties?: unknown }).properties as Record<string, unknown> | null | undefined)
          : null
      return {
        id: String((edge as { id?: unknown })?.id || '').trim(),
        source: readEdgeEndpointId(edge?.source),
        target: readEdgeEndpointId(edge?.target),
        sourcePortKey:
          typeof props?.[FLOW_EDGE_SOURCE_PORT_KEY] === 'string'
            ? String(props?.[FLOW_EDGE_SOURCE_PORT_KEY] || '').trim()
            : '',
        targetPortKey:
          typeof props?.[FLOW_EDGE_TARGET_PORT_KEY] === 'string'
            ? String(props?.[FLOW_EDGE_TARGET_PORT_KEY] || '').trim()
            : '',
      }
    }),
    { maxItems: Math.max(24, edgeList.length), maxKeysPerItem: 5 },
  )
}

export function buildConnectedValuesSemanticSignature(
  connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath | null | undefined,
): string {
  const record =
    connectedValuesBySchemaPath && typeof connectedValuesBySchemaPath === 'object' && !Array.isArray(connectedValuesBySchemaPath)
      ? (connectedValuesBySchemaPath as Record<string, unknown>)
      : {}
  const keys = Object.keys(record).sort()
  return hashArrayOfObjectsSignature(
    keys.map(path => {
      const entry = record[path] as Record<string, unknown> | null | undefined
      const value = entry?.value
      return {
        path,
        valueType: typeof value,
        valueText:
          typeof value === 'string'
            ? value
            : typeof value === 'number' && Number.isFinite(value)
              ? String(value)
              : typeof value === 'boolean'
                ? (value ? '1' : '0')
                : '',
        valueSignature: hashRecordSignature32(value, { maxEntries: 60, maxDepth: 2 }),
      }
    }),
    { maxItems: Math.max(24, keys.length), maxKeysPerItem: 4 },
  )
}

export function pickString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function cleanDomIdPart(v: unknown): string {
  return String(typeof v === 'string' ? v : '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}
