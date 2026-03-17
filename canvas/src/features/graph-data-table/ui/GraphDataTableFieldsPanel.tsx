import React from 'react'
import { GripVertical, Search as SearchIcon } from 'lucide-react'
import { secondaryButtonClassName } from '@/features/graph-data-table/ui/GraphDataTableUiPrimitives'
import { type GraphDataTableColumnKey } from '@/features/graph-data-table/graphDataTable'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'

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
  const panelTypography = usePanelTypography()
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
    <section className={`z-50 flex max-h-96 w-80 max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-4 ${UI_THEME_TOKENS.text.primary} shadow-md sm:w-96 md:w-[544px] ${panelTypography.panelTextClass}`}>
      <header className={`mb-2 flex items-center justify-between gap-2 ${panelTypography.textSizeClass}`}>
        <div className="font-medium">{panelTitle}</div>
        <button type="button" className={secondaryButtonClassName} onClick={onClose}>
          {UI_LABELS.close}
        </button>
      </header>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon
            className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${UI_THEME_TOKENS.text.tertiary} ${iconSizeClass}`}
            strokeWidth={uiIconStrokeWidth}
          />
          <input
            value={fieldsQuery}
            onChange={event => setFieldsQuery(event.target.value)}
            placeholder={UI_COPY.searchFieldsPlaceholder}
            className={`h-7 w-full rounded-md border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} pl-7 pr-2 ${panelTypography.textSizeClass} shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500`}
          />
        </div>
        <button type="button" className={secondaryButtonClassName} onClick={showAllColumns}>
          {UI_LABELS.showAll}
        </button>
        <button type="button" className={secondaryButtonClassName} onClick={hideAllColumns}>
          {UI_LABELS.hideAll}
        </button>
      </div>
      <div className={`flex-1 overflow-auto border ${UI_THEME_TOKENS.panel.border} rounded-md ${UI_THEME_TOKENS.panel.headerBg}`}>
        {fieldsPanelColumnKeys.length === 0 ? (
          <div className={`flex h-32 items-center justify-center ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{UI_COPY.noFieldsMatch}</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {fieldsPanelColumnKeys.map(key => {
              const isVisible = isColumnVisible(key)
              const label = columnLabelByKey.get(key) ?? key
              const isDragging = draggingColumnKey === key
              return (
                <label
                  key={key}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 ${panelTypography.textSizeClass} ${
                    isDragging ? UI_THEME_TOKENS.button.activeBg : UI_THEME_TOKENS.button.hoverBg
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`inline-flex h-6 w-6 items-center justify-center rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.tertiary} shadow-sm ${UI_THEME_TOKENS.button.hoverBg} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500`}
                      draggable
                      onDragStart={event => handleDragStart(event, key)}
                      onDragEnd={handleDragEnd}
                      onDrop={event => handleDropOnColumn(event, key)}
                      onDragOver={handleDragOverColumn}
                    >
                      <GripVertical className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                    </button>
                    <span className={`truncate ${UI_THEME_TOKENS.text.primary}`} title={label}>
                      {label}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className={`h-4 w-4 rounded ${UI_THEME_TOKENS.input.border} text-blue-500 focus:ring-blue-500`}
                    checked={isVisible}
                    onChange={event => setColumnVisibility(key, event.target.checked)}
                  />
                </label>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
