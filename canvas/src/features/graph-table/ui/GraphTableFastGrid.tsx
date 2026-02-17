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
import { drawGrid, getCellText, hitTest, readGridTheme, type GridTheme } from '@/features/graph-table/ui/fast-grid/canvasGridRender'
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
  const spacerRef = useRef<HTMLElement | null>(null)
  const spacerRafRef = useRef<number | null>(null)
  const themeRef = useRef<GridTheme | null>(null)

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

  const modelRef = useRef(model)
  modelRef.current = model
  const rowHeightRef = useRef(rowHeight)
  rowHeightRef.current = rowHeight
  const headerHeightRef = useRef(headerHeight)
  headerHeightRef.current = headerHeight

  const syncScrollSpacer = React.useCallback(() => {
    if (spacerRafRef.current != null) cancelAnimationFrame(spacerRafRef.current)
    spacerRafRef.current = requestAnimationFrame(() => {
      spacerRafRef.current = null
      const viewportEl = viewportRef.current
      const spacerEl = spacerRef.current
      if (!viewportEl || !spacerEl) return
      const m = modelRef.current
      const viewportW = Math.max(1, viewportEl.clientWidth)
      const viewportH = Math.max(1, viewportEl.clientHeight)
      const targetW = Math.max(viewportW, Math.floor(m.layout.totalWidth))
      const targetH = Math.max(viewportH, Math.floor(m.layout.totalHeight))
      const nextW = `${targetW}px`
      const nextH = `${targetH}px`
      if (spacerEl.style.width !== nextW) spacerEl.style.width = nextW
      if (spacerEl.style.height !== nextH) spacerEl.style.height = nextH
    })
  }, [])

  const scheduleDraw = React.useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const canvas = canvasRef.current
      const viewportEl = viewportRef.current
      if (!canvas || !viewportEl) return
      const m = modelRef.current
      if (!themeRef.current) themeRef.current = readGridTheme(viewportEl)

      scrollRef.current = { left: viewportEl.scrollLeft, top: viewportEl.scrollTop }
      drawGrid({
        canvas,
        viewportEl,
        scrollLeft: scrollRef.current.left,
        scrollTop: scrollRef.current.top,
        rowHeight: rowHeightRef.current,
        headerHeight: headerHeightRef.current,
        layout: m.layout,
        displayRows: m.displayRows,
        selectedSet: m.selectedSet,
        allSelected: m.allSelected,
        someSelected: m.someSelected,
        sortIndexByColumnId: m.sortIndexByColumnId,
        isGroupCollapsed: label => m.collapseSetRef.current.has(label),
        theme: themeRef.current,
      })
    })
  }, [])

  useEffect(() => {
    const viewportEl = viewportRef.current
    if (!viewportEl) return
    const ro = new ResizeObserver(() => {
      themeRef.current = readGridTheme(viewportEl)
      syncScrollSpacer()
      scheduleDraw()
    })
    ro.observe(viewportEl)
    themeRef.current = readGridTheme(viewportEl)
    syncScrollSpacer()
    return () => ro.disconnect()
  }, [scheduleDraw, syncScrollSpacer])

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
    const root = document.documentElement
    const mo = new MutationObserver(() => {
      const viewportEl = viewportRef.current
      if (viewportEl) themeRef.current = readGridTheme(viewportEl)
      scheduleDraw()
    })
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    return () => mo.disconnect()
  }, [scheduleDraw])

  useEffect(() => {
    scheduleDraw()
  }, [model.displayRows, model.layout.totalHeight, model.layout.totalWidth, props.selectedRowIds, props.rowHeightPreset, model.sortIndexByColumnId])

  useEffect(() => {
    syncScrollSpacer()
  }, [model.layout.totalHeight, model.layout.totalWidth, syncScrollSpacer])

  useEffect(() => {
    if (!props.autoScrollToFocusRow) return
    const id = typeof props.focusRowId === 'string' ? props.focusRowId : ''
    if (!id) return
    const viewportEl = viewportRef.current
    if (!viewportEl) return
    const m = modelRef.current
    m.ensureGroupExpandedForRow(id)
    const idx = m.rowIndexById.get(id)
    if (idx == null) return
    const viewportH = Math.max(1, viewportEl.clientHeight - headerHeightRef.current)
    const targetTop = idx * rowHeightRef.current
    const next = clamp(
      targetTop - Math.floor(viewportH / 2),
      0,
      Math.max(0, m.displayRows.length * rowHeightRef.current - viewportH),
    )
    try {
      if (Math.abs(viewportEl.scrollTop - next) <= 1) return
      viewportEl.scrollTop = next
      scrollRef.current = { left: viewportEl.scrollLeft, top: viewportEl.scrollTop }
      scheduleDraw()
    } catch {
      void 0
    }
  }, [props.autoScrollToFocusRow, props.focusRowId, scheduleDraw])

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
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" aria-label="Grid canvas" />
      <section
        ref={el => {
          viewportRef.current = el
        }}
        className={`absolute inset-0 z-10 overflow-auto bg-transparent overscroll-contain ${props.panelTypography?.panelTextClass || ''} ${UI_THEME_TOKENS.text.primary}`}
        aria-label="Grid viewport"
        style={{ scrollbarGutter: 'stable' }}
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
        <section
          className="w-full h-full pointer-events-none"
          aria-hidden="true"
          ref={el => {
            spacerRef.current = el
          }}
          style={{ width: 1, height: 1 }}
        />
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
