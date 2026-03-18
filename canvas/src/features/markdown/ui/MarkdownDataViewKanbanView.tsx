import React from 'react'
import type { MarkdownDataView } from './markdownDataViewModel'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import { KanbanGroup, type KanbanGroupModel } from './kanban/KanbanGroup'

type MarkdownDataViewKanbanViewProps = {
  view: MarkdownDataView
  visibleColumnIds?: string[] | null
  canMutate: boolean
  onUpdateCell: (args: { rowId: string; columnId: string; nextValue: string }) => void
  onNewRecord: (seed?: Partial<Record<string, string>>) => void
  onActivateRow?: (rowId: string) => void
}

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
    if (groupByIndex < 0) return [] as KanbanGroupModel[]
    const buckets = new Map<string, typeof view.rows>()
    for (const row of view.rows) {
      const key = String(row.cells[groupByIndex] ?? '').trim() || MARKDOWN_DATA_VIEW_COPY.ungroupedLabel
      const list = buckets.get(key)
      if (list) list.push(row)
      else buckets.set(key, [row])
    }
    const col = view.columns[groupByIndex]
    const opts = Array.isArray(col.options) ? col.options : []
    const existing = Array.from(buckets.keys())
    const order = !opts.length
      ? existing.sort((a, b) => a.localeCompare(b))
      : (() => {
          const seen = new Set<string>()
          const out: string[] = []
          for (const option of opts) {
            if (!buckets.has(option)) continue
            out.push(option)
            seen.add(option)
          }
          for (const key of existing) {
            if (seen.has(key)) continue
            out.push(key)
          }
          return out
        })()
    return order.map(key => ({ key, rows: buckets.get(key) || [] }))
  }, [groupByIndex, view.columns, view.rows])

  const moveTargets = React.useMemo(() => groups.map(x => x.key).filter(Boolean), [groups])

  const groupColumnOptions = React.useMemo(() => {
    if (groupByIndex < 0) return [] as string[]
    const col = view.columns[groupByIndex]
    return Array.isArray(col.options) ? col.options.filter(Boolean) : []
  }, [groupByIndex, view.columns])

  const otherColumnIndices = React.useMemo(() => {
    if (groupByIndex < 0 || titleIndex < 0) return []
    const out: number[] = []
    for (let i = 0; i < view.columns.length; i += 1) {
      const col = view.columns[i]
      if (col.id === view.titleColumnId) continue
      if (col.id === view.groupByColumnId) continue
      if (visibleColumnIdSet && !visibleColumnIdSet.has(col.id)) continue
      if (col.kind === 'select' || col.kind === 'multi-select' || col.kind === 'text') out.push(i)
    }
    return out
  }, [view.columns, view.groupByColumnId, view.titleColumnId, visibleColumnIdSet])

  if (groupByIndex < 0 || titleIndex < 0 || !view.groupByColumnId) return null

  return (
    <section className="p-2 overflow-x-auto" aria-label={MARKDOWN_DATA_VIEW_COPY.kanbanViewLabel}>
      <ul className="flex items-start gap-3 min-w-fit list-none m-0 p-0" aria-label="Kanban groups">
        {groups.map(group => (
          <KanbanGroup
            key={group.key}
            group={group}
            canMutate={canMutate}
            view={view}
            titleIndex={titleIndex}
            groupByIndex={groupByIndex}
            moveTargets={moveTargets}
            groupColumnOptions={groupColumnOptions}
            otherColumnIndices={otherColumnIndices}
            onUpdateCell={onUpdateCell}
            onNewRecord={onNewRecord}
            onActivateRow={onActivateRow}
          />
        ))}
      </ul>
    </section>
  )
})

