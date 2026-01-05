import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getRendererPalette } from '@/lib/graph/schema'
import {
  getAgenticRagFieldKind,
  normalizeSettingsForField,
  parseGraphFieldId,
  type GraphField,
  type GraphFieldId,
  type GraphFieldSettingsById,
  type GraphFieldSettingsResolved,
} from '@/features/graph-fields/graphFields'
import {
  GRAPH_DATA_TABLE_COLUMN_DEFS,
  isGraphDataTableColumnKey,
  isGraphDataTablePropertyColumnKey,
  parseGraphDataTablePropertyColumnKey,
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
} from '@/features/graph-data-table/graphDataTable'
import type { GraphFieldsSelectedView } from '@/features/panels/views/GraphFieldsView'
import { normalized as normalizeText } from '@/features/panels/utils/json'

export function buildFieldByIdMap(
  fields: ReadonlyArray<GraphField>,
): Map<GraphFieldId, GraphField> {
  const map = new Map<GraphFieldId, GraphField>()
  for (const field of fields) map.set(field.id, field)
  return map
}

export function buildResolvedSettingsByIdMap(
  fields: ReadonlyArray<GraphField>,
  settingsById: GraphFieldSettingsById,
): Map<GraphFieldId, GraphFieldSettingsResolved> {
  const map = new Map<GraphFieldId, GraphFieldSettingsResolved>()
  for (const field of fields) {
    map.set(field.id, normalizeSettingsForField(field, settingsById[field.id]))
  }
  return map
}

export function computeSchemaDefinedFieldIds(args: {
  fields: ReadonlyArray<GraphField>
  schema: GraphSchema | null
}): Set<GraphFieldId> {
  const { fields, schema } = args
  const out = new Set<GraphFieldId>()
  if (!schema) return out
  const nodeSchemas = schema.propertySchemas?.node ?? {}
  const edgeSchemas = schema.propertySchemas?.edge ?? {}
  for (const field of fields) {
    const key = field.key
    const ownerSchemas = field.scope === 'node' ? nodeSchemas : edgeSchemas
    const isDefined = Object.values(ownerSchemas).some(
      props => !!props && Object.prototype.hasOwnProperty.call(props, key),
    )
    if (isDefined) out.add(field.id)
  }
  return out
}

export function buildCuratorColumnLabelByKey(args: {
  fields: ReadonlyArray<GraphField>
  resolvedSettingsById: Map<GraphFieldId, GraphFieldSettingsResolved>
}): Map<GraphDataTableColumnKey, string> {
  const { fields, resolvedSettingsById } = args
  const map = new Map<GraphDataTableColumnKey, string>(
    GRAPH_DATA_TABLE_COLUMN_DEFS.map(d => [d.key, d.label]),
  )
  for (const field of fields) {
    const agenticKind = getAgenticRagFieldKind(field)
    const settings = resolvedSettingsById.get(field.id)
    const agenticPrefix = agenticKind ? 'AgenticRAG · ' : ''
    map.set(
      `prop:${field.scope}:${field.key}` as GraphDataTableColumnKey,
      `${field.scope === 'node' ? 'Node' : 'Edge'} · ${agenticPrefix}${
        settings?.displayName || field.key
      }`,
    )
  }
  return map
}

export function computeOrderedAllCuratorColumnKeys(args: {
  fields: ReadonlyArray<GraphField>
  graphDataTableColumnOrder: GraphDataTableColumnKey[]
  graphDataTableVisibleColumns: GraphDataTableColumnVisibilityByKey
}): GraphDataTableColumnKey[] {
  const { fields, graphDataTableColumnOrder, graphDataTableVisibleColumns } = args
  const next: GraphDataTableColumnKey[] = []
  const seen = new Set<GraphDataTableColumnKey>()
  const add = (k: GraphDataTableColumnKey) => {
    if (seen.has(k)) return
    seen.add(k)
    next.push(k)
  }

  for (const k of graphDataTableColumnOrder) add(k)
  for (const d of GRAPH_DATA_TABLE_COLUMN_DEFS) add(d.key)
  for (const f of fields) add(`prop:${f.scope}:${f.key}` as GraphDataTableColumnKey)
  for (const rawKey of Object.keys(graphDataTableVisibleColumns)) {
    if (!isGraphDataTableColumnKey(rawKey)) continue
    add(rawKey as GraphDataTableColumnKey)
  }

  return next
}

export function computeFilteredGraphFieldColumnKeys(args: {
  search: string
  orderedAllCuratorColumnKeys: GraphDataTableColumnKey[]
  curatorColumnLabelByKey: Map<GraphDataTableColumnKey, string>
  visibleFieldIds?: ReadonlySet<GraphFieldId> | null
}): GraphDataTableColumnKey[] {
  const { search, orderedAllCuratorColumnKeys, curatorColumnLabelByKey, visibleFieldIds } =
    args

  const q = normalizeText(search).trim()
  let next = !q
    ? orderedAllCuratorColumnKeys
    : orderedAllCuratorColumnKeys.filter(k => {
        const label = curatorColumnLabelByKey.get(k) ?? String(k)
        return normalizeText(label).includes(q) || normalizeText(String(k)).includes(q)
      })

  if (visibleFieldIds) {
    next = next.filter(k => {
      if (!isGraphDataTablePropertyColumnKey(k)) return true
      const parsed = parseGraphDataTablePropertyColumnKey(k)
      if (!parsed) return true
      const fieldId = `${parsed.scope}:${parsed.propertyKey}` as GraphFieldId
      return visibleFieldIds.has(fieldId)
    })
  }

  return next
}

export function computeStyleOwnerByFieldId(args: {
  fields: ReadonlyArray<GraphField>
  graphData: GraphData | null
  schema: GraphSchema | null
}): Map<GraphFieldId, string> {
  const { fields, graphData, schema } = args
  const map = new Map<GraphFieldId, string>()
  if (!schema) return map
  const nodeSchemas = schema.propertySchemas?.node ?? {}
  const edgeSchemas = schema.propertySchemas?.edge ?? {}
  const nodeStyles = schema.nodeStyles || {}
  const edgeStyles = schema.edgeStyles || {}
  const catalogNodeTypes = schema.catalog?.nodeTypes ?? []
  const catalogEdgeLabels = schema.catalog?.edgeLabels ?? []
  const firstNodeStyleKey =
    Object.keys(nodeStyles)[0] || catalogNodeTypes[0] || 'default'
  const firstEdgeStyleKey =
    Object.keys(edgeStyles)[0] || catalogEdgeLabels[0] || 'default'

  for (const field of fields) {
    const key = field.key
    let ownerKey = ''
    if (field.scope === 'node') {
      for (const [typeKey, props] of Object.entries(nodeSchemas)) {
        if (props && Object.prototype.hasOwnProperty.call(props, key)) {
          ownerKey = typeKey
          break
        }
      }
      if (!ownerKey && graphData?.nodes) {
        const node = graphData.nodes.find(
          n =>
            n.properties &&
            Object.prototype.hasOwnProperty.call(n.properties, key),
        )
        if (node && typeof node.type === 'string' && node.type.trim()) {
          ownerKey = node.type.trim()
        }
      }
      if (!ownerKey) ownerKey = firstNodeStyleKey
    } else {
      for (const [label, props] of Object.entries(edgeSchemas)) {
        if (props && Object.prototype.hasOwnProperty.call(props, key)) {
          ownerKey = label
          break
        }
      }
      if (!ownerKey && graphData?.edges) {
        const edge = graphData.edges.find(
          e =>
            e.properties &&
            Object.prototype.hasOwnProperty.call(e.properties, key),
        )
        if (edge && typeof edge.label === 'string' && edge.label.trim()) {
          ownerKey = edge.label.trim()
        }
      }
      if (!ownerKey) ownerKey = firstEdgeStyleKey
    }
    map.set(field.id, ownerKey)
  }

  return map
}

export function computeNodeStyleOwnerKey(args: {
  graphData: GraphData | null
  schema: GraphSchema | null
}): string {
  const { graphData, schema } = args
  const styles = schema?.nodeStyles || {}
  const styleKeys = Object.keys(styles)
  const dataType = graphData?.nodes?.find(
    n => typeof n.type === 'string' && n.type.trim(),
  )?.type
  const trimmed = typeof dataType === 'string' ? dataType.trim() : ''
  if (trimmed) return trimmed
  if (styleKeys.length > 0) return styleKeys[0]
  const catalogTypes = schema?.catalog?.nodeTypes || []
  if (catalogTypes.length > 0) return catalogTypes[0]
  return 'default'
}

export function computeEdgeStyleOwnerKey(args: {
  graphData: GraphData | null
  schema: GraphSchema | null
}): string {
  const { graphData, schema } = args
  const styles = schema?.edgeStyles || {}
  const styleKeys = Object.keys(styles)
  const dataLabel = graphData?.edges?.find(
    e => typeof e.label === 'string' && e.label.trim(),
  )?.label
  const trimmed = typeof dataLabel === 'string' ? dataLabel.trim() : ''
  if (trimmed) return trimmed
  if (styleKeys.length > 0) return styleKeys[0]
  const catalogLabels = schema?.catalog?.edgeLabels || []
  if (catalogLabels.length > 0) return catalogLabels[0]
  return 'default'
}

export function computeNodeScopeBorderColor(args: {
  schema: GraphSchema | null
  nodeStyleOwnerKey: string
}): string {
  const { schema, nodeStyleOwnerKey } = args
  if (!schema) {
    const palette = getRendererPalette(null)
    return palette.nodes.execution
  }
  const styles = schema.nodeStyles || {}
  const color =
    typeof styles[nodeStyleOwnerKey]?.color === 'string'
      ? styles[nodeStyleOwnerKey]!.color!.trim()
      : ''
  if (color) return color
  const palette = getRendererPalette(schema)
  return palette.nodes.execution
}

export function computeEdgeScopeBorderColor(args: {
  schema: GraphSchema | null
  edgeStyleOwnerKey: string
}): string {
  const { schema, edgeStyleOwnerKey } = args
  if (!schema) return '#9CA3AF'
  const styles = schema.edgeStyles || {}
  const color =
    typeof styles[edgeStyleOwnerKey]?.color === 'string'
      ? styles[edgeStyleOwnerKey]!.color!.trim()
      : ''
  return color || '#9CA3AF'
}

export function partitionPropertyColumnKeys(args: {
  filteredGraphFieldColumnKeys: GraphDataTableColumnKey[]
  fieldById: Map<GraphFieldId, GraphField>
  schemaDefinedFieldIds: ReadonlySet<GraphFieldId>
  settingsById: GraphFieldSettingsById
}): {
  basePropertyColumnKeys: GraphDataTableColumnKey[]
  customPropertyColumnKeys: GraphDataTableColumnKey[]
  derivedPropertyColumnKeys: GraphDataTableColumnKey[]
} {
  const { filteredGraphFieldColumnKeys, fieldById, schemaDefinedFieldIds, settingsById } =
    args

  const propertyColumnKeys = filteredGraphFieldColumnKeys.filter(
    isGraphDataTablePropertyColumnKey,
  )

  const basePropertyColumnKeys: GraphDataTableColumnKey[] = []
  const customPropertyColumnKeys: GraphDataTableColumnKey[] = []
  const derivedPropertyColumnKeys: GraphDataTableColumnKey[] = []

  for (const key of propertyColumnKeys) {
    const parsed = parseGraphDataTablePropertyColumnKey(key)
    if (!parsed) continue
    const graphFieldId = `${parsed.scope}:${parsed.propertyKey}` as GraphFieldId
    const field = fieldById.get(graphFieldId)
    const isSchemaDefined = field ? schemaDefinedFieldIds.has(field.id) : false
    const rawSettings = settingsById[graphFieldId]
    const isCustom = rawSettings?.isCustom === true
    if (isSchemaDefined) basePropertyColumnKeys.push(key)
    else if (isCustom) customPropertyColumnKeys.push(key)
    else derivedPropertyColumnKeys.push(key)
  }

  return {
    basePropertyColumnKeys,
    customPropertyColumnKeys,
    derivedPropertyColumnKeys,
  }
}

export type LocalSchemaFacet = 'properties' | 'template' | 'validation' | 'localRules'

export function resolveLocalSchemaTarget(args: {
  facet: LocalSchemaFacet
  selectedGlobalView: GraphFieldsSelectedView
  selectedFieldId: GraphFieldId | null
  localSchemaNodeTypes: string[]
  localSchemaEdgeLabels: string[]
  schema: GraphSchema | null
}): { scope: 'node' | 'edge'; ownerKey: string } {
  const {
    facet,
    selectedGlobalView,
    selectedFieldId,
    localSchemaNodeTypes,
    localSchemaEdgeLabels,
    schema,
  } = args

  const defaultNodeOwnerKey =
    (localSchemaNodeTypes[0] ?? (schema?.catalog?.nodeTypes?.[0] ?? '')) || ''

  const defaultEdgeOwnerKey =
    (localSchemaEdgeLabels[0] ?? (schema?.catalog?.edgeLabels?.[0] ?? '')) || ''

  const prev = selectedGlobalView
  const prevLocal = prev && prev.kind === 'localSchema' ? prev : null

  if (prevLocal && prevLocal.facet === facet) {
    const candidateList =
      prevLocal.scope === 'node' ? localSchemaNodeTypes : localSchemaEdgeLabels
    const current = String(prevLocal.ownerKey || '').trim()
    if (current && candidateList.includes(current)) {
      return {
        scope: prevLocal.scope,
        ownerKey: current,
      }
    }
  }

  if (selectedFieldId && schema) {
    const parsed = parseGraphFieldId(selectedFieldId)
    if (parsed) {
      const scope = parsed.scope
      const key = parsed.key
      if (scope === 'node') {
        const nodeSchemas = schema.propertySchemas?.node ?? {}
        const candidates: string[] = []
        Object.entries(nodeSchemas).forEach(([typeKey, props]) => {
          if (props && Object.prototype.hasOwnProperty.call(props, key)) {
            candidates.push(typeKey)
          }
        })
        const ownerKey =
          candidates[0] ||
          (localSchemaNodeTypes[0] ?? (schema.catalog?.nodeTypes?.[0] ?? '')) ||
          ''
        return {
          scope: 'node',
          ownerKey: String(ownerKey || ''),
        }
      }
      if (scope === 'edge') {
        const edgeSchemas = schema.propertySchemas?.edge ?? {}
        const candidates: string[] = []
        Object.entries(edgeSchemas).forEach(([label, props]) => {
          if (props && Object.prototype.hasOwnProperty.call(props, key)) {
            candidates.push(label)
          }
        })
        const ownerKey =
          candidates[0] ||
          (localSchemaEdgeLabels[0] ??
            (schema.catalog?.edgeLabels?.[0] ?? '')) ||
          ''
        return {
          scope: 'edge',
          ownerKey: String(ownerKey || ''),
        }
      }
    }
  }

  if (prevLocal) {
    const scope = prevLocal.scope
    const ownerKey =
      prevLocal.ownerKey ||
      (scope === 'node' ? defaultNodeOwnerKey : defaultEdgeOwnerKey)
    return {
      scope,
      ownerKey: String(ownerKey || ''),
    }
  }

  return {
    scope: 'node',
    ownerKey: defaultNodeOwnerKey,
  }
}

export function formatLocalSchemaSubtitle(args: {
  facet: LocalSchemaFacet
  selectedGlobalView: GraphFieldsSelectedView
  selectedFieldId: GraphFieldId | null
  localSchemaNodeTypes: string[]
  localSchemaEdgeLabels: string[]
  schema: GraphSchema | null
}): string {
  const {
    facet,
    selectedGlobalView,
    selectedFieldId,
    localSchemaNodeTypes,
    localSchemaEdgeLabels,
    schema,
  } = args

  const { scope, ownerKey } = resolveLocalSchemaTarget({
    facet,
    selectedGlobalView,
    selectedFieldId,
    localSchemaNodeTypes,
    localSchemaEdgeLabels,
    schema,
  })
  const scopeLabel = scope === 'edge' ? 'edge label' : 'node type'
  const ownerLabel = ownerKey || '—'
  return `${scopeLabel}: ${ownerLabel}`
}
