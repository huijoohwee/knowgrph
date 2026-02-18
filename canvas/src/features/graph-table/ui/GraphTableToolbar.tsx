import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import IconButton from '@/components/IconButton'
import {
  ArrowUpDown,
  Columns2,
  Filter,
  PanelRightClose,
  PanelRightOpen,
  Ruler,
  SidebarClose,
  SidebarOpen,
} from 'lucide-react'
import {
  makeGraphTableRuleId,
  type GraphTableColumnVisibilityById,
  type GraphTableColumnWidthsPxById,
  type GraphTableFilterClause,
  type GraphTableFilterMatch,
  type GraphTableFilterOperator,
  type GraphTableRowHeightPreset,
  type GraphTableSortRule,
  type GraphTableSortDirection,
} from './graphTableViewState'
import type { PanelTypography } from '@/lib/ui/panelTypography'

export type GraphTableToolbarProps = {
  columns: { columnId: string; name: string }[]
  inspectorOpen: boolean
  setInspectorOpen: (next: boolean) => void

  canvasPreviewAvailable?: boolean
  canvasPreviewCollapsed?: boolean
  setCanvasPreviewCollapsed?: (next: boolean) => void

  panelTypography?: PanelTypography

  columnVisibilityById: GraphTableColumnVisibilityById
  setColumnVisibilityById: (next: GraphTableColumnVisibilityById) => void

  filterMatch: GraphTableFilterMatch
  setFilterMatch: (next: GraphTableFilterMatch) => void
  filterClauses: GraphTableFilterClause[]
  setFilterClauses: (next: GraphTableFilterClause[]) => void

  groupBy: string
  setGroupBy: (next: string) => void

  sortRules: GraphTableSortRule[]
  setSortRules: (next: GraphTableSortRule[]) => void

  rowHeightPreset: GraphTableRowHeightPreset
  setRowHeightPreset: (next: GraphTableRowHeightPreset) => void

  columnWidthsPxById: GraphTableColumnWidthsPxById
  resetColumnWidths: () => void
}

export function GraphTableToolbar(props: GraphTableToolbarProps) {
  const iconButtonClass = `${UI_THEME_TOKENS.button.square}`
  const iconSummaryClass = `list-none ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} h-7 w-7 inline-flex items-center justify-center rounded cursor-pointer select-none`
  const microLabelClass = props.panelTypography?.microLabelClass || ''
  const toggleColumn = (columnId: string) => {
    const next = { ...props.columnVisibilityById }
    const current = props.columnVisibilityById[columnId]
    next[columnId] = current === false
    props.setColumnVisibilityById(next)
  }

  const addFilterClause = () => {
    const first = props.columns[0]?.columnId || 'id'
    const next: GraphTableFilterClause[] = [
      ...props.filterClauses,
      { id: makeGraphTableRuleId(), columnId: first, operator: 'contains', value: '' },
    ]
    props.setFilterClauses(next)
  }

  const updateFilterClause = (id: string, patch: Partial<Pick<GraphTableFilterClause, 'columnId' | 'operator' | 'value'>>) => {
    props.setFilterClauses(props.filterClauses.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  const removeFilterClause = (id: string) => {
    props.setFilterClauses(props.filterClauses.filter(c => c.id !== id))
  }

  const addSortRule = () => {
    const first = props.columns[0]?.columnId || 'id'
    const next: GraphTableSortRule[] = [...props.sortRules, { id: makeGraphTableRuleId(), columnId: first, direction: 'asc' }]
    props.setSortRules(next)
  }

  const updateSortRule = (id: string, patch: Partial<Pick<GraphTableSortRule, 'columnId' | 'direction'>>) => {
    props.setSortRules(props.sortRules.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeSortRule = (id: string) => {
    props.setSortRules(props.sortRules.filter(r => r.id !== id))
  }

  const hasCustomWidths = Object.keys(props.columnWidthsPxById || {}).length > 0

  return (
    <nav aria-label="Table toolbar" className={`flex items-center gap-2 flex-wrap ${microLabelClass}`}>
      <IconButton
        title={props.inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
        showTooltip={false}
        onClick={() => props.setInspectorOpen(!props.inspectorOpen)}
        className={iconButtonClass}
      >
        {props.inspectorOpen ? <SidebarClose className="w-4 h-4" aria-hidden="true" /> : <SidebarOpen className="w-4 h-4" aria-hidden="true" />}
      </IconButton>

      {props.canvasPreviewAvailable && props.setCanvasPreviewCollapsed ? (
        <IconButton
          title={props.canvasPreviewCollapsed ? 'Show Canvas Preview' : 'Hide Canvas Preview'}
          showTooltip={false}
          onClick={() => props.setCanvasPreviewCollapsed?.(!props.canvasPreviewCollapsed)}
          className={iconButtonClass}
        >
          {props.canvasPreviewCollapsed ? (
            <PanelRightOpen className="w-4 h-4" aria-hidden="true" />
          ) : (
            <PanelRightClose className="w-4 h-4" aria-hidden="true" />
          )}
        </IconButton>
      ) : null}

      <details className="relative">
        <summary className={iconSummaryClass} title="Fields" aria-label="Fields">
          <Columns2 className="w-4 h-4" aria-hidden="true" />
        </summary>
        <form className="absolute mt-1 z-10 rounded border bg-[color:var(--kg-panel-bg)] p-2 min-w-44">
          <fieldset className="space-y-1">
            <legend className={`${UI_THEME_TOKENS.text.tertiary}`}>Visible columns</legend>
            {props.columns.map(c => (
              <label key={c.columnId} className="flex items-center gap-2">
                <input type="checkbox" checked={props.columnVisibilityById[c.columnId] !== false} onChange={() => toggleColumn(c.columnId)} />
                <span>{c.name}</span>
              </label>
            ))}
          </fieldset>
        </form>
      </details>

      <details className="relative">
        <summary className={iconSummaryClass} title="Filter" aria-label="Filter">
          <Filter className="w-4 h-4" aria-hidden="true" />
        </summary>
        <form className="absolute mt-1 z-10 rounded border bg-[color:var(--kg-panel-bg)] p-2 min-w-72">
          <fieldset className="space-y-2">
            <label className="flex items-center gap-2">
              <span>Match</span>
              <select
                value={props.filterMatch}
                onChange={e => props.setFilterMatch(e.target.value === 'any' ? 'any' : 'all')}
                className={`h-7 px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`}
              >
                <option value="all">All</option>
                <option value="any">Any</option>
              </select>
            </label>
            {props.filterClauses.map(clause => (
              <section key={clause.id} className="flex items-center gap-2">
                <label>
                  Field
                  <select
                    value={clause.columnId}
                    onChange={e => updateFilterClause(clause.id, { columnId: e.target.value })}
                    className={`h-7 px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ml-2`}
                  >
                    {props.columns.map(c => (
                      <option key={c.columnId} value={c.columnId}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Op
                  <select
                    value={clause.operator}
                    onChange={e => updateFilterClause(clause.id, { operator: e.target.value as GraphTableFilterOperator })}
                    className={`h-7 px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ml-2`}
                  >
                    <option value="contains">contains</option>
                    <option value="equals">equals</option>
                    <option value="startsWith">startsWith</option>
                    <option value="endsWith">endsWith</option>
                  </select>
                </label>
                <label>
                  Value
                  <input
                    value={clause.value}
                    onChange={e => updateFilterClause(clause.id, { value: e.target.value })}
                    className={`h-7 px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ml-2`}
                  />
                </label>
                <button
                  type="button"
                  className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  onClick={() => removeFilterClause(clause.id)}
                >
                  Remove
                </button>
              </section>
            ))}
            <section className="flex items-center gap-2">
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={addFilterClause}
              >
                Add filter
              </button>
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={() => props.setFilterClauses([])}
              >
                Clear all
              </button>
            </section>
          </fieldset>
        </form>
      </details>

      <label className="flex items-center gap-2">
        <span>Group</span>
        <select
          value={props.groupBy}
          onChange={e => props.setGroupBy(e.target.value)}
          className={`h-7 px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`}
        >
          <option value="">None</option>
          {props.columns.map(c => (
            <option key={c.columnId} value={c.columnId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <details className="relative">
        <summary className={iconSummaryClass} title="Sort" aria-label="Sort">
          <ArrowUpDown className="w-4 h-4" aria-hidden="true" />
        </summary>
        <form className="absolute mt-1 z-10 rounded border bg-[color:var(--kg-panel-bg)] p-2 min-w-64">
          <fieldset className="space-y-2">
            {props.sortRules.map(rule => (
              <section key={rule.id} className="flex items-center gap-2">
                <label>
                  Field
                  <select
                    value={rule.columnId}
                    onChange={e => updateSortRule(rule.id, { columnId: e.target.value })}
                    className={`h-7 px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ml-2`}
                  >
                    {props.columns.map(c => (
                      <option key={c.columnId} value={c.columnId}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Dir
                  <select
                    value={rule.direction}
                    onChange={e => updateSortRule(rule.id, { direction: (e.target.value === 'desc' ? 'desc' : 'asc') as GraphTableSortDirection })}
                    className={`h-7 px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ml-2`}
                  >
                    <option value="asc">ASC</option>
                    <option value="desc">DESC</option>
                  </select>
                </label>
                <button
                  type="button"
                  className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  onClick={() => removeSortRule(rule.id)}
                >
                  Remove
                </button>
              </section>
            ))}
            <section className="flex items-center gap-2">
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={addSortRule}
              >
                Add sort
              </button>
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={() => props.setSortRules([])}
              >
                Clear sort
              </button>
            </section>
          </fieldset>
        </form>
      </details>

      <label className="flex items-center gap-2">
        <span>Row height</span>
        <select
          value={props.rowHeightPreset}
          onChange={e => props.setRowHeightPreset(e.target.value === 'compact' ? 'compact' : 'comfortable')}
          className={`h-7 px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`}
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </label>

      <IconButton
        title="Reset column widths"
        showTooltip
        onClick={props.resetColumnWidths}
        disabled={!hasCustomWidths}
        className={iconButtonClass}
      >
        <Ruler className="w-4 h-4" aria-hidden="true" />
      </IconButton>
    </nav>
  )
}
