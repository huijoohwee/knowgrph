import { Plus, Eraser } from 'lucide-react'
import {
  FilterCombobox,
  iconButtonClassName,
  secondaryButtonClassName,
  type FilterComboboxOption,
} from '@/features/graph-data-table/ui/GraphDataTableUiPrimitives'
import {
  type GraphDataTableColumnKey,
  type GraphDataTableSortDir,
  type GraphDataTableSortRule,
} from '@/features/graph-data-table/graphDataTable'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_COPY, UI_LABELS } from '@/lib/config'

export interface SortPanelProps {
  panelTitle: string
  isAutoSortEnabled: boolean
  setIsAutoSortEnabled: (enabled: boolean) => void
  sortRules: ReadonlyArray<GraphDataTableSortRule>
  columnOptions: ReadonlyArray<FilterComboboxOption<GraphDataTableColumnKey>>
  sortDirOptions: ReadonlyArray<FilterComboboxOption<GraphDataTableSortDir>>
  updateSortRule: (id: string, patch: Partial<Omit<GraphDataTableSortRule, 'id'>>) => void
  removeSortRule: (id: string) => void
  addSortRule: () => void
  resetSortRules: () => void
  onClose: () => void
}

export function SortPanel({
  panelTitle,
  isAutoSortEnabled,
  setIsAutoSortEnabled,
  sortRules,
  columnOptions,
  sortDirOptions,
  updateSortRule,
  removeSortRule,
  addSortRule,
  resetSortRules,
  onClose,
}: SortPanelProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <div className="z-50 border border-gray-200 bg-white text-gray-900 shadow-md outline-none flex max-h-96 w-80 sm:w-96 md:w-[544px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg p-4 relative">
      <div className="mb-2 flex items-center justify-between gap-2 text-[13px]">
        <div className="font-medium">{panelTitle}</div>
        <button type="button" className={secondaryButtonClassName} onClick={onClose}>
          {UI_LABELS.close}
        </button>
      </div>
      <div className="mb-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <input
            id="auto-sort-checkbox"
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            checked={isAutoSortEnabled}
            onChange={event => setIsAutoSortEnabled(event.target.checked)}
          />
          <label htmlFor="auto-sort-checkbox" className="select-none text-gray-700">
            {UI_COPY.graphDataTableAutoSortWhileEditingLabel}
          </label>
        </div>
        <button type="button" className={secondaryButtonClassName} onClick={resetSortRules}>
          {UI_LABELS.reset}
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-auto pt-2 pb-4">
        {sortRules.length === 0 ? (
          <div className="text-xs text-gray-500">{UI_COPY.graphDataTableSortingByIdFallbackLabel}</div>
        ) : (
          sortRules.map(rule => (
            <div key={rule.id} className="flex items-center gap-2">
              <FilterCombobox
                value={rule.key}
                options={columnOptions}
                onChange={value =>
                  updateSortRule(rule.id, { key: value as GraphDataTableColumnKey })
                }
                className="justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 gap-2 border border-gray-200 bg-white shadow-sm hover:bg-gray-50 px-2 py-1 text-xs"
              />
              <FilterCombobox
                value={rule.dir}
                options={sortDirOptions}
                onChange={value =>
                  updateSortRule(rule.id, { dir: value as GraphDataTableSortDir })
                }
                className="flex items-center justify-between whitespace-nowrap rounded-md border border-gray-200 bg-transparent hover:border-blue-500/30 px-2 py-1 text-xs shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                className={iconButtonClassName}
                onClick={() => removeSortRule(rule.id)}
                title={UI_COPY.graphDataTableRemoveSortRuleTitle}
              >
                <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" className={secondaryButtonClassName} onClick={addSortRule}>
          <Plus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          {UI_COPY.graphDataTableAddSortLabel}
        </button>
      </div>
    </div>
  )
}
