import React from 'react'
import {
  GRAPH_DATA_TABLE_COLUMN_DEFS,
  buildDefaultVisibleColumns,
  isGraphDataTablePropertyColumnKey,
  parseGraphDataTablePropertyColumnKey,
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
} from '@/features/graph-data-table/graphDataTable'
import {
  getAgenticRagFieldKind,
  normalizeSettingsForField,
  type GraphField,
  type GraphFieldId,
  type GraphFieldSettingsResolved,
  type GraphFieldSettingsById,
} from '@/features/graph-fields/graphFields'
import { normalized as normalizeText } from '@/features/panels/utils/json'

interface UseBottomPanelCuratorColumnsParams {
  derivedGraphFields: ReadonlyArray<GraphField>
  propertyColumnKeysFromGraphFields: ReadonlyArray<GraphDataTableColumnKey>
  graphDataTableColumnOrder: ReadonlyArray<GraphDataTableColumnKey>
  graphDataTableVisibleColumns: GraphDataTableColumnVisibilityByKey
  graphFieldSettingsById: GraphFieldSettingsById
  graphDataTableFieldsQuery: string
  setGraphDataTableVisibleColumnsState: (
    updater:
      | GraphDataTableColumnVisibilityByKey
      | ((prev: GraphDataTableColumnVisibilityByKey) => GraphDataTableColumnVisibilityByKey),
  ) => void
  setGraphDataTableColumnOrderState: (
    updater: GraphDataTableColumnKey[] | ((prev: GraphDataTableColumnKey[]) => GraphDataTableColumnKey[]),
  ) => void
}

interface BottomPanelCuratorColumnsResult {
  graphDataTableColumnLabelByKey: Map<GraphDataTableColumnKey, string>
  orderedAllColumnKeys: ReadonlyArray<GraphDataTableColumnKey>
  orderedVisibleColumnKeys: ReadonlyArray<GraphDataTableColumnKey>
  fieldsPanelColumnKeys: ReadonlyArray<GraphDataTableColumnKey>
  propertyFieldSettingsByColumnKey: Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>
  isGraphDataTableColumnVisible: (key: GraphDataTableColumnKey) => boolean
  showAllColumns: () => void
  hideAllColumns: () => void
  moveGraphDataTableColumn: (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => void
}

export function useBottomPanelCuratorColumns({
  derivedGraphFields,
  propertyColumnKeysFromGraphFields,
  graphDataTableColumnOrder,
  graphDataTableVisibleColumns,
  graphFieldSettingsById,
  graphDataTableFieldsQuery,
  setGraphDataTableVisibleColumnsState,
  setGraphDataTableColumnOrderState,
}: UseBottomPanelCuratorColumnsParams): BottomPanelCuratorColumnsResult {
  const uiPropertyColumnKeys = React.useMemo(() => {
    const set = new Set<GraphDataTableColumnKey>()
    for (const key of propertyColumnKeysFromGraphFields) set.add(key)
    for (const key of graphDataTableColumnOrder) {
      if (isGraphDataTablePropertyColumnKey(key)) set.add(key)
    }
    for (const key of Object.keys(graphDataTableVisibleColumns)) {
      if (isGraphDataTablePropertyColumnKey(key as GraphDataTableColumnKey)) {
        set.add(key as GraphDataTableColumnKey)
      }
    }
    return Array.from(set.values())
  }, [propertyColumnKeysFromGraphFields, graphDataTableColumnOrder, graphDataTableVisibleColumns])

  const graphDataTableColumnLabelByKey = React.useMemo(() => {
    const map = new Map<GraphDataTableColumnKey, string>(GRAPH_DATA_TABLE_COLUMN_DEFS.map(def => [def.key, def.label]))
    for (const field of derivedGraphFields) {
      const settings = normalizeSettingsForField(field, graphFieldSettingsById[field.id])
      const agenticKind = getAgenticRagFieldKind(field)
      const agenticPrefix =
        agenticKind === 'chunk_text' ||
        agenticKind === 'embedding' ||
        agenticKind === 'media_url' ||
        agenticKind === 'graphRAGPath'
          ? 'AgenticRAG · '
          : ''
      const label = `${field.scope === 'node' ? 'Node' : 'Edge'} · ${agenticPrefix}${settings.displayName || field.key}`
      map.set(`prop:${field.scope}:${field.key}` as GraphDataTableColumnKey, label)
    }
    for (const key of uiPropertyColumnKeys) {
      if (!isGraphDataTablePropertyColumnKey(key)) continue
      if (map.has(key)) continue
      const parsed = parseGraphDataTablePropertyColumnKey(key)
      if (!parsed) continue
      const fieldId = `${parsed.scope}:${parsed.propertyKey}` as GraphFieldId
      const settings = graphFieldSettingsById[fieldId]
      const displayName = settings?.displayName || parsed.propertyKey
      const label = `${parsed.scope === 'node' ? 'Node' : 'Edge'} · ${displayName || parsed.propertyKey}`
      map.set(key, label)
    }
    return map
  }, [derivedGraphFields, graphFieldSettingsById, uiPropertyColumnKeys])

  const orderedAllColumnKeys = React.useMemo(() => {
    const next: GraphDataTableColumnKey[] = []
    const seen = new Set<GraphDataTableColumnKey>()
    const add = (key: GraphDataTableColumnKey) => {
      if (seen.has(key)) return
      seen.add(key)
      next.push(key)
    }

    for (const key of graphDataTableColumnOrder) add(key)
    for (const def of GRAPH_DATA_TABLE_COLUMN_DEFS) add(def.key)
    for (const key of propertyColumnKeysFromGraphFields) add(key)
    return next
  }, [propertyColumnKeysFromGraphFields, graphDataTableColumnOrder])

  const orderedVisibleColumnKeys = React.useMemo(
    () =>
      orderedAllColumnKeys.filter(key =>
        isGraphDataTablePropertyColumnKey(key) ? graphDataTableVisibleColumns[key] === true : graphDataTableVisibleColumns[key] !== false,
      ),
    [orderedAllColumnKeys, graphDataTableVisibleColumns],
  )

  const fieldsPanelColumnKeys = React.useMemo(() => {
    const normalizedQuery = normalizeText(graphDataTableFieldsQuery).trim()
    if (!normalizedQuery) return orderedAllColumnKeys
    return orderedAllColumnKeys.filter(key => {
      const label = graphDataTableColumnLabelByKey.get(key) ?? key
      return normalizeText(`${key} ${label}`).includes(normalizedQuery)
    })
  }, [orderedAllColumnKeys, graphDataTableColumnLabelByKey, graphDataTableFieldsQuery])

  const propertyFieldSettingsByColumnKey = React.useMemo(() => {
    const map = new Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>()
    for (const field of derivedGraphFields) {
      const settings = normalizeSettingsForField(field, graphFieldSettingsById[field.id])
      const key = `prop:${field.scope}:${field.key}` as GraphDataTableColumnKey
      map.set(key, settings)
    }
    return map
  }, [derivedGraphFields, graphFieldSettingsById])

  const isGraphDataTableColumnVisible = React.useCallback(
    (key: GraphDataTableColumnKey) =>
      isGraphDataTablePropertyColumnKey(key) ? graphDataTableVisibleColumns[key] === true : graphDataTableVisibleColumns[key] !== false,
    [graphDataTableVisibleColumns],
  )

  const showAllColumns = React.useCallback(() => {
    const next: Record<string, boolean> = { ...buildDefaultVisibleColumns() }
    for (const key of orderedAllColumnKeys) {
      if (isGraphDataTablePropertyColumnKey(key)) next[key] = true
    }
    setGraphDataTableVisibleColumnsState(next as GraphDataTableColumnVisibilityByKey)
  }, [orderedAllColumnKeys, setGraphDataTableVisibleColumnsState])

  const hideAllColumns = React.useCallback(() => {
    const next: Record<string, boolean> = { ...buildDefaultVisibleColumns() }
    for (const def of GRAPH_DATA_TABLE_COLUMN_DEFS) next[def.key] = false
    for (const key of orderedAllColumnKeys) {
      if (isGraphDataTablePropertyColumnKey(key)) next[key] = false
    }
    next.label = true
    setGraphDataTableVisibleColumnsState(next as GraphDataTableColumnVisibilityByKey)
  }, [orderedAllColumnKeys, setGraphDataTableVisibleColumnsState])

  const moveGraphDataTableColumn = React.useCallback(
    (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => {
      if (from === to) return
      setGraphDataTableColumnOrderState(prev => {
        const filtered = prev.filter(key => key !== from)
        const index = filtered.indexOf(to)
        if (index < 0) return [from, ...filtered]
        return [...filtered.slice(0, index), from, ...filtered.slice(index)]
      })
    },
    [setGraphDataTableColumnOrderState],
  )

  return {
    graphDataTableColumnLabelByKey,
    orderedAllColumnKeys,
    orderedVisibleColumnKeys,
    fieldsPanelColumnKeys,
    propertyFieldSettingsByColumnKey,
    isGraphDataTableColumnVisible,
    showAllColumns,
    hideAllColumns,
    moveGraphDataTableColumn,
  }
}
