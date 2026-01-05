import React from 'react'
import { DropdownPanel } from '@/lib/ui/overlay'
import { ChevronDown, Lock } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  isGraphDataTableGroupableColumnKey,
  type GraphDataTableColumnKey,
} from '@/features/graph-data-table/graphDataTable'

export const FROZEN_DATA_COLUMN_LEFT = '2.5rem'
export const FROZEN_RESIZE_TOOLTIP_TEXT = 'Drag to adjust frozen area'

interface FrozenAreaResizeHandleProps {
  onStartDrag?: (clientX: number) => void
}

export function FrozenAreaResizeHandle({ onStartDrag }: FrozenAreaResizeHandleProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  return (
    <div className="absolute inset-y-0 right-0 flex items-center">
      <div
        className="group relative h-full w-2 cursor-col-resize"
        title={FROZEN_RESIZE_TOOLTIP_TEXT}
        onMouseDown={event => {
          event.preventDefault()
          event.stopPropagation()
          if (onStartDrag) onStartDrag(event.clientX)
        }}
      >
        <div className="mx-auto h-5 w-3 rounded-full bg-blue-50/70 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="h-4 border-r border-blue-400/60" />
        </div>
        <div className={`pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 ${uiPanelKeyValueTextSizeClass} text-white opacity-0 group-hover:opacity-100`}>
          {FROZEN_RESIZE_TOOLTIP_TEXT}
        </div>
      </div>
    </div>
  )
}

function getHeaderCellLayoutClass(columnKey: GraphDataTableColumnKey): string {
  if (columnKey === 'kind') return 'w-16'
  if (columnKey === 'id') return 'w-52'
  if (columnKey === 'label') return 'w-60'
  if (columnKey === 'properties' || columnKey === 'metadata') return ''
  return 'w-40'
}

interface HeaderCellProps {
  columnKey: GraphDataTableColumnKey
  label: string
  headerCellBaseClassName: string
  headerHeightClassName: string
  sortKey: GraphDataTableColumnKey
  sortDir: 'asc' | 'desc'
  freezeFirstDataColumn: 'none' | 'label' | 'id'
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
  headerCellBaseClassName,
  headerHeightClassName,
  sortKey,
  sortDir,
  freezeFirstDataColumn,
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

  const widthClass = getHeaderCellLayoutClass(columnKey)
  const stickyClass =
    freezeFirstDataColumn === 'label' && columnKey === 'label'
      ? 'sticky z-10 bg-gray-100'
      : freezeFirstDataColumn === 'id' && columnKey === 'id'
        ? 'sticky z-10 bg-gray-100'
        : ''

  const cellRef = React.useRef<HTMLTableCellElement>(null)
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

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
      className={`${headerCellBaseClassName} ${headerHeightClassName} ${widthClass} ${stickyClass} text-xs font-normal text-gray-500`}
      style={style}
      onContextMenu={event => {
        event.preventDefault()
        setIsMenuOpen(true)
      }}
    >
      <div className="flex items-center justify-between gap-1 px-2">
        <div className="flex items-center gap-1 min-w-0">
          {stickyClass && <Lock className="size-3 text-gray-400 shrink-0" />}
          <span className="truncate" data-column-key={columnKey}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isSorted && (
            <span className="text-xs text-gray-500">
              {sortDir === 'asc' ? 'A→Z' : 'Z→A'}
            </span>
          )}
          {isGroupable && (
            <span className="rounded bg-gray-100 px-1 text-xs text-gray-500">group</span>
          )}
          <ChevronDown
            className={`size-3.5 transition-opacity ${
              isSorted ? 'text-gray-600 opacity-100' : 'text-gray-400 opacity-0'
            }`}
          />
        </div>
      <div
        className="absolute inset-y-0 right-0 w-1 cursor-col-resize"
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
      </div>
      {showFrozenResizeHandle && (
        <FrozenAreaResizeHandle onStartDrag={onStartFrozenAreaDrag} />
      )}
      {isMenuOpen && (
        <DropdownPanel
          anchorRef={cellRef}
          open={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          align="bottom-left"
        >
          <div className="bg-white border border-gray-200 rounded shadow-md py-1 text-xs min-w-[180px]">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-1 text-left text-gray-700 hover:bg-gray-100"
              onClick={() => {
                onRequestSortByColumn(columnKey, 'asc')
                setIsMenuOpen(false)
              }}
            >
              <span>Sort A→Z</span>
              {isSorted && sortDir === 'asc' && (
                <ChevronDown className="size-3 rotate-180 text-gray-500" />
              )}
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-1 text-left text-gray-700 hover:bg-gray-100"
              onClick={() => {
                onRequestSortByColumn(columnKey, 'desc')
                setIsMenuOpen(false)
              }}
            >
              <span>Sort Z→A</span>
              {isSorted && sortDir === 'desc' && (
                <ChevronDown className="size-3 text-gray-500" />
              )}
            </button>
            <div className="my-1 h-px bg-gray-100" />
          <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-1 text-left text-gray-700 hover:bg-gray-100"
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
                className="flex w-full items-center justify-between px-3 py-1 text-left text-gray-700 hover:bg-gray-100"
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
              className="flex w-full items-center justify-between px-3 py-1 text-left text-gray-700 hover:bg-gray-100"
              onClick={() => {
                onRequestHideColumn(columnKey)
                setIsMenuOpen(false)
              }}
            >
              <span>Hide column</span>
            </button>
          </div>
        </DropdownPanel>
      )}
    </th>
  )
})
