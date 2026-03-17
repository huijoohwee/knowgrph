import { Eraser } from 'lucide-react'
import { secondaryButtonClassName } from '@/features/graph-data-table/ui/GraphDataTableUiPrimitives'
import { uiDataTableToggleActiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { type GraphDataTableColumnKey } from '@/features/graph-data-table/graphDataTable'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'

export interface GroupPanelProps {
  panelTitle: string
  groupKey: GraphDataTableColumnKey | ''
  setGroupKey: (key: GraphDataTableColumnKey | '') => void
  groupOptions: ReadonlyArray<{ value: GraphDataTableColumnKey; label: string }>
  includeMixedNumericFields: boolean
  setIncludeMixedNumericFields: (value: boolean) => void
  includeIdAsNumeric: boolean
  setIncludeIdAsNumeric: (value: boolean) => void
  includeSourceAsNumeric: boolean
  setIncludeSourceAsNumeric: (value: boolean) => void
  includeTargetAsNumeric: boolean
  setIncludeTargetAsNumeric: (value: boolean) => void
  aggregatePanelColumnKeys: GraphDataTableColumnKey[]
  aggregateKeys: GraphDataTableColumnKey[]
  setAggregateKeys: (keys: GraphDataTableColumnKey[]) => void
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  onClose: () => void
}

export function GroupPanel({
  panelTitle,
  groupKey,
  setGroupKey,
  groupOptions,
  includeMixedNumericFields,
  setIncludeMixedNumericFields,
  includeIdAsNumeric,
  setIncludeIdAsNumeric,
  includeSourceAsNumeric,
  setIncludeSourceAsNumeric,
  includeTargetAsNumeric,
  setIncludeTargetAsNumeric,
  aggregatePanelColumnKeys,
  aggregateKeys,
  setAggregateKeys,
  columnLabelByKey,
  onClose,
}: GroupPanelProps) {
  const panelTypography = usePanelTypography()
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <section
      className={`z-50 border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} shadow-md outline-none flex max-h-80 w-80 sm:w-96 md:w-[384px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg p-4 relative ${panelTypography.panelTextClass}`}
      aria-label="Group Panel"
    >
      <div className={`mb-2 flex items-center justify-between gap-2 ${panelTypography.textSizeClass}`}>
        <div className="font-medium">{panelTitle}</div>
        <button type="button" className={secondaryButtonClassName} onClick={onClose}>
          {UI_LABELS.close}
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-auto pt-2 pb-4">
        <div className={`flex items-center justify-between gap-2 ${panelTypography.textSizeClass}`}>
          <div className={UI_THEME_TOKENS.text.secondary}>{UI_COPY.graphDataTableGroupRowsByLabel}</div>
          <button
            type="button"
            className={`${secondaryButtonClassName} inline-flex items-center gap-1`}
            onClick={() => setGroupKey('')}
            aria-label={UI_COPY.graphDataTableClearGroupingAriaLabel}
          >
            <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            {UI_LABELS.clear}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`inline-flex items-center justify-between gap-2 rounded-md border px-2 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${panelTypography.textSizeClass} ${
              groupKey === '' ? uiDataTableToggleActiveClassName : `${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.text}`
            }`}
            onClick={() => setGroupKey('')}
          >
            <span className="truncate">{UI_COPY.graphDataTableNoGroupingLabel}</span>
          </button>
          {groupOptions.map(option => (
            <button
              key={option.value}
              type="button"
              className={`inline-flex items-center justify-between gap-2 rounded-md border px-2 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${panelTypography.textSizeClass} ${
                groupKey === option.value ? uiDataTableToggleActiveClassName : `${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.text}`
              }`}
              onClick={() => setGroupKey(option.value)}
            >
              <span className="truncate">
                {option.label}
              </span>
            </button>
          ))}
        </div>
        <div className={`mt-3 flex flex-col gap-2 border-t ${UI_THEME_TOKENS.panel.divider} pt-3`}>
          <div className="flex items-center justify-between gap-2">
            <div className={`${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.graphDataTableAggregateNumericFieldsLabel}</div>
            <div className="flex items-center gap-2">
              <label className={`inline-flex items-center gap-1 ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
                <input
                  type="checkbox"
                  className={`h-3 w-3 rounded ${UI_THEME_TOKENS.input.border} text-blue-500 focus:ring-blue-500`}
                  checked={includeMixedNumericFields}
                  onChange={event => setIncludeMixedNumericFields(event.target.checked)}
                />
                <span>Include mixed</span>
              </label>
              <label className={`inline-flex items-center gap-1 ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
                <input
                  type="checkbox"
                  className={`h-3 w-3 rounded ${UI_THEME_TOKENS.input.border} text-blue-500 focus:ring-blue-500`}
                  checked={includeIdAsNumeric}
                  onChange={event => setIncludeIdAsNumeric(event.target.checked)}
                />
                <span>Treat ID as numeric</span>
              </label>
              <label className={`inline-flex items-center gap-1 ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
                <input
                  type="checkbox"
                  className={`h-3 w-3 rounded ${UI_THEME_TOKENS.input.border} text-blue-500 focus:ring-blue-500`}
                  checked={includeSourceAsNumeric}
                  onChange={event => setIncludeSourceAsNumeric(event.target.checked)}
                />
                <span>Treat Source as numeric</span>
              </label>
              <label className={`inline-flex items-center gap-1 ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
                <input
                  type="checkbox"
                  className={`h-3 w-3 rounded ${UI_THEME_TOKENS.input.border} text-blue-500 focus:ring-blue-500`}
                  checked={includeTargetAsNumeric}
                  onChange={event => setIncludeTargetAsNumeric(event.target.checked)}
                />
                <span>Treat Target as numeric</span>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {aggregatePanelColumnKeys.map(key => {
              const isActive = aggregateKeys.includes(key)
              const label = columnLabelByKey.get(key) ?? key
              return (
                <button
                  key={key}
                  type="button"
                  className={`inline-flex items-center justify-between gap-2 rounded-md border px-2 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${panelTypography.textSizeClass} ${
                    isActive ? uiDataTableToggleActiveClassName : `${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.text}`
                  }`}
                  onClick={() => {
                    if (isActive) {
                      setAggregateKeys(aggregateKeys.filter(k => k !== key))
                    } else {
                      setAggregateKeys([...aggregateKeys, key])
                    }
                  }}
                >
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
