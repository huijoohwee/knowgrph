import React from 'react'
import { DropdownPanel } from '@/lib/ui/overlay'
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
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
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
      className={`${headerCellBaseClassName} sticky top-0 z-30 ${UI_THEME_TOKENS.table.headerBg} ${headerHeightClassName} ${stickyClass} ${panelTypography.microLabelClass} font-normal ${UI_THEME_TOKENS.text.tertiary} ${
        dropHint === 'left'
          ? 'shadow-[inset_2px_0_0_0_rgba(96,165,250,0.95)]'
          : dropHint === 'right'
            ? 'shadow-[inset_-2px_0_0_0_rgba(96,165,250,0.95)]'
            : ''
      } ${isReordering ? 'opacity-60' : ''} ${isColumnSelected ? 'shadow-[inset_0_-2px_0_0_rgba(59,130,246,0.9)]' : ''}`}
      style={style}
      onContextMenu={event => {
        event.preventDefault()
        setIsMenuOpen(true)
      }}
    >
      <span
        className="flex items-center justify-between gap-1 px-2 group cursor-grab active:cursor-grabbing touch-none select-none"
        onClick={event => {
          const target = event.target
          if (target instanceof HTMLElement && target.closest('.kg-col-resize')) return
          if (target instanceof HTMLElement && target.closest('.kg-col-menu')) return
          if (isReordering) return
          onSelectColumn?.(columnKey)
        }}
        onPointerDown={event => {
          if (!onReorderPointerDown) return
          const target = event.target
          if (target instanceof HTMLElement && target.closest('.kg-col-resize')) return
          if (target instanceof HTMLElement && target.closest('.kg-col-menu')) return
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            void 0
          }
          onReorderPointerDown(event, columnKey)
        }}
      >
        <span className="flex items-center gap-1 min-w-0">
          {stickyClass && <Lock className={`size-3 ${UI_THEME_TOKENS.text.tertiary} shrink-0`} />}
          {Icon && <Icon className={`size-3 ${UI_THEME_TOKENS.text.tertiary} shrink-0`} />}
          <span className="truncate" data-column-key={columnKey}>
            {label}
          </span>
        </span>
        <span className="flex items-center gap-1">
          {isSorted && (
            <span className={`${UI_THEME_TOKENS.text.tertiary}`}>
              {sortDir === 'asc' ? 'A→Z' : 'Z→A'}
            </span>
          )}
          {isGroupable && (
            <span className={`rounded ${UI_THEME_TOKENS.badge.chip} px-1 ${UI_THEME_TOKENS.text.tertiary}`}>group</span>
          )}
          <button
            type="button"
            className="kg-col-menu inline-flex items-center"
            onPointerDown={e => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              setIsMenuOpen(true)
            }}
            aria-label="Column menu"
          >
            <ChevronDown
              className={`size-3.5 transition-opacity ${UI_THEME_TOKENS.text.tertiary} opacity-0 group-hover:opacity-100 ${
                isSorted ? `${UI_THEME_TOKENS.text.secondary} opacity-100` : ''
              }`}
            />
          </button>
        </span>
        <span
          className="absolute inset-y-0 right-0 w-1 cursor-col-resize kg-col-resize"
          onMouseDown={event => {
            if (!onStartColumnResize || !cellRef.current) return
            event.preventDefault()
            event.stopPropagation()
            const rect = cellRef.current.getBoundingClientRect()
            onStartColumnResize({
              columnKey,
              clientX: event.clientX,
              width: rect.width,
            })
          }}
        />
      </span>
      {showFrozenResizeHandle && (
        <FrozenAreaResizeHandle onStartDrag={onStartFrozenAreaDrag} panelTypography={panelTypography} />
      )}
      {isMenuOpen && (
        <DropdownPanel
          anchorRef={cellRef}
          open={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          align="bottom-left"
        >
          <menu className={`${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md py-1 min-w-[180px] list-none m-0 p-0 ${panelTypography.microLabelClass}`}>
            <button
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1 text-left ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.table.rowHover}`}
              onClick={() => {
                onRequestSortByColumn(columnKey, 'asc')
                setIsMenuOpen(false)
              }}
            >
              <span>Sort A→Z</span>
              {isSorted && sortDir === 'asc' && (
                <ChevronDown className={`size-3 rotate-180 ${UI_THEME_TOKENS.text.tertiary}`} />
              )}
            </button>
            <button
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1 text-left ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.table.rowHover}`}
              onClick={() => {
                onRequestSortByColumn(columnKey, 'desc')
                setIsMenuOpen(false)
              }}
            >
              <span>Sort Z→A</span>
              {isSorted && sortDir === 'desc' && (
                <ChevronDown className={`size-3 ${UI_THEME_TOKENS.text.tertiary}`} />
              )}
            </button>
            <hr className={`my-1 border-0 h-px ${UI_THEME_TOKENS.panel.divider}`} />
          <button
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1 text-left ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.table.rowHover}`}
              onClick={() => {
                onRequestAddFilter(columnKey)
                setIsMenuOpen(false)
              }}
            >
              <span>Filter by this column</span>
          </button>
            {isGroupable && (
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 py-1 text-left ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.table.rowHover}`}
                onClick={() => {
                  onRequestGroupBy(columnKey)
                  setIsMenuOpen(false)
                }}
              >
                <span>Group by this column</span>
              </button>
            )}
            <button
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1 text-left ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.table.rowHover}`}
              onClick={() => {
                onRequestHideColumn(columnKey)
                setIsMenuOpen(false)
              }}
            >
              <span>Hide column</span>
            </button>
          </menu>
        </DropdownPanel>
      )}
    </th>
  )
})
