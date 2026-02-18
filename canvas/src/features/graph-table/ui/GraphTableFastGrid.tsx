import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { binarySearchFloor, clamp } from '@/features/graph-table/ui/fast-grid/fastGridMath'
import { drawGrid, getCellText, hitTest, readGridTheme, type GridTheme } from '@/features/graph-table/ui/fast-grid/canvasGridRender'
import { useGraphTableGridModel } from '@/features/graph-table/ui/fast-grid/useGraphTableGridModel'
import { DateCellEditor, type DateCellEditorState } from '@/features/graph-table/ui/fast-grid/DateCellEditor'

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
  columnOrderIds?: string[]
  onColumnWidthChanged: (columnId: string, widthPx: number) => void
  onRequestReorderColumn: (fromColumnId: string, toColumnId: string, side: 'left' | 'right') => void
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
  const headerScrollableContentRef = useRef<HTMLDivElement | null>(null)
  const headerRafRef = useRef<number | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)
  const [viewportClientWidth, setViewportClientWidth] = useState(0)
  const [editor, setEditor] = useState<(CanvasCellEditorState & { kind: 'text' }) | (DateCellEditorState & { kind: 'date' }) | null>(null)
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const selectedColumnIdRef = useRef<string | null>(null)
  const reorderFromRef = useRef<string | null>(null)
  const reorderHintRef = useRef<{ columnId: string; side: 'left' | 'right' } | null>(null)
  const spacerRef = useRef<HTMLElement | null>(null)
  const spacerRafRef = useRef<number | null>(null)
  const themeRef = useRef<GridTheme | null>(null)

  const [overlayTick, setOverlayTick] = useState(0)
  const overlayRafRef = useRef<number | null>(null)
  const bumpOverlayTick = React.useCallback(() => {
    if (!editor) return
    if (overlayRafRef.current != null) return
    overlayRafRef.current = window.requestAnimationFrame(() => {
      overlayRafRef.current = null
      setOverlayTick(v => v + 1)
    })
  }, [editor])

  const rowHeight = props.rowHeightPreset === 'compact' ? 22 : 28
  const headerHeight = rowHeight

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

  const syncHeaderScroll = React.useCallback((scrollLeft: number) => {
    if (headerRafRef.current != null) cancelAnimationFrame(headerRafRef.current)
    headerRafRef.current = requestAnimationFrame(() => {
      headerRafRef.current = null
      const el = headerScrollableContentRef.current
      if (!el) return
      el.style.transform = `translateX(${-scrollLeft}px)`
    })
  }, [])

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
      setViewportClientWidth(prev => (prev === viewportW ? prev : viewportW))
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
        reorderHint: reorderFromRef.current ? reorderHintRef.current : null,
        selectedColumnId: selectedColumnIdRef.current,
        theme: themeRef.current,
      })
    })
  }, [])

  const computedEditorRect = useMemo(() => {
    void overlayTick
    if (!editor) return null
    const rowId = editor.rowId
    const columnId = editor.columnId
    const rowIndex = model.rowIndexById.get(rowId)
    if (rowIndex == null) return null
    const colIndex = model.layout.scrollable.findIndex(c => c.id === columnId)
    if (colIndex < 0) return null
    const col = model.layout.scrollable[colIndex]
    if (!col) return null
    const x = model.layout.pinnedWidth + (model.layout.scrollableOffsets[colIndex] || 0) - scrollRef.current.left
    const y = headerHeight + rowIndex * rowHeight - scrollRef.current.top
    return { x, y, w: col.width, h: rowHeight }
  }, [editor, headerHeight, model.layout.pinnedWidth, model.layout.scrollable, model.layout.scrollableOffsets, model.rowIndexById, overlayTick, rowHeight])

  useEffect(() => {
    if (!editor) return
    if (computedEditorRect) return
    setEditor(null)
  }, [computedEditorRect, editor])

  useEffect(() => {
    selectedColumnIdRef.current = selectedColumnId
    scheduleDraw()
  }, [scheduleDraw, selectedColumnId])

  useEffect(() => {
    return () => {
      if (headerRafRef.current != null) cancelAnimationFrame(headerRafRef.current)
      headerRafRef.current = null
    }
  }, [])

  useEffect(() => {
    const viewportEl = viewportRef.current
    if (!viewportEl) return
    const ro = new ResizeObserver(() => {
      themeRef.current = readGridTheme(viewportEl)
      syncScrollSpacer()
      scheduleDraw()
      bumpOverlayTick()
    })
    ro.observe(viewportEl)
    themeRef.current = readGridTheme(viewportEl)
    syncScrollSpacer()
    return () => ro.disconnect()
  }, [bumpOverlayTick, scheduleDraw, syncScrollSpacer])

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
    const root = document.documentElement
    const mo = new MutationObserver(() => {
      const viewportEl = viewportRef.current
      if (viewportEl) themeRef.current = readGridTheme(viewportEl)
      scheduleDraw()
      bumpOverlayTick()
    })
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    return () => mo.disconnect()
  }, [bumpOverlayTick, scheduleDraw])

  useEffect(() => {
    scheduleDraw()
  }, [
    model.columns,
    model.displayRows,
    model.layout.totalHeight,
    model.layout.totalWidth,
    props.selectedRowIds,
    props.rowHeightPreset,
    model.sortIndexByColumnId,
    scheduleDraw,
  ])

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

  const headerLayout = useMemo(() => {
    const pinned = model.layout.pinned
    const scrollable = model.layout.scrollable
    const pinnedWidth = model.layout.pinnedWidth
    const scrollableClipW = Math.max(0, viewportClientWidth - pinnedWidth)
    return { pinned, scrollable, pinnedWidth, scrollableClipW }
  }, [model.layout.pinned, model.layout.pinnedWidth, model.layout.scrollable, viewportClientWidth])

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    el.indeterminate = model.someSelected && !model.allSelected
  }, [model.allSelected, model.someSelected])

  return (
    <section className="relative flex-1 min-h-0 overflow-hidden" aria-label={`${props.tableId} fast grid`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 pointer-events-none"
        aria-label="Grid canvas"
        style={{ clipPath: `inset(${headerHeight}px 0px 0px 0px)` }}
      />
      <section
        className={`absolute left-0 top-0 z-20 border-b pointer-events-none ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.panel.bg}`}
        aria-label="Grid header"
        style={{ height: headerHeight, width: viewportClientWidth > 0 ? `${viewportClientWidth}px` : undefined }}
        onWheel={e => {
          const viewportEl = viewportRef.current
          if (!viewportEl) return
          try {
            if (e.deltaX) viewportEl.scrollLeft += e.deltaX
            if (e.deltaY) viewportEl.scrollTop += e.deltaY
            scrollRef.current = { left: viewportEl.scrollLeft, top: viewportEl.scrollTop }
            syncHeaderScroll(viewportEl.scrollLeft)
            scheduleDraw()
            e.preventDefault()
          } catch {
            void 0
          }
        }}
      >
        <section className={`h-full flex items-stretch ${props.panelTypography?.panelTextClass || ''} ${UI_THEME_TOKENS.text.primary}`}>
          <section className="h-full flex items-stretch" style={{ width: headerLayout.pinnedWidth }} aria-label="Pinned columns">
            {headerLayout.pinned.map(col => {
              const selected = selectedColumnIdRef.current === col.id
              const bg = selected ? 'color-mix(in srgb, var(--kg-canvas-accent) 10%, transparent)' : 'transparent'
              if (col.kind === 'select') {
                return (
                  <button
                    key={col.id}
                    type="button"
                    className={`h-full flex items-center justify-center leading-none border-r pointer-events-auto ${UI_THEME_TOKENS.panel.divider}`}
                    style={{ width: col.width, backgroundColor: bg }}
                    onClick={() => {
                      if (model.allSelected) props.onSelectionChanged([])
                      else props.onSelectionChanged(model.allVisibleRowIds)
                    }}
                  >
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={model.allSelected}
                      readOnly
                      aria-label={model.allSelected ? 'Deselect all rows' : 'Select all rows'}
                    />
                  </button>
                )
              }
              return (
                <button
                  key={col.id}
                  type="button"
                  className={`h-full flex items-center leading-none px-2 border-r pointer-events-auto ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.text.secondary}`}
                  style={{ width: col.width, backgroundColor: bg }}
                  onClick={() => {
                    selectedColumnIdRef.current = col.id
                    setSelectedColumnId(col.id)
                    scheduleDraw()
                  }}
                >
                  {col.title}
                </button>
              )
            })}
          </section>

          <section className="h-full overflow-hidden" style={{ width: headerLayout.scrollableClipW }} aria-label="Scrollable columns">
            <div
              ref={el => {
                headerScrollableContentRef.current = el
              }}
              className="h-full flex items-stretch"
              style={{ width: model.layout.totalWidth - headerLayout.pinnedWidth, transform: `translateX(${-scrollRef.current.left}px)` }}
            >
              {headerLayout.scrollable.map(col => {
                const selected = selectedColumnIdRef.current === col.id
                const bg = selected ? 'color-mix(in srgb, var(--kg-canvas-accent) 10%, transparent)' : 'transparent'
                const sortMeta = model.sortIndexByColumnId[col.id]
                return (
                  <section
                    key={col.id}
                    className={`relative h-full flex items-center border-r ${UI_THEME_TOKENS.panel.divider}`}
                    style={{ width: col.width, backgroundColor: bg }}
                  >
                    <button
                      type="button"
                      className={`h-full w-full leading-none px-2 flex items-center justify-between gap-2 pointer-events-auto ${UI_THEME_TOKENS.text.secondary}`}
                      onPointerDown={e => {
                        if (e.button !== undefined && e.button !== 0) return
                        const fromColumnId = col.id
                        const startX = e.clientX
                        const startY = e.clientY
                        let didStartReorder = false
                        selectedColumnIdRef.current = fromColumnId
                        setSelectedColumnId(fromColumnId)
                        scheduleDraw()

                        startPointerDrag({
                          ev: e.nativeEvent,
                          cursor: 'grabbing',
                          shouldStart: down => {
                            if (down.button !== undefined && down.button !== 0) return false
                            return true
                          },
                          onMove: mv => {
                            const dx = mv.clientX - startX
                            const dy = mv.clientY - startY
                            if (!didStartReorder) {
                              if (dx * dx + dy * dy < 25) return
                              didStartReorder = true
                              reorderFromRef.current = fromColumnId
                              reorderHintRef.current = null
                              scheduleDraw()
                            }

                            const viewportEl = viewportRef.current
                            if (!viewportEl) return
                            const clipW = Math.max(1, viewportEl.clientWidth - model.layout.pinnedWidth)
                            const clipRect = viewportEl.getBoundingClientRect()
                            const xInScrollable = mv.clientX - clipRect.left - model.layout.pinnedWidth + scrollRef.current.left
                            if (xInScrollable < 0 || xInScrollable > scrollRef.current.left + clipW + 8) {
                              if (reorderHintRef.current != null) {
                                reorderHintRef.current = null
                                scheduleDraw()
                              }
                              return
                            }

                            const idx = clamp(
                              binarySearchFloor(model.layout.scrollableOffsets, xInScrollable),
                              0,
                              Math.max(0, model.layout.scrollable.length - 1),
                            )
                            const target = model.layout.scrollable[idx]
                            if (!target) {
                              if (reorderHintRef.current != null) {
                                reorderHintRef.current = null
                                scheduleDraw()
                              }
                              return
                            }
                            const start = model.layout.scrollableOffsets[idx] || 0
                            const side: 'left' | 'right' = xInScrollable - start < target.width / 2 ? 'left' : 'right'
                            const prev = reorderHintRef.current
                            if (!prev || prev.columnId !== target.id || prev.side !== side) {
                              reorderHintRef.current = { columnId: target.id, side }
                              scheduleDraw()
                            }
                          },
                          onEnd: () => {
                            const hint = reorderHintRef.current
                            reorderFromRef.current = null
                            reorderHintRef.current = null
                            scheduleDraw()
                            if (!didStartReorder) return
                            if (!hint) return
                            if (!fromColumnId || fromColumnId === hint.columnId) return
                            props.onRequestReorderColumn(fromColumnId, hint.columnId, hint.side)
                          },
                          onCancel: () => {
                            reorderFromRef.current = null
                            reorderHintRef.current = null
                            scheduleDraw()
                          },
                        })
                      }}
                    >
                      <span className="truncate">{col.title}</span>
                      {sortMeta ? (
                        <span className={`${UI_THEME_TOKENS.text.tertiary} text-[10px] font-semibold shrink-0`}>
                          {sortMeta.dir === 'desc' ? `↓${sortMeta.index}` : `↑${sortMeta.index}`}
                        </span>
                      ) : null}
                    </button>
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize pointer-events-auto"
                      onPointerDown={e => {
                        e.stopPropagation()
                        if (e.button !== undefined && e.button !== 0) return
                        startResize(col.id, e.clientX, col.width, e)
                      }}
                      aria-hidden="true"
                    />
                  </section>
                )
              })}
            </div>
          </section>
        </section>
      </section>
      <section
        ref={el => {
          viewportRef.current = el
        }}
        className={`absolute inset-0 z-10 overflow-auto bg-transparent overscroll-contain ${props.panelTypography?.panelTextClass || ''} ${UI_THEME_TOKENS.text.primary}`}
        aria-label="Grid viewport"
        style={{ scrollbarGutter: 'stable' }}
        onWheelCapture={e => e.stopPropagation()}
        onScroll={e => {
          const el = e.currentTarget
          scrollRef.current = { left: el.scrollLeft, top: el.scrollTop }
          syncHeaderScroll(el.scrollLeft)
          scheduleDraw()
          bumpOverlayTick()
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
          const colX =
            model.layout.pinnedWidth + (model.layout.scrollableOffsets[hit.scrollableColIndex] || 0) - scrollRef.current.left
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
          const x =
            model.layout.pinnedWidth + (model.layout.scrollableOffsets[hit.scrollableColIndex] || 0) - scrollRef.current.left
          const y = headerHeight + hit.rowIndex * rowHeight - scrollRef.current.top
          const kind = props.columns.find(c => c.columnId === columnId)?.kind
          if (kind === 'date') {
            setEditor({ kind: 'date', rowId, columnId, initialValue: raw, rect: { x, y, w: hit.col.width, h: rowHeight } })
            return
          }
          setEditor({ kind: 'text', rowId, columnId, value, rect: { x, y, w: hit.col.width, h: rowHeight } })
        }}
        onPointerDown={e => {
          e.stopPropagation()
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
        editor.kind === 'date' ? (
          <DateCellEditor
            state={{ ...editor, rect: computedEditorRect || editor.rect }}
            onCancel={() => setEditor(null)}
            onCommit={value => {
              const current = editor
              setEditor(null)
              props.onCellValueChanged(current.rowId, current.columnId, value)
            }}
          />
        ) : (
          <CanvasCellEditor
            state={{ ...editor, rect: computedEditorRect || editor.rect }}
            onChange={value => setEditor(prev => (prev && prev.kind === 'text' ? { ...prev, value } : prev))}
            onCancel={() => setEditor(null)}
            onCommit={() => {
              const current = editor
              setEditor(null)
              if (current.kind !== 'text') return
              props.onCellValueChanged(current.rowId, current.columnId, current.value)
            }}
          />
        )
      ) : null}
    </section>
  )
}
