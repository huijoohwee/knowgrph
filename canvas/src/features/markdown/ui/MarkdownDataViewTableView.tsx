import React from 'react'
import type { MarkdownDataView } from './markdownDataViewModel'
import type { MarkdownDataViewColumnType } from './markdownDataViewColumnType'
import {
  columnTypeToBaseKind,
  defaultColumnTypeForInferredKind,
} from './markdownDataViewColumnType'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { DataViewTagChip } from './MarkdownDataViewChips'
import { MarkdownDataViewColumnTypeMenu } from './MarkdownDataViewColumnTypeMenu'
import { iconByColumnType } from './markdownDataViewColumnTypeMenuIcons'
import { MarkdownDataViewAddColumnMenu } from './MarkdownDataViewAddColumnMenu'
import {
  Type,
  ChevronDown,
  Plus,
} from 'lucide-react'

type MarkdownDataViewTableViewProps = {
  view: MarkdownDataView
  visibleColumnIds?: string[] | null
  columnTypesById?: Record<string, MarkdownDataViewColumnType> | null
  canMutate: boolean
  onUpdateCell: (args: { rowId: string; columnId: string; nextValue: string }) => void
  onActivateRow?: (rowId: string) => void
  onNewRecord?: () => void
  onAddColumn?: (args: { name: string; columnType: MarkdownDataViewColumnType }) => void
  onChangeColumnType?: (args: { columnId: string; nextType: MarkdownDataViewColumnType }) => void
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
  const [editing, setEditing] = React.useState<{ rowId: string; colId: string } | null>(null)
  const [draft, setDraft] = React.useState('')

  const startEdit = React.useCallback(
    (rowId: string, colId: string, current: string) => {
      if (!canMutate) return
      setEditing({ rowId, colId })
      setDraft(String(current ?? ''))
    },
    [canMutate],
  )

  const commit = React.useCallback(() => {
    if (!editing) return
    onUpdateCell({ rowId: editing.rowId, columnId: editing.colId, nextValue: draft })
    setEditing(null)
  }, [draft, editing, onUpdateCell])

  const cancel = React.useCallback(() => {
    setEditing(null)
  }, [])

  const visibleColumnMeta = React.useMemo(() => {
    if (!visibleColumnIds) return view.columns.map((c, idx) => ({ col: c, index: idx }))
    const allowed = new Set(visibleColumnIds)
    return view.columns
      .map((c, idx) => ({ col: c, index: idx }))
      .filter(x => allowed.has(x.col.id))
  }, [view.columns, visibleColumnIds])

  const selectOptionsByColumnIndex = React.useMemo(() => {
    const out = new Map<number, string[]>()
    for (let i = 0; i < view.columns.length; i += 1) {
      const c = view.columns[i]
      if (c.kind !== 'select') continue
      const base = Array.isArray(c.options) ? c.options.map(x => String(x || '').trim()).filter(Boolean) : []
      if (base.length) {
        out.set(i, base)
        continue
      }
      const set = new Set<string>()
      for (const r of view.rows) {
        const v = String(r.cells[i] ?? '').trim()
        if (!v) continue
        set.add(v)
        if (set.size >= 64) break
      }
      out.set(i, Array.from(set))
    }
    return out
  }, [view.columns, view.rows])


  return (
    <section className="overflow-auto max-h-[70vh]" aria-label="Table view">
      <table className="min-w-full border-collapse table-auto text-xs">
        <thead className={`${UI_THEME_TOKENS.table.headerBg} ${UI_THEME_TOKENS.table.text}`}>
          <tr>
            {visibleColumnMeta.map(({ col: c }) => {
              const type = (columnTypesById && columnTypesById[c.id]) || defaultColumnTypeForInferredKind(c.kind)
              const Icon = iconByColumnType[type] || Type
              return (
              <th
                key={c.id}
                className={`px-3 py-2 text-left font-semibold border-b ${UI_THEME_TOKENS.table.cellBorder} sticky top-0 z-10 ${UI_THEME_TOKENS.table.headerBg}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={['w-3 h-3 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                  {props.onChangeColumnType && canMutate ? (
                    <details className="relative min-w-0">
                      <summary className={['list-none cursor-pointer flex items-center gap-1 min-w-0', UI_THEME_TOKENS.button.hoverBg].join(' ')}>
                        <span className="truncate">{c.name}</span>
                        <ChevronDown className={['w-3 h-3 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                      </summary>
                        <MarkdownDataViewColumnTypeMenu
                          ariaLabel={`Column type: ${c.name}`}
                          value={type}
                          className="absolute left-0 mt-2 w-[240px]"
                          onSelect={(next) => props.onChangeColumnType?.({ columnId: c.id, nextType: next })}
                        />
                    </details>
                  ) : (
                    <span className="truncate">{c.name}</span>
                  )}
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
                  menuPositionClassName="absolute right-0 mt-2 w-[280px]"
                />
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className={UI_THEME_TOKENS.table.text}>
          {view.rows.map(r => (
            <tr
              key={r.id}
              className={[`${UI_THEME_TOKENS.table.rowHoverAmber} transition-colors`, onActivateRow ? 'cursor-pointer' : ''].join(' ')}
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
                  const derivedOptions = isSelect ? (selectOptionsByColumnIndex.get(colIndex) || []) : []
                  return (
                    <td key={c.id} className={cellBase}>
                      {isCheckbox ? (
                        <label className="inline-flex items-center gap-2">
                          <input
                            autoFocus
                            type="checkbox"
                            checked={isTruthy(value)}
                            onChange={e => {
                              onUpdateCell({ rowId: r.id, columnId: c.id, nextValue: e.target.checked ? 'true' : '' })
                              setEditing(null)
                            }}
                          />
                          <span className={['text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>{isTruthy(value) ? 'Checked' : 'Unchecked'}</span>
                        </label>
                      ) : isSelect && derivedOptions.length ? (
                        <select
                          className={['w-full text-xs px-2 py-1 rounded border', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border].join(' ')}
                          value={draft}
                          onChange={e => {
                            setDraft(e.target.value)
                            onUpdateCell({ rowId: r.id, columnId: c.id, nextValue: e.target.value })
                            setEditing(null)
                          }}
                        >
                          <option value=""></option>
                          {derivedOptions.map(o => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          autoFocus
                          type={uiType === 'number' || uiType === 'progress' ? 'number' : uiType === 'date' ? 'date' : 'text'}
                          min={uiType === 'progress' ? 0 : undefined}
                          max={uiType === 'progress' ? 100 : undefined}
                          className={['w-full text-xs px-2 py-1 rounded border', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.text.primary].join(' ')}
                          value={draft}
                          placeholder={isMulti ? 'A, B, C' : ''}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={commit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commit()
                            if (e.key === 'Escape') cancel()
                          }}
                        />
                      )}
                    </td>
                  )
                }

                const chips = baseKind === 'multi-select'
                  ? value
                      .split(',')
                      .map(x => x.trim())
                      .filter(Boolean)
                  : []

                const href = uiType === 'link' ? safeLinkHref(value) : null
                const progressValue = uiType === 'progress' ? Number(value) : NaN

                return (
                  <td
                    key={c.id}
                    className={cellBase}
                    onDoubleClick={() => startEdit(r.id, c.id, value)}
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
                      <div className="flex items-center gap-2">
                        <progress className="w-24 h-2" value={Math.max(0, Math.min(100, progressValue))} max={100} />
                        <span className={UI_THEME_TOKENS.text.secondary}>{`${Math.round(Math.max(0, Math.min(100, progressValue)))}%`}</span>
                      </div>
                    ) : href ? (
                      <a className={['underline', UI_THEME_TOKENS.text.primary].join(' ')} href={href} target="_blank" rel="noreferrer">
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
                      <span className={value ? '' : UI_THEME_TOKENS.text.tertiary}>{value || (canMutate ? '—' : '')}</span>
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
                  className={['inline-flex items-center gap-2 text-xs', UI_THEME_TOKENS.text.tertiary, UI_THEME_TOKENS.button.hoverBg, 'px-2 py-1 rounded'].join(' ')}
                  onClick={() => props.onNewRecord?.()}
                >
                  <Plus className={['w-3 h-3', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                  New Record
                </button>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  )
})
