import React from 'react'
import { Plus, Eraser } from 'lucide-react'
import {
  FilterCombobox,
  iconButtonClassName,
  secondaryButtonClassName,
  type FilterComboboxOption,
} from '@/features/graph-data-table/ui/GraphDataTableUiPrimitives'
import {
  type GraphDataTableColumnKey,
  type GraphDataTableFilterClause,
  type GraphDataTableFilterCondition,
  type GraphDataTableFilterMatch,
  type GraphDataTableFilterOperator,
} from '@/features/graph-data-table/graphDataTable'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'

export interface FilterPanelProps {
  filterMatch: GraphDataTableFilterMatch
  setFilterMatch: (match: GraphDataTableFilterMatch) => void
  filterClauses: ReadonlyArray<GraphDataTableFilterClause>
  columnOptions: ReadonlyArray<FilterComboboxOption<GraphDataTableColumnKey>>
  filterOperatorOptions: ReadonlyArray<FilterComboboxOption<GraphDataTableFilterOperator>>
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  updateFilterCondition: (
    id: string,
    patch: Partial<Omit<GraphDataTableFilterCondition, 'id' | 'kind'>>,
  ) => void
  setFilterGroupMatch: (groupId: string, match: GraphDataTableFilterMatch) => void
  addFilterConditionToGroup: (groupId: string) => void
  removeFilterCondition: (id: string) => void
  addFilterCondition: () => void
  addFilterGroup: () => void
  clearAllFilters: () => void
}

export function FilterPanel({
  filterMatch,
  setFilterMatch,
  filterClauses,
  columnOptions,
  filterOperatorOptions,
  columnLabelByKey,
  updateFilterCondition,
  setFilterGroupMatch,
  addFilterConditionToGroup,
  removeFilterCondition,
  addFilterCondition,
  addFilterGroup,
  clearAllFilters,
}: FilterPanelProps) {
  const panelTypography = usePanelTypography()
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const handleFilterOperatorChange = React.useCallback(
    (id: string, operator: GraphDataTableFilterOperator) => {
      updateFilterCondition(id, { operator })
    },
    [updateFilterCondition],
  )

  const handleFilterColumnChange = React.useCallback(
    (id: string, key: GraphDataTableColumnKey) => {
      updateFilterCondition(id, { key })
    },
    [updateFilterCondition],
  )

  const handleFilterValueChange = React.useCallback(
    (id: string, value: string) => {
      updateFilterCondition(id, { value })
    },
    [updateFilterCondition],
  )

  return (
    <section className={`z-50 border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} shadow-md outline-none flex max-h-96 w-80 sm:w-96 md:w-[544px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg p-4 relative ${panelTypography.panelTextClass}`}>
      <header className={`mb-2 ${panelTypography.microLabelClass}`}>
        <div>In this view, show records</div>
      </header>
      <div className="flex flex-1 gap-2 flex-col overflow-auto pt-2 pb-4">
        {filterClauses.length === 0 ? (
          <div className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.tertiary}`}>{UI_COPY.graphDataTableNoFilters}</div>
        ) : null}
        {filterClauses.map((clause, index) => {
          const prefix =
            index === 0 ? (
              <span className={`px-1 leading-9 ${panelTypography.microLabelClass}`}>where</span>
            ) : (
              <FilterCombobox
                value={filterMatch}
                options={[
                  { value: 'all', label: 'and' },
                  { value: 'any', label: 'or' },
                ]}
                onChange={value => setFilterMatch(value === 'any' ? 'any' : 'all')}
                className={`inline-flex items-center whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 gap-2 border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} shadow-sm ${UI_THEME_TOKENS.button.hoverBg} justify-between px-2 py-1 ${panelTypography.microLabelClass}`}
              />
            )
          if (clause.kind === 'condition') {
            const condition = clause
            const columnLabel = columnLabelByKey.get(condition.key) ?? condition.key
            const isValueDisabled =
              condition.operator === 'is_empty' || condition.operator === 'is_not_empty'
            return (
              <div key={condition.id} className="flex items-center gap-2">
                {prefix}
                <FilterCombobox
                  value={condition.key}
                  options={columnOptions}
                  onChange={value =>
                    handleFilterColumnChange(condition.id, value as GraphDataTableColumnKey)
                  }
                  className={`inline-flex items-center whitespace-nowrap rounded-md border ${UI_THEME_TOKENS.panel.border} bg-transparent hover:border-blue-500/30 px-2 py-1 ${panelTypography.textSizeClass} shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50`}
                />
                <FilterCombobox
                  value={condition.operator}
                  options={filterOperatorOptions}
                  onChange={value =>
                    handleFilterOperatorChange(condition.id, value as GraphDataTableFilterOperator)
                  }
                  className={`inline-flex items-center whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 gap-2 border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} shadow-sm ${UI_THEME_TOKENS.button.hoverBg} justify-between px-2 py-1 ${panelTypography.textSizeClass}`}
                />
                <input
                  className={`h-8 w-40 rounded-md border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} px-2 py-1 ${panelTypography.textSizeClass} shadow-sm transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
                    isValueDisabled ? 'opacity-50' : ''
                  }`}
                  placeholder={`Enter value for ${columnLabel.toLowerCase()}`}
                  value={condition.value}
                  onChange={event => handleFilterValueChange(condition.id, event.target.value)}
                  disabled={isValueDisabled}
                />
                <button
                  type="button"
                  className={iconButtonClassName}
                  onClick={() => removeFilterCondition(condition.id)}
                  title="Remove condition"
                >
                  <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                </button>
              </div>
            )
          }

          const group = clause
          return (
            <div key={group.id} className={`flex flex-col gap-2 rounded-md border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} p-2`}>
              <div className="flex items-center justify-between gap-2">
                <div className={`flex items-center gap-2 ${panelTypography.textSizeClass}`}>
                  {prefix}
                  <FilterCombobox
                    value={group.match}
                    options={[
                      { value: 'all', label: 'all' },
                      { value: 'any', label: 'any' },
                    ]}
                    onChange={value => setFilterGroupMatch(group.id, value)}
                    className={`inline-flex items-center whitespace-nowrap rounded-md border ${UI_THEME_TOKENS.panel.border} bg-transparent hover:border-blue-500/30 px-2 py-1 ${panelTypography.textSizeClass} shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50`}
                  />
                  <span className={UI_THEME_TOKENS.text.tertiary}>of the following conditions:</span>
                </div>
                <button
                  type="button"
                  className={iconButtonClassName}
                  onClick={() => addFilterConditionToGroup(group.id)}
                >
                  <Plus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {group.clauses.map(innerClause => {
                  if (innerClause.kind !== 'condition') return null
                  const condition = innerClause
                  const isValueDisabled =
                    condition.operator === 'is_empty' || condition.operator === 'is_not_empty'
                  const columnLabel = columnLabelByKey.get(condition.key) ?? condition.key
                  return (
                    <div key={condition.id} className="flex items-center gap-2">
                      <FilterCombobox
                        value={condition.key}
                        options={columnOptions}
                        onChange={value =>
                          handleFilterColumnChange(condition.id, value as GraphDataTableColumnKey)
                        }
                        className={`inline-flex items-center whitespace-nowrap rounded-md border ${UI_THEME_TOKENS.panel.border} bg-transparent hover:border-blue-500/30 px-2 py-1 ${panelTypography.textSizeClass} shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50`}
                      />
                      <FilterCombobox
                        value={condition.operator}
                        options={filterOperatorOptions}
                        onChange={value =>
                          handleFilterOperatorChange(
                            condition.id,
                            value as GraphDataTableFilterOperator,
                          )
                        }
                        className={`inline-flex items-center whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 gap-2 border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} shadow-sm ${UI_THEME_TOKENS.button.hoverBg} justify-between px-2 py-1 ${panelTypography.textSizeClass}`}
                      />
                      <input
                        className={`h-8 w-40 rounded-md border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} px-2 py-1 ${panelTypography.textSizeClass} shadow-sm transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
                          isValueDisabled ? 'opacity-50' : ''
                        }`}
                        placeholder={`Enter value for ${columnLabel.toLowerCase()}`}
                        value={condition.value}
                        onChange={event => handleFilterValueChange(condition.id, event.target.value)}
                        disabled={isValueDisabled}
                      />
                    <button
                      type="button"
                      className={iconButtonClassName}
                      onClick={() => removeFilterCondition(condition.id)}
                      title="Remove condition"
                    >
                      <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                    </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={addFilterCondition}
          >
            <Plus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            Add condition
          </button>
          <button type="button" className={secondaryButtonClassName} onClick={addFilterGroup}>
            <Plus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            Add group
          </button>
        </div>
        <button
          type="button"
          className={`${secondaryButtonClassName} inline-flex items-center gap-1`}
          onClick={clearAllFilters}
        >
          <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          Clear all
        </button>
      </div>
    </section>
  )
}
