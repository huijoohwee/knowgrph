import React from 'react'
import type { GraphColumnDoc, GraphTableId } from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'
import type {
  GraphTableColumnVisibilityById,
  GraphTableColumnWidthsPxById,
  GraphTableFilterClause,
  GraphTableFilterMatch,
  GraphTableRowHeightPreset,
  GraphTableSortRule,
} from '@/features/graph-table/ui/graphTableViewState'
import { useGraphTableGridModel } from '@/features/graph-table/ui/fast-grid/useGraphTableGridModel'
import { getCellTextByKind } from '@/features/graph-table/ui/fast-grid/canvasGridRender'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { PanelTypography } from '@/lib/ui/panelTypography'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { UI_RESPONSIVE_CONTENT_START_OFFSET_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'

export const GraphTableDomTableView = React.memo(function GraphTableDomTableView(props: {
  tableId: GraphTableId
  columns: GraphColumnDoc[]
  rows: GraphTableGridRow[]
  selectedRowIds: string[]
  columnVisibilityById: GraphTableColumnVisibilityById
  filterMatch: GraphTableFilterMatch
  filterClauses: GraphTableFilterClause[]
  groupBy: string
  sortRules: GraphTableSortRule[]
  rowHeightPreset: GraphTableRowHeightPreset
  columnWidthsPxById: GraphTableColumnWidthsPxById
  columnOrderIds?: string[]
  panelTypography?: PanelTypography
  onRowClicked: (rowId: string) => void
  onSelectionChanged: (selectedRowIds: string[]) => void
}) {
  const model = useGraphTableGridModel({
    columns: props.columns,
    rows: props.rows,
    columnVisibilityById: props.columnVisibilityById,
    filterMatch: props.filterMatch,
    filterClauses: props.filterClauses,
    groupBy: props.groupBy,
    sortRules: props.sortRules,
    columnWidthsPxById: props.columnWidthsPxById,
    columnOrderIds: props.columnOrderIds,
    headerHeight: 28,
    rowHeight: props.rowHeightPreset === 'compact' ? 22 : 28,
    selectedRowIds: props.selectedRowIds,
  })

  const dataCols = React.useMemo(() => model.columns.filter(c => c.kind === 'data'), [model.columns])
  const selectedSet = React.useMemo(() => new Set(props.selectedRowIds), [props.selectedRowIds])

  return (
    <section className="flex-1 min-h-0 min-w-0 max-w-full overflow-auto" aria-label={`${props.tableId} dom table`}>
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className={`${UI_THEME_TOKENS.table.headerBg} ${UI_THEME_TOKENS.table.cellBorder}`}>
            <th className={`sticky left-0 z-20 border-b border-r ${UI_THEME_TOKENS.table.cellBorder} ${UI_THEME_TOKENS.table.headerBg}`} style={{ width: 44 }}>
              <input
                type="checkbox"
                aria-label={model.allSelected ? 'Deselect all rows' : 'Select all rows'}
                checked={model.allSelected}
                onChange={() => {
                  if (model.allSelected) props.onSelectionChanged([])
                  else props.onSelectionChanged(model.allVisibleRowIds)
                }}
              />
            </th>
            <th
              className={`sticky ${UI_RESPONSIVE_CONTENT_START_OFFSET_CLASSNAME} z-20 border-b border-r px-2 text-left ${props.panelTypography?.microLabelClass || ''} ${UI_THEME_TOKENS.table.cellBorder} ${UI_THEME_TOKENS.table.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
              style={{ width: 72 }}
            >
              #
            </th>
            {dataCols.map(col => (
              <th
                key={col.id}
                className={`border-b border-r px-2 text-left ${props.panelTypography?.microLabelClass || ''} ${UI_THEME_TOKENS.table.cellBorder} ${UI_THEME_TOKENS.text.secondary}`}
                style={{ width: col.width }}
              >
                <span className={UI_TEXT_TRUNCATE}>{col.title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={props.panelTypography?.panelTextClass || ''}>
          {model.displayRows.map((item, idx) => {
            if (item.kind === 'group') {
              return (
                <tr key={`g:${item.label}:${idx}`} className={UI_THEME_TOKENS.table.rowBg}>
                  <td colSpan={2 + dataCols.length} className={`border-b px-2 py-1 font-semibold ${UI_THEME_TOKENS.table.cellBorder} ${UI_THEME_TOKENS.text.secondary}`}>
                    <span className={UI_TEXT_TRUNCATE} title={readMarkdownSigilDisplayText(item.label)}>
                      {renderMarkdownSigilInlineText(item.label)} ({item.count})
                    </span>
                  </td>
                </tr>
              )
            }

            const row = item.row
            const selected = selectedSet.has(row.id)
            return (
              <tr
                key={row.id}
                className={`${UI_THEME_TOKENS.table.rowBg} ${selected ? UI_THEME_TOKENS.table.rowSelected : ''} ${UI_THEME_TOKENS.table.rowHover}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => props.onRowClicked(row.id)}
              >
                <td className={`sticky left-0 z-10 border-b border-r ${UI_THEME_TOKENS.table.cellBorder} ${UI_THEME_TOKENS.table.rowBg}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={e => {
                      e.stopPropagation()
                      const next = new Set(props.selectedRowIds)
                      if (next.has(row.id)) next.delete(row.id)
                      else next.add(row.id)
                      props.onSelectionChanged(Array.from(next.values()))
                    }}
                  />
                </td>
                <td
                  className={`sticky ${UI_RESPONSIVE_CONTENT_START_OFFSET_CLASSNAME} z-10 border-b border-r px-2 ${UI_THEME_TOKENS.table.cellBorder} ${UI_THEME_TOKENS.table.rowBg} ${UI_THEME_TOKENS.text.tertiary}`}
                >
                  {String((row as any).__order ?? '')}
                </td>
                {dataCols.map(col => {
                  const raw = (row as any)[col.id]
                  const text = getCellTextByKind(raw, col.dataKind)
                  const displayText = readMarkdownSigilDisplayText(text)
                  return (
                    <td key={col.id} className={`border-b border-r px-2 ${UI_THEME_TOKENS.table.cellBorder} ${UI_THEME_TOKENS.text.primary}`}>
                      <span className={UI_TEXT_TRUNCATE} title={displayText}>{renderMarkdownSigilInlineText(text)}</span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
})
