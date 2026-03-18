import React from 'react'
import { ArrowLeftRight, Braces, ChevronDown, Hash, Lock, Tag, Text } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { PanelTypography } from '@/lib/ui/panelTypography'
import {
  isGraphDataTableGroupableColumnKey,
  type GraphDataTableColumnKey,
} from '@/features/graph-data-table/graphDataTable'

export const FROZEN_DATA_COLUMN_LEFT = '2rem'
export const FROZEN_RESIZE_TOOLTIP_TEXT = 'Drag to adjust frozen area'

interface FrozenAreaResizeHandleProps {
  onStartDrag?: (clientX: number) => void
  panelTypography: PanelTypography
}

export function FrozenAreaResizeHandle({ onStartDrag, panelTypography }: FrozenAreaResizeHandleProps) {
  return (
    <span className="absolute inset-y-0 right-0 flex items-center">
      <button
        type="button"
        className="group relative h-full w-2 cursor-col-resize"
        title={FROZEN_RESIZE_TOOLTIP_TEXT}
        onMouseDown={event => {
          event.preventDefault()
          event.stopPropagation()
          if (onStartDrag) onStartDrag(event.clientX)
        }}
        aria-label={FROZEN_RESIZE_TOOLTIP_TEXT}
      >
        <span className={`mx-auto h-5 w-3 rounded-full ${UI_THEME_TOKENS.button.activeBg} bg-opacity-70 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100`}>
          <span className={`h-4 border-r ${UI_THEME_TOKENS.button.activeBorder} border-opacity-60`} />
        </span>
        <span className={`pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded ${UI_THEME_TOKENS.tooltip.bg} px-2 py-1 ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.tooltip.text} opacity-0 group-hover:opacity-100`}>
          {FROZEN_RESIZE_TOOLTIP_TEXT}
        </span>
      </button>
    </span>
  )
}

function getHeaderCellIcon(columnKey: GraphDataTableColumnKey) {
  if (columnKey === 'id') return Hash
  if (columnKey === 'label') return Text
  if (columnKey === 'kind') return Tag
  if (columnKey === 'source' || columnKey === 'target') return ArrowLeftRight
  if (String(columnKey).startsWith('prop:') || String(columnKey).startsWith('meta:')) return Braces
  return null
}

interface HeaderCellProps {
  columnKey: GraphDataTableColumnKey
  label: string
  panelTypography: PanelTypography
  headerCellBaseClassName: string
  headerHeightClassName: string
  sortKey: GraphDataTableColumnKey
  sortDir: 'asc' | 'desc'
  freezeFirstDataColumn: 'none' | 'label' | 'id'
  isReordering?: boolean
  dropHint?: 'left' | 'right' | null
  onReorderPointerDown?: (event: React.PointerEvent, key: GraphDataTableColumnKey) => void
  isColumnSelected?: boolean
  onSelectColumn?: (key: GraphDataTableColumnKey) => void
  showFrozenResizeHandle: boolean
  onStartFrozenAreaDrag?: (clientX: number) => void
  width?: number
  onStartColumnResize?: (payload: {
    columnKey: GraphDataTableColumnKey
    clientX: number
    width: number
  }) => void
  onRequestAddFilter: (key: GraphDataTableColumnKey) => void
  onRequestGroupBy: (key: GraphDataTableColumnKey | '') => void
  onRequestHideColumn: (key: GraphDataTableColumnKey) => void
  onRequestSortByColumn: (key: GraphDataTableColumnKey, dir: 'asc' | 'desc') => void
}

export const HeaderCell = React.memo(function HeaderCell({
  columnKey,
  label,
  panelTypography,
  headerCellBaseClassName,
  headerHeightClassName,
  sortKey,
  sortDir,
  freezeFirstDataColumn,
  isReordering,
  dropHint,
  onReorderPointerDown,
  isColumnSelected,
  onSelectColumn,
  showFrozenResizeHandle,
  onStartFrozenAreaDrag,
  width,
  onStartColumnResize,
  onRequestAddFilter,
  onRequestGroupBy,
  onRequestHideColumn,
  onRequestSortByColumn,
}: HeaderCellProps) {
  const isSorted = sortKey === columnKey
  const isGroupable = isGraphDataTableGroupableColumnKey(columnKey)

  const isFrozen =
    (freezeFirstDataColumn === 'label' && columnKey === 'label') ||
    (freezeFirstDataColumn === 'id' && columnKey === 'id')
  const stickyClass = isFrozen ? `sticky z-40 ${UI_THEME_TOKENS.table.headerBg}` : ''

  const cellRef = React.useRef<HTMLTableCellElement>(null)
  const detailsRef = React.useRef<HTMLDetailsElement | null>(null)
  const Icon = getHeaderCellIcon(columnKey)

  const style: React.CSSProperties = {}
  if (freezeFirstDataColumn === 'label' && columnKey === 'label') {
    style.left = FROZEN_DATA_COLUMN_LEFT
  } else if (freezeFirstDataColumn === 'id' && columnKey === 'id') {
    style.left = FROZEN_DATA_COLUMN_LEFT
  }
  if (width != null) {
    style.width = width
    style.minWidth = width
  }

  return (
    <th
      ref={cellRef}
      data-kg-col-key={columnKey}
      className={`${headerCellBaseClassName} sticky top-0 z-30 ${UI_THEME_TOKENS.table.headerBg} ${headerHeightClassName} ${stickyClass} ${panelTypography.microLabelClass} font-semibold ${UI_THEME_TOKENS.table.text} ${
        dropHint === 'left'
          ? 'shadow-[inset_2px_0_0_0_rgba(96,165,250,0.95)]'
          : dropHint === 'right'
            ? 'shadow-[inset_-2px_0_0_0_rgba(96,165,250,0.95)]'
            : ''
      } ${isReordering ? 'opacity-60' : ''} ${isColumnSelected ? 'shadow-[inset_0_-2px_0_0_rgba(59,130,246,0.9)]' : ''}`}
      style={style}
      onContextMenu={event => {
        event.preventDefault()
        if (detailsRef.current) detailsRef.current.open = true
      }}
    >
      <div
        className="h-full flex items-center justify-between gap-2 px-2 group cursor-grab active:cursor-grabbing touch-none select-none"
        onClick={event => {
          const target = event.target
          if (target instanceof HTMLElement && target.closest('.kg-col-resize')) return
          if (target instanceof HTMLElement && target.closest('summary')) return
          if (isReordering) return
          onSelectColumn?.(columnKey)
        }}
        onPointerDown={event => {
          if (!onReorderPointerDown) return
          const target = event.target
          if (target instanceof HTMLElement && target.closest('.kg-col-resize')) return
          if (target instanceof HTMLElement && target.closest('summary')) return
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            void 0
          }
          onReorderPointerDown(event, columnKey)
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {stickyClass ? <Lock className={`w-3 h-3 shrink-0 ${UI_THEME_TOKENS.icon.color}`} aria-hidden="true" /> : null}
          {Icon ? <Icon className={`w-3 h-3 shrink-0 ${UI_THEME_TOKENS.icon.color}`} aria-hidden="true" /> : null}

          <details className="relative min-w-0" ref={detailsRef}>
            <summary
              className={['list-none cursor-pointer flex items-center gap-1 min-w-0', UI_THEME_TOKENS.button.hoverBg].join(' ')}
              aria-label={`Column menu: ${label}`}
            >
              <span className="truncate" data-column-key={columnKey}>
                {label}
              </span>
              <ChevronDown className={['w-3 h-3 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
            </summary>

            <menu
              className={[
                'rounded border shadow-sm p-1 z-20',
                UI_THEME_TOKENS.panel.bg,
                UI_THEME_TOKENS.panel.border,
                'absolute left-0 mt-2 w-[240px]',
              ].join(' ')}
              aria-label={`Column actions: ${label}`}
            >
              <li className="list-none">
                <button
                  type="button"
                  className={['w-full flex items-center justify-between gap-2 px-2 py-2 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                  onClick={() => {
                    onRequestSortByColumn(columnKey, 'asc')
                    if (detailsRef.current) detailsRef.current.open = false
                  }}
                >
                  <span>Sort A→Z</span>
                  {isSorted && sortDir === 'asc' ? (
                    <ChevronDown className={`w-4 h-4 rotate-180 ${UI_THEME_TOKENS.icon.color}`} aria-hidden="true" />
                  ) : null}
                </button>
              </li>
              <li className="list-none">
                <button
                  type="button"
                  className={['w-full flex items-center justify-between gap-2 px-2 py-2 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                  onClick={() => {
                    onRequestSortByColumn(columnKey, 'desc')
                    if (detailsRef.current) detailsRef.current.open = false
                  }}
                >
                  <span>Sort Z→A</span>
                  {isSorted && sortDir === 'desc' ? <ChevronDown className={`w-4 h-4 ${UI_THEME_TOKENS.icon.color}`} aria-hidden="true" /> : null}
                </button>
              </li>
              <li className={['list-none my-1 h-px', UI_THEME_TOKENS.panel.divider].join(' ')} />
              <li className="list-none">
                <button
                  type="button"
                  className={['w-full flex items-center justify-between gap-2 px-2 py-2 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                  onClick={() => {
                    onRequestAddFilter(columnKey)
                    if (detailsRef.current) detailsRef.current.open = false
                  }}
                >
                  <span>Filter by this column</span>
                </button>
              </li>
              {isGroupable ? (
                <li className="list-none">
                  <button
                    type="button"
                    className={['w-full flex items-center justify-between gap-2 px-2 py-2 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                    onClick={() => {
                      onRequestGroupBy(columnKey)
                      if (detailsRef.current) detailsRef.current.open = false
                    }}
                  >
                    <span>Group by this column</span>
                  </button>
                </li>
              ) : null}
              <li className="list-none">
                <button
                  type="button"
                  className={['w-full flex items-center justify-between gap-2 px-2 py-2 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                  onClick={() => {
                    onRequestHideColumn(columnKey)
                    if (detailsRef.current) detailsRef.current.open = false
                  }}
                >
                  <span>Hide column</span>
                </button>
              </li>
            </menu>
          </details>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isSorted ? <span className={`${UI_THEME_TOKENS.table.textSecondary} text-[10px]`}>{sortDir === 'asc' ? 'A→Z' : 'Z→A'}</span> : null}
          {isGroupable ? <span className={`rounded ${UI_THEME_TOKENS.badge.chip} px-1 ${UI_THEME_TOKENS.table.textSecondary}`}>group</span> : null}
        </div>

        <span
          className="absolute inset-y-0 right-0 w-1 cursor-col-resize kg-col-resize"
          onMouseDown={event => {
            if (!onStartColumnResize || !cellRef.current) return
            event.preventDefault()
            event.stopPropagation()
            const rect = cellRef.current.getBoundingClientRect()
            onStartColumnResize({ columnKey, clientX: event.clientX, width: rect.width })
          }}
        />
      </div>
      {showFrozenResizeHandle && (
        <FrozenAreaResizeHandle onStartDrag={onStartFrozenAreaDrag} panelTypography={panelTypography} />
      )}
    </th>
  )
})
