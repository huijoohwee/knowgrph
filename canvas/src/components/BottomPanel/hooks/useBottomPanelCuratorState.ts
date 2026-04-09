import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphDataTableScope as HostGraphDataTableScope } from '@/hooks/store/types'
import { LS_KEYS } from '@/lib/config'
import { lsSetJson } from '@/lib/persistence'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import {
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
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
  removeSortRuleById,
  requestSortByColumnRules,
  resetSortRules,
  updateSortRuleById,
} from '@/features/graph-data-table/graphDataTableSorts'
import { type GraphDataTablePanel } from '@/features/graph-data-table/ui/GraphDataTablePanelOverlay'
import { type GraphFieldId } from '@/features/graph-fields/graphFields'
import { createUniqueId } from '@/lib/ids'
import { emitPropsPanelOpen } from '@/features/canvas/utils'
import { type MarkdownSelectionToolbarState } from '@/features/markdown/ui/MarkdownSelectionToolbar'
import { findSelectionTarget } from '@/features/markdown/ui/markdownPreviewSelection'

export type GraphDataTableScope = HostGraphDataTableScope

export function useBottomPanelCuratorState(
  nodes: GraphNode[],
  edges: GraphEdge[],
) {
  const {
    addEdge,
    graphData,
    graphDataRevision,
    graphDataTableAggregateKeys,
    graphDataTableColumnOrder,
    graphDataTableFilterClauses,
    graphDataTableFilterMatch,
    graphDataTableGroupKey,
    graphDataTableSortRules,
    graphDataTableVisibleColumns,
    graphFieldSettingsById,
    includeIdAsNumeric,
    includeMixedNumericFields,
    includeSourceAsNumeric,
    includeTargetAsNumeric,
    isAutoScrollDisabled,
    isGraphDataTableAutoSortEnabled,
    lastTraversalSummary,
    numericSampleLimit,
    numericSampleMinCount,
    numericSampleMinRatio,
    removeEdge,
    removeNode,
    rowDensity,
    schema,
    selectedEdgeId,
    selectedEdgeIds,
    selectedNodeId,
    selectedNodeIds,
    selectEdge,
    selectMode,
    selectNode,
    setFreezeFirstDataColumnScoped,
    setGraphDataTableAggregateKeys,
    setGraphDataTableColumnOrder,
    setGraphDataTableFilterClauses,
    setGraphDataTableFilterMatch,
    setGraphDataTableGroupKey,
    setGraphDataTableSortRules,
    setGraphDataTableVisibleColumns,
    setIncludeIdAsNumeric,
    setIncludeMixedNumericFields,
    setIncludeSourceAsNumeric,
    setIncludeTargetAsNumeric,
    setIsAutoScrollDisabled,
    setIsGraphDataTableAutoSortEnabled,
    setRowDensity,
    setSelectedGraphFieldId,
    setSelectionSource,
    updateEdge,
    updateNode,
    freezeFirstDataColumnByScope,
  } = useGraphStore(
    useShallow(s => ({
      addEdge: s.addEdge,
      graphData: s.graphData,
      graphDataRevision: s.graphDataRevision,
      graphDataTableAggregateKeys: s.graphDataTableAggregateKeys,
      graphDataTableColumnOrder: s.graphDataTableColumnOrder,
      graphDataTableFilterClauses: s.graphDataTableFilterClauses,
      graphDataTableFilterMatch: s.graphDataTableFilterMatch,
      graphDataTableGroupKey: s.graphDataTableGroupKey,
      graphDataTableSortRules: s.graphDataTableSortRules,
      graphDataTableVisibleColumns: s.graphDataTableVisibleColumns,
      graphFieldSettingsById: s.graphFieldSettingsById,
      includeIdAsNumeric: s.graphDataTableAggregateIncludeIdAsNumeric,
      includeMixedNumericFields: s.graphDataTableAggregateIncludeMixedNumericFields,
      includeSourceAsNumeric: s.graphDataTableAggregateIncludeSourceAsNumeric,
      includeTargetAsNumeric: s.graphDataTableAggregateIncludeTargetAsNumeric,
      isAutoScrollDisabled: s.graphDataTableDisableAutoScroll,
      isGraphDataTableAutoSortEnabled: s.graphDataTableAutoSortEnabled,
      lastTraversalSummary: s.lastTraversalSummary,
      numericSampleLimit: s.graphDataTableNumericSampleLimit,
      numericSampleMinCount: s.graphDataTableNumericSampleMinCount,
      numericSampleMinRatio: s.graphDataTableNumericSampleMinRatio,
      removeEdge: s.removeEdge,
      removeNode: s.removeNode,
      rowDensity: s.graphDataTableRowDensity,
      schema: s.schema,
      selectedEdgeId: s.selectedEdgeId,
      selectedEdgeIds: s.selectedEdgeIds,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      selectEdge: s.selectEdge,
      selectMode: s.schema.behavior?.selectMode ?? 'single',
      selectNode: s.selectNode,
      setFreezeFirstDataColumnScoped: s.setGraphDataTableFreezeFirstDataColumn,
      setGraphDataTableAggregateKeys: s.setGraphDataTableAggregateKeys,
      setGraphDataTableColumnOrder: s.setGraphDataTableColumnOrder,
      setGraphDataTableFilterClauses: s.setGraphDataTableFilterClauses,
      setGraphDataTableFilterMatch: s.setGraphDataTableFilterMatch,
      setGraphDataTableGroupKey: s.setGraphDataTableGroupKey,
      setGraphDataTableSortRules: s.setGraphDataTableSortRules,
      setGraphDataTableVisibleColumns: s.setGraphDataTableVisibleColumns,
      setIncludeIdAsNumeric: s.setGraphDataTableAggregateIncludeIdAsNumeric,
      setIncludeMixedNumericFields: s.setGraphDataTableAggregateIncludeMixedNumericFields,
      setIncludeSourceAsNumeric: s.setGraphDataTableAggregateIncludeSourceAsNumeric,
      setIncludeTargetAsNumeric: s.setGraphDataTableAggregateIncludeTargetAsNumeric,
      setIsAutoScrollDisabled: s.setGraphDataTableDisableAutoScroll,
      setIsGraphDataTableAutoSortEnabled: s.setGraphDataTableAutoSortEnabled,
      setRowDensity: s.setGraphDataTableRowDensity,
      setSelectedGraphFieldId: s.setSelectedGraphFieldId,
      setSelectionSource: s.setSelectionSource,
      updateEdge: s.updateEdge,
      updateNode: s.updateNode,
      freezeFirstDataColumnByScope: s.graphDataTableFreezeFirstDataColumnByScope,
    })),
  )
  const setBottomPanelCurationView = React.useCallback((view: 'grid' | 'markdown') => {
    const st = useGraphStore.getState() as unknown as {
      setBottomPanelCurationView?: (next: 'grid' | 'markdown') => void
    }
    st.setBottomPanelCurationView?.(view)
  }, [])

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
      setSelectionSource('menu')
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

  return {
    schema,
    graphDataRevision,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    selectMode,
    selectNode,
    selectEdge,
    updateNode,
    updateEdge,
    graphFieldSettingsById,
    graphDataTableVisibleColumns,
    graphDataTableColumnOrder,
    graphDataTableAggregateKeys,
    graphDataTableFilterMatch,
    graphDataTableFilterClauses,
    graphDataTableSortRules,
    graphDataTableGroupKey,
    isGraphDataTableAutoSortEnabled,
    includeMixedNumericFields,
    includeIdAsNumeric,
    includeSourceAsNumeric,
    includeTargetAsNumeric,
    setIncludeMixedNumericFields,
    setIncludeIdAsNumeric,
    setIncludeSourceAsNumeric,
    setIncludeTargetAsNumeric,
    numericSampleLimit,
    numericSampleMinCount,
    numericSampleMinRatio,
    rowDensity,
    setRowDensity,
    isAutoScrollDisabled,
    setIsAutoScrollDisabled,
    lastTraversalSummary,
    setBottomPanelCurationView,
    query,
    setQuery,
    graphDataTableScope,
    setGraphDataTableScope,
    graphDataTableViewMode,
    setGraphDataTableViewMode,
    graphDataTablePanel,
    setGraphDataTablePanel,
    fieldsMenuRef,
    filterMenuRef,
    sortMenuRef,
    groupMenuRef,
    graphDataTableFieldsQuery,
    setGraphDataTableFieldsQuery,
    draggingColumnKey,
    setDraggingColumnKey,
    toolbarResetToken,
    setToolbarResetToken,
    selectionToolbar,
    setSelectionToolbar,
    freezeFirstDataColumn,
    setFreezeFirstDataColumn,
    setGraphDataTableVisibleColumnsState,
    setGraphDataTableColumnOrderState,
    setGraphDataTableAggregateKeysState,
    nodeById,
    edgeById,
    appendGraphDataTableFilterCondition,
    addGraphDataTableFilterCondition,
    updateGraphDataTableFilterCondition,
    setGraphDataTableFilterGroupMatch,
    addGraphDataTableFilterGroup,
    addGraphDataTableFilterConditionToGroup,
    removeGraphDataTableFilterCondition,
    clearAllGraphDataTableFilters,
    addGraphDataTableFilterForColumn,
    addGraphDataTableSortRule,
    updateGraphDataTableSortRule,
    resetGraphDataTableSortRules,
    removeGraphDataTableSortRule,
    requestSortByColumn,
    requestGroupByColumn,
    requestHideColumn,
    handleAddNode,
    handleAddEdge,
    handleDeleteSelected,
    handleRowSelect,
    handleShowOnCanvas,
    handleShowInViewer,
    handleShowInEditor,
    handleShowInPresentation,
    handleShowInSlidesGallery,
    handleRowDoubleClick,
    handleSetColumnVisibility,
    setGraphDataTableFilterMatch,
    setGraphDataTableFilterClauses,
    setIsGraphDataTableAutoSortEnabled,
    setGraphDataTableSortRules,
    setGraphDataTableGroupKey,
  }
}
