import React from 'react'
import { GripVertical, Search as SearchIcon } from 'lucide-react'
import { secondaryButtonClassName } from '@/features/graph-data-table/ui/GraphDataTableUiPrimitives'
import { type GraphDataTableColumnKey } from '@/features/graph-data-table/graphDataTable'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'

export interface FieldsPanelProps {
  panelTitle: string
  fieldsQuery: string
  setFieldsQuery: (next: string) => void
  fieldsPanelColumnKeys: GraphDataTableColumnKey[]
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  isColumnVisible: (key: GraphDataTableColumnKey) => boolean
  setColumnVisibility: (key: GraphDataTableColumnKey, visible: boolean) => void
  draggingColumnKey: GraphDataTableColumnKey | null
  setDraggingColumnKey: (key: GraphDataTableColumnKey | null) => void
  moveColumn: (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => void
  showAllColumns: () => void
  hideAllColumns: () => void
  onClose: () => void
}

export function FieldsPanel({
  panelTitle,
  fieldsQuery,
  setFieldsQuery,
  fieldsPanelColumnKeys,
  columnLabelByKey,
  isColumnVisible,
  setColumnVisibility,
  draggingColumnKey,
  setDraggingColumnKey,
  moveColumn,
  showAllColumns,
  hideAllColumns,
  onClose,
}: FieldsPanelProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const handleDragStart = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, key: GraphDataTableColumnKey) => {
      event.dataTransfer.effectAllowed = 'move'
      setDraggingColumnKey(key)
    },
    [setDraggingColumnKey],
  )

  const handleDragEnd = React.useCallback(() => {
    setDraggingColumnKey(null)
  }, [setDraggingColumnKey])

  const handleDropOnColumn = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, targetKey: GraphDataTableColumnKey) => {
      event.preventDefault()
      if (!draggingColumnKey || draggingColumnKey === targetKey) return
      moveColumn(draggingColumnKey, targetKey)
      setDraggingColumnKey(null)
    },
    [draggingColumnKey, moveColumn, setDraggingColumnKey],
  )

  const handleDragOverColumn = React.useCallback((event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }, [])

  return (
    <div className="z-50 flex max-h-96 w-80 max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4 text-gray-900 shadow-md sm:w-96 md:w-[544px]">
      <div className="mb-2 flex items-center justify-between gap-2 text-[13px]">
        <div className="font-medium">{panelTitle}</div>
        <button type="button" className={secondaryButtonClassName} onClick={onClose}>
          {UI_LABELS.close}
        </button>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon
            className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 ${iconSizeClass}`}
            strokeWidth={uiIconStrokeWidth}
          />
          <input
            value={fieldsQuery}
            onChange={event => setFieldsQuery(event.target.value)}
            placeholder={UI_COPY.searchFieldsPlaceholder}
            className="h-7 w-full rounded-md border border-gray-200 bg-white pl-7 pr-2 text-xs shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          />
        </div>
        <button type="button" className={secondaryButtonClassName} onClick={showAllColumns}>
          {UI_LABELS.showAll}
        </button>
        <button type="button" className={secondaryButtonClassName} onClick={hideAllColumns}>
          {UI_LABELS.hideAll}
        </button>
      </div>
      <div className="flex-1 overflow-auto border border-gray-100 rounded-md bg-gray-50">
        {fieldsPanelColumnKeys.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-gray-500">{UI_COPY.noFieldsMatch}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {fieldsPanelColumnKeys.map(key => {
              const isVisible = isColumnVisible(key)
              const label = columnLabelByKey.get(key) ?? key
              const isDragging = draggingColumnKey === key
              return (
                <label
                  key={key}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 text-xs ${
                    isDragging ? 'bg-blue-50' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-400 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                      draggable
                      onDragStart={event => handleDragStart(event, key)}
                      onDragEnd={handleDragEnd}
                      onDrop={event => handleDropOnColumn(event, key)}
                      onDragOver={handleDragOverColumn}
                    >
                      <GripVertical className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                    </button>
                    <span className="truncate text-gray-900" title={label}>
                      {label}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    checked={isVisible}
                    onChange={event => setColumnVisibility(key, event.target.checked)}
                  />
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
