import React from 'react'
import { buildMarkdownDataViewNestedRowStates } from './MarkdownDataViewRowNesting'

export function useMarkdownDataViewNestedRowCollapse<Row extends { id: string; cells: readonly string[] }>(args: {
  rows: readonly Row[]
  levelColumnIndex?: number
  indentColumnIndex?: number
}) {
  const [collapsedNestedRowIds, setCollapsedNestedRowIds] = React.useState<Set<string>>(() => new Set())
  const nestedRowStates = React.useMemo(
    () => buildMarkdownDataViewNestedRowStates({ rows: args.rows, collapsedRowIds: collapsedNestedRowIds, levelColumnIndex: args.levelColumnIndex, indentColumnIndex: args.indentColumnIndex }),
    [args.indentColumnIndex, args.levelColumnIndex, args.rows, collapsedNestedRowIds],
  )
  const visibleNestedRowStates = React.useMemo(() => nestedRowStates.filter(state => !state.hidden), [nestedRowStates])
  const nestedParentRowIds = React.useMemo(() => nestedRowStates.filter(state => state.childCount > 0).map(state => state.row.id), [nestedRowStates])
  const hasNestedRowHierarchy = nestedRowStates.some(state => state.depth > 0 || state.childCount > 0)
  const areAllNestedRowsCollapsed = nestedParentRowIds.length > 0 && nestedParentRowIds.every(rowId => collapsedNestedRowIds.has(rowId))
  const toggleNestedRow = React.useCallback((rowId: string) => {
    setCollapsedNestedRowIds(prev => {
      const next = new Set(prev)
      ;(next.has(rowId) ? next.delete : next.add).call(next, rowId)
      return next
    })
  }, [])
  const toggleAllNestedRows = React.useCallback(() => {
    setCollapsedNestedRowIds(prev => {
      const next = new Set(prev)
      for (const rowId of nestedParentRowIds) (areAllNestedRowsCollapsed ? next.delete : next.add).call(next, rowId)
      return next
    })
  }, [areAllNestedRowsCollapsed, nestedParentRowIds])
  return { areAllNestedRowsCollapsed, collapsedNestedRowIds, hasNestedRowHierarchy, toggleAllNestedRows, toggleNestedRow, visibleNestedRowStates }
}
