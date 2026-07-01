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
import {
  UI_RESPONSIVE_ACTION_ROW_CLASSNAME,
  UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_MENU_PANEL_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_TABLE_FRAME_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_TABLE_PROGRESS_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_TABLE_VALUE_CLASSNAME,
  UI_RESPONSIVE_ELEMENT_ROW_CLASSNAME,
  UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME,
  UI_RESPONSIVE_MENU_ICON_ACTION_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { uiToolbarRowScrollClassName } from '@/features/toolbar/ui/toolbarStyles'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { MARKDOWN_TEXT_EDIT_SURFACE_MIN_LINE_HEIGHT_CLASS } from './markdownEditSurfaceLayout'
import { renderMarkdownDataViewTableCellImage } from './MarkdownDataViewImageCell'
import {
  coerceDataViewFieldLineMode,
  coerceDataViewRowHeightPreset,
  readDataViewFieldLineClassName,
  readDataViewHeaderPaddingClassName,
  readDataViewTablePaddingClassName,
  type DataViewFieldLineMode,
  type DataViewRowHeightPreset,
} from '@/lib/ui/dataViewDensity'

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
  renderAllRows?: boolean
  orientation?: 'rows' | 'columns'
  rowHeightPreset?: DataViewRowHeightPreset
  fieldLineMode?: DataViewFieldLineMode
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

export const MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT = 96
export const MARKDOWN_DATA_VIEW_TABLE_INITIAL_RENDER_ROW_LIMIT = 32
export const MARKDOWN_DATA_VIEW_TABLE_RENDER_ROW_INCREMENT = 32
export function readMarkdownDataViewTableCellPreviewText(raw: string): string {
  const value = String(raw || '')
  if (value.length <= MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT) return value
  return `${value.slice(0, MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT).trimEnd()}...`
}

export const MarkdownDataViewTableView = React.memo(function MarkdownDataViewTableView(props: MarkdownDataViewTableViewProps) {
  const { view, visibleColumnIds, columnTypesById, canMutate, onUpdateCell, onActivateRow } = props
  const canConfigure = props.canConfigure ?? canMutate
  const orientation = props.orientation === 'columns' ? 'columns' : 'rows'
  const rowHeightPreset = coerceDataViewRowHeightPreset(props.rowHeightPreset)
  const fieldLineMode = coerceDataViewFieldLineMode(props.fieldLineMode)
  const cellPaddingClassName = readDataViewTablePaddingClassName(rowHeightPreset)
  const headerPaddingClassName = readDataViewHeaderPaddingClassName(rowHeightPreset)
  const fieldLineClassName = readDataViewFieldLineClassName(fieldLineMode)
  const [editing, setEditing] = React.useState<{ rowId: string; colId: string; anchorEl: HTMLElement } | null>(null)
  const [draft, setDraft] = React.useState('')
  const [renderedRowLimit, setRenderedRowLimit] = React.useState(MARKDOWN_DATA_VIEW_TABLE_INITIAL_RENDER_ROW_LIMIT)

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
  const visibleColumnSignature = React.useMemo(
    () => visibleColumnMeta.map(({ col }) => col.id).join('\u0000'),
    [visibleColumnMeta],
  )

  React.useEffect(() => {
    if (props.renderAllRows) {
      setRenderedRowLimit(view.rows.length)
      return
    }
    setRenderedRowLimit(MARKDOWN_DATA_VIEW_TABLE_INITIAL_RENDER_ROW_LIMIT)
  }, [props.renderAllRows, view.rows, visibleColumnSignature])

  React.useEffect(() => {
    if (!editing) return
    const rowIndex = view.rows.findIndex(row => row.id === editing.rowId)
    if (rowIndex < 0 || rowIndex < renderedRowLimit) return
    setRenderedRowLimit(Math.min(view.rows.length, rowIndex + 1))
  }, [editing, renderedRowLimit, view.rows])

  const renderedRows = React.useMemo(
    () => (props.renderAllRows ? view.rows : view.rows.slice(0, Math.min(view.rows.length, renderedRowLimit))),
    [props.renderAllRows, renderedRowLimit, view.rows],
  )
  const hiddenRowCount = Math.max(0, view.rows.length - renderedRows.length)

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

  const titleColumnIndex = React.useMemo(() => {
    const index = view.columns.findIndex(column => column.id === view.titleColumnId)
    return index >= 0 ? index : 0
  }, [view.columns, view.titleColumnId])

  if (orientation === 'columns') {
    return (
      <section className={UI_RESPONSIVE_DATA_VIEW_TABLE_FRAME_CLASSNAME} aria-label="Table view">
        <table className="min-w-full border-collapse table-auto text-xs">
          <thead className={`${UI_THEME_TOKENS.table.headerBg} ${UI_THEME_TOKENS.table.text}`}>
            <tr>
              <th className={`${headerPaddingClassName} text-left font-semibold border-b ${UI_THEME_TOKENS.table.cellBorder} sticky top-0 z-10 ${UI_THEME_TOKENS.table.headerBg}`}>
                Field
              </th>
              {renderedRows.map((row, rowIndex) => {
                const label = String(row.cells[titleColumnIndex] ?? '').trim() || `Row ${rowIndex + 1}`
                return (
                  <th
                    key={row.id}
                    className={`${headerPaddingClassName} text-left font-semibold border-b ${UI_THEME_TOKENS.table.cellBorder} sticky top-0 z-10 ${UI_THEME_TOKENS.table.headerBg}`}
                  >
                    <span className={[UI_TEXT_TRUNCATE, 'block max-w-[14rem]'].join(' ')}>{readMarkdownDataViewTableCellPreviewText(label)}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className={UI_THEME_TOKENS.table.text}>
            {visibleColumnMeta.map(({ col: c, index: colIndex }) => {
              const type = (columnTypesById && columnTypesById[c.id]) || defaultColumnTypeForInferredKind(c.kind)
              const Icon = iconByColumnType[type] || Type
              const allowTypeEdit = Boolean(canConfigure && props.onChangeColumnType)
              const filterOps = c.kind === 'multi-select'
                ? [{ key: 'includes', label: 'includes' }, { key: 'contains', label: 'contains' }, { key: 'equals', label: 'equals' }]
                : c.kind === 'select'
                  ? [{ key: 'equals', label: 'equals' }, { key: 'contains', label: 'contains' }]
                  : [{ key: 'contains', label: 'contains' }, { key: 'equals', label: 'equals' }]
              return (
                <tr key={c.id} className={`${UI_THEME_TOKENS.table.rowHoverHighlight} transition-colors`}>
                  <th className={`${headerPaddingClassName} text-left font-semibold border-b ${UI_THEME_TOKENS.table.cellBorder} ${UI_THEME_TOKENS.table.headerBg}`}>
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
                          disableSort
                          disableInsert
                          disableDuplicate
                          disableDelete
                          disableMoveLeft
                          disableMoveRight
                        />
                      )}
                    />
                  </th>
                  {renderedRows.map(row => {
                    const value = String(row.cells[colIndex] ?? '')
                    const displayValue = readMarkdownSigilDisplayText(value)
                    const previewDisplayValue = readMarkdownDataViewTableCellPreviewText(displayValue)
                    const previewRawValue = displayValue === value ? previewDisplayValue : readMarkdownDataViewTableCellPreviewText(value)
                    const uiType = (columnTypesById && columnTypesById[c.id]) || defaultColumnTypeForInferredKind(c.kind)
                    const baseKind = columnTypeToBaseKind(uiType)
                    const isEditing = editing?.rowId === row.id && editing?.colId === c.id
                    const cellBase = `${cellPaddingClassName} border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`
                    if (isEditing) {
                      return (
                        <td key={`${row.id}:${c.id}`} className={cellBase}>
                          <InlineTextCellEditor
                            key={`${row.id}:${c.id}`}
                            ariaLabel={`Edit ${c.name}`}
                            initialValue={value}
                            textClassName={UI_THEME_TOKENS.text.primary}
                            onCommit={(next) => handleInlineTextCommit(row.id, c.id, next)}
                            onCancel={cancel}
                          />
                        </td>
                      )
                    }
                    const chips = baseKind === 'multi-select' ? splitMultiValues(value) : []
                    const href = uiType === 'link' ? safeLinkHref(value) : null
                    const progressValue = uiType === 'progress' ? Number(value) : NaN
                    return (
                      <td
                        key={`${row.id}:${c.id}`}
                        className={cellBase}
                        onClick={(e) => {
                          const el = e.target as HTMLElement | null
                          if (el?.closest('a,button,input,select,textarea')) return
                          e.preventDefault()
                          e.stopPropagation()
                          startEdit(row.id, c.id, value, e.currentTarget)
                        }}
                        role={canMutate ? 'button' : undefined}
                      >
                        {renderMarkdownDataViewTableCellImage(value) || (uiType === 'checkbox' ? (
                          <input
                            type="checkbox"
                            checked={isTruthy(value)}
                            disabled={!canMutate}
                            onChange={e => {
                              if (!canMutate) return
                              onUpdateCell({ rowId: row.id, columnId: c.id, nextValue: e.target.checked ? 'true' : '' })
                            }}
                          />
                        ) : uiType === 'progress' && Number.isFinite(progressValue) ? (
                          <section className={`${UI_RESPONSIVE_ELEMENT_ROW_CLASSNAME} gap-2`}>
                            <progress className={UI_RESPONSIVE_DATA_VIEW_TABLE_PROGRESS_CLASSNAME} value={Math.max(0, Math.min(100, progressValue))} max={100} />
                            <span className={['min-w-0', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.secondary].join(' ')}>{`${Math.round(Math.max(0, Math.min(100, progressValue)))}%`}</span>
                          </section>
                        ) : href ? (
                          <a className={[UI_RESPONSIVE_DATA_VIEW_TABLE_VALUE_CLASSNAME, fieldLineClassName, 'underline', UI_THEME_TOKENS.text.primary].join(' ')} href={href} target="_blank" rel="noreferrer">
                            {previewRawValue === value ? renderMarkdownSigilInlineText(value) : previewDisplayValue}
                          </a>
                        ) : baseKind === 'select' && value ? (
                          <DataViewTagChip value={value} />
                        ) : baseKind === 'multi-select' && chips.length ? (
                          <section className={`${uiToolbarRowScrollClassName} gap-1`}>
                            {chips.map(v => (
                              <DataViewTagChip key={v} value={v} />
                            ))}
                          </section>
                        ) : (
                          <span className={[UI_RESPONSIVE_DATA_VIEW_TABLE_VALUE_CLASSNAME, fieldLineClassName, value ? '' : UI_THEME_TOKENS.text.tertiary].join(' ')}>
                            {value ? (previewRawValue === value ? renderMarkdownSigilInlineText(value) : previewDisplayValue) : (canMutate ? '—' : '')}
                          </span>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {hiddenRowCount > 0 ? (
              <tr>
                <td
                  colSpan={renderedRows.length + 1}
                  className={`${cellPaddingClassName} border-b ${UI_THEME_TOKENS.table.cellBorder}`}
                >
                  <button
                    type="button"
                    className={[UI_RESPONSIVE_ACTION_ROW_CLASSNAME, 'gap-2 text-xs', UI_THEME_TOKENS.text.secondary, UI_THEME_TOKENS.button.hoverBg, 'px-2 py-1 rounded'].join(' ')}
                    onClick={() => setRenderedRowLimit(limit => Math.min(view.rows.length, limit + MARKDOWN_DATA_VIEW_TABLE_RENDER_ROW_INCREMENT))}
                  >
                    <span className={UI_TEXT_TRUNCATE}>{`Show ${Math.min(hiddenRowCount, MARKDOWN_DATA_VIEW_TABLE_RENDER_ROW_INCREMENT)} more columns`}</span>
                  </button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    )
  }

  return (
    <section className={UI_RESPONSIVE_DATA_VIEW_TABLE_FRAME_CLASSNAME} aria-label="Table view">
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
                className={`${headerPaddingClassName} text-left font-semibold border-b ${UI_THEME_TOKENS.table.cellBorder} sticky top-0 z-10 ${UI_THEME_TOKENS.table.headerBg}`}
              >
                <section className="flex min-w-0 items-center gap-2 overflow-hidden">
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
                </section>
              </th>
              )
            })}
            {canMutate && props.onAddColumn ? (
              <th
                className={`${headerPaddingClassName} text-left font-semibold border-b ${UI_THEME_TOKENS.table.cellBorder} sticky top-0 z-10 ${UI_THEME_TOKENS.table.headerBg}`}
              >
                <MarkdownDataViewAddColumnMenu
                  ariaLabel="Add column"
                  nextColumnNumber={view.columns.length + 1}
                  canMutate={canMutate}
                  onAddColumn={props.onAddColumn}
                  summaryClassName={['list-none', UI_RESPONSIVE_MENU_ICON_ACTION_CLASSNAME, 'rounded border cursor-pointer', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
                  menuPositionClassName={`kg-data-view-add-column-menu absolute right-0 mt-2 ${UI_RESPONSIVE_DATA_VIEW_MENU_PANEL_CLASSNAME}`}
                />
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className={UI_THEME_TOKENS.table.text}>
          {renderedRows.map(r => (
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
                const displayValue = readMarkdownSigilDisplayText(value)
                const previewDisplayValue = readMarkdownDataViewTableCellPreviewText(displayValue)
                const previewRawValue = displayValue === value ? previewDisplayValue : readMarkdownDataViewTableCellPreviewText(value)
                const isPreviewTruncated = previewDisplayValue !== displayValue
                const uiType = (columnTypesById && columnTypesById[c.id]) || defaultColumnTypeForInferredKind(c.kind)
                const baseKind = columnTypeToBaseKind(uiType)
                const isEditing = editing?.rowId === r.id && editing?.colId === c.id
                const cellBase = `${cellPaddingClassName} border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`
                if (isEditing) {
                  const isSelect = baseKind === 'select' && uiType !== 'checkbox'
                  const isCheckbox = uiType === 'checkbox'
                  const isMulti = baseKind === 'multi-select'
                  return (
                    <td key={c.id} className={cellBase}>
                      {isCheckbox ? (
                        <label className={`${UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME} gap-2`}>
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
                            <section className={`${uiToolbarRowScrollClassName} gap-1`}>
                              {chips.map(v => (
                                <DataViewTagChip key={v} value={v} />
                              ))}
                            </section>
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
                    {renderMarkdownDataViewTableCellImage(value) || (uiType === 'checkbox' ? (
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
                      <section className={`${UI_RESPONSIVE_ELEMENT_ROW_CLASSNAME} gap-2`}>
                        <progress className={UI_RESPONSIVE_DATA_VIEW_TABLE_PROGRESS_CLASSNAME} value={Math.max(0, Math.min(100, progressValue))} max={100} />
                        <span className={['min-w-0', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.secondary].join(' ')}>{`${Math.round(Math.max(0, Math.min(100, progressValue)))}%`}</span>
                      </section>
                    ) : href ? (
                      <a className={[UI_RESPONSIVE_DATA_VIEW_TABLE_VALUE_CLASSNAME, fieldLineClassName, 'underline', UI_THEME_TOKENS.text.primary].join(' ')} href={href} target="_blank" rel="noreferrer" aria-label={isPreviewTruncated ? previewDisplayValue : undefined}>
                        {previewRawValue === value ? renderMarkdownSigilInlineText(value) : previewDisplayValue}
                      </a>
                    ) : baseKind === 'select' && value ? (
                      <DataViewTagChip value={value} />
                    ) : baseKind === 'multi-select' && chips.length ? (
                      <section className={`${uiToolbarRowScrollClassName} gap-1`}>
                        {chips.map(v => (
                          <DataViewTagChip key={v} value={v} />
                        ))}
                      </section>
                    ) : (
                      <span className={[UI_RESPONSIVE_DATA_VIEW_TABLE_VALUE_CLASSNAME, fieldLineClassName, value ? '' : UI_THEME_TOKENS.text.tertiary].join(' ')} aria-label={isPreviewTruncated ? previewDisplayValue : undefined}>
                        {value ? (previewRawValue === value ? renderMarkdownSigilInlineText(value) : previewDisplayValue) : (canMutate ? '—' : '')}
                      </span>
                    ))}
                  </td>
                )
              })}
              {canMutate && props.onAddColumn ? (
                <td className={`${headerPaddingClassName} border-b ${UI_THEME_TOKENS.table.cellBorder}`} />
              ) : null}
            </tr>
          ))}
          {canMutate && props.onNewRecord ? (
            <tr>
              <td
                colSpan={visibleColumnMeta.length + (canMutate && props.onAddColumn ? 1 : 0)}
                className={`${cellPaddingClassName} border-b ${UI_THEME_TOKENS.table.cellBorder}`}
              >
                <button
                  type="button"
                  className={[UI_RESPONSIVE_ACTION_ROW_CLASSNAME, 'gap-2 text-xs', UI_THEME_TOKENS.text.tertiary, UI_THEME_TOKENS.button.hoverBg, 'px-2 py-1 rounded'].join(' ')}
                  onClick={() => props.onNewRecord?.()}
                >
                  <Plus className={[UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME, UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                  <span className={UI_TEXT_TRUNCATE}>{MARKDOWN_DATA_VIEW_COPY.newRecordLabel}</span>
                </button>
              </td>
            </tr>
          ) : null}
          {hiddenRowCount > 0 ? (
            <tr>
              <td
                colSpan={visibleColumnMeta.length + (canMutate && props.onAddColumn ? 1 : 0)}
                className={`${cellPaddingClassName} border-b ${UI_THEME_TOKENS.table.cellBorder}`}
              >
                <button
                  type="button"
                  className={[UI_RESPONSIVE_ACTION_ROW_CLASSNAME, 'gap-2 text-xs', UI_THEME_TOKENS.text.secondary, UI_THEME_TOKENS.button.hoverBg, 'px-2 py-1 rounded'].join(' ')}
                  onClick={() => setRenderedRowLimit(limit => Math.min(view.rows.length, limit + MARKDOWN_DATA_VIEW_TABLE_RENDER_ROW_INCREMENT))}
                >
                  <span className={UI_TEXT_TRUNCATE}>{`Show ${Math.min(hiddenRowCount, MARKDOWN_DATA_VIEW_TABLE_RENDER_ROW_INCREMENT)} more rows`}</span>
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
      className={['inline-block w-full', MARKDOWN_TEXT_EDIT_SURFACE_MIN_LINE_HEIGHT_CLASS, 'whitespace-pre-wrap break-words outline-none', textClassName].join(' ')}
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
