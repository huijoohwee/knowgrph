import React from 'react'
import type { TokenWithLines } from './markdownPreviewLex'
import type { RenderOpts } from './MarkdownRendererTypes'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY } from '@/lib/config'
import type { TokensTable } from './MarkdownTokens'
import {
  appendMarkdownDataViewRow,
  buildMarkdownDataViewFromTableToken,
  updateMarkdownDataViewCell,
  type MarkdownDataView,
} from './markdownDataViewModel'
import type { MarkdownDataViewColumnType } from './markdownDataViewColumnType'
import { serializeMarkdownDataViewToTableLines } from './markdownDataViewSerialize'
import { MarkdownDataViewKanbanView } from './MarkdownDataViewKanbanView'
import { MarkdownDataViewTableView } from './MarkdownDataViewTableView'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'

type MarkdownDataViewBlockProps = {
  token: TokenWithLines
  table: TokensTable
  highlightClass: string
  highlightStyle?: React.CSSProperties
  opts: RenderOpts
}

const normalizeSearch = (v: string): string => String(v || '').trim().toLowerCase()

type ColumnFilterOp = 'contains' | 'equals' | 'includes'

const splitMultiValues = (raw: string): string[] => {
  return String(raw ?? '')
    .split(',')
    .map(x => String(x ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const matchFilter = (cell: string, kind: MarkdownDataView['columns'][number]['kind'], op: ColumnFilterOp, needle: string): boolean => {
  const n = String(needle ?? '').trim().toLowerCase()
  if (!n) return true
  const v = String(cell ?? '').trim()
  const lower = v.toLowerCase()

  if (op === 'equals') return lower === n
  if (op === 'includes') {
    if (kind !== 'multi-select') return lower.includes(n)
    return splitMultiValues(v).some(x => x.toLowerCase() === n)
  }
  return lower.includes(n)
}

export const MarkdownDataViewBlock = React.memo(function MarkdownDataViewBlock(props: MarkdownDataViewBlockProps) {
  const { token, table, highlightClass, highlightStyle, opts } = props
  const startLine = token.startLine
  const endLine = token.endLine || token.startLine
  const canMutate = !!opts.onReplaceLineRange

  const view = React.useMemo(() => buildMarkdownDataViewFromTableToken(table), [table])
  const [viewMode, setViewMode] = React.useState<'kanban' | 'table'>(() => {
    const dv = buildMarkdownDataViewFromTableToken(table)
    return dv?.groupByColumnId ? 'kanban' : 'table'
  })
  const [query, setQuery] = React.useState('')
  const [columnTypesById, setColumnTypesById] = React.useState<Record<string, MarkdownDataViewColumnType>>({})
  const [visibleColumnIds, setVisibleColumnIds] = React.useState<string[] | null>(null)
  const [columnFiltersById, setColumnFiltersById] = React.useState<
    Record<string, { columnKind: MarkdownDataView['columns'][number]['kind']; op: ColumnFilterOp; value: string }>
  >({})
  const [sortMode, setSortMode] = React.useState<'none' | 'title_asc' | 'title_desc'>('none')

  React.useEffect(() => {
    const next = buildMarkdownDataViewFromTableToken(table)
    if (!next?.groupByColumnId && viewMode === 'kanban') setViewMode('table')
  }, [table, viewMode])

  const filteredView = React.useMemo((): MarkdownDataView | null => {
    if (!view) return null
    const q = normalizeSearch(query)
    const titleIndex = view.columns.findIndex(c => c.id === view.titleColumnId)
    const columnIndexById = new Map<string, number>()
    for (let i = 0; i < view.columns.length; i += 1) {
      columnIndexById.set(view.columns[i].id, i)
    }

    const activeFilters = Object.entries(columnFiltersById).filter(([, f]) => String(f.value || '').trim())
    const needsFilter = Boolean(q || activeFilters.length)
    const needsSort = sortMode !== 'none' && titleIndex >= 0

    if (!needsFilter && !needsSort) return view

    let rows = view.rows
    if (needsFilter) {
      rows = rows.filter(r => {
        if (q && !r.cells.some(c => normalizeSearch(c).includes(q))) return false
        for (const [columnId, f] of activeFilters) {
          const idx = columnIndexById.get(columnId) ?? -1
          if (idx < 0) continue
          if (!matchFilter(String(r.cells[idx] ?? ''), f.columnKind, f.op, f.value)) return false
        }
        return true
      })
    }

    if (needsSort) {
      const dir = sortMode === 'title_desc' ? -1 : 1
      const sorted = rows.slice().sort((a, b) => {
        const av = String(a.cells[titleIndex] ?? '').toLowerCase()
        const bv = String(b.cells[titleIndex] ?? '').toLowerCase()
        if (av < bv) return -1 * dir
        if (av > bv) return 1 * dir
        return 0
      })
      rows = sorted
    }

    return rows === view.rows ? view : { ...view, rows }
  }, [columnFiltersById, query, sortMode, view])

  const commitView = React.useCallback(
    (next: MarkdownDataView) => {
      if (!opts.onReplaceLineRange) return
      const replacementLines = serializeMarkdownDataViewToTableLines(next)
      if (!replacementLines.length) return
      opts.onReplaceLineRange({ startLine, endLine, replacementLines })
    },
    [endLine, opts, startLine],
  )

  const handleUpdateCell = React.useCallback(
    (args: { rowId: string; columnId: string; nextValue: string }) => {
      if (!view) return
      const next = updateMarkdownDataViewCell({ view, ...args })
      commitView(next)
    },
    [commitView, view],
  )

  const handleNewRecord = React.useCallback(
    (seed?: Partial<Record<string, string>>) => {
      if (!view) return
      const next = appendMarkdownDataViewRow({ view, seed })
      commitView(next)
    },
    [commitView, view],
  )

  const handleChangeColumnType = React.useCallback((args: { columnId: string; nextType: MarkdownDataViewColumnType }) => {
    setColumnTypesById(prev => {
      if (prev[args.columnId] === args.nextType) return prev
      return { ...prev, [args.columnId]: args.nextType }
    })
  }, [])

  const handleHideColumnInView = React.useCallback(
    (columnId: string) => {
      if (!view) return
      setVisibleColumnIds(prev => {
        const base = prev || view.columns.map(c => c.id)
        return base.filter(id => id !== columnId)
      })
    },
    [view],
  )

  const handleUpsertColumnFilter = React.useCallback(
    (args: { columnId: string; columnKind: MarkdownDataView['columns'][number]['kind']; op: ColumnFilterOp; value: string }) => {
      setColumnFiltersById(prev => {
        const value = String(args.value ?? '')
        const next = { ...prev }
        if (!value.trim()) {
          delete next[args.columnId]
          return next
        }
        next[args.columnId] = { columnKind: args.columnKind, op: args.op, value }
        return next
      })
    },
    [],
  )

  const handleSetColumnSort = React.useCallback(
    (args: { columnId: string; direction: 'asc' | 'desc' }) => {
      if (!view) return
      if (args.columnId !== view.titleColumnId) return
      setSortMode(args.direction === 'desc' ? 'title_desc' : 'title_asc')
    },
    [view],
  )

  if (!filteredView) return null

  const headerClass = [
    'flex items-center gap-2 min-w-0',
    'h-10 px-2 rounded-t-lg border-b',
    UI_THEME_TOKENS.panel.headerBg,
    UI_THEME_TOKENS.panel.divider,
  ].join(' ')

  const wrapperClass = [
    'rounded-lg border overflow-hidden',
    UI_THEME_TOKENS.panel.border,
    highlightClass,
  ]
    .filter(Boolean)
    .join(' ')

  const buttonBase = `text-xs px-2 py-1 rounded border ${UI_THEME_TOKENS.panel.divider}`
  const buttonOn = `${buttonBase} bg-blue-600 border-blue-600 text-white hover:bg-blue-700`
  const buttonOff = `${buttonBase} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary} hover:bg-black/5 dark:hover:bg-white/5`

  const showKanban = !!filteredView.groupByColumnId

  return (
    <section className={wrapperClass} style={highlightStyle}>
      <div className={headerClass}>
        <div className={['flex-1 text-sm font-medium', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>
          {UI_COPY.markdownDataViewTitleDefault}
        </div>

        <div className="flex items-center gap-1">
          {showKanban ? (
            <button
              type="button"
              className={viewMode === 'kanban' ? buttonOn : buttonOff}
              onClick={() => setViewMode('kanban')}
            >
              {UI_COPY.markdownDataViewKanbanViewLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={viewMode === 'table' ? buttonOn : buttonOff}
            onClick={() => setViewMode('table')}
          >
            {UI_COPY.markdownDataViewTableViewLabel}
          </button>
        </div>

        <label className="flex items-center gap-2 min-w-[180px]">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={UI_COPY.markdownDataViewSearchPlaceholder}
            className={[
              'w-full text-xs px-2 py-1 rounded border',
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.text.primary,
            ].join(' ')}
          />
        </label>

        <button
          type="button"
          disabled={!canMutate}
          className={[
            'text-xs px-2 py-1 rounded border',
            canMutate ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : `bg-black/5 dark:bg-white/5 ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.text.tertiary}`,
          ].join(' ')}
          onClick={() => handleNewRecord()}
        >
          {UI_COPY.markdownDataViewNewRecordLabel}
        </button>
      </div>

      <div className={UI_THEME_TOKENS.panel.bg}>
        {viewMode === 'kanban' && showKanban ? (
          <MarkdownDataViewKanbanView
            view={filteredView}
            canMutate={canMutate}
            onUpdateCell={handleUpdateCell}
            onNewRecord={handleNewRecord}
          />
        ) : (
          <MarkdownDataViewTableView
            view={filteredView}
            canMutate={canMutate}
            canConfigure={true}
            onUpdateCell={handleUpdateCell}
            visibleColumnIds={visibleColumnIds}
            columnTypesById={columnTypesById}
            onChangeColumnType={handleChangeColumnType}
            onHideColumnInView={handleHideColumnInView}
            onUpsertColumnFilter={handleUpsertColumnFilter}
            onSetColumnSort={handleSetColumnSort}
          />
        )}
      </div>
    </section>
  )
})
