import React, { useEffect, useRef, useState } from 'react'
import type { GraphColumnDoc, GraphTableId } from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'
import type { PanelTypography } from '@/lib/ui/panelTypography'
import type {
  GraphTableColumnVisibilityById,
  GraphTableColumnWidthsPxById,
  GraphTableFilterClause,
  GraphTableFilterMatch,
  GraphTableRowHeightPreset,
  GraphTableSortRule,
} from '@/features/graph-table/ui/graphTableViewState'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { CanvasCellEditor, type CanvasCellEditorState } from '@/features/graph-table/ui/fast-grid/CanvasCellEditor'
import { clamp } from '@/features/graph-table/ui/fast-grid/fastGridMath'
import { drawGrid, getCellText, hitTest } from '@/features/graph-table/ui/fast-grid/canvasGridRender'
import { useGraphTableGridModel } from '@/features/graph-table/ui/fast-grid/useGraphTableGridModel'

export type GraphTableFastGridProps = {
  tableId: GraphTableId
  columns: GraphColumnDoc[]
  rows: GraphTableGridRow[]
  selectedRowIds: string[]
  focusRowId?: string | null
  autoScrollToFocusRow?: boolean
  columnVisibilityById: GraphTableColumnVisibilityById
  filterMatch: GraphTableFilterMatch
  filterClauses: GraphTableFilterClause[]
  groupBy: string
  sortRules: GraphTableSortRule[]
  rowHeightPreset: GraphTableRowHeightPreset
  columnWidthsPxById: GraphTableColumnWidthsPxById
  onColumnWidthChanged: (columnId: string, widthPx: number) => void
  onRowClicked: (rowId: string) => void
  onSelectionChanged: (selectedRowIds: string[]) => void
  onCellValueChanged: (rowId: string, columnId: string, next: unknown) => void
  panelTypography?: PanelTypography
}

export function GraphTableFastGrid(props: GraphTableFastGridProps) {
  const rafRef = useRef<number | null>(null)
  const scrollRef = useRef({ left: 0, top: 0 })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<HTMLElement | null>(null)
  const [editor, setEditor] = useState<CanvasCellEditorState | null>(null)

  const rowHeight = props.rowHeightPreset === 'compact' ? 22 : 28
  const headerHeight = 28

  const model = useGraphTableGridModel({
    columns: props.columns,
    rows: props.rows,
    columnVisibilityById: props.columnVisibilityById,
    filterMatch: props.filterMatch,
    filterClauses: props.filterClauses,
    groupBy: props.groupBy,
    sortRules: props.sortRules,
    columnWidthsPxById: props.columnWidthsPxById,
    headerHeight,
    rowHeight,
    selectedRowIds: props.selectedRowIds,
  })

  const scheduleDraw = () => {
    if (rafRef.current != null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const canvas = canvasRef.current
      const viewportEl = viewportRef.current
      if (!canvas || !viewportEl) return
      drawGrid({
        canvas,
        viewportEl,
        scrollLeft: scrollRef.current.left,
        scrollTop: scrollRef.current.top,
        rowHeight,
        headerHeight,
        layout: model.layout,
        displayRows: model.displayRows,
        selectedSet: model.selectedSet,
        allSelected: model.allSelected,
        someSelected: model.someSelected,
        sortIndexByColumnId: model.sortIndexByColumnId,
        isGroupCollapsed: label => model.collapseSetRef.current.has(label),
      })
    })
  }

  useEffect(() => {
    const viewportEl = viewportRef.current
    if (!viewportEl) return
    const ro = new ResizeObserver(() => scheduleDraw())
    ro.observe(viewportEl)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    scheduleDraw()
  }, [model.displayRows, model.layout.totalHeight, model.layout.totalWidth, props.selectedRowIds, props.rowHeightPreset, model.sortIndexByColumnId])

  useEffect(() => {
    if (!props.autoScrollToFocusRow) return
    const id = typeof props.focusRowId === 'string' ? props.focusRowId : ''
    if (!id) return
    const viewportEl = viewportRef.current
    if (!viewportEl) return
    model.ensureGroupExpandedForRow(id)
    const idx = model.rowIndexById.get(id)
    if (idx == null) return
    const viewportH = Math.max(1, viewportEl.clientHeight - headerHeight)
    const targetTop = idx * rowHeight
    const next = clamp(targetTop - Math.floor(viewportH / 2), 0, Math.max(0, model.displayRows.length * rowHeight - viewportH))
    try {
      viewportEl.scrollTop = next
      scrollRef.current = { left: viewportEl.scrollLeft, top: viewportEl.scrollTop }
      scheduleDraw()
    } catch {
      void 0
    }
  }, [model.displayRows.length, headerHeight, props.autoScrollToFocusRow, props.focusRowId, model, rowHeight])

  const startResize = (columnId: string, startX: number, startWidth: number, ev: React.PointerEvent) => {
    let pending = startWidth
    startPointerDrag({
      ev: ev.nativeEvent,
      cursor: 'col-resize',
      shouldStart: down => {
        if (down.button !== undefined && down.button !== 0) return false
        return true
      },
      onMove: mv => {
        const dx = mv.clientX - startX
        pending = Math.max(80, Math.min(720, Math.round(startWidth + dx)))
        props.onColumnWidthChanged(columnId, pending)
      },
      onEnd: () => props.onColumnWidthChanged(columnId, pending),
      onCancel: () => props.onColumnWidthChanged(columnId, pending),
    })
  }

  return (
    <section className="relative flex-1 min-h-0 overflow-hidden" aria-label={`${props.tableId} fast grid`}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-label="Grid canvas" />
      <section
        ref={el => {
          viewportRef.current = el
        }}
        className={`absolute inset-0 overflow-auto ${props.panelTypography?.panelTextClass || ''} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.panel.bg}`}
        aria-label="Grid viewport"
        onWheelCapture={e => e.stopPropagation()}
        onPointerDownCapture={e => e.stopPropagation()}
        onScroll={e => {
          const el = e.currentTarget
          scrollRef.current = { left: el.scrollLeft, top: el.scrollTop }
          scheduleDraw()
        }}
        onPointerMove={e => {
          const el = e.currentTarget
          const canvas = canvasRef.current
          if (!canvas) return
          const hit = hitTest({
            clientX: e.clientX,
            clientY: e.clientY,
            viewportEl: el,
            scrollLeft: scrollRef.current.left,
            scrollTop: scrollRef.current.top,
            rowHeight,
            headerHeight,
            layout: model.layout,
            displayRows: model.displayRows,
          })
          if (!hit || !hit.inHeader || hit.col?.kind !== 'data' || hit.scrollableColIndex < 0) {
            el.style.cursor = 'default'
            return
          }
          const colX = model.layout.pinnedWidth + (model.layout.scrollableOffsets[hit.scrollableColIndex] || 0) - scrollRef.current.left
          const nearRight = hit.x >= colX + hit.col.width - 6 && hit.x <= colX + hit.col.width + 2
          el.style.cursor = nearRight ? 'col-resize' : 'default'
        }}
        onDoubleClick={e => {
          const el = e.currentTarget
          const hit = hitTest({
            clientX: e.clientX,
            clientY: e.clientY,
            viewportEl: el,
            scrollLeft: scrollRef.current.left,
            scrollTop: scrollRef.current.top,
            rowHeight,
            headerHeight,
            layout: model.layout,
            displayRows: model.displayRows,
          })
          if (!hit || hit.inHeader) return
          if (!hit.rowItem || hit.rowItem.kind !== 'row') return
          if (!hit.col || hit.col.kind !== 'data' || !hit.col.editable) return
          if (hit.scrollableColIndex < 0) return
          const rowId = hit.rowItem.row.id
          const columnId = hit.col.id
          const raw = (hit.rowItem.row as unknown as Record<string, unknown>)[columnId]
          const value = getCellText(raw)
          const x = model.layout.pinnedWidth + (model.layout.scrollableOffsets[hit.scrollableColIndex] || 0) - scrollRef.current.left
          const y = headerHeight + hit.rowIndex * rowHeight - scrollRef.current.top
          setEditor({ rowId, columnId, value, rect: { x, y, w: hit.col.width, h: rowHeight } })
        }}
        onPointerDown={e => {
          const el = e.currentTarget
          const hit = hitTest({
            clientX: e.clientX,
            clientY: e.clientY,
            viewportEl: el,
            scrollLeft: scrollRef.current.left,
            scrollTop: scrollRef.current.top,
            rowHeight,
            headerHeight,
            layout: model.layout,
            displayRows: model.displayRows,
          })
          if (!hit) return
          if (editor) setEditor(null)

          if (hit.inHeader) {
            if (hit.col?.kind === 'select') {
              if (model.allSelected) props.onSelectionChanged([])
              else props.onSelectionChanged(model.allVisibleRowIds)
              return
            }
            if (hit.col?.kind === 'data' && hit.scrollableColIndex >= 0) {
              const colX = model.layout.pinnedWidth + (model.layout.scrollableOffsets[hit.scrollableColIndex] || 0) - scrollRef.current.left
              const nearRight = hit.x >= colX + hit.col.width - 6 && hit.x <= colX + hit.col.width + 2
              if (nearRight) startResize(hit.col.id, e.clientX, hit.col.width, e)
            }
            return
          }

          if (!hit.rowItem) return
          if (hit.rowItem.kind === 'group') {
            model.toggleGroupCollapsed(hit.rowItem.label)
            return
          }

          const rowId = hit.rowItem.row.id
          if (hit.col?.kind === 'select') {
            const next = new Set(props.selectedRowIds)
            if (next.has(rowId)) next.delete(rowId)
            else next.add(rowId)
            props.onSelectionChanged(Array.from(next.values()))
            return
          }
          props.onRowClicked(rowId)
        }}
      >
        <section style={{ width: model.layout.totalWidth, height: model.layout.totalHeight }} aria-hidden="true" />
      </section>
      {editor ? (
        <CanvasCellEditor
          state={editor}
          onChange={value => setEditor(prev => (prev ? { ...prev, value } : prev))}
          onCancel={() => setEditor(null)}
          onCommit={() => {
            const current = editor
            setEditor(null)
            props.onCellValueChanged(current.rowId, current.columnId, current.value)
          }}
        />
      ) : null}
    </section>
  )
}
