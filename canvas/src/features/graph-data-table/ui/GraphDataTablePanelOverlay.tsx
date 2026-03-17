import React from 'react'
import { DropdownPanel } from '@/lib/ui/overlay'
import {
  GRAPH_DATA_TABLE_COLUMN_DEFS,
  GRAPH_DATA_TABLE_GROUP_KEYS,
  type GraphDataTableColumnKey,
  type GraphDataTableFilterClause,
  type GraphDataTableFilterCondition,
  type GraphDataTableFilterMatch,
  type GraphDataTableFilterOperator,
  type GraphDataTableSortDir,
  type GraphDataTableSortRule,
} from '@/features/graph-data-table/graphDataTable'
import {
  type FilterComboboxOption,
} from '@/features/graph-data-table/ui/GraphDataTableUiPrimitives'
import { FieldsPanel } from '@/features/graph-data-table/ui/GraphDataTableFieldsPanel'
import { FilterPanel } from '@/features/graph-data-table/ui/GraphDataTableFilterPanel'
import { SortPanel } from '@/features/graph-data-table/ui/GraphDataTableSortPanel'
import { GroupPanel } from '@/features/graph-data-table/ui/GraphDataTableGroupPanel'

export type GraphDataTablePanel = 'none' | 'fields' | 'filter' | 'sort' | 'group'

const FILTER_OPERATOR_OPTIONS: ReadonlyArray<{ value: GraphDataTableFilterOperator; label: string }> = [
  { value: 'contains', label: 'Contains' },
  { value: 'does_not_contain', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'greater_or_equal', label: 'Greater or equal' },
  { value: 'less_than', label: 'Less than' },
  { value: 'less_or_equal', label: 'Less or equal' },
]

interface GraphDataTablePanelOverlayProps {
  panel: Exclude<GraphDataTablePanel, 'none'>
  anchorRef: React.RefObject<HTMLElement>
  onClose: () => void

  fieldsQuery: string
  setFieldsQuery: (next: string) => void
  fieldsPanelColumnKeys: GraphDataTableColumnKey[]
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  isColumnVisible: (key: GraphDataTableColumnKey) => boolean
  setColumnVisibility: (key: GraphDataTableColumnKey, visible: boolean) => void
  moveColumn: (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => void
  draggingColumnKey: GraphDataTableColumnKey | null
  setDraggingColumnKey: (key: GraphDataTableColumnKey | null) => void
  showAllColumns: () => void
  hideAllColumns: () => void

  filterMatch: GraphDataTableFilterMatch
  setFilterMatch: (match: GraphDataTableFilterMatch) => void
  filterClauses: ReadonlyArray<GraphDataTableFilterClause>
  addFilterCondition: () => void
  addFilterGroup: () => void
  addFilterConditionToGroup: (groupId: string) => void
  updateFilterCondition: (id: string, patch: Partial<Omit<GraphDataTableFilterCondition, 'id' | 'kind'>>) => void
  setFilterGroupMatch: (groupId: string, match: GraphDataTableFilterMatch) => void
  removeFilterCondition: (id: string) => void
  clearAllFilters: () => void

  isAutoSortEnabled: boolean
  setIsAutoSortEnabled: (enabled: boolean) => void
  sortRules: ReadonlyArray<GraphDataTableSortRule>
  addSortRule: () => void
  resetSortRules: () => void
  updateSortRule: (id: string, patch: Partial<Omit<GraphDataTableSortRule, 'id'>>) => void
  removeSortRule: (id: string) => void

  groupKey: GraphDataTableColumnKey | ''
  setGroupKey: (key: GraphDataTableColumnKey | '') => void
  aggregateKeys: GraphDataTableColumnKey[]
  setAggregateKeys: (keys: GraphDataTableColumnKey[]) => void
  aggregatePanelColumnKeys: GraphDataTableColumnKey[]
  includeMixedNumericFields: boolean
  setIncludeMixedNumericFields: (value: boolean) => void
  includeIdAsNumeric: boolean
  setIncludeIdAsNumeric: (value: boolean) => void
  includeSourceAsNumeric: boolean
  setIncludeSourceAsNumeric: (value: boolean) => void
  includeTargetAsNumeric: boolean
  setIncludeTargetAsNumeric: (value: boolean) => void
}

export function GraphDataTablePanelOverlay({
  panel,
  anchorRef,
  onClose,
  fieldsQuery,
  setFieldsQuery,
  fieldsPanelColumnKeys,
  columnLabelByKey,
  isColumnVisible,
  setColumnVisibility,
  moveColumn,
  draggingColumnKey,
  setDraggingColumnKey,
  showAllColumns,
  hideAllColumns,
  filterMatch,
  setFilterMatch,
  filterClauses,
  addFilterCondition,
  addFilterGroup,
  addFilterConditionToGroup,
  updateFilterCondition,
  setFilterGroupMatch,
  removeFilterCondition,
  clearAllFilters,
  isAutoSortEnabled,
  setIsAutoSortEnabled,
  sortRules,
  addSortRule,
  resetSortRules,
  updateSortRule,
  removeSortRule,
  groupKey,
  setGroupKey,
  aggregateKeys,
  setAggregateKeys,
  aggregatePanelColumnKeys,
  includeMixedNumericFields,
  setIncludeMixedNumericFields,
  includeIdAsNumeric,
  setIncludeIdAsNumeric,
  includeSourceAsNumeric,
  setIncludeSourceAsNumeric,
  includeTargetAsNumeric,
  setIncludeTargetAsNumeric,
}: GraphDataTablePanelOverlayProps) {
  const columnOptions = React.useMemo(
    () =>
      GRAPH_DATA_TABLE_COLUMN_DEFS.map(def => ({
        value: def.key,
        label: def.label,
      })),
    [],
  )

  const sortDirOptions: ReadonlyArray<FilterComboboxOption<GraphDataTableSortDir>> = React.useMemo(
    () => [
      { value: 'asc', label: 'Ascending' },
      { value: 'desc', label: 'Descending' },
    ],
    [],
  )

  const filterOperatorOptions = React.useMemo(
    () => FILTER_OPERATOR_OPTIONS,
    [],
  )

  const groupOptions = React.useMemo(
    () =>
      GRAPH_DATA_TABLE_GROUP_KEYS.map(key => ({
        value: key,
        label: GRAPH_DATA_TABLE_COLUMN_DEFS.find(def => def.key === key)?.label ?? key,
      })),
    [],
  )

  const handleClose = React.useCallback(() => {
    onClose()
  }, [onClose])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  const panelTitle =
    panel === 'fields'
      ? 'Visible fields'
      : panel === 'filter'
        ? 'Filter records'
        : panel === 'sort'
          ? 'Sort records'
          : 'Group records'

  return (
    <DropdownPanel anchorRef={anchorRef} open onClose={handleClose} align="bottom-left">
      {panel === 'fields' && (
        <FieldsPanel
          panelTitle={panelTitle}
          fieldsQuery={fieldsQuery}
          setFieldsQuery={setFieldsQuery}
          fieldsPanelColumnKeys={fieldsPanelColumnKeys}
          columnLabelByKey={columnLabelByKey}
          isColumnVisible={isColumnVisible}
          setColumnVisibility={setColumnVisibility}
          draggingColumnKey={draggingColumnKey}
          setDraggingColumnKey={setDraggingColumnKey}
          moveColumn={moveColumn}
          showAllColumns={showAllColumns}
          hideAllColumns={hideAllColumns}
          onClose={onClose}
        />
      )}

      {panel === 'filter' && (
        <FilterPanel
          filterMatch={filterMatch}
          setFilterMatch={setFilterMatch}
          filterClauses={filterClauses}
          columnOptions={columnOptions}
          filterOperatorOptions={filterOperatorOptions}
          columnLabelByKey={columnLabelByKey}
          updateFilterCondition={updateFilterCondition}
          setFilterGroupMatch={setFilterGroupMatch}
          addFilterConditionToGroup={addFilterConditionToGroup}
          removeFilterCondition={removeFilterCondition}
          addFilterCondition={addFilterCondition}
          addFilterGroup={addFilterGroup}
          clearAllFilters={clearAllFilters}
        />
      )}

      {panel === 'sort' && (
        <SortPanel
          panelTitle={panelTitle}
          isAutoSortEnabled={isAutoSortEnabled}
          setIsAutoSortEnabled={setIsAutoSortEnabled}
          sortRules={sortRules}
          columnOptions={columnOptions}
          sortDirOptions={sortDirOptions}
          updateSortRule={updateSortRule}
          removeSortRule={removeSortRule}
          addSortRule={addSortRule}
          resetSortRules={resetSortRules}
          onClose={onClose}
        />
      )}

      {panel === 'group' && (
        <GroupPanel
          panelTitle={panelTitle}
          groupKey={groupKey}
          setGroupKey={setGroupKey}
          groupOptions={groupOptions}
          includeMixedNumericFields={includeMixedNumericFields}
          setIncludeMixedNumericFields={setIncludeMixedNumericFields}
          includeIdAsNumeric={includeIdAsNumeric}
          setIncludeIdAsNumeric={setIncludeIdAsNumeric}
          includeSourceAsNumeric={includeSourceAsNumeric}
          setIncludeSourceAsNumeric={setIncludeSourceAsNumeric}
          includeTargetAsNumeric={includeTargetAsNumeric}
          setIncludeTargetAsNumeric={setIncludeTargetAsNumeric}
          aggregatePanelColumnKeys={aggregatePanelColumnKeys}
          aggregateKeys={aggregateKeys}
          setAggregateKeys={setAggregateKeys}
          columnLabelByKey={columnLabelByKey}
          onClose={onClose}
        />
      )}
    </DropdownPanel>
  )
}
