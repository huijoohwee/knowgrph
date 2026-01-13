import React from 'react'
import { LS_KEYS } from '@/lib/config'
import { lsSetJson } from '@/lib/persistence'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
  type GraphDataTableFilterClause,
  type GraphDataTableFilterCondition,
  type GraphDataTableFilterMatch,
  type GraphDataTableSortDir,
  type GraphDataTableSortRule,
  type UnifiedRow,
  isGraphDataTablePropertyColumnKey,
  parseGraphDataTablePropertyColumnKey,
} from '@/features/graph-data-table/graphDataTable'
import {
  createInitialFilterState,
  addFilterGroupClause,
  addFilterConditionToGroupClause,
  appendFilterConditionClause,
  removeFilterConditionClause,
  setFilterGroupMatchOnClauses,
  updateFilterConditionClause,
} from '@/features/graph-data-table/graphDataTableFilters'
import {
  addSortRuleFromColumns,
  createInitialSortRules,
  removeSortRuleById,
  requestSortByColumnRules,
  resetSortRules,
  updateSortRuleById,
} from '@/features/graph-data-table/graphDataTableSorts'
import { type GraphDataTablePanel } from '@/features/graph-data-table/ui/GraphDataTablePanelOverlay'
import {
  type GraphFieldId,
} from '@/features/graph-fields/graphFields'
import { BottomPanelCuratorContent, type BottomPanelCuratorContentViewModel } from '@/components/BottomPanel/BottomPanelCuratorContent'
import {
  buildBottomPanelCuratorToolbarModel,
  buildBottomPanelCuratorOverlayModel,
  buildBottomPanelCuratorTableModel,
  type GraphDataTableScope,
} from './BottomPanelCuratorModels'
import { MarkdownSelectionToolbar, type MarkdownSelectionToolbarState } from '@/features/markdown/ui/MarkdownSelectionToolbar'
import { findSelectionTarget } from '@/features/markdown/ui/markdownPreviewSelection'
import type { GraphData } from '@/lib/graph/types'
import { createUniqueId } from '@/lib/ids'
import { emitPropsPanelOpen } from '@/features/canvas/utils'
import { useBottomPanelCuratorVisibleRows } from './hooks/useBottomPanelCuratorVisibleRows'
import { useBottomPanelCuratorFieldAggregates } from './hooks/useBottomPanelCuratorFieldAggregates'
import { useBottomPanelCuratorColumns } from './hooks/useBottomPanelCuratorColumns'
import { useBottomPanelCuratorListItems } from './hooks/useBottomPanelCuratorListItems'

interface BottomPanelCuratorTabProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export default function BottomPanelCuratorTab({
  nodes,
  edges,
}: BottomPanelCuratorTabProps) {
  const schema = useGraphStore(s => s.schema)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds)
  const selectMode = useGraphStore(s => s.schema.behavior?.selectMode ?? 'single')
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const removeNode = useGraphStore(s => s.removeNode)
  const updateNode = useGraphStore(s => s.updateNode)
  const addEdge = useGraphStore(s => s.addEdge)
  const removeEdge = useGraphStore(s => s.removeEdge)
  const updateEdge = useGraphStore(s => s.updateEdge)
  const graphFieldSettingsById = useGraphStore(s => s.graphFieldSettingsById)
  const graphDataTableVisibleColumns = useGraphStore(s => s.graphDataTableVisibleColumns)
  const graphDataTableColumnOrder = useGraphStore(s => s.graphDataTableColumnOrder)
  const setGraphDataTableVisibleColumns = useGraphStore(s => s.setGraphDataTableVisibleColumns)
  const setGraphDataTableColumnOrder = useGraphStore(s => s.setGraphDataTableColumnOrder)
  const graphDataTableAggregateKeys = useGraphStore(s => s.graphDataTableAggregateKeys)
  const setGraphDataTableAggregateKeys = useGraphStore(s => s.setGraphDataTableAggregateKeys)
  const graphDataTableFilterMatch = useGraphStore(s => s.graphDataTableFilterMatch)
  const graphDataTableFilterClauses = useGraphStore(s => s.graphDataTableFilterClauses)
  const graphDataTableSortRules = useGraphStore(s => s.graphDataTableSortRules)
  const graphDataTableGroupKey = useGraphStore(s => s.graphDataTableGroupKey)
  const isGraphDataTableAutoSortEnabled = useGraphStore(s => s.graphDataTableAutoSortEnabled)
  const setGraphDataTableFilterMatch = useGraphStore(s => s.setGraphDataTableFilterMatch)
  const setGraphDataTableFilterClauses = useGraphStore(s => s.setGraphDataTableFilterClauses)
  const setGraphDataTableSortRules = useGraphStore(s => s.setGraphDataTableSortRules)
  const setGraphDataTableGroupKey = useGraphStore(s => s.setGraphDataTableGroupKey)
  const setIsGraphDataTableAutoSortEnabled = useGraphStore(s => s.setGraphDataTableAutoSortEnabled)
  const includeMixedNumericFields = useGraphStore(s => s.graphDataTableAggregateIncludeMixedNumericFields)
  const includeIdAsNumeric = useGraphStore(s => s.graphDataTableAggregateIncludeIdAsNumeric)
  const includeSourceAsNumeric = useGraphStore(s => s.graphDataTableAggregateIncludeSourceAsNumeric)
  const includeTargetAsNumeric = useGraphStore(s => s.graphDataTableAggregateIncludeTargetAsNumeric)
  const setIncludeMixedNumericFields = useGraphStore(s => s.setGraphDataTableAggregateIncludeMixedNumericFields)
  const setIncludeIdAsNumeric = useGraphStore(s => s.setGraphDataTableAggregateIncludeIdAsNumeric)
  const setIncludeSourceAsNumeric = useGraphStore(s => s.setGraphDataTableAggregateIncludeSourceAsNumeric)
  const setIncludeTargetAsNumeric = useGraphStore(s => s.setGraphDataTableAggregateIncludeTargetAsNumeric)
  const setSelectedGraphFieldId = useGraphStore(s => s.setSelectedGraphFieldId)
  const numericSampleLimit = useGraphStore(s => s.graphDataTableNumericSampleLimit)
  const numericSampleMinCount = useGraphStore(s => s.graphDataTableNumericSampleMinCount)
  const numericSampleMinRatio = useGraphStore(s => s.graphDataTableNumericSampleMinRatio)
  const rowDensity = useGraphStore(s => s.graphDataTableRowDensity)
  const setRowDensity = useGraphStore(s => s.setGraphDataTableRowDensity)
  const isAutoScrollDisabled = useGraphStore(s => s.graphDataTableDisableAutoScroll)
  const setIsAutoScrollDisabled = useGraphStore(s => s.setGraphDataTableDisableAutoScroll)
  const freezeFirstDataColumnByScope = useGraphStore(s => s.graphDataTableFreezeFirstDataColumnByScope)
  const lastTraversalSummary = useGraphStore(s => s.lastTraversalSummary)
  const setFreezeFirstDataColumnScoped = useGraphStore(s => s.setGraphDataTableFreezeFirstDataColumn)
  const graphData = useGraphStore(s => s.graphData)
  const setBottomPanelCurationView = useGraphStore(s => s.setBottomPanelCurationView)
  const [query, setQuery] = React.useState('')
  const [graphDataTableScope, setGraphDataTableScope] = React.useState<GraphDataTableScope>('all')
  const [graphDataTableViewMode, setGraphDataTableViewMode] = React.useState<
    'allRows' | 'selectionNeighborhood' | 'traversalSequence'
  >('allRows')
  const [graphDataTablePanel, setGraphDataTablePanel] = React.useState<GraphDataTablePanel>('none')
  const fieldsMenuRef = React.useRef<HTMLButtonElement>(null)
  const filterMenuRef = React.useRef<HTMLButtonElement>(null)
  const sortMenuRef = React.useRef<HTMLButtonElement>(null)
  const groupMenuRef = React.useRef<HTMLButtonElement>(null)
  const [graphDataTableFieldsQuery, setGraphDataTableFieldsQuery] = React.useState('')
  const [draggingColumnKey, setDraggingColumnKey] = React.useState<GraphDataTableColumnKey | null>(null)
  const [toolbarResetToken, setToolbarResetToken] = React.useState(0)
  const [selectionToolbar, setSelectionToolbar] = React.useState<MarkdownSelectionToolbarState | null>(null)

  const freezeFirstDataColumn = freezeFirstDataColumnByScope[graphDataTableScope] ?? 'none'

  const setFreezeFirstDataColumn = React.useCallback(
    (value: 'none' | 'label' | 'id') => {
      setFreezeFirstDataColumnScoped(graphDataTableScope, value)
    },
    [setFreezeFirstDataColumnScoped, graphDataTableScope],
  )

  React.useEffect(() => {
    if (graphDataTableScope === 'edges' && freezeFirstDataColumn === 'none') {
      setFreezeFirstDataColumn('id')
    }
  }, [graphDataTableScope, freezeFirstDataColumn, setFreezeFirstDataColumn])

  React.useEffect(() => {
    if (graphDataTableViewMode !== 'selectionNeighborhood') return
    if (!selectedNodeId && !selectedEdgeId) {
      setGraphDataTableViewMode('allRows')
    }
  }, [graphDataTableViewMode, selectedNodeId, selectedEdgeId])

  const setGraphDataTableVisibleColumnsState = React.useCallback(
    (
      updater:
        | GraphDataTableColumnVisibilityByKey
        | ((prev: GraphDataTableColumnVisibilityByKey) => GraphDataTableColumnVisibilityByKey),
    ) => {
      if (typeof updater === 'function') {
        const next = (updater as (prev: GraphDataTableColumnVisibilityByKey) => GraphDataTableColumnVisibilityByKey)(
          graphDataTableVisibleColumns,
        )
        setGraphDataTableVisibleColumns(next)
        return
      }
      setGraphDataTableVisibleColumns(updater)
    },
    [setGraphDataTableVisibleColumns, graphDataTableVisibleColumns],
  )

  const setGraphDataTableColumnOrderState = React.useCallback(
    (
      updater: GraphDataTableColumnKey[] | ((prev: GraphDataTableColumnKey[]) => GraphDataTableColumnKey[]),
    ) => {
      if (typeof updater === 'function') {
        const next = (updater as (prev: GraphDataTableColumnKey[]) => GraphDataTableColumnKey[])(graphDataTableColumnOrder)
        setGraphDataTableColumnOrder(next)
        return
      }
      setGraphDataTableColumnOrder(updater)
    },
    [setGraphDataTableColumnOrder, graphDataTableColumnOrder],
  )

  const setGraphDataTableAggregateKeysState = React.useCallback(
    (
      updater: GraphDataTableColumnKey[] | ((prev: GraphDataTableColumnKey[]) => GraphDataTableColumnKey[]),
    ) => {
      if (typeof updater === 'function') {
        const next = (updater as (prev: GraphDataTableColumnKey[]) => GraphDataTableColumnKey[])(graphDataTableAggregateKeys)
        setGraphDataTableAggregateKeys(next)
        return
      }
      setGraphDataTableAggregateKeys(updater)
    },
    [setGraphDataTableAggregateKeys, graphDataTableAggregateKeys],
  )

  const nodeById = React.useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const edgeById = React.useMemo(() => new Map(edges.map(e => [e.id, e])), [edges])

  const visibleRows = useBottomPanelCuratorVisibleRows({
    nodes,
    edges,
    query,
    graphDataTableScope,
    graphDataTableFilterMatch,
    graphDataTableFilterClauses,
    graphDataTableViewMode,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    isGraphDataTableAutoSortEnabled,
    graphDataTableSortRules,
    lastTraversalSummary,
  })

  const {
    derivedGraphFields,
    propertyColumnKeysFromGraphFields,
    aggregatePanelColumnKeys,
  } = useBottomPanelCuratorFieldAggregates({
    nodes,
    edges,
    graphDataRevision,
    graphDataTablePanel,
    graphDataTableAggregateKeys,
    graphDataTableGroupKey,
    graphFieldSettingsById,
    numericSampleLimit,
    numericSampleMinCount,
    numericSampleMinRatio,
    includeMixedNumericFields,
    includeIdAsNumeric,
    includeSourceAsNumeric,
    includeTargetAsNumeric,
    graphDataTableViewMode,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    setGraphDataTableAggregateKeysState,
  })

  const {
    graphDataTableColumnLabelByKey,
    orderedVisibleColumnKeys,
    fieldsPanelColumnKeys,
    propertyFieldSettingsByColumnKey,
    isGraphDataTableColumnVisible,
    showAllColumns,
    hideAllColumns,
    moveGraphDataTableColumn,
  } = useBottomPanelCuratorColumns({
    derivedGraphFields,
    propertyColumnKeysFromGraphFields,
    graphDataTableColumnOrder,
    graphDataTableVisibleColumns,
    graphFieldSettingsById,
    graphDataTableFieldsQuery,
    setGraphDataTableVisibleColumnsState,
    setGraphDataTableColumnOrderState,
  })

  const listItems = useBottomPanelCuratorListItems({
    visibleRows,
    graphDataTableAggregateKeys,
    graphDataTableGroupKey,
  })

  const appendGraphDataTableFilterCondition = React.useCallback(
    (key: GraphDataTableColumnKey) => {
      setGraphDataTableFilterClauses(prev => appendFilterConditionClause(prev, key))
    },
    [setGraphDataTableFilterClauses],
  )

  const addGraphDataTableFilterCondition = React.useCallback(() => {
    appendGraphDataTableFilterCondition('label')
  }, [appendGraphDataTableFilterCondition])

  const updateGraphDataTableFilterCondition = React.useCallback(
    (id: string, patch: Partial<Omit<GraphDataTableFilterCondition, 'id'>>) => {
      setGraphDataTableFilterClauses(prev => updateFilterConditionClause(prev, id, patch))
    },
    [setGraphDataTableFilterClauses],
  )

  const setGraphDataTableFilterGroupMatch = React.useCallback(
    (groupId: string, match: GraphDataTableFilterMatch) => {
      setGraphDataTableFilterClauses(prev => setFilterGroupMatchOnClauses(prev, groupId, match))
    },
    [setGraphDataTableFilterClauses],
  )

  const addGraphDataTableFilterGroup = React.useCallback(() => {
    setGraphDataTableFilterClauses(prev => addFilterGroupClause(prev))
  }, [setGraphDataTableFilterClauses])

  const addGraphDataTableFilterConditionToGroup = React.useCallback(
    (groupId: string) => {
      setGraphDataTableFilterClauses(prev => addFilterConditionToGroupClause(prev, groupId))
    },
    [setGraphDataTableFilterClauses],
  )

  const removeGraphDataTableFilterCondition = React.useCallback(
    (id: string) => {
      setGraphDataTableFilterClauses(prev => removeFilterConditionClause(prev, id))
    },
    [setGraphDataTableFilterClauses],
  )

  const clearAllGraphDataTableFilters = React.useCallback(() => {
    const initial = createInitialFilterState()
    setGraphDataTableFilterMatch(initial.match)
    setGraphDataTableFilterClauses(initial.clauses)
  }, [setGraphDataTableFilterClauses, setGraphDataTableFilterMatch])

  const addGraphDataTableFilterForColumn = React.useCallback(
    (key: GraphDataTableColumnKey) => {
      setGraphDataTablePanel('filter')
      appendGraphDataTableFilterCondition(key)
    },
    [appendGraphDataTableFilterCondition],
  )

  const addGraphDataTableSortRule = React.useCallback(() => {
    setIsGraphDataTableAutoSortEnabled(true)
    setGraphDataTableSortRules(prev => addSortRuleFromColumns(prev))
  }, [setIsGraphDataTableAutoSortEnabled, setGraphDataTableSortRules])

  const updateGraphDataTableSortRule = React.useCallback(
    (id: string, patch: Partial<Omit<GraphDataTableSortRule, 'id'>>) => {
      setIsGraphDataTableAutoSortEnabled(true)
      setGraphDataTableSortRules(prev => updateSortRuleById(prev, id, patch))
    },
    [setIsGraphDataTableAutoSortEnabled, setGraphDataTableSortRules],
  )

  const resetGraphDataTableSortRules = React.useCallback(() => {
    setIsGraphDataTableAutoSortEnabled(true)
    setGraphDataTableSortRules(() => resetSortRules())
  }, [setIsGraphDataTableAutoSortEnabled, setGraphDataTableSortRules])

  const removeGraphDataTableSortRule = React.useCallback(
    (id: string) => {
      setGraphDataTableSortRules(prev => removeSortRuleById(prev, id))
    },
    [setGraphDataTableSortRules],
  )

  const requestSortByColumn = React.useCallback(
    (key: GraphDataTableColumnKey, dir: GraphDataTableSortDir) => {
      setIsGraphDataTableAutoSortEnabled(true)
      setGraphDataTableSortRules(prev => requestSortByColumnRules(prev, key, dir))
    },
    [setIsGraphDataTableAutoSortEnabled, setGraphDataTableSortRules],
  )

  const requestGroupByColumn = React.useCallback(
    (key: GraphDataTableColumnKey | '') => {
      setGraphDataTableGroupKey(key)
    },
    [setGraphDataTableGroupKey],
  )

  const requestHideColumn = React.useCallback(
    (key: GraphDataTableColumnKey) => {
      setGraphDataTableVisibleColumnsState(prev => ({ ...prev, [key]: false }))
    },
    [setGraphDataTableVisibleColumnsState],
  )

  const handleAddNode = React.useCallback(() => {
    emitPropsPanelOpen()
  }, [])

  const handleAddEdge = React.useCallback(() => {
    if (nodes.length < 2) return
    const used = new Set(edges.map(edge => edge.id))
    const id = createUniqueId('e', used)
    const labels = schema?.catalog?.edgeLabels || []
    const resolvedLabel =
      labels[0] || edges[0]?.label || 'link'
    const source = selectedNodeId && nodes.some(node => node.id === selectedNodeId) ? selectedNodeId : nodes[0]!.id
    const target = nodes.find(node => node.id !== source)?.id || nodes[1]!.id
    addEdge({ id, source, target, label: resolvedLabel, properties: {}, metadata: {} })
    selectNode(null)
    selectEdge(id)
  }, [addEdge, edges, nodes, schema, selectEdge, selectNode, selectedNodeId])

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedNodeId) {
      removeNode(selectedNodeId)
      selectNode(null)
      return
    }
    if (selectedEdgeId) {
      removeEdge(selectedEdgeId)
      selectEdge(null)
    }
  }, [removeEdge, removeNode, selectEdge, selectNode, selectedEdgeId, selectedNodeId])

  const handleRowSelect = React.useCallback(
    (row: UnifiedRow) => {
      setSelectionSource('table')
      if (row.kind === 'node') {
        if (selectMode === 'single') selectEdge(null)
        selectNode(row.id)
        return
      }
      if (selectMode === 'single') selectNode(null)
      selectEdge(row.id)
    },
    [selectEdge, selectMode, selectNode, setSelectionSource],
  )

  const handleRowContextMenu = React.useCallback(
    (e: React.MouseEvent, row: UnifiedRow) => {
      e.preventDefault()
      const startLine = Number(row.metadata?.lineStart) || 1
      const endLine = Number(row.metadata?.lineEnd) || startLine
      const text = row.kind === 'node' ? row.id : (row.label || row.id)
      
      setSelectionToolbar({
        x: e.clientX,
        y: e.clientY,
        startLine,
        endLine,
        text,
      })
    },
    [],
  )

  const closeSelectionToolbar = React.useCallback(() => {
    setSelectionToolbar(null)
  }, [])

  React.useEffect(() => {
    if (!selectionToolbar) return
    const handler = () => closeSelectionToolbar()
    window.addEventListener('mousedown', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [selectionToolbar, closeSelectionToolbar])

  const handleShowOnCanvas = React.useCallback(
    (startLine: number, endLine: number) => {
      const target = findSelectionTarget(graphData as GraphData | null, '', startLine, endLine)
      if (!target) return
      setSelectionSource('editor')
      if (target.kind === 'node') {
        selectNode(target.id)
      } else {
        selectEdge(target.id)
      }
    },
    [graphData, selectEdge, selectNode, setSelectionSource],
  )

  const activePanelAnchorRef =
    graphDataTablePanel === 'fields'
      ? fieldsMenuRef
      : graphDataTablePanel === 'filter'
        ? filterMenuRef
        : graphDataTablePanel === 'sort'
          ? sortMenuRef
          : graphDataTablePanel === 'group'
            ? groupMenuRef
            : fieldsMenuRef

  React.useEffect(() => {
    setQuery('')
    setGraphDataTableViewMode('allRows')
    setGraphDataTableScope('all')
    setGraphDataTablePanel('none')
    setGraphDataTableFieldsQuery('')
    setDraggingColumnKey(null)
    const initialFilters = createInitialFilterState()
    setGraphDataTableFilterMatch(initialFilters.match)
    setGraphDataTableFilterClauses(initialFilters.clauses)
    setIsGraphDataTableAutoSortEnabled(true)
    setGraphDataTableSortRules(createInitialSortRules())
    setGraphDataTableGroupKey('')
    setToolbarResetToken(token => token + 1)
  }, [
    graphDataRevision,
    setQuery,
    setGraphDataTableScope,
    setGraphDataTablePanel,
    setGraphDataTableFieldsQuery,
    setDraggingColumnKey,
    setGraphDataTableFilterMatch,
    setGraphDataTableFilterClauses,
    setIsGraphDataTableAutoSortEnabled,
    setGraphDataTableSortRules,
    setGraphDataTableGroupKey,
    setToolbarResetToken,
  ])

  const handleSetColumnVisibility = React.useCallback(
    (key: GraphDataTableColumnKey, visible: boolean) => {
      setGraphDataTableVisibleColumnsState(prev => {
        const next = { ...prev, [key]: visible }
        if (visible && isGraphDataTablePropertyColumnKey(key)) {
          const parsed = parseGraphDataTablePropertyColumnKey(key)
          if (parsed) {
            const fieldId = `${parsed.scope}:${parsed.propertyKey}` as GraphFieldId
            setSelectedGraphFieldId(fieldId)
          }
        }
        return next
      })
    },
    [setSelectedGraphFieldId, setGraphDataTableVisibleColumnsState],
  )

  const handleShowInViewer = React.useCallback((line: number) => {
    handleShowOnCanvas(line, line)
    lsSetJson(LS_KEYS.markdownLayoutMode, 'viewer')
    lsSetJson(LS_KEYS.markdownPresentationMode, false)
    setBottomPanelCurationView('markdown')
  }, [handleShowOnCanvas, setBottomPanelCurationView])

  const handleShowInEditor = React.useCallback((line: number) => {
    handleShowOnCanvas(line, line)
    lsSetJson(LS_KEYS.markdownLayoutMode, 'editor')
    lsSetJson(LS_KEYS.markdownPresentationMode, false)
    setBottomPanelCurationView('markdown')
  }, [handleShowOnCanvas, setBottomPanelCurationView])

  const handleShowInPresentation = React.useCallback((line: number) => {
    handleShowOnCanvas(line, line)
    lsSetJson(LS_KEYS.markdownPresentationMode, true)
    setBottomPanelCurationView('markdown')
  }, [handleShowOnCanvas, setBottomPanelCurationView])

  const handleShowInSlidesGallery = React.useCallback((line: number) => {
    handleShowOnCanvas(line, line)
    lsSetJson(LS_KEYS.markdownPresentationMode, true)
    setBottomPanelCurationView('markdown')
  }, [handleShowOnCanvas, setBottomPanelCurationView])

  const handleRowDoubleClick = React.useCallback(
    (row: UnifiedRow) => {
      const line = Number(row.metadata?.lineStart)
      if (line) {
        handleShowInEditor(line)
        return
      }
      handleRowSelect(row)
      if (row.metadata?.lineStart) {
        setBottomPanelCurationView('markdown')
      }
    },
    [handleRowSelect, handleShowInEditor, setBottomPanelCurationView],
  )

  const selectionToolbarNode = selectionToolbar ? (
    <MarkdownSelectionToolbar
      toolbar={selectionToolbar}
      onClose={closeSelectionToolbar}
      onShowOnCanvas={handleShowOnCanvas}
      onShowInViewer={handleShowInViewer}
      onShowInEditor={handleShowInEditor}
      onShowInPresentation={handleShowInPresentation}
      onShowInSlidesGallery={handleShowInSlidesGallery}
      onShowInGraphDataTable={() => {}}
      currentView="table"
    />
  ) : undefined

  const viewModel: BottomPanelCuratorContentViewModel = {
    toolbar: buildBottomPanelCuratorToolbarModel({
      graphDataTablePanel,
      setGraphDataTablePanel,
      graphDataTableScope,
      setGraphDataTableScope,
      viewMode: graphDataTableViewMode,
      setViewMode: setGraphDataTableViewMode,
      selectedNodeId,
      selectedEdgeId,
      onDeleteSelected: handleDeleteSelected,
      onAddNode: handleAddNode,
      onAddEdge: handleAddEdge,
      nodesCount: nodes.length,
      fieldsMenuRef,
      filterMenuRef,
      sortMenuRef,
      groupMenuRef,
      resetToken: toolbarResetToken,
      rowDensity,
      setRowDensity,
      isAutoScrollDisabled,
      setIsAutoScrollDisabled,
    }),
    overlay: buildBottomPanelCuratorOverlayModel({
      activePanelAnchorRef,
      graphDataTableFieldsQuery,
      setGraphDataTableFieldsQuery,
      fieldsPanelColumnKeys: [...fieldsPanelColumnKeys],
      columnLabelByKey: graphDataTableColumnLabelByKey,
      isGraphDataTableColumnVisible,
      handleSetColumnVisibility,
      moveGraphDataTableColumn,
      draggingColumnKey,
      setDraggingColumnKey,
      showAllColumns,
      hideAllColumns,
      graphDataTableFilterMatch,
      setGraphDataTableFilterMatch,
      graphDataTableFilterClauses: graphDataTableFilterClauses as ReadonlyArray<GraphDataTableFilterClause>,
      addGraphDataTableFilterCondition: addGraphDataTableFilterCondition,
      addGraphDataTableFilterGroup: addGraphDataTableFilterGroup,
      addGraphDataTableFilterConditionToGroup: addGraphDataTableFilterConditionToGroup,
      updateGraphDataTableFilterCondition: updateGraphDataTableFilterCondition,
      setGraphDataTableFilterGroupMatch,
      removeGraphDataTableFilterCondition: removeGraphDataTableFilterCondition,
      clearAllGraphDataTableFilters: clearAllGraphDataTableFilters,
      isGraphDataTableAutoSortEnabled,
      setIsGraphDataTableAutoSortEnabled,
      graphDataTableSortRules,
      addGraphDataTableSortRule,
      resetGraphDataTableSortRules,
      updateGraphDataTableSortRule,
      removeGraphDataTableSortRule,
      graphDataTableGroupKey,
      setGraphDataTableGroupKey,
      graphDataTableAggregateKeys,
      setGraphDataTableAggregateKeys: setGraphDataTableAggregateKeysState,
      aggregatePanelColumnKeys: [...aggregatePanelColumnKeys],
      includeMixedNumericFields,
      setIncludeMixedNumericFields,
      includeIdAsNumeric,
      setIncludeIdAsNumeric,
      includeSourceAsNumeric,
      setIncludeSourceAsNumeric,
      includeTargetAsNumeric,
      setIncludeTargetAsNumeric,
    }),
    table: buildBottomPanelCuratorTableModel({
      listItems,
      orderedVisibleColumnKeys: [...orderedVisibleColumnKeys],
      visibleRows,
      columnLabelByKey: graphDataTableColumnLabelByKey,
      propertyFieldSettingsByColumnKey,
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
      nodeById,
      edgeById,
      updateNode,
      updateEdge,
      onRowClick: handleRowSelect,
      onRowDoubleClick: handleRowDoubleClick,
      onRowContextMenu: handleRowContextMenu,
      graphDataTableSortRules,
      addGraphDataTableFilterForColumn: addGraphDataTableFilterForColumn,
      requestGroupByColumn,
      requestHideColumn,
      requestSortByColumn,
      rowDensity,
      isAutoScrollDisabled,
      freezeFirstDataColumn,
      setFreezeFirstDataColumn,
    }),
  }

  return (
    <BottomPanelCuratorContent viewModel={viewModel} selectionToolbar={selectionToolbarNode} />
  )
}
