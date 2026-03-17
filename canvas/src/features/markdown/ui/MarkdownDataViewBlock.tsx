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
import { serializeMarkdownDataViewToTableLines } from './markdownDataViewSerialize'
import { MarkdownDataViewKanbanView } from './MarkdownDataViewKanbanView'
import { MarkdownDataViewTableView } from './MarkdownDataViewTableView'

type MarkdownDataViewBlockProps = {
  token: TokenWithLines
  table: TokensTable
  highlightClass: string
  highlightStyle?: React.CSSProperties
  opts: RenderOpts
}

const normalizeSearch = (v: string): string => String(v || '').trim().toLowerCase()

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

  React.useEffect(() => {
    const next = buildMarkdownDataViewFromTableToken(table)
    if (!next?.groupByColumnId && viewMode === 'kanban') setViewMode('table')
  }, [table, viewMode])

  const filteredView = React.useMemo((): MarkdownDataView | null => {
    if (!view) return null
    const q = normalizeSearch(query)
    if (!q) return view
    const rows = view.rows.filter(r => r.cells.some(c => normalizeSearch(c).includes(q)))
    return rows.length === view.rows.length ? view : { ...view, rows }
  }, [query, view])

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
        <div className={['flex-1 min-w-0 text-sm font-medium truncate', UI_THEME_TOKENS.text.primary].join(' ')}>
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
            onUpdateCell={handleUpdateCell}
          />
        )}
      </div>
    </section>
  )
})
