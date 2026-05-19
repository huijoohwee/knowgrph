import React from 'react'
import type { MarkdownDataView, MarkdownDataViewRow } from '../markdownDataViewModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { DataViewTagChip } from '../MarkdownDataViewChips'
import { KanbanCard } from './KanbanCard'

export type KanbanGroupModel = {
  key: string
  rows: MarkdownDataViewRow[]
}

export type KanbanGroupProps = {
  group: KanbanGroupModel
  canMutate: boolean
  view: MarkdownDataView
  titleIndex: number
  groupByIndex: number
  moveTargets: string[]
  groupColumnOptions: string[]
  otherColumnIndices: number[]
  onUpdateCell: (args: { rowId: string; columnId: string; nextValue: string }) => void
  onNewRecord: (seed?: Partial<Record<string, string>>) => void
  onActivateRow?: (rowId: string) => void
}

export const KanbanGroup = React.memo(function KanbanGroup(props: KanbanGroupProps) {
  const groupByColumnId = String(props.view.groupByColumnId || '')
  const [expanded, setExpanded] = React.useState(true)
  const toggleExpanded = React.useCallback(() => {
    setExpanded(prev => !prev)
  }, [])

  return (
    <li className="list-none">
      <section
        data-kg-kanban-group="1"
        className={[
          'kg-data-view-kanban-group w-[260px] flex-shrink-0 border',
          'rounded-[var(--kg-kanban-card-radius)]',
          UI_THEME_TOKENS.panel.border,
          UI_THEME_TOKENS.kanban.groupBg,
        ].join(' ')}
        aria-label={`Group: ${props.group.key}`}
      >
        <header className={['flex min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-hidden px-2 py-2 border-b', UI_THEME_TOKENS.panel.divider].join(' ')}>
          <button
            type="button"
            className={['flex items-center gap-2 flex-1 min-w-0 rounded', UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.focus.primarySoftRing].join(' ')}
            aria-expanded={expanded}
            onClick={toggleExpanded}
            onKeyDown={e => {
              if (e.key === 'ArrowRight') {
                e.preventDefault()
                setExpanded(true)
              }
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setExpanded(false)
              }
            }}
          >
            {expanded ? (
              <ChevronDown className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
            ) : (
              <ChevronRight className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
            )}
            <h3 className="min-w-0 flex items-center gap-2 m-0 text-sm font-medium">
              <DataViewTagChip value={props.group.key} />
              <span className={['inline-flex items-center justify-center w-5 h-5 rounded', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary, 'text-[11px]'].join(' ')}>
                {props.group.rows.length}
              </span>
            </h3>
          </button>

          {props.canMutate ? (
            <menu
              data-kg-kanban-group-actions="1"
              className="m-0 p-0 list-none flex shrink-0 items-center gap-1 opacity-0 pointer-events-none transition-opacity"
              aria-label="Group actions"
            >
              <li className="list-none">
                <button
                  type="button"
                  className={[
                    'kg-panel-action-btn kg-panel-icon-btn',
                    'inline-flex items-center justify-center w-7 h-7 rounded-md',
                    UI_THEME_TOKENS.focus.primarySoftRing,
                  ].join(' ')}
                  aria-label={`New record in ${props.group.key}`}
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    props.onNewRecord({ [groupByColumnId]: props.group.key })
                  }}
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </li>
            </menu>
          ) : null}
        </header>

        {expanded ? (
          <ol className="p-2 space-y-2 list-none m-0" aria-label={`Cards in ${props.group.key}`}>
            {props.group.rows.map(row => {
              const title = String(row.cells[props.titleIndex] ?? '')
              const groupValue = String(row.cells[props.groupByIndex] ?? '').trim() || props.group.key
              return (
                <li key={row.id} className="list-none">
                  <KanbanCard
                    row={row}
                    title={title}
                    groupValue={groupValue}
                    canMutate={props.canMutate}
                    groupByColumnId={groupByColumnId}
                    groupByIndex={props.groupByIndex}
                    moveTargets={props.moveTargets}
                    groupColumnOptions={props.groupColumnOptions}
                    view={props.view}
                    otherColumnIndices={props.otherColumnIndices}
                    onUpdateCell={props.onUpdateCell}
                    onActivateRow={props.onActivateRow}
                  />
                </li>
              )
            })}

            {props.canMutate ? (
              <li
                data-kg-kanban-group-actions="1"
                className="list-none opacity-0 pointer-events-none transition-opacity"
              >
                <button
                  type="button"
                  className={[
                    'kg-panel-action-btn',
                    'kg-data-view-action w-full min-w-0 max-w-full inline-flex flex-nowrap items-center gap-2 overflow-hidden text-xs px-2 py-2 rounded-md',
                    UI_THEME_TOKENS.text.secondary,
                    UI_THEME_TOKENS.button.hoverBg,
                    UI_THEME_TOKENS.focus.primarySoftRing,
                  ].join(' ')}
                  onClick={() => props.onNewRecord({ [groupByColumnId]: props.group.key })}
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="kg-truncate">{MARKDOWN_DATA_VIEW_COPY.newRecordLabel}</span>
                </button>
              </li>
            ) : null}
          </ol>
        ) : null}
      </section>
    </li>
  )
})
