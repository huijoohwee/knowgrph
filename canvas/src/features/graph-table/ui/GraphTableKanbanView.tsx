import React from 'react'
import type { GraphColumnDoc, GraphTableId } from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'
import type {
  GraphTableColumnVisibilityById,
  GraphTableFilterClause,
  GraphTableFilterMatch,
  GraphTableSortRule,
} from '@/features/graph-table/ui/graphTableViewState'
import { useGraphTableGridModel } from '@/features/graph-table/ui/fast-grid/useGraphTableGridModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { UI_COLOR_PRIMARY_BLUE_INDICATOR } from '@/features/toolbar/ui/toolbarStyles'
import { useKanbanDragAndDrop } from '@/features/markdown/ui/kanban/useKanbanDragAndDrop'
import { KanbanCardDropPreview, KanbanLaneDropPreview } from '@/features/markdown/ui/kanban/KanbanDropPreview'
import { buildKanbanCardDropIntentLabel, buildKanbanDragStatusText, buildKanbanLaneDropIntentLabel } from '@/features/markdown/ui/kanban/kanbanDragIntent'
import { buildKanbanDropOutcomeText, isKanbanMoveNoOp } from '@/features/markdown/ui/kanban/kanbanMoveOutcomes'
import { reorderKanbanRowIds, resolveKanbanGroupOrder } from '@/features/markdown/ui/kanban/kanbanReorder'
import { getKanbanCardDragVisualState, getKanbanLaneDragVisualState } from '@/features/markdown/ui/kanban/kanbanDragVisualState'

const EMPTY_COLUMN_WIDTHS: Record<string, number> = {}
const EMPTY_LANE_LABEL = '(empty)'

type LaneModel = {
  id: string
  label: string
  rows: readonly GraphTableGridRow[]
}

const getRowTitle = (row: GraphTableGridRow): string => {
  const anyRow = row as unknown as Record<string, unknown>
  const title = typeof anyRow.title === 'string' ? anyRow.title.trim() : ''
  if (title) return title
  const label = typeof anyRow.label === 'string' ? anyRow.label.trim() : ''
  if (label) return label
  const name = typeof anyRow.name === 'string' ? anyRow.name.trim() : ''
  if (name) return name
  const heading = typeof anyRow.heading === 'string' ? anyRow.heading.trim() : ''
  if (heading) return heading
  return row.id
}

const getRowMeta = (row: GraphTableGridRow, tableId: GraphTableId): string => {
  const anyRow = row as unknown as Record<string, unknown>
  if (tableId === 'edges') {
    const source = typeof anyRow.source === 'string' ? anyRow.source.trim() : ''
    const target = typeof anyRow.target === 'string' ? anyRow.target.trim() : ''
    if (source || target) return [source, target].filter(Boolean).join(' → ')
  }
  return ''
}

export const GraphTableKanbanView = React.memo(function GraphTableKanbanView(props: {
  tableId: GraphTableId
  columns: GraphColumnDoc[]
  rows: GraphTableGridRow[]
  columnVisibilityById: GraphTableColumnVisibilityById
  filterMatch: GraphTableFilterMatch
  filterClauses: GraphTableFilterClause[]
  groupBy: string
  sortRules: GraphTableSortRule[]
  columnOrderIds?: string[]
  selectedRowIds: readonly string[]
  onRowClicked: (rowId: string) => void
  onMoveRowToGroup?: (args: {
    rowId: string
    columnId: string
    nextValue: string
    orderedRowIds: readonly string[]
  }) => void
}) {
  const typography = usePanelTypography()
  const selectedSet = React.useMemo(() => new Set(props.selectedRowIds), [props.selectedRowIds])
  const boardScrollRef = React.useRef<HTMLElement>(null)
  const laneScrollElementsRef = React.useRef(new Map<string, HTMLUListElement>())

  const { displayRows } = useGraphTableGridModel({
    columns: props.columns,
    rows: props.rows,
    columnVisibilityById: props.columnVisibilityById,
    filterMatch: props.filterMatch,
    filterClauses: props.filterClauses,
    groupBy: props.groupBy,
    sortRules: props.sortRules,
    columnWidthsPxById: EMPTY_COLUMN_WIDTHS,
    columnOrderIds: props.columnOrderIds,
    headerHeight: 32,
    rowHeight: 32,
    selectedRowIds: Array.from(selectedSet),
  })

  const lanes = React.useMemo<LaneModel[]>(() => {
    if (!props.groupBy) {
      const rows = displayRows.filter(r => r.kind === 'row').map(r => r.row)
      return [{ id: 'all', label: 'All', rows }]
    }

    const byLabel = new Map<string, GraphTableGridRow[]>()
    for (const item of displayRows) {
      if (item.kind !== 'row') continue
      const label = item.groupLabel || EMPTY_LANE_LABEL
      const existing = byLabel.get(label)
      if (existing) existing.push(item.row)
      else byLabel.set(label, [item.row])
    }
    const encounteredGroupOrder = Array.from(byLabel.keys())
    const laneOrder = resolveKanbanGroupOrder({
      configuredGroupOrder: null,
      encounteredGroupOrder,
    })
    return laneOrder.map(label => ({ id: label, label, rows: byLabel.get(label) || [] }))
  }, [displayRows, props.columns, props.groupBy])

  const rowIdToGroupKey = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const lane of lanes) {
      for (const row of lane.rows) map.set(row.id, lane.id)
    }
    return map
  }, [lanes])
  const groupToRowIds = React.useMemo(() => {
    const map = new Map<string, readonly string[]>()
    for (const lane of lanes) {
      map.set(lane.id, lane.rows.map(row => row.id))
    }
    return map
  }, [lanes])

  const orderedRowIds = React.useMemo(() => props.rows.map(row => row.id), [props.rows])
  const rowIdToTitle = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const row of props.rows) {
      map.set(row.id, getRowTitle(row))
    }
    return map
  }, [props.rows])

  const kanbanDrag = useKanbanDragAndDrop({
    enabled: !!props.groupBy && typeof props.onMoveRowToGroup === 'function',
    getBoardScrollElement: () => boardScrollRef.current,
    getLaneScrollElement: groupKey => laneScrollElementsRef.current.get(groupKey) || null,
    isNoOpMove: move => isKanbanMoveNoOp({
      groupToRowIds,
      draggedRowId: move.rowId,
      sourceGroupKey: move.sourceGroupKey,
      targetGroupKey: move.targetGroupKey,
      targetRowId: move.targetRowId,
      position: move.position,
    }),
    buildOutcomeMessage: ({ kind, move, sourceGroupKey, blockedReason }) => buildKanbanDropOutcomeText({
      kind,
      sourceLaneLabel: sourceGroupKey || move?.sourceGroupKey || null,
      targetLaneLabel: move?.targetGroupKey || null,
      targetCardLabel: move?.targetRowId ? rowIdToTitle.get(move.targetRowId) || move.targetRowId : null,
      blockedReason,
    }),
    onCommitMove: ({ rowId, targetGroupKey, targetRowId, position }) => {
      if (!props.groupBy || !props.onMoveRowToGroup) return
      const nextOrderedRowIds = reorderKanbanRowIds({
        orderedRowIds,
        availableRowIds: props.rows.map(row => row.id),
        rowIdToGroupKey,
        draggedRowId: rowId,
        targetGroupKey,
        targetRowId,
        position,
      })
      props.onMoveRowToGroup({
        rowId,
        columnId: props.groupBy,
        nextValue: targetGroupKey === EMPTY_LANE_LABEL ? '' : targetGroupKey,
        orderedRowIds: nextOrderedRowIds,
      })
    },
  })

  const handleKeyboardMove = React.useCallback((args: { rowId: string; direction: 'up' | 'down' | 'left' | 'right' }): boolean => {
    if (!props.groupBy || !props.onMoveRowToGroup) return false
    const currentGroupKey = rowIdToGroupKey.get(args.rowId) || EMPTY_LANE_LABEL
    const currentLane = lanes.find(lane => lane.id === currentGroupKey) || null
    if (!currentLane) return false
    const currentIndex = currentLane.rows.findIndex(row => row.id === args.rowId)
    if (currentIndex < 0) return false

    if (args.direction === 'up' || args.direction === 'down') {
      if (args.direction === 'up' && currentIndex === 0) {
        kanbanDrag.reportBlockedMove({
          rowId: args.rowId,
          sourceGroupKey: currentLane.id,
          reason: 'start-of-lane',
        })
        return true
      }
      if (args.direction === 'down' && currentIndex === currentLane.rows.length - 1) {
        kanbanDrag.reportBlockedMove({
          rowId: args.rowId,
          sourceGroupKey: currentLane.id,
          reason: 'end-of-lane',
        })
        return true
      }
      const delta = args.direction === 'up' ? -1 : 1
      const neighbor = currentLane.rows[currentIndex + delta] || null
      kanbanDrag.commitMove({
        rowId: args.rowId,
        sourceGroupKey: currentLane.id,
        targetGroupKey: currentLane.id,
        targetRowId: neighbor?.id ?? null,
        position: neighbor ? (args.direction === 'up' ? 'before' : 'after') : 'end',
      })
      return true
    }

    const laneIndex = lanes.findIndex(lane => lane.id === currentLane.id)
    const nextLane = lanes[laneIndex + (args.direction === 'left' ? -1 : 1)] || null
    if (!nextLane) {
      kanbanDrag.reportBlockedMove({
        rowId: args.rowId,
        sourceGroupKey: currentLane.id,
        reason: args.direction === 'left' ? 'start-of-board' : 'end-of-board',
      })
      return true
    }
    kanbanDrag.commitMove({
      rowId: args.rowId,
      sourceGroupKey: currentLane.id,
      targetGroupKey: nextLane.id,
      targetRowId: null,
      position: 'end',
    })
    return true
  }, [kanbanDrag, lanes, props.groupBy, props.onMoveRowToGroup, rowIdToGroupKey])

  const activeDragStatusText = buildKanbanDragStatusText({
    sourceLaneLabel: kanbanDrag.dragSourceGroupKey,
    targetLaneLabel: kanbanDrag.dragOverGroupKey,
    targetCardLabel: kanbanDrag.dragOverRowId ? rowIdToTitle.get(kanbanDrag.dragOverRowId) || kanbanDrag.dragOverRowId : null,
    position: kanbanDrag.dragOverPosition,
    isDragging: kanbanDrag.draggingRowId !== null,
  })
  const statusPillText = activeDragStatusText || kanbanDrag.dragOutcomeMessage
  const liveRegionKey = [
    kanbanDrag.dragOutcomeSequence,
    kanbanDrag.draggingRowId || '',
    kanbanDrag.dragOverGroupKey || '',
    kanbanDrag.dragOverRowId || '',
    kanbanDrag.dragOverPosition,
    statusPillText || '',
  ].join(':')

  return (
    <section ref={boardScrollRef} className="flex-1 min-h-0 min-w-0 max-w-full overflow-x-auto overflow-y-auto" aria-label="Graph Data Table Kanban view">
      <div key={liveRegionKey} className="sr-only" aria-live="polite">{statusPillText}</div>
      {props.onMoveRowToGroup ? (
        <div className="flex items-center justify-between gap-3 px-3 pt-3">
          <div className={['min-h-[28px] text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>
            {statusPillText ? (
              <span className={['inline-flex items-center rounded-full border px-2.5 py-1', UI_THEME_TOKENS.panel.border].join(' ')}>
                {statusPillText}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="min-h-0 min-w-0 max-w-full flex items-start gap-3 p-3" role="list">
        {lanes.map(lane => {
          const laneDragVisualState = getKanbanLaneDragVisualState({
            hasActiveDrag: kanbanDrag.draggingRowId !== null,
            isDragOver: kanbanDrag.dragOverGroupKey === lane.id && kanbanDrag.dragSourceGroupKey !== lane.id,
            isSourceLane: kanbanDrag.dragSourceGroupKey === lane.id,
            isCommitFlash: kanbanDrag.commitFlashGroupKey === lane.id,
          })
          return (
          <section
            key={lane.id}
            className={[
              'kg-graph-table-kanban-lane relative shrink-0 rounded border flex flex-col max-h-full overflow-hidden transition-colors',
              laneDragVisualState.className,
              UI_THEME_TOKENS.panel.border,
              UI_THEME_TOKENS.panel.bg,
            ].join(' ')}
            style={laneDragVisualState.style}
            aria-label={`Lane ${readMarkdownSigilDisplayText(lane.label)}`}
            onDragEnter={kanbanDrag.createLaneDropProps(lane.id).onDragEnter}
            onDragOver={kanbanDrag.createLaneDropProps(lane.id).onDragOver}
            onDragLeave={kanbanDrag.createLaneDropProps(lane.id).onDragLeave}
            onDrop={kanbanDrag.createLaneDropProps(lane.id).onDrop}
          >
            {kanbanDrag.dragOverGroupKey === lane.id && kanbanDrag.dragSourceGroupKey !== lane.id ? (
              <div className="absolute inset-x-0 top-0 h-[2px]" style={{ backgroundColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }} aria-hidden="true" />
            ) : null}
            <header className={['px-3 py-2 border-b', UI_THEME_TOKENS.panel.border].join(' ')}>
              <div className={['flex min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden', typography.microLabelClass].join(' ')}>
                <h2 className={['min-w-0 font-medium', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')} title={readMarkdownSigilDisplayText(lane.label)}>
                  {renderMarkdownSigilInlineText(lane.label)}
                </h2>
                <output className={UI_THEME_TOKENS.text.tertiary}>{lane.rows.length}</output>
              </div>
            </header>

            <ul
              ref={element => {
                if (element) {
                  laneScrollElementsRef.current.set(lane.id, element)
                  return
                }
                laneScrollElementsRef.current.delete(lane.id)
              }}
              className="flex-1 min-h-0 overflow-y-auto list-none m-0 p-2 flex flex-col gap-2 max-h-[min(65vh,720px)]"
              aria-label={`${readMarkdownSigilDisplayText(lane.label)} cards`}
            >
              {lane.rows.map(row => {
                const selected = selectedSet.has(row.id)
                const title = getRowTitle(row)
                const displayTitle = readMarkdownSigilDisplayText(title)
                const meta = getRowMeta(row, props.tableId)
                const displayMeta = readMarkdownSigilDisplayText(meta)
                const cardDragVisualState = getKanbanCardDragVisualState({
                  hasActiveDrag: kanbanDrag.draggingRowId !== null,
                  isDragging: kanbanDrag.draggingRowId === row.id,
                  isDropTarget: kanbanDrag.dragOverRowId === row.id,
                  isCommitFlash: kanbanDrag.commitFlashRowId === row.id,
                })
                return (
                  <li key={row.id} className="list-none">
                    <button
                      ref={element => {
                        kanbanDrag.registerFocusableRowElement({
                          rowId: row.id,
                          element,
                        })
                      }}
                      type="button"
                      className={[
                        'group relative w-full min-w-0 max-w-full overflow-hidden text-left rounded border px-3 py-2 transition-transform transition-shadow duration-150 ease-out',
                        typography.microLabelClass,
                        cardDragVisualState.className,
                        kanbanDrag.draggingRowId !== row.id ? 'hover:-translate-y-[1px] active:translate-y-0' : '',
                        selected ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
                        UI_THEME_TOKENS.panel.border,
                      ].join(' ')}
                      style={cardDragVisualState.style}
                      aria-current={selected ? 'true' : undefined}
                      aria-grabbed={kanbanDrag.draggingRowId === row.id}
                      title={displayTitle}
                      draggable={!!props.groupBy && typeof props.onMoveRowToGroup === 'function'}
                      onDragStart={kanbanDrag.createCardDragProps({ rowId: row.id, groupKey: lane.id }).onDragStart}
                      onDragEnd={kanbanDrag.createCardDragProps({ rowId: row.id, groupKey: lane.id }).onDragEnd}
                      onDragEnter={kanbanDrag.createCardDropProps({ rowId: row.id, groupKey: lane.id }).onDragEnter}
                      onDragOver={kanbanDrag.createCardDropProps({ rowId: row.id, groupKey: lane.id }).onDragOver}
                      onDragLeave={kanbanDrag.createCardDropProps({ rowId: row.id, groupKey: lane.id }).onDragLeave}
                      onDrop={kanbanDrag.createCardDropProps({ rowId: row.id, groupKey: lane.id }).onDrop}
                      onKeyDown={event => {
                        if (!props.onMoveRowToGroup || (!event.altKey && !event.metaKey)) return
                        const direction =
                          event.key === 'ArrowUp'
                            ? 'up'
                            : event.key === 'ArrowDown'
                              ? 'down'
                              : event.key === 'ArrowLeft'
                                ? 'left'
                                : event.key === 'ArrowRight'
                                  ? 'right'
                                  : null
                        if (!direction) return
                        const handled = handleKeyboardMove({ rowId: row.id, direction })
                        if (!handled) return
                        event.preventDefault()
                      }}
                      onClick={() => {
                        props.onRowClicked(row.id)
                      }}
                    >
                      {kanbanDrag.dragOverRowId === row.id ? (
                        <KanbanCardDropPreview
                          position={kanbanDrag.dragOverPosition}
                          label={buildKanbanCardDropIntentLabel({
                            position: kanbanDrag.dragOverPosition,
                            targetCardLabel: rowIdToTitle.get(row.id) || row.id,
                            targetLaneLabel: lane.label,
                          })}
                        />
                      ) : null}
                      <div className={['font-medium', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>{renderMarkdownSigilInlineText(title)}</div>
                      {meta ? (
                        <div className={['mt-1', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.tertiary].join(' ')} title={displayMeta}>
                          {renderMarkdownSigilInlineText(meta)}
                        </div>
                      ) : null}
                      <div className={['mt-1', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.tertiary].join(' ')}>{row.id}</div>
                    </button>
                  </li>
                )
              })}
              {kanbanDrag.draggingRowId !== null && kanbanDrag.dragOverGroupKey === lane.id && kanbanDrag.dragOverRowId === null ? (
                <li className="list-none">
                  <KanbanLaneDropPreview label={buildKanbanLaneDropIntentLabel({ targetLaneLabel: lane.label })} compact />
                </li>
              ) : null}
            </ul>
          </section>
          )
        })}
      </div>
    </section>
  )
})
