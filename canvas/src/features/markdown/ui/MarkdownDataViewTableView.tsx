import React from 'react'
import type { MarkdownDataView } from './markdownDataViewModel'
import type { MarkdownDataViewColumnType } from './markdownDataViewColumnType'
import {
  columnTypeToBaseKind,
  defaultColumnTypeForInferredKind,
  labelForMarkdownDataViewColumnType,
} from './markdownDataViewColumnType'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import { DataViewTagChip } from './MarkdownDataViewChips'
import { MarkdownDataViewMultiTagSelect } from './MarkdownDataViewMultiTagSelect'
import { MarkdownDataViewSingleSelect } from './MarkdownDataViewSingleSelect'
import { MarkdownDataViewColumnTypeMenu } from './MarkdownDataViewColumnTypeMenu'
import { iconByColumnType } from './markdownDataViewColumnTypeMenuIcons'
import { MarkdownDataViewAddColumnMenu } from './MarkdownDataViewAddColumnMenu'
import { ColumnHeaderPropertyTypeMenu } from '@/components/ui/ColumnHeaderPropertyTypeMenu'
import { Plus, Type } from 'lucide-react'
import { ColumnHeaderMenu } from '@/components/ui/ColumnHeaderMenu'
import { AnchoredPopover } from '@/components/ui/AnchoredPopover'
import { workspaceTablePreferencesStore } from '@/features/workspace-table/workspaceTablePreferencesStore'
import { splitMultiValues } from '@/features/markdown/ui/markdownDataViewValueUtils'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'

type MarkdownDataViewTableViewProps = {
  view: MarkdownDataView
  visibleColumnIds?: string[] | null
  columnTypesById?: Record<string, MarkdownDataViewColumnType> | null
  canMutate: boolean
  canConfigure?: boolean
  onUpdateCell: (args: { rowId: string; columnId: string; nextValue: string }) => void
  onActivateRow?: (rowId: string) => void
  onNewRecord?: () => void
  onAddColumn?: (args: { name: string; columnType: MarkdownDataViewColumnType }) => void
  onChangeColumnType?: (args: { columnId: string; nextType: MarkdownDataViewColumnType }) => void
  onHideColumnInView?: (columnId: string) => void
  onUpsertColumnFilter?: (args: { columnId: string; columnKind: MarkdownDataView['columns'][number]['kind']; op: 'contains' | 'equals' | 'includes'; value: string }) => void
  onSetColumnSort?: (args: { columnId: string; direction: 'asc' | 'desc' }) => void
}

const isTruthy = (raw: string): boolean => {
  const v = String(raw || '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'x'
}

const safeLinkHref = (raw: string): string | null => {
  const v = String(raw || '').trim()
  if (!v) return null
  const lower = v.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:')) return v
  return null
}

export const MarkdownDataViewTableView = React.memo(function MarkdownDataViewTableView(props: MarkdownDataViewTableViewProps) {
  const { view, visibleColumnIds, columnTypesById, canMutate, onUpdateCell, onActivateRow } = props
  const canConfigure = props.canConfigure ?? canMutate
  const [editing, setEditing] = React.useState<{ rowId: string; colId: string; anchorEl: HTMLElement } | null>(null)
  const [draft, setDraft] = React.useState('')

  const draftRef = React.useRef('')
  draftRef.current = draft

  const startEdit = React.useCallback(
    (rowId: string, colId: string, current: string, anchorEl: HTMLElement) => {
      if (!canMutate) return
      setEditing({ rowId, colId, anchorEl })
      setDraft(String(current ?? ''))
    },
    [canMutate],
  )

  const commit = React.useCallback((nextOverride?: string) => {
    if (!editing) return
    if (!canMutate) {
      setEditing(null)
      return
    }
    const nextValue = typeof nextOverride === 'string' ? nextOverride : draftRef.current
    onUpdateCell({ rowId: editing.rowId, columnId: editing.colId, nextValue })
    setEditing(null)
  }, [canMutate, editing, onUpdateCell])

  const cancel = React.useCallback(() => {
    setEditing(null)
  }, [])

  const handleInlineTextCommit = React.useCallback(
    (rowId: string, colId: string, nextValue: string) => {
      if (!canMutate) return
      if (!editing || editing.rowId !== rowId || editing.colId !== colId) return
      commit(nextValue)
    },
    [canMutate, commit, editing],
  )

  const visibleColumnMeta = React.useMemo(() => {
    if (!visibleColumnIds) return view.columns.map((c, idx) => ({ col: c, index: idx }))
    const allowed = new Set(visibleColumnIds)
    return view.columns
      .map((c, idx) => ({ col: c, index: idx }))
      .filter(x => allowed.has(x.col.id))
  }, [view.columns, visibleColumnIds])

  const workspaceCellSelectPanelPlacement = React.useSyncExternalStore(
    workspaceTablePreferencesStore.subscribe,
    () => workspaceTablePreferencesStore.getSnapshot().workspaceCellSelectPanelPlacement,
    () => workspaceTablePreferencesStore.getServerSnapshot().workspaceCellSelectPanelPlacement,
  )

  const columnIndexById = React.useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < view.columns.length; i += 1) {
      map.set(view.columns[i].id, i)
    }
    return map
  }, [view.columns])

  const editingMeta = React.useMemo(() => {
    if (!editing) return null
    const colIndex = columnIndexById.get(editing.colId)
    if (colIndex == null) return null
    const column = view.columns[colIndex]
    if (!column) return null
    const uiType = (columnTypesById && columnTypesById[column.id]) || defaultColumnTypeForInferredKind(column.kind)
    const baseKind = columnTypeToBaseKind(uiType)
    return {
      rowId: editing.rowId,
      colId: editing.colId,
      colIndex,
      column,
      uiType,
      baseKind,
      anchorEl: editing.anchorEl,
    }
  }, [columnIndexById, columnTypesById, editing, view.columns])

  const editingSelectOptions = React.useMemo(() => {
    if (!editingMeta) return []
    if (editingMeta.baseKind !== 'select' || editingMeta.uiType === 'checkbox') return []
    if (editingMeta.column.kind === 'select' && Array.isArray(editingMeta.column.options)) {
      const base = editingMeta.column.options.map(x => String(x || '').trim()).filter(Boolean)
      if (base.length) return base
    }
    const set = new Set<string>()
    for (const r of view.rows) {
      const v = String(r.cells[editingMeta.colIndex] ?? '').trim()
      if (!v) continue
      set.add(v)
      if (set.size >= 64) break
    }
    return Array.from(set)
  }, [editingMeta, view.rows])

  const editingMultiSelectOptions = React.useMemo(() => {
    if (!editingMeta) return []
    if (editingMeta.baseKind !== 'multi-select') return []
    if (editingMeta.column.kind === 'multi-select' && Array.isArray(editingMeta.column.options)) {
      const base = editingMeta.column.options.map(x => String(x || '').trim()).filter(Boolean)
      if (base.length) return base
    }
    const set = new Set<string>()
    const list: string[] = []
    for (const r of view.rows) {
      const vals = splitMultiValues(String(r.cells[editingMeta.colIndex] ?? ''))
      for (const v of vals) {
        const key = v.toLowerCase()
        if (set.has(key)) continue
        set.add(key)
        list.push(v)
        if (list.length >= 96) break
      }
      if (list.length >= 96) break
    }
    return list
  }, [editingMeta, view.rows])


  return (
    <section className="overflow-auto max-h-[70vh]" aria-label="Table view">
      <table className="min-w-full border-collapse table-auto text-xs">
        <thead className={`${UI_THEME_TOKENS.table.headerBg} ${UI_THEME_TOKENS.table.text}`}>
          <tr>
            {visibleColumnMeta.map(({ col: c }) => {
              const type = (columnTypesById && columnTypesById[c.id]) || defaultColumnTypeForInferredKind(c.kind)
              const Icon = iconByColumnType[type] || Type
              const allowTypeEdit = Boolean(canConfigure && props.onChangeColumnType)
              const canSort = Boolean(canConfigure && props.onSetColumnSort && c.id === view.titleColumnId)
              const filterOps = c.kind === 'multi-select'
                ? [{ key: 'includes', label: 'includes' }, { key: 'contains', label: 'contains' }, { key: 'equals', label: 'equals' }]
                : c.kind === 'select'
                  ? [{ key: 'equals', label: 'equals' }, { key: 'contains', label: 'contains' }]
                  : [{ key: 'contains', label: 'contains' }, { key: 'equals', label: 'equals' }]
              return (
              <th
                key={c.id}
                className={`px-3 py-2 text-left font-semibold border-b ${UI_THEME_TOKENS.table.cellBorder} sticky top-0 z-10 ${UI_THEME_TOKENS.table.headerBg}`}
              >
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  <ColumnHeaderPropertyTypeMenu
                    ariaLabel={`Column type: ${c.name}`}
                    label={c.name}
                    Icon={Icon}
                    portal
                    portalPlacement="bottom-start"
                    toggleTargets="icon+chevron"
                    menu={({ close }) => (
                      <ColumnHeaderMenu
                        ariaLabel={`Column menu: ${c.name}`}
                        closeMenu={close}
                        typeSummaryLabel="Type"
                        typeValueLabel={labelForMarkdownDataViewColumnType(type)}
                        disableTypeChange={!allowTypeEdit}
                        renderTypeMenu={() => (
                          <MarkdownDataViewColumnTypeMenu
                            ariaLabel={`Column type: ${c.name}`}
                            value={type}
                            close={close}
                            disabled={!allowTypeEdit}
                            className="w-[240px]"
                            onSelect={(next) => {
                              if (!allowTypeEdit) return
                              props.onChangeColumnType?.({ columnId: c.id, nextType: next })
                            }}
                          />
                        )}
                        onHideInView={canConfigure && props.onHideColumnInView ? () => props.onHideColumnInView?.(c.id) : undefined}
                        filter={
                          canConfigure && props.onUpsertColumnFilter
                            ? {
                                ops: filterOps,
                                defaultOp: filterOps[0]?.key || 'contains',
                                onApply: ({ op, value }) =>
                                  props.onUpsertColumnFilter?.({
                                    columnId: c.id,
                                    columnKind: c.kind,
                                    op: (op === 'includes' ? 'includes' : op === 'equals' ? 'equals' : 'contains'),
                                    value,
                                  }),
                              }
                            : undefined
                        }
                        onSortAsc={canSort ? () => props.onSetColumnSort?.({ columnId: c.id, direction: 'asc' }) : undefined}
                        onSortDesc={canSort ? () => props.onSetColumnSort?.({ columnId: c.id, direction: 'desc' }) : undefined}
                        disableSort={!canSort}
                        disableInsert
                        disableDuplicate
                        disableDelete
                        disableMoveLeft
                        disableMoveRight
                      />
                    )}
                  />
                </div>
              </th>
              )
            })}
            {canMutate && props.onAddColumn ? (
              <th
                className={`px-2 py-2 text-left font-semibold border-b ${UI_THEME_TOKENS.table.cellBorder} sticky top-0 z-10 ${UI_THEME_TOKENS.table.headerBg}`}
              >
                <MarkdownDataViewAddColumnMenu
                  ariaLabel="Add column"
                  nextColumnNumber={view.columns.length + 1}
                  canMutate={canMutate}
                  onAddColumn={props.onAddColumn}
                  summaryClassName={['list-none flex items-center justify-center w-8 h-8 rounded border cursor-pointer', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
                  menuPositionClassName="kg-data-view-add-column-menu absolute right-0 mt-2 w-[280px]"
                />
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className={UI_THEME_TOKENS.table.text}>
          {view.rows.map(r => (
            <tr
              key={r.id}
              className={[`${UI_THEME_TOKENS.table.rowHoverHighlight} transition-colors`, onActivateRow ? 'cursor-pointer' : ''].join(' ')}
              onClick={
                onActivateRow
                  ? (e) => {
                      const el = e.target as HTMLElement | null
                      if (el?.closest('input,select,textarea,button')) return
                      onActivateRow(r.id)
                    }
                  : undefined
              }
            >
              {visibleColumnMeta.map(({ col: c, index: colIndex }) => {
                const value = String(r.cells[colIndex] ?? '')
                const uiType = (columnTypesById && columnTypesById[c.id]) || defaultColumnTypeForInferredKind(c.kind)
                const baseKind = columnTypeToBaseKind(uiType)
                const isEditing = editing?.rowId === r.id && editing?.colId === c.id
                const cellBase = `px-3 py-2 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`
                if (isEditing) {
                  const isSelect = baseKind === 'select' && uiType !== 'checkbox'
                  const isCheckbox = uiType === 'checkbox'
                  const isMulti = baseKind === 'multi-select'
                  return (
                    <td key={c.id} className={cellBase}>
                      {isCheckbox ? (
                        <label className="inline-flex min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-hidden">
                          <input
                            autoFocus
                            type="checkbox"
                            checked={isTruthy(value)}
                            onChange={e => {
                              onUpdateCell({ rowId: r.id, columnId: c.id, nextValue: e.target.checked ? 'true' : '' })
                              setEditing(null)
                            }}
                          />
                          <span className={['min-w-0 text-xs', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.secondary].join(' ')}>{isTruthy(value) ? 'Checked' : 'Unchecked'}</span>
                        </label>
                      ) : isSelect ? (
                        draft ? <DataViewTagChip value={draft} /> : <span className={UI_THEME_TOKENS.text.tertiary}>—</span>
                      ) : isMulti ? (
                        (() => {
                          const chips = splitMultiValues(draft)
                          if (!chips.length) return <span className={UI_THEME_TOKENS.text.tertiary}>—</span>
                          return (
                            <div className="flex flex-wrap gap-1">
                              {chips.map(v => (
                                <DataViewTagChip key={v} value={v} />
                              ))}
                            </div>
                          )
                        })()
                      ) : (
                        <InlineTextCellEditor
                          key={`${r.id}:${c.id}`}
                          ariaLabel={`Edit ${c.name}`}
                          initialValue={value}
                          textClassName={UI_THEME_TOKENS.text.primary}
                          onCommit={(next) => handleInlineTextCommit(r.id, c.id, next)}
                          onCancel={cancel}
                        />
                      )}
                    </td>
                  )
                }

                const chips = baseKind === 'multi-select' ? splitMultiValues(value) : []

                const href = uiType === 'link' ? safeLinkHref(value) : null
                const progressValue = uiType === 'progress' ? Number(value) : NaN

                return (
                  <td
                    key={c.id}
                    className={cellBase}
                    onClick={(e) => {
                      const el = e.target as HTMLElement | null
                      if (el?.closest('a,button,input,select,textarea')) return
                      e.preventDefault()
                      e.stopPropagation()
                      startEdit(r.id, c.id, value, e.currentTarget)
                    }}
                    role={canMutate ? 'button' : undefined}
                  >
                    {uiType === 'checkbox' ? (
                      <span className={['inline-flex items-center gap-2', UI_THEME_TOKENS.text.primary].join(' ')}>
                        <input
                          type="checkbox"
                          checked={isTruthy(value)}
                          disabled={!canMutate}
                          onChange={e => {
                            if (!canMutate) return
                            onUpdateCell({ rowId: r.id, columnId: c.id, nextValue: e.target.checked ? 'true' : '' })
                          }}
                        />
                      </span>
                    ) : uiType === 'progress' && Number.isFinite(progressValue) ? (
                      <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-hidden">
                        <progress className="h-2 w-24 max-w-[55%] shrink" value={Math.max(0, Math.min(100, progressValue))} max={100} />
                        <span className={['min-w-0', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.secondary].join(' ')}>{`${Math.round(Math.max(0, Math.min(100, progressValue)))}%`}</span>
                      </div>
                    ) : href ? (
                      <a className={['block max-w-[24rem] underline', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')} href={href} target="_blank" rel="noreferrer">
                        {value}
                      </a>
                    ) : baseKind === 'select' && value ? (
                      <DataViewTagChip value={value} />
                    ) : baseKind === 'multi-select' && chips.length ? (
                      <div className="flex flex-wrap gap-1">
                        {chips.map(v => (
                          <DataViewTagChip key={v} value={v} />
                        ))}
                      </div>
                    ) : (
                      <span className={['block max-w-[24rem]', UI_TEXT_TRUNCATE, value ? '' : UI_THEME_TOKENS.text.tertiary].join(' ')}>{value || (canMutate ? '—' : '')}</span>
                    )}
                  </td>
                )
              })}
              {canMutate && props.onAddColumn ? (
                <td className={`px-2 py-2 border-b ${UI_THEME_TOKENS.table.cellBorder}`} />
              ) : null}
            </tr>
          ))}
          {canMutate && props.onNewRecord ? (
            <tr>
              <td
                colSpan={visibleColumnMeta.length + (canMutate && props.onAddColumn ? 1 : 0)}
                className={`px-3 py-2 border-b ${UI_THEME_TOKENS.table.cellBorder}`}
              >
                <button
                  type="button"
                  className={['kg-data-view-action inline-flex min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-hidden text-xs', UI_THEME_TOKENS.text.tertiary, UI_THEME_TOKENS.button.hoverBg, 'px-2 py-1 rounded'].join(' ')}
                  onClick={() => props.onNewRecord?.()}
                >
                  <Plus className={['w-3 h-3 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                  <span className={UI_TEXT_TRUNCATE}>{MARKDOWN_DATA_VIEW_COPY.newRecordLabel}</span>
                </button>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <AnchoredPopover
        open={Boolean(editingMeta && (editingMeta.baseKind === 'select' || editingMeta.baseKind === 'multi-select') && editingMeta.uiType !== 'checkbox')}
        anchorEl={editingMeta?.anchorEl || null}
        ariaLabel="Cell select panel"
        placement={workspaceCellSelectPanelPlacement === 'bottom' ? 'bottom-start' : 'top-start'}
        minWidthPx={320}
        maxWidthPx={420}
        maxHeightPx={420}
        onClose={() => setEditing(null)}
      >
        {editingMeta && editingMeta.baseKind === 'select' && editingMeta.uiType !== 'checkbox' ? (
          <MarkdownDataViewSingleSelect
            autoFocus
            canCreate
            value={draft}
            options={editingSelectOptions}
            onChange={(next) => {
              if (!canMutate) {
                setEditing(null)
                return
              }
              setDraft(next)
              onUpdateCell({ rowId: editingMeta.rowId, columnId: editingMeta.colId, nextValue: next })
            }}
            onRequestClose={() => setEditing(null)}
          />
        ) : editingMeta && editingMeta.baseKind === 'multi-select' ? (
          <MarkdownDataViewMultiTagSelect
            autoFocus
            canCreate={true}
            value={draft}
            options={editingMultiSelectOptions}
            onChange={(next) => {
              if (!canMutate) {
                setEditing(null)
                return
              }
              setDraft(next)
              onUpdateCell({ rowId: editingMeta.rowId, columnId: editingMeta.colId, nextValue: next })
            }}
            onRequestClose={() => setEditing(null)}
          />
        ) : null}
      </AnchoredPopover>
    </section>
  )
})

const InlineTextCellEditor = React.memo(function InlineTextCellEditor(props: {
  ariaLabel: string
  initialValue: string
  textClassName: string
  onCommit: (nextValue: string) => void
  onCancel: () => void
}) {
  const { ariaLabel, initialValue, textClassName, onCommit, onCancel } = props
  const editorRef = React.useRef<HTMLSpanElement | null>(null)

  React.useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const next = String(initialValue ?? '')
    if (el.textContent !== next) el.textContent = next
  }, [initialValue])

  const commit = React.useCallback(() => {
    const next = String(editorRef.current?.textContent || '').replace(/\r/g, '')
    onCommit(next)
  }, [onCommit])

  return (
    <span
      ref={editorRef}
      autoFocus
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      className={['inline-block w-full min-h-[1lh] whitespace-pre-wrap break-words outline-none', textClassName].join(' ')}
      onClick={e => e.stopPropagation()}
      onInput={() => {}}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commit()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
    >
      {String(initialValue ?? '')}
    </span>
  )
})
