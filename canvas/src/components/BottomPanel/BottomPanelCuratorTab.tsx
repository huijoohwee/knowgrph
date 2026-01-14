import React from 'react'
import {
  type GraphDataTableFilterClause,
  type UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'
import {
  createInitialFilterState,
} from '@/features/graph-data-table/graphDataTableFilters'
import { createInitialSortRules as createInitialSortRulesUtil } from '@/features/graph-data-table/graphDataTableSorts'
import { BottomPanelCuratorContent, type BottomPanelCuratorContentViewModel } from '@/components/BottomPanel/BottomPanelCuratorContent'
import {
  buildBottomPanelCuratorToolbarModel,
  buildBottomPanelCuratorOverlayModel,
  buildBottomPanelCuratorTableModel,
} from './BottomPanelCuratorModels'
import { MarkdownSelectionToolbar } from '@/features/markdown/ui/MarkdownSelectionToolbar'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import { useBottomPanelCuratorVisibleRows } from './hooks/useBottomPanelCuratorVisibleRows'
import { useBottomPanelCuratorFieldAggregates } from './hooks/useBottomPanelCuratorFieldAggregates'
import { useBottomPanelCuratorColumns } from './hooks/useBottomPanelCuratorColumns'
import { useBottomPanelCuratorListItems } from './hooks/useBottomPanelCuratorListItems'
import { useBottomPanelCuratorState } from './hooks/useBottomPanelCuratorState'

interface BottomPanelCuratorTabProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export default function BottomPanelCuratorTab({
  nodes,
  edges,
}: BottomPanelCuratorTabProps) {
  const {
    graphDataRevision,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
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
  } = useBottomPanelCuratorState(nodes, edges)

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
    [setSelectionToolbar],
  )

  const closeSelectionToolbar = React.useCallback(() => {
    setSelectionToolbar(null)
  }, [setSelectionToolbar])

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
    setGraphDataTableSortRules(createInitialSortRulesUtil())
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
