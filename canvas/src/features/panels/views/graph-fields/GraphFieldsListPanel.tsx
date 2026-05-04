import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import type { GraphFieldsSelectedView } from '@/features/panels/views/GraphFieldsView'
import {
  type GraphField,
  type GraphFieldId,
  type GraphFieldSettings,
  type GraphFieldSettingsById,
  type GraphFieldSettingsResolved,
  type GraphFieldType,
} from '@/features/graph-fields/graphFields'
import {
  isGraphDataTablePropertyColumnKey,
  parseGraphDataTablePropertyColumnKey,
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
} from '@/features/graph-data-table/graphDataTable'
import { UI_COPY } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'
import { computeFilteredLists } from '@/features/schema-editor/utils'
import {
  buildDataTableColumnLabelByKey,
  buildFieldByIdMap,
  buildResolvedSettingsByIdMap,
  computeEdgeScopeBorderColor,
  computeEdgeStyleOwnerKey,
  computeFilteredGraphFieldColumnKeys,
  computeNodeScopeBorderColor,
  computeNodeStyleOwnerKey,
  computeOrderedAllDataTableColumnKeys,
  computeSchemaDefinedFieldIds,
  computeStyleOwnerByFieldId,
} from '@/features/panels/views/graph-fields/graphFieldsListUtils'
import { GraphFieldsListPanelBody } from '@/features/panels/views/graph-fields/GraphFieldsListPanelBody'

type GraphFieldsListPanelProps = {
  graphData: GraphData | null
  graphDataRevision: number
  fields: ReadonlyArray<GraphField>
  visibleFieldIds?: ReadonlySet<GraphFieldId> | null
  selectedFieldId: GraphFieldId | null
  setSelectedFieldId: (id: GraphFieldId | null) => void
  selectedGlobalView: GraphFieldsSelectedView
  setSelectedGlobalView: React.Dispatch<React.SetStateAction<GraphFieldsSelectedView>>
  settingsById: GraphFieldSettingsById
  patchGraphFieldSetting: (fieldId: GraphFieldId, patch: Partial<GraphFieldSettings>) => void
  graphDataTableVisibleColumns: GraphDataTableColumnVisibilityByKey
  graphDataTableColumnOrder: GraphDataTableColumnKey[]
  setGraphDataTableVisibleColumns: (next: GraphDataTableColumnVisibilityByKey) => void
  setGraphDataTableColumnOrder: (next: GraphDataTableColumnKey[]) => void
  onStatusChange: (msg: string) => void
}

export default function GraphFieldsListPanel({
  graphData,
  graphDataRevision,
  fields,
  visibleFieldIds,
  selectedFieldId,
  setSelectedFieldId,
  selectedGlobalView,
  setSelectedGlobalView,
  settingsById,
  patchGraphFieldSetting,
  graphDataTableVisibleColumns,
  graphDataTableColumnOrder,
  setGraphDataTableVisibleColumns,
  setGraphDataTableColumnOrder,
  onStatusChange,
}: GraphFieldsListPanelProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const schema = useGraphStore(s => s.schema)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const updateNodeStyle = useGraphStore(s => s.updateNodeStyle)
  const updateEdgeStyle = useGraphStore(s => s.updateEdgeStyle)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [draggingDataTableColumnKey, setDraggingDataTableColumnKey] = React.useState<GraphDataTableColumnKey | null>(null)
  const [dragOverDataTableColumnKey, setDragOverDataTableColumnKey] = React.useState<GraphDataTableColumnKey | null>(null)
  const [newFieldOpen, setNewFieldOpen] = React.useState(false)
  const [newFieldScope, setNewFieldScope] = React.useState<'node' | 'edge'>('node')
  const [newFieldKey, setNewFieldKey] = React.useState('')
  const [newFieldType, setNewFieldType] = React.useState<GraphFieldType>('Single line text')

  React.useEffect(() => {
    setSearchOpen(false)
    setSearch('')
    setDraggingDataTableColumnKey(null)
    setNewFieldOpen(false)
    setNewFieldScope('node')
    setNewFieldKey('')
    setNewFieldType('Single line text')
  }, [graphDataRevision])

  const fieldById = React.useMemo(
    () => buildFieldByIdMap(fields),
    [fields],
  )

  const resolvedSettingsById = React.useMemo(
    () => buildResolvedSettingsByIdMap(fields, settingsById),
    [fields, settingsById],
  )

  const { uniqueNodeTypes, uniqueEdgeLabels } = React.useMemo(() => {
    if (!schema) {
      return { uniqueNodeTypes: [] as string[], uniqueEdgeLabels: [] as string[] }
    }
    return computeFilteredLists(graphData, schema)
  }, [graphData, schema])

  const localSchemaNodeTypes = React.useMemo(() => {
    if (!schema) return uniqueNodeTypes
    const nodeSchemaKeys = Object.keys(schema.propertySchemas?.node ?? {})
    const both = uniqueNodeTypes.filter(t => nodeSchemaKeys.includes(t))
    return both.length > 0 ? both : uniqueNodeTypes
  }, [schema, uniqueNodeTypes])

  const localSchemaEdgeLabels = React.useMemo(() => {
    if (!schema) return uniqueEdgeLabels
    const edgeSchemaKeys = Object.keys(schema.propertySchemas?.edge ?? {})
    const both = uniqueEdgeLabels.filter(l => edgeSchemaKeys.includes(l))
    return both.length > 0 ? both : uniqueEdgeLabels
  }, [schema, uniqueEdgeLabels])

  const updateGraphFieldSettings = React.useCallback(
    (fieldId: GraphFieldId, patch: Partial<GraphFieldSettingsResolved>) => {
      const current = resolvedSettingsById.get(fieldId)
      if (!current) return
      patchGraphFieldSetting(fieldId, { ...current, ...patch })
    },
    [patchGraphFieldSetting, resolvedSettingsById],
  )

  const schemaDefinedFieldIds = React.useMemo(
    () => computeSchemaDefinedFieldIds({ fields, schema }),
    [fields, schema],
  )

  const dataTableColumnLabelByKey = React.useMemo(
    () => buildDataTableColumnLabelByKey({ fields, resolvedSettingsById }),
    [fields, resolvedSettingsById],
  )

  const isDataTableColumnVisible = React.useCallback(
    (key: GraphDataTableColumnKey) =>
      isGraphDataTablePropertyColumnKey(key)
        ? graphDataTableVisibleColumns[key] === true
        : graphDataTableVisibleColumns[key] !== false,
    [graphDataTableVisibleColumns],
  )

  const setDataTableColumnVisibility = React.useCallback(
    (key: GraphDataTableColumnKey, visible: boolean) => {
      const current = useGraphStore.getState().graphDataTableVisibleColumns
      setGraphDataTableVisibleColumns({ ...current, [key]: visible })
      if (isGraphDataTablePropertyColumnKey(key)) {
        const parsed = parseGraphDataTablePropertyColumnKey(key)
        if (parsed) {
          const fieldId = `${parsed.scope}:${parsed.propertyKey}` as GraphFieldId
          updateGraphFieldSettings(fieldId, { isHidden: !visible })
        }
      }
    },
    [setGraphDataTableVisibleColumns, updateGraphFieldSettings],
  )

  const orderedAllDataTableColumnKeys = React.useMemo(
    () =>
      computeOrderedAllDataTableColumnKeys({
        fields,
        graphDataTableColumnOrder,
        graphDataTableVisibleColumns,
      }),
    [fields, graphDataTableColumnOrder, graphDataTableVisibleColumns],
  )

  const visibleGraphFieldColumnCount = React.useMemo(
    () => orderedAllDataTableColumnKeys.filter(isDataTableColumnVisible).length,
    [isDataTableColumnVisible, orderedAllDataTableColumnKeys],
  )

  const moveDataTableColumn = React.useCallback(
    (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => {
      if (from === to) return
      const filtered = orderedAllDataTableColumnKeys.filter(k => k !== from)
      const idx = filtered.indexOf(to)
      const next = idx < 0 ? [from, ...filtered] : [...filtered.slice(0, idx), from, ...filtered.slice(idx)]
      setGraphDataTableColumnOrder(next)
    },
    [orderedAllDataTableColumnKeys, setGraphDataTableColumnOrder],
  )

  const createNewField = React.useCallback(() => {
    if (!graphData) return
    const cleaned = String(newFieldKey || '').trim()
    if (!cleaned) {
      onStatusChange(UI_COPY.graphFieldsNewFieldMissingNameStatus)
      return
    }
    if (cleaned.includes(':')) {
      onStatusChange(UI_COPY.graphFieldsNewFieldNameCannotContainColonStatus)
      return
    }
    const id = `${newFieldScope}:${cleaned}` as GraphFieldId
    if (fields.some(f => f.id === id) || settingsById[id]) {
      onStatusChange(UI_COPY.graphFieldsNewFieldAlreadyExistsStatus)
      return
    }
    patchGraphFieldSetting(id, { displayName: cleaned, isHidden: false, fieldType: newFieldType, isCustom: true })
    const colKey = `prop:${newFieldScope}:${cleaned}` as GraphDataTableColumnKey
    setDataTableColumnVisibility(colKey, true)
    const currentOrder = useGraphStore.getState().graphDataTableColumnOrder
    if (!currentOrder.includes(colKey)) {
      setGraphDataTableColumnOrder([...currentOrder, colKey])
    }
    setSelectedFieldId(id)
    setNewFieldKey('')
    setNewFieldOpen(false)
    onStatusChange(UI_COPY.graphFieldsCreatedFieldStatus(id))
  }, [
    fields,
    graphData,
    newFieldKey,
    newFieldScope,
    newFieldType,
    onStatusChange,
    setGraphDataTableColumnOrder,
    setDataTableColumnVisibility,
    patchGraphFieldSetting,
    setSelectedFieldId,
    settingsById,
  ])

  const filteredGraphFieldColumnKeys = React.useMemo(
    () =>
      computeFilteredGraphFieldColumnKeys({
        search,
        orderedAllDataTableColumnKeys,
        dataTableColumnLabelByKey,
        visibleFieldIds,
      }),
    [dataTableColumnLabelByKey, orderedAllDataTableColumnKeys, search, visibleFieldIds],
  )

  const styleOwnerByFieldId = React.useMemo(
    () => computeStyleOwnerByFieldId({ fields, graphData, schema }),
    [fields, graphData, schema],
  )

  const nodeStyleOwnerKey = React.useMemo(
    () => computeNodeStyleOwnerKey({ graphData, schema }),
    [graphData, schema],
  )

  const edgeStyleOwnerKey = React.useMemo(
    () => computeEdgeStyleOwnerKey({ graphData, schema }),
    [graphData, schema],
  )

  const nodeScopeBorderColor = React.useMemo(
    () => computeNodeScopeBorderColor({ schema, nodeStyleOwnerKey }),
    [schema, nodeStyleOwnerKey],
  )

  const edgeScopeBorderColor = React.useMemo(
    () => computeEdgeScopeBorderColor({ schema, edgeStyleOwnerKey }),
    [schema, edgeStyleOwnerKey],
  )

  return (
    <GraphFieldsListPanelBody
      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      iconSizeClass={iconSizeClass}
      uiIconStrokeWidth={uiIconStrokeWidth}
      graphDataPresent={!!graphData}
      searchOpen={searchOpen}
      setSearchOpen={setSearchOpen}
      search={search}
      setSearch={setSearch}
      newFieldOpen={newFieldOpen}
      setNewFieldOpen={setNewFieldOpen}
      newFieldScope={newFieldScope}
      setNewFieldScope={setNewFieldScope}
      newFieldKey={newFieldKey}
      setNewFieldKey={setNewFieldKey}
      newFieldType={newFieldType}
      setNewFieldType={setNewFieldType}
      createNewField={createNewField}
      visibleGraphFieldColumnCount={visibleGraphFieldColumnCount}
      orderedAllDataTableColumnKeys={orderedAllDataTableColumnKeys}
      filteredGraphFieldColumnKeys={filteredGraphFieldColumnKeys}
      dataTableColumnLabelByKey={dataTableColumnLabelByKey}
      isDataTableColumnVisible={isDataTableColumnVisible}
      setDataTableColumnVisibility={setDataTableColumnVisibility}
      moveDataTableColumn={moveDataTableColumn}
      draggingDataTableColumnKey={draggingDataTableColumnKey}
      setDraggingDataTableColumnKey={setDraggingDataTableColumnKey}
      dragOverDataTableColumnKey={dragOverDataTableColumnKey}
      setDragOverDataTableColumnKey={setDragOverDataTableColumnKey}
      selectedFieldId={selectedFieldId}
      selectedGlobalView={selectedGlobalView}
      setSelectedGlobalView={setSelectedGlobalView}
      setSelectedFieldId={setSelectedFieldId}
      fieldById={fieldById}
      resolvedSettingsById={resolvedSettingsById}
      settingsById={settingsById}
      schema={schema}
      schemaDefinedFieldIds={schemaDefinedFieldIds}
      styleOwnerByFieldId={styleOwnerByFieldId}
      nodeStyleOwnerKey={nodeStyleOwnerKey}
      edgeStyleOwnerKey={edgeStyleOwnerKey}
      nodeScopeBorderColor={nodeScopeBorderColor}
      edgeScopeBorderColor={edgeScopeBorderColor}
      updateGraphFieldSettings={updateGraphFieldSettings}
      updateNodeStyle={updateNodeStyle}
      updateEdgeStyle={updateEdgeStyle}
      localSchemaNodeTypes={localSchemaNodeTypes}
      localSchemaEdgeLabels={localSchemaEdgeLabels}
    />
  )
}
