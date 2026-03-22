import React from 'react'
import { ArrowUpDown, ChevronDown, Filter, MoreHorizontal, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import type { MarkdownWorkspaceDerivedViewerMode } from './MarkdownWorkspaceDerivedViewer'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { MarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'
import { MarkdownDataViewAddColumnMenu } from '@/features/markdown/ui/MarkdownDataViewAddColumnMenu'
import type { WorkspaceDataViewConfig } from './workspaceDataViewConfig'
import { WorkspaceDataViewFilterMenu } from './WorkspaceDataViewFilterMenu'
import { WorkspaceDataViewSettingsDialog } from './WorkspaceDataViewSettingsDialog'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

type SortMode = 'none' | 'title_asc' | 'title_desc'

const SORT_OPTIONS: readonly { key: SortMode; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'title_asc', label: 'Title (A → Z)' },
  { key: 'title_desc', label: 'Title (Z → A)' },
] as const

export type WorkspaceDataViewHeaderState = {
  searchQuery: string
  visibleGroups: readonly string[] | null
  sortMode: SortMode
}

export function WorkspaceDataViewHeader(props: {
  title: string
  viewerMode: MarkdownWorkspaceDerivedViewerMode
  canMutate: boolean
  columns: readonly MarkdownDataViewColumn[]
  groupByColumnId: string | null
  viewConfig: WorkspaceDataViewConfig | null
  setViewConfig: (next: WorkspaceDataViewConfig) => void
  openSettings: () => void
  settingsOpen: boolean
  closeSettings: () => void
  tableSelector?: React.ReactNode
  groupOptions: readonly string[]
  state: WorkspaceDataViewHeaderState
  onChangeState: (next: WorkspaceDataViewHeaderState) => void
  onChangeViewerMode?: (mode: MarkdownWorkspaceDerivedViewerMode) => void
  onNewRecord?: () => void
  onAddColumn?: (args: { name: string; columnType: MarkdownDataViewColumnType }) => void
  onReset: () => void
}) {
  const typography = usePanelTypography()
  const setState = props.onChangeState

  const groupByDetailsRef = React.useRef<HTMLDetailsElement | null>(null)

  const filterDetailsRef = React.useRef<HTMLDetailsElement | null>(null)

  const icon12Class = ['w-3 h-3', UI_THEME_TOKENS.icon.color].join(' ')
  const icon14Class = ['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')

  const viewTitle = props.viewerMode === 'read' ? `Read ${props.title}` : MARKDOWN_DATA_VIEW_COPY.titleDefault
  const viewModeLabel =
    props.viewerMode === 'read'
      ? 'Read'
      : props.viewerMode === 'kanban'
        ? MARKDOWN_DATA_VIEW_COPY.kanbanViewLabel
        : MARKDOWN_DATA_VIEW_COPY.tableViewLabel
  const hasActiveFilters = !!(props.state.searchQuery.trim() || props.state.visibleGroups || props.state.sortMode !== 'none')

  const groupByOptions = React.useMemo(() => {
    const cols = props.columns.filter(c => c.kind === 'select' || c.kind === 'multi-select')
    const byId = new Set(cols.map(c => c.id))
    const current = props.groupByColumnId
    if (current && !byId.has(current)) {
      const currentCol = props.columns.find(c => c.id === current)
      if (currentCol) cols.unshift(currentCol)
    }
    return cols.map(c => ({ id: c.id, name: c.name }))
  }, [props.columns, props.groupByColumnId])

  const groupByLabel = React.useMemo(() => {
    const id = props.groupByColumnId
    if (!id) return 'Group'
    return props.columns.find(c => c.id === id)?.name || 'Group'
  }, [props.columns, props.groupByColumnId])

  const setGroupByColumnId = React.useCallback(
    (next: string | null) => {
      if (!props.viewConfig) return
      props.setViewConfig({ ...props.viewConfig, groupByColumnId: next })
      const el = groupByDetailsRef.current
      if (el) el.open = false
    },
    [props.setViewConfig, props.viewConfig],
  )

  return (
    <WorkspaceHeader ariaLabel="Data view header" border="border">
      <section className="flex items-center gap-2 px-3 pt-2 min-w-0" aria-label="Data view controls">
        <h2
          className={['text-base font-semibold leading-6 truncate overflow-hidden whitespace-nowrap', UI_THEME_TOKENS.text.primary].join(' ')}
          title={viewTitle}
        >
          {viewTitle}
        </h2>
        <span className={['text-xs px-2 py-1 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {viewModeLabel}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <form className={['flex items-center gap-2 px-2 py-1 rounded border', UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.bg].join(' ')} role="search">
            <Search className={icon12Class} aria-hidden="true" />
            <span className="sr-only">{MARKDOWN_DATA_VIEW_COPY.searchLabel}</span>
            <input
              className={['bg-transparent outline-none text-xs w-[180px]', UI_THEME_TOKENS.input.text].join(' ')}
              placeholder={MARKDOWN_DATA_VIEW_COPY.searchPlaceholder}
              value={props.state.searchQuery}
              onChange={e => setState({ ...props.state, searchQuery: e.target.value })}
            />
          </form>

          <details className="relative" ref={filterDetailsRef}>
            <summary
              className={['list-none flex items-center justify-center w-8 h-8 rounded border cursor-pointer', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
              aria-label={MARKDOWN_DATA_VIEW_COPY.filterLabel}
            >
              <Filter className={icon14Class} aria-hidden="true" />
            </summary>
            <menu
              className={[
                'absolute right-0 mt-2 rounded border shadow-sm p-2 z-10',
                UI_THEME_TOKENS.panel.bg,
                UI_THEME_TOKENS.panel.border,
              ].join(' ')}
              aria-label={MARKDOWN_DATA_VIEW_COPY.filterMenuAriaLabel}
            >
              <li className="list-none">
                <WorkspaceDataViewFilterMenu
                  columns={props.columns}
                  viewConfig={props.viewConfig}
                  setViewConfig={props.setViewConfig}
                  onCloseMenu={() => {
                    const el = filterDetailsRef.current
                    if (el) el.open = false
                  }}
                />
              </li>
            </menu>
          </details>

          <details className="relative">
            <summary
              className={['list-none flex items-center justify-center w-8 h-8 rounded border cursor-pointer', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
              aria-label={MARKDOWN_DATA_VIEW_COPY.sortLabel}
            >
              <ArrowUpDown className={icon14Class} aria-hidden="true" />
            </summary>
            <menu
              className={[
                'absolute right-0 mt-2 w-[220px] rounded border shadow-sm p-2 z-10',
                UI_THEME_TOKENS.panel.bg,
                UI_THEME_TOKENS.panel.border,
              ].join(' ')}
              aria-label={MARKDOWN_DATA_VIEW_COPY.sortMenuAriaLabel}
            >
              {SORT_OPTIONS.map(o => (
                <li key={o.key} className="list-none">
                  <button
                    type="button"
                    className={[
                      'w-full text-left px-2 py-1.5 rounded text-xs',
                      props.state.sortMode === o.key ? 'bg-blue-600 text-white' : UI_THEME_TOKENS.button.hoverBg,
                    ].join(' ')}
                    onClick={() => setState({ ...props.state, sortMode: o.key })}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </menu>
          </details>

          <MarkdownDataViewAddColumnMenu
            ariaLabel="Add column"
            nextColumnNumber={props.columns.length + 1}
            canMutate={props.canMutate}
            onAddColumn={props.onAddColumn}
            summaryClassName={['list-none flex items-center justify-center w-8 h-8 rounded border cursor-pointer', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
            menuPositionClassName="absolute right-0 mt-2 w-[280px]"
          />

          <details className="relative">
            <summary
              className={['list-none flex items-center justify-center w-8 h-8 rounded border cursor-pointer', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
              aria-label="More"
            >
              <MoreHorizontal className={icon14Class} aria-hidden="true" />
            </summary>
            <menu
              className={[
                'absolute right-0 mt-2 w-[220px] rounded border shadow-sm p-2 z-10',
                UI_THEME_TOKENS.panel.bg,
                UI_THEME_TOKENS.panel.border,
              ].join(' ')}
              aria-label={MARKDOWN_DATA_VIEW_COPY.moreMenuAriaLabel}
            >
              <li className="list-none">
                <div className={['text-xs font-medium mb-1 px-2', UI_THEME_TOKENS.text.secondary].join(' ')}>Visible columns</div>
                <div className="flex flex-wrap gap-1 px-2 pb-1">
                  {props.groupOptions.map(k => {
                    const active = props.state.visibleGroups ? props.state.visibleGroups.includes(k) : true
                    return (
                      <button
                        key={k}
                        type="button"
                        className={[
                          'text-[10px] px-2 py-1 rounded border',
                          active ? 'bg-blue-600 text-white border-blue-600' : [UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary, UI_THEME_TOKENS.button.hoverBg].join(' '),
                        ].join(' ')}
                        onClick={() => {
                          const nextActive = props.state.visibleGroups ? new Set(props.state.visibleGroups) : new Set(props.groupOptions)
                          if (active) nextActive.delete(k)
                          else nextActive.add(k)
                          const next = Array.from(nextActive)
                          setState({ ...props.state, visibleGroups: next.length === props.groupOptions.length ? null : next })
                        }}
                      >
                        {k}
                      </button>
                    )
                  })}
                </div>
              </li>
              <li className={['list-none my-2 h-px', UI_THEME_TOKENS.panel.divider].join(' ')} />
              <li className="list-none">
                <button
                  type="button"
                  className={['w-full text-left px-2 py-1.5 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                  onClick={() => props.onReset()}
                >
                  Reset view state
                </button>
              </li>
              <li className="list-none">
                <div className={['px-2 py-1.5 text-[10px]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                  {props.canMutate ? 'Editable' : 'Read-only'}
                  {hasActiveFilters ? ' • Filtered' : ''}
                </div>
              </li>
            </menu>
          </details>

          <button
            type="button"
            className={['inline-flex items-center gap-2 px-3 h-8 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
            onClick={() => props.openSettings()}
          >
            <SlidersHorizontal className={icon14Class} aria-hidden="true" />
            <span className={['text-xs font-medium', UI_THEME_TOKENS.text.primary].join(' ')}>{MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}</span>
          </button>

          {props.canMutate && props.onNewRecord ? (
            <button
              type="button"
              className={['inline-flex items-center gap-2 px-3 h-8 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
              onClick={() => props.onNewRecord?.()}
            >
              <Plus className={icon14Class} aria-hidden="true" />
              <span className={['text-xs font-medium', UI_THEME_TOKENS.text.primary].join(' ')}>{MARKDOWN_DATA_VIEW_COPY.newRecordLabel}</span>
            </button>
          ) : null}
        </div>
      </section>

      <section className="flex items-center gap-2 px-3 pb-2" aria-label="Data view header">

        {props.viewerMode === 'kanban' ? (
          <details className="relative ml-2" ref={groupByDetailsRef}>
            <summary
              className={[
                'list-none cursor-pointer inline-flex items-center gap-2 px-3 h-8 rounded border',
                UI_THEME_TOKENS.panel.border,
                UI_THEME_TOKENS.button.hoverBg,
              ].join(' ')}
              aria-label="Group by"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ChevronDown className={['w-3 h-3 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                <span className="truncate">{groupByLabel}</span>
              </div>
            </summary>
            <menu
              className={[
                'absolute left-0 mt-2 w-[220px] rounded border shadow-sm p-2 z-10',
                UI_THEME_TOKENS.panel.bg,
                UI_THEME_TOKENS.panel.border,
              ].join(' ')}
              aria-label="Group by column"
            >
              <li className="list-none">
                <button
                  type="button"
                  className={['w-full text-left px-2 py-1.5 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                  onClick={() => {
                    setGroupByColumnId(null)
                    props.onChangeViewerMode?.('table')
                  }}
                >
                  None (Table)
                </button>
              </li>
              <li className={['list-none my-2 h-px', UI_THEME_TOKENS.panel.divider].join(' ')} />
              {groupByOptions.map(o => (
                <li key={o.id} className="list-none">
                  <button
                    type="button"
                    className={[
                      'w-full text-left px-2 py-1.5 rounded text-xs',
                      props.groupByColumnId === o.id ? 'bg-blue-600 text-white' : UI_THEME_TOKENS.button.hoverBg,
                    ].join(' ')}
                    onClick={() => setGroupByColumnId(o.id)}
                  >
                    {o.name}
                  </button>
                </li>
              ))}
            </menu>
          </details>
        ) : null}

        {props.tableSelector ? (
          <div className="ml-2">
            <div className={['inline-flex items-center gap-2', typography.microLabelClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
              <span>Source</span>
              {props.tableSelector}
            </div>
          </div>
        ) : null}
      </section>

      {props.viewConfig ? (
        <WorkspaceDataViewSettingsDialog
          open={props.settingsOpen}
          canMutate={props.canMutate}
          viewerLayout={props.viewerMode === 'table' ? 'table' : 'kanban'}
          columns={props.columns}
          groupByColumnId={props.groupByColumnId}
          viewConfig={props.viewConfig}
          setViewConfig={props.setViewConfig}
          onChangeLayout={(layout) => {
            props.setViewConfig({ ...props.viewConfig!, layout })
            props.onChangeViewerMode?.(layout)
          }}
          onClose={props.closeSettings}
        />
      ) : null}
    </WorkspaceHeader>
  )
}
