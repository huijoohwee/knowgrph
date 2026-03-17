import React from 'react'
import type { MarkdownDataView } from './markdownDataViewModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Expand,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
import { DataViewStatusChip, DataViewTagChip } from './MarkdownDataViewChips'

type MarkdownDataViewKanbanViewProps = {
  view: MarkdownDataView
  visibleColumnIds?: string[] | null
  canMutate: boolean
  onUpdateCell: (args: { rowId: string; columnId: string; nextValue: string }) => void
  onNewRecord: (seed?: Partial<Record<string, string>>) => void
  onActivateRow?: (rowId: string) => void
}

const TypeBadge = React.memo(function TypeBadge() {
  return (
    <span className={['inline-flex items-center justify-center w-6 h-6 rounded border text-xs font-semibold', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}>
      T
    </span>
  )
})

export const MarkdownDataViewKanbanView = React.memo(function MarkdownDataViewKanbanView(props: MarkdownDataViewKanbanViewProps) {
  const { view, visibleColumnIds, canMutate, onUpdateCell, onNewRecord, onActivateRow } = props
  const visibleColumnIdSet = React.useMemo(() => {
    return visibleColumnIds ? new Set(visibleColumnIds) : null
  }, [visibleColumnIds])

  const groupById = view.groupByColumnId
  const groupByIndex = React.useMemo(() => {
    return groupById ? view.columns.findIndex(c => c.id === groupById) : -1
  }, [groupById, view.columns])

  const titleIndex = React.useMemo(() => {
    return view.columns.findIndex(c => c.id === view.titleColumnId)
  }, [view.columns, view.titleColumnId])

  const groups = React.useMemo(() => {
    if (groupByIndex < 0) return [] as Array<{ key: string; rows: typeof view.rows }>
    const buckets = new Map<string, typeof view.rows>()
    for (const r of view.rows) {
      const key = String(r.cells[groupByIndex] ?? '').trim() || MARKDOWN_DATA_VIEW_COPY.ungroupedLabel
      const list = buckets.get(key)
      if (list) list.push(r)
      else buckets.set(key, [r])
    }
    const order = (() => {
      const col = view.columns[groupByIndex]
      const opts = Array.isArray(col.options) ? col.options : []
      const existing = Array.from(buckets.keys())
      if (!opts.length) return existing.sort((a, b) => a.localeCompare(b))
      const seen = new Set<string>()
      const out: string[] = []
      for (const o of opts) {
        if (!buckets.has(o)) continue
        out.push(o)
        seen.add(o)
      }
      for (const k of existing) {
        if (seen.has(k)) continue
        out.push(k)
      }
      return out
    })()
    return order.map(key => ({ key, rows: buckets.get(key) || [] }))
  }, [groupByIndex, view.columns, view.rows])

  const moveTargets = React.useMemo(() => {
    return groups.map(x => x.key).filter(Boolean)
  }, [groups])

  const groupColumnOptions = React.useMemo(() => {
    if (groupByIndex < 0) return [] as string[]
    const col = view.columns[groupByIndex]
    return Array.isArray(col.options) ? col.options.filter(Boolean) : []
  }, [groupByIndex, view.columns])

  const otherColumnIndices = React.useMemo(() => {
    if (groupByIndex < 0 || titleIndex < 0) return []
    const out: number[] = []
    for (let i = 0; i < view.columns.length; i += 1) {
      const c = view.columns[i]
      if (c.id === view.titleColumnId) continue
      if (c.id === view.groupByColumnId) continue
      if (visibleColumnIdSet && !visibleColumnIdSet.has(c.id)) continue
      if (c.kind === 'select' || c.kind === 'multi-select') out.push(i)
    }
    return out
  }, [view.columns, view.groupByColumnId, view.titleColumnId, visibleColumnIdSet])

  if (groupByIndex < 0 || titleIndex < 0) return null

  return (
    <section className="p-2 overflow-x-auto" aria-label={MARKDOWN_DATA_VIEW_COPY.kanbanViewLabel}>
      <ul className="flex items-start gap-3 min-w-fit list-none m-0 p-0" aria-label="Kanban groups">
        {groups.map(g => (
          <li key={g.key} className="list-none">
            <details
              open
              className={[
                'w-[260px] flex-shrink-0 rounded-lg border',
                UI_THEME_TOKENS.panel.border,
                UI_THEME_TOKENS.panel.headerBg,
              ].join(' ')}
            >
              <summary
                className={['list-none flex items-center gap-2 px-2 py-2 border-b cursor-pointer', UI_THEME_TOKENS.panel.divider].join(' ')}
                aria-label={`Group: ${g.key}`}
              >
                <span className="flex items-center gap-2 flex-1 min-w-0">
                  <ChevronDown className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                  <h3 className="min-w-0 flex items-center gap-2 m-0 text-sm font-medium">
                    <DataViewTagChip value={g.key} />
                    <span className={['inline-flex items-center justify-center w-5 h-5 rounded', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary, 'text-[11px]'].join(' ')}>
                      {g.rows.length}
                    </span>
                  </h3>
                </span>
                {canMutate ? (
                  <button
                    type="button"
                    className={['inline-flex items-center justify-center w-8 h-8 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
                    aria-label={`New record in ${g.key}`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onNewRecord({ [view.groupByColumnId as string]: g.key })
                    }}
                  >
                    <Plus className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                  </button>
                ) : null}
              </summary>

              <ol className="p-2 space-y-2 list-none m-0" aria-label={`Cards in ${g.key}`}>
                {g.rows.map(r => {
                const title = String(r.cells[titleIndex] ?? '')
                const groupValue = String(r.cells[groupByIndex] ?? '').trim() || g.key
                const isDone = String(groupValue).trim().toLowerCase() === 'done'
                return (
                  <li key={r.id} className="list-none">
                    <article
                      className={[
                        'group relative rounded-md border p-2 bg-[var(--kg-panel-bg)]',
                        UI_THEME_TOKENS.panel.border,
                        'shadow-sm',
                        onActivateRow
                          ? 'cursor-pointer hover:bg-[var(--kg-panel-bg-hover)] focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                          : '',
                      ].join(' ')}
                      tabIndex={onActivateRow ? 0 : undefined}
                      role={onActivateRow ? 'button' : undefined}
                      onClick={onActivateRow ? () => onActivateRow(r.id) : undefined}
                      onKeyDown={
                        onActivateRow
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onActivateRow(r.id)
                              }
                            }
                          : undefined
                      }
                      aria-label={title ? `Card: ${title}` : 'Card'}
                    >
                      <header className="flex items-start justify-between gap-2">
                        <h4 className={['text-xs font-semibold leading-5 m-0', UI_THEME_TOKENS.text.primary].join(' ')}>
                          {title || (canMutate ? 'Untitled' : '')}
                        </h4>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          {onActivateRow ? (
                            <button
                              type="button"
                              className={['inline-flex items-center justify-center w-8 h-8 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
                              aria-label={MARKDOWN_DATA_VIEW_COPY.expandCardLabel}
                              onClick={e => {
                                e.stopPropagation()
                                onActivateRow(r.id)
                              }}
                            >
                              <Expand className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                            </button>
                          ) : null}

                        <details className="relative" onClick={e => e.stopPropagation()}>
                          <summary
                            className={['list-none inline-flex items-center justify-center w-8 h-8 rounded border cursor-pointer', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
                            aria-label={MARKDOWN_DATA_VIEW_COPY.cardMenuLabel}
                          >
                            <MoreHorizontal className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                          </summary>
                          <menu
                            className={[
                              'absolute right-0 mt-2 w-[220px] rounded border shadow-sm p-2 z-10',
                              UI_THEME_TOKENS.panel.bg,
                              UI_THEME_TOKENS.panel.border,
                            ].join(' ')}
                            aria-label={MARKDOWN_DATA_VIEW_COPY.cardActionsLabel}
                          >
                            <li className="list-none">
                              <button
                                type="button"
                                className={['w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                                onClick={() => onActivateRow?.(r.id)}
                              >
                                <Expand className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                                {MARKDOWN_DATA_VIEW_COPY.expandCardLabel}
                              </button>
                            </li>

                            <li className="list-none">
                              <details className="relative">
                                <summary className={['list-none w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm cursor-pointer', UI_THEME_TOKENS.button.hoverBg].join(' ')}>
                                  <ArrowRight className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                                  <span className="flex-1 text-left">{MARKDOWN_DATA_VIEW_COPY.moveToLabel}</span>
                                  <ChevronDown className={['w-4 h-4 rotate-[-90deg]', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                                </summary>
                                <menu
                                  className={[
                                    'absolute left-[-8px] top-0 -translate-x-full w-[200px] rounded border shadow-sm p-2 z-10',
                                    UI_THEME_TOKENS.panel.bg,
                                    UI_THEME_TOKENS.panel.border,
                                  ].join(' ')}
                                  aria-label="Move targets"
                                >
                                  {moveTargets.map(t => (
                                    <li key={t} className="list-none">
                                      <button
                                        type="button"
                                        className={['w-full text-left px-2 py-1.5 rounded text-sm', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                                        onClick={() => {
                                          if (!view.groupByColumnId) return
                                          onUpdateCell({ rowId: r.id, columnId: view.groupByColumnId, nextValue: t })
                                        }}
                                      >
                                        {t}
                                      </button>
                                    </li>
                                  ))}
                                </menu>
                              </details>
                            </li>

                            <li className={['list-none my-2 h-px', UI_THEME_TOKENS.panel.divider].join(' ')} />
                            <li className="list-none">
                              <button
                                type="button"
                                className={['w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm opacity-60', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                                disabled
                              >
                                <ArrowUp className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                                Insert Before
                              </button>
                            </li>
                            <li className="list-none">
                              <button
                                type="button"
                                className={['w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm opacity-60', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                                disabled
                              >
                                <ArrowDown className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                                Insert After
                              </button>
                            </li>
                            <li className={['list-none my-2 h-px', UI_THEME_TOKENS.panel.divider].join(' ')} />
                            <li className="list-none">
                              <button
                                type="button"
                                className={['w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm opacity-60', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                                disabled
                              >
                                <Trash2 className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                                Delete Card
                              </button>
                            </li>
                          </menu>
                        </details>
                      </div>
                      </header>
                      <div className="mt-2">
                        <TypeBadge />
                      </div>
                    {otherColumnIndices.length ? (
                      <ul className="flex flex-wrap gap-1 mt-2 list-none p-0 m-0">
                        <li className="list-none">
                          <DataViewStatusChip value={groupValue} checked={isDone} />
                        </li>
                        {otherColumnIndices.map(colIndex => {
                          const col = view.columns[colIndex]
                          const value = String(r.cells[colIndex] ?? '')
                          if (!value) return null
                          if (col.kind === 'multi-select') {
                            const tags = value
                              .split(',')
                              .map(x => x.trim())
                              .filter(Boolean)
                            return tags.map(v => (
                              <li key={`${col.id}:${v}`} className="list-none">
                                <DataViewTagChip value={v} />
                              </li>
                            ))
                          }
                          return (
                            <li key={col.id} className="list-none">
                              <DataViewTagChip value={value} />
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                    {canMutate ? (
                      <footer className="mt-2">
                        <label className="sr-only">Status</label>
                        <select
                          className={['w-full text-[10px] px-2 py-1 rounded border', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border].join(' ')}
                          value={String(r.cells[groupByIndex] ?? '')}
                          onChange={e => onUpdateCell({ rowId: r.id, columnId: view.groupByColumnId as string, nextValue: e.target.value })}
                        >
                          {(groupColumnOptions.length ? groupColumnOptions : moveTargets).map(o => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </footer>
                    ) : null}
                    </article>
                  </li>
                )
              })}

                {canMutate ? (
                  <li className="list-none">
                    <button
                      type="button"
                      className={[
                        'w-full inline-flex items-center gap-2 text-xs px-2 py-2 rounded border',
                        UI_THEME_TOKENS.panel.divider,
                        UI_THEME_TOKENS.text.secondary,
                        UI_THEME_TOKENS.button.hoverBg,
                      ].join(' ')}
                      onClick={() => onNewRecord({ [view.groupByColumnId as string]: g.key })}
                    >
                      <Plus className={['w-3 h-3', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                      {MARKDOWN_DATA_VIEW_COPY.newRecordLabel}
                    </button>
                  </li>
                ) : null}
              </ol>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
})
