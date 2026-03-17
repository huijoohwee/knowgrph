import React from 'react'
import { ChevronDown, ChevronRight, LayoutGrid, SlidersHorizontal, Table as TableIcon, Trash2, Copy } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import {
  defaultColumnTypeForInferredKind,
  labelForMarkdownDataViewColumnType,
  type MarkdownDataViewColumnType,
} from '@/features/markdown/ui/markdownDataViewColumnType'
import { MarkdownDataViewColumnTypeMenu } from '@/features/markdown/ui/MarkdownDataViewColumnTypeMenu'
import { iconByColumnType } from '@/features/markdown/ui/markdownDataViewColumnTypeMenuIcons'
import type { WorkspaceDataViewConfig, WorkspaceDataViewLayout } from './workspaceDataViewConfig'

type SettingsRowProps = {
  icon: React.ReactNode
  label: string
  value?: string
  onClick?: () => void
}

function SettingsRow(props: SettingsRowProps) {
  return (
    <button
      type="button"
      className={['w-full flex items-center gap-3 px-3 py-2 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
      onClick={props.onClick}
    >
      <span className={['w-5 h-5 flex items-center justify-center', UI_THEME_TOKENS.icon.color].join(' ')}>{props.icon}</span>
      <span className={['text-sm', UI_THEME_TOKENS.text.primary].join(' ')}>{props.label}</span>
      <span className={['ml-auto text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>{props.value || ''}</span>
      <ChevronRight className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
    </button>
  )
}

function LayoutChoice(props: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={[
        'flex-1 rounded border px-3 py-2 flex flex-col items-center justify-center gap-1',
        props.active ? 'border-blue-500 text-blue-600' : [UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' '),
        UI_THEME_TOKENS.button.hoverBg,
      ].join(' ')}
      onClick={props.onClick}
    >
      <span className={props.active ? 'text-blue-600' : UI_THEME_TOKENS.text.secondary}>{props.icon}</span>
      <span className={['text-sm font-medium', props.active ? 'text-blue-600' : UI_THEME_TOKENS.text.secondary].join(' ')}>{props.label}</span>
    </button>
  )
}

export function WorkspaceDataViewSettingsDialog(props: {
  open: boolean
  canMutate: boolean
  viewerLayout: WorkspaceDataViewLayout
  columns: readonly MarkdownDataViewColumn[]
  groupByColumnId: string | null
  viewConfig: WorkspaceDataViewConfig
  setViewConfig: (next: WorkspaceDataViewConfig) => void
  onChangeLayout: (layout: WorkspaceDataViewLayout) => void
  onClose: () => void
}) {
  const dialogRef = React.useRef<HTMLDialogElement | null>(null)
  const [propertiesOpen, setPropertiesOpen] = React.useState(false)

  React.useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (props.open) {
      if (!el.open) el.showModal()
    } else {
      if (el.open) el.close()
    }
  }, [props.open])

  const shownCount = props.viewConfig.visibleColumnIds ? props.viewConfig.visibleColumnIds.length : props.columns.length

  const setVisibleColumn = React.useCallback(
    (columnId: string, visible: boolean) => {
      const current = props.viewConfig.visibleColumnIds
      const allIds = props.columns.map(c => c.id)
      const set = new Set(current ?? allIds)
      if (visible) set.add(columnId)
      else set.delete(columnId)
      const nextIds = Array.from(set)
      props.setViewConfig({
        ...props.viewConfig,
        visibleColumnIds: nextIds.length === allIds.length ? null : nextIds,
      })
    },
    [props],
  )

  const setColumnType = React.useCallback(
    (args: { column: MarkdownDataViewColumn; nextType: MarkdownDataViewColumnType }) => {
      const defaultType = defaultColumnTypeForInferredKind(args.column.kind)
      const nextMap = { ...(props.viewConfig.columnTypesById ?? {}) }
      if (args.nextType === defaultType) delete nextMap[args.column.id]
      else nextMap[args.column.id] = args.nextType
      const normalized = Object.keys(nextMap).length ? nextMap : null
      props.setViewConfig({
        ...props.viewConfig,
        columnTypesById: normalized,
      })
    },
    [props],
  )

  const groupLabel = React.useMemo(() => {
    const c = props.columns.find(x => x.id === props.viewConfig.groupByColumnId)
    return c ? c.name : props.groupByColumnId ? (props.columns.find(x => x.id === props.groupByColumnId)?.name || '') : ''
  }, [props.columns, props.groupByColumnId, props.viewConfig.groupByColumnId])

  return (
    <dialog
      ref={dialogRef}
      className={[
        'rounded-lg p-0 border shadow-xl w-[360px] max-w-[92vw]',
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
      ].join(' ')}
      onCancel={e => {
        e.preventDefault()
        props.onClose()
      }}
      aria-label={MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}
    >
      <header className={['flex items-center gap-2 px-4 py-3 border-b', UI_THEME_TOKENS.panel.divider].join(' ')}>
        <h3 className={['text-base font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>{MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}</h3>
        <button
          type="button"
          className={['ml-auto inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
          aria-label="Close"
          onClick={() => props.onClose()}
        >
          <span className={UI_THEME_TOKENS.text.secondary}>✕</span>
        </button>
      </header>

      <main className="px-4 py-3">
        <label className="block">
          <span className="sr-only">View name</span>
          <input
            className={['w-full text-sm px-3 py-2 rounded border outline-none focus:ring-2 focus:ring-blue-500/50', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text].join(' ')}
            value={props.viewConfig.name}
            onChange={e => props.setViewConfig({ ...props.viewConfig, name: e.target.value })}
            placeholder="View name"
          />
        </label>

        <section className={['mt-3 pt-3 border-t', UI_THEME_TOKENS.panel.divider].join(' ')} aria-label="Layout">
          <div className={['flex items-center gap-2 text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>
            <LayoutGrid className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
            <span>Layout</span>
          </div>
          <div className="mt-2 flex gap-2">
            <LayoutChoice
              active={props.viewerLayout === 'table'}
              label={MARKDOWN_DATA_VIEW_COPY.tableViewLabel}
              icon={<TableIcon className="w-6 h-6" aria-hidden="true" />}
              onClick={() => props.onChangeLayout('table')}
            />
            <LayoutChoice
              active={props.viewerLayout === 'kanban'}
              label={MARKDOWN_DATA_VIEW_COPY.kanbanViewLabel}
              icon={<LayoutGrid className="w-6 h-6" aria-hidden="true" />}
              onClick={() => props.onChangeLayout('kanban')}
            />
          </div>
        </section>

        <section className={['mt-3 pt-3 border-t', UI_THEME_TOKENS.panel.divider].join(' ')} aria-label="View options">
          <SettingsRow
            icon={<SlidersHorizontal className="w-4 h-4" aria-hidden="true" />}
            label="Properties"
            value={`${shownCount} shown`}
            onClick={() => setPropertiesOpen(v => !v)}
          />

          {propertiesOpen ? (
            <section className={['mt-2 rounded border p-2', UI_THEME_TOKENS.panel.border].join(' ')} aria-label="Properties chooser">
              <ul className="m-0 p-0 list-none flex flex-col gap-1">
                {props.columns.map(c => {
                  const visible = props.viewConfig.visibleColumnIds ? props.viewConfig.visibleColumnIds.includes(c.id) : true
                  const type = (props.viewConfig.columnTypesById && props.viewConfig.columnTypesById[c.id]) || defaultColumnTypeForInferredKind(c.kind)
                  const Icon = iconByColumnType[type]
                  return (
                    <li key={c.id} className="list-none">
                      <div className={['flex items-center gap-2 px-2 py-1 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={e => setVisibleColumn(c.id, e.target.checked)}
                          />
                          <span className={['text-sm', UI_THEME_TOKENS.text.primary].join(' ')}>{c.name}</span>
                        </label>

                        <div className="ml-auto">
                          {props.canMutate ? (
                            <details className="relative">
                              <summary
                                className={[
                                  'list-none cursor-pointer inline-flex items-center gap-2 px-2 py-1 rounded border text-xs',
                                  UI_THEME_TOKENS.panel.border,
                                  UI_THEME_TOKENS.button.hoverBg,
                                  UI_THEME_TOKENS.text.primary,
                                ].join(' ')}
                                aria-label={`Column type: ${c.name}`}
                              >
                                <Icon className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                                <span className={UI_THEME_TOKENS.text.secondary}>{labelForMarkdownDataViewColumnType(type)}</span>
                                <ChevronDown className={['w-3 h-3', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                              </summary>
                              <MarkdownDataViewColumnTypeMenu
                                ariaLabel={`Column type: ${c.name}`}
                                value={type}
                                className="absolute right-0 mt-2 w-[240px]"
                                onSelect={(next) => setColumnType({ column: c, nextType: next })}
                              />
                            </details>
                          ) : (
                            <span className={['inline-flex items-center gap-2 px-2 py-1 rounded border text-xs', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}>
                              <Icon className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                              {labelForMarkdownDataViewColumnType(type)}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <SettingsRow
            icon={<span className={UI_THEME_TOKENS.text.secondary}>⦿</span>}
            label={MARKDOWN_DATA_VIEW_COPY.filterLabel}
            value={String(props.viewConfig.filterGroups.reduce((n, g) => n + g.rules.length, 0) || '')}
            onClick={() => {}}
          />

          <div className={['flex items-center gap-3 px-3 py-2 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}>
            <span className={['w-5 h-5 flex items-center justify-center', UI_THEME_TOKENS.icon.color].join(' ')}>
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className={['text-sm', UI_THEME_TOKENS.text.primary].join(' ')}>Group</span>
            <span className={['ml-auto text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>{groupLabel}</span>
            <select
              className={['ml-2 text-xs px-2 py-1 rounded border', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text].join(' ')}
              value={props.viewConfig.groupByColumnId || ''}
              onChange={e => props.setViewConfig({ ...props.viewConfig, groupByColumnId: e.target.value || null })}
            >
              <option value="">None</option>
              {props.columns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className={['mt-3 pt-3 border-t', UI_THEME_TOKENS.panel.divider].join(' ')} />
        <section aria-label="Danger zone">
          <button
            type="button"
            className={['w-full flex items-center gap-3 px-3 py-2 rounded', UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary].join(' ')}
            disabled
          >
            <Copy className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
            Duplicate
          </button>
          <button
            type="button"
            className={['w-full flex items-center gap-3 px-3 py-2 rounded', UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary].join(' ')}
            disabled
          >
            <Trash2 className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
            Delete
          </button>
        </section>
      </main>
    </dialog>
  )
}
