import React from 'react'
import { ArrowUpDown, Check, Filter, Layers, LayoutGrid, MoreHorizontal, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import type { MarkdownWorkspaceDerivedViewerMode } from './MarkdownWorkspaceDerivedViewer'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { MarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'
import { MarkdownDataViewAddColumnMenu } from '@/features/markdown/ui/MarkdownDataViewAddColumnMenu'
import type { WorkspaceDataViewConfig } from './workspaceDataViewConfig'
import { WorkspaceDataViewSettingsDialog } from './WorkspaceDataViewSettingsDialog'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import {
  FLOATING_MENU_BUTTON_CLASSNAME,
  FLOATING_MENU_DIVIDER_CLASSNAME,
  FLOATING_MENU_LEFT_W220_CLASSNAME,
  FLOATING_MENU_RIGHT_W220_CLASSNAME,
} from './floatingMenuStyles'
import { getWorkspaceEditorModeLabel } from '@/features/workspace-table/workspaceEditorModePresentation'

type SortMode = 'none' | 'title_asc' | 'title_desc'
type LayoutMode = 'table' | 'multiDimTable' | 'kanban' | 'geospatial'

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
  openSettingsPanel?: (panel: 'layout' | 'properties' | 'filter' | 'sort' | 'group') => void
  settingsOpen: boolean
  settingsPanel?: 'layout' | 'properties' | 'filter' | 'sort' | 'group' | 'duplicate' | 'delete'
  closeSettings: () => void
  tableSelector?: React.ReactNode
  groupOptions: readonly string[]
  state: WorkspaceDataViewHeaderState
  onChangeState: (next: WorkspaceDataViewHeaderState) => void
  onChangeViewerMode?: (mode: MarkdownWorkspaceDerivedViewerMode) => void
  onSelectGeospatialView?: () => void
  supportsMultiDimLayout?: boolean
  onNewRecord?: () => void
  onAddColumn?: (args: { name: string; columnType: MarkdownDataViewColumnType }) => void
  onReset: () => void
}) {
  const supportsMultiDimLayout = props.supportsMultiDimLayout ?? false
  const setState = props.onChangeState
  const viewConfig = props.viewConfig
  const setViewConfig = props.setViewConfig
  const onChangeViewerMode = props.onChangeViewerMode

  const [searchExpandedRaw, setSearchExpandedRaw] = React.useState(false)
  const searchExpanded = searchExpandedRaw || props.state.searchQuery.trim().length > 0
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  const layoutDetailsRef = React.useRef<HTMLDetailsElement | null>(null)

  const icon12Class = ['w-3 h-3', UI_THEME_TOKENS.icon.color].join(' ')
  const icon14Class = ['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')
  const squareIconButtonClassName = ['inline-flex', UI_THEME_TOKENS.button.square, 'rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')
  const squareIconSummaryClassName = ['list-none cursor-pointer', UI_THEME_TOKENS.button.square, 'rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')

  const viewModeLabel =
    props.viewConfig?.geospatialViewEnabled === true
      ? MARKDOWN_DATA_VIEW_COPY.geospatialViewLabel
      : props.viewerMode === 'read'
        ? 'Read'
        : props.viewerMode === 'geospatial'
          ? MARKDOWN_DATA_VIEW_COPY.geospatialViewLabel
          : getWorkspaceEditorModeLabel(props.viewerMode)
  const hasActiveFilters = !!(props.state.searchQuery.trim() || props.state.visibleGroups)

  const groupByLabel = React.useMemo(() => {
    const id = props.groupByColumnId
    if (!id) return 'Group'
    return props.columns.find(c => c.id === id)?.name || 'Group'
  }, [props.columns, props.groupByColumnId])

  const openSettingsPanel = (panel: 'layout' | 'properties' | 'filter' | 'sort' | 'group') => {
    if (props.openSettingsPanel) {
      props.openSettingsPanel(panel)
      return
    }
    props.openSettings()
  }
  const applyLayoutMode = React.useCallback((mode: LayoutMode) => {
    if (mode === 'geospatial') {
      props.onSelectGeospatialView?.()
      return
    }
    if (props.viewerMode === mode) return
    const nextLayout = mode === 'kanban' ? 'kanban' : 'table'
    if (viewConfig && (viewConfig.layout !== nextLayout || viewConfig.geospatialViewEnabled === true)) {
      setViewConfig({ ...viewConfig, layout: nextLayout, geospatialViewEnabled: false })
    }
    onChangeViewerMode?.(mode)
  }, [onChangeViewerMode, props.onSelectGeospatialView, props.viewerMode, setViewConfig, viewConfig])

  return (
    <WorkspaceHeader ariaLabel="Data view header" border="border" className="relative z-20">
      <section className="flex items-center gap-2 px-3 pt-2 min-w-0" aria-label="Data view controls">
        <details className="relative z-30" ref={layoutDetailsRef}>
          <summary
            className={squareIconSummaryClassName}
            aria-label={`Layout: ${viewModeLabel}`}
          >
            <LayoutGrid className={icon14Class} aria-hidden="true" />
          </summary>
          <menu className={FLOATING_MENU_LEFT_W220_CLASSNAME} aria-label="Layout mode options">
            <li className="list-none">
              <button
                type="button"
                className={[
                  FLOATING_MENU_BUTTON_CLASSNAME,
                  props.viewerMode === 'table' ? 'bg-blue-600 text-white' : '',
                ].join(' ')}
                onClick={() => {
                  applyLayoutMode('table')
                  const el = layoutDetailsRef.current
                  if (el) el.open = false
                }}
              >
                <span className="inline-flex items-center justify-between w-full gap-2">
                  <span>{MARKDOWN_DATA_VIEW_COPY.tableViewLabel}</span>
                  {props.viewerMode === 'table' ? <Check className="w-3 h-3" aria-hidden="true" /> : <span className="w-3 h-3" aria-hidden="true" />}
                </span>
              </button>
            </li>
            {supportsMultiDimLayout ? (
              <li className="list-none">
                <button
                  type="button"
                  className={[
                    FLOATING_MENU_BUTTON_CLASSNAME,
                    props.viewerMode === 'multiDimTable' ? 'bg-blue-600 text-white' : '',
                  ].join(' ')}
                  onClick={() => {
                    applyLayoutMode('multiDimTable')
                    const el = layoutDetailsRef.current
                    if (el) el.open = false
                  }}
                >
                  <span className="inline-flex items-center justify-between w-full gap-2">
                    <span>{MARKDOWN_DATA_VIEW_COPY.titleDefault}</span>
                    {props.viewerMode === 'multiDimTable' ? <Check className="w-3 h-3" aria-hidden="true" /> : <span className="w-3 h-3" aria-hidden="true" />}
                  </span>
                </button>
              </li>
            ) : null}
            <li className="list-none">
              <button
                type="button"
                className={[
                  FLOATING_MENU_BUTTON_CLASSNAME,
                  props.viewerMode === 'kanban' ? 'bg-blue-600 text-white' : '',
                ].join(' ')}
                onClick={() => {
                  applyLayoutMode('kanban')
                  const el = layoutDetailsRef.current
                  if (el) el.open = false
                }}
              >
                <span className="inline-flex items-center justify-between w-full gap-2">
                  <span>{MARKDOWN_DATA_VIEW_COPY.kanbanViewLabel}</span>
                  {props.viewerMode === 'kanban' ? <Check className="w-3 h-3" aria-hidden="true" /> : <span className="w-3 h-3" aria-hidden="true" />}
                </span>
              </button>
            </li>
            <li className="list-none">
              <button
                type="button"
                className={[
                  FLOATING_MENU_BUTTON_CLASSNAME,
                  props.viewConfig?.geospatialViewEnabled === true ? 'bg-blue-600 text-white' : '',
                ].join(' ')}
                onClick={() => {
                  applyLayoutMode('geospatial')
                  const el = layoutDetailsRef.current
                  if (el) el.open = false
                }}
              >
                <span className="inline-flex items-center justify-between w-full gap-2">
                  <span>{MARKDOWN_DATA_VIEW_COPY.geospatialViewLabel}</span>
                  {props.viewConfig?.geospatialViewEnabled === true ? <Check className="w-3 h-3" aria-hidden="true" /> : <span className="w-3 h-3" aria-hidden="true" />}
                </span>
              </button>
            </li>
          </menu>
        </details>
        <button
          type="button"
          className={squareIconButtonClassName}
          aria-label={`Group by: ${groupByLabel}`}
          onClick={() => openSettingsPanel('group')}
        >
          <Layers className={icon14Class} aria-hidden="true" />
        </button>
        <section className="ml-auto flex items-center gap-2" aria-label="Data view actions">
          {!searchExpanded ? (
            <button
              type="button"
              className={squareIconButtonClassName}
              aria-label={MARKDOWN_DATA_VIEW_COPY.searchLabel}
              onClick={() => {
                setSearchExpandedRaw(true)
                requestAnimationFrame(() => searchInputRef.current?.focus())
              }}
            >
              <Search className={icon14Class} aria-hidden="true" />
            </button>
          ) : (
            <form
              className={['flex items-center gap-2 px-2 py-1 rounded border', UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.bg].join(' ')}
              role="search"
              onSubmit={e => e.preventDefault()}
            >
              <Search className={icon12Class} aria-hidden="true" />
              <span className="sr-only">{MARKDOWN_DATA_VIEW_COPY.searchLabel}</span>
              <input
                ref={searchInputRef}
                className={['bg-transparent outline-none text-xs w-[180px]', UI_THEME_TOKENS.input.text].join(' ')}
                placeholder={MARKDOWN_DATA_VIEW_COPY.searchPlaceholder}
                value={props.state.searchQuery}
                onChange={e => setState({ ...props.state, searchQuery: e.target.value })}
                onBlur={() => {
                  if (!props.state.searchQuery.trim()) setSearchExpandedRaw(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape' && !props.state.searchQuery.trim()) setSearchExpandedRaw(false)
                }}
              />
            </form>
          )}

          <button
            type="button"
            className={squareIconButtonClassName}
            aria-label={MARKDOWN_DATA_VIEW_COPY.filterLabel}
            onClick={() => openSettingsPanel('filter')}
          >
            <Filter className={icon14Class} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={squareIconButtonClassName}
            aria-label={MARKDOWN_DATA_VIEW_COPY.sortLabel}
            onClick={() => openSettingsPanel('sort')}
          >
            <ArrowUpDown className={icon14Class} aria-hidden="true" />
          </button>

          <MarkdownDataViewAddColumnMenu
            ariaLabel="Add column"
            nextColumnNumber={props.columns.length + 1}
            canMutate={props.canMutate}
            onAddColumn={props.onAddColumn}
            summaryClassName={squareIconSummaryClassName}
            menuPositionClassName="absolute right-0 mt-2 w-[280px]"
          />

          <details className="relative z-30">
            <summary
              className={squareIconSummaryClassName}
              aria-label="More"
            >
              <MoreHorizontal className={icon14Class} aria-hidden="true" />
            </summary>
            <menu
              className={FLOATING_MENU_RIGHT_W220_CLASSNAME}
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
              <li className={FLOATING_MENU_DIVIDER_CLASSNAME} />
              <li className="list-none">
                <button
                  type="button"
                  className={FLOATING_MENU_BUTTON_CLASSNAME}
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

          <button type="button" className={squareIconButtonClassName} aria-label={MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel} onClick={() => props.openSettings()}>
            <SlidersHorizontal className={icon14Class} aria-hidden="true" />
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
        </section>
      </section>

      <section className="flex items-center gap-2 px-3 pb-2" aria-label="Data view header options">
        {props.tableSelector ? (
          <aside className="ml-2" aria-label="Data view table selector">
            <div className="inline-flex items-center gap-2" role="group" aria-label="Table selector">
              {props.tableSelector}
            </div>
          </aside>
        ) : null}
      </section>

      {props.viewConfig ? (
        <WorkspaceDataViewSettingsDialog
          open={props.settingsOpen}
          activePanel={props.settingsPanel}
          canMutate={props.canMutate}
          viewerLayout={props.viewerMode === 'kanban' ? 'kanban' : 'table'}
          viewerMode={props.viewerMode === 'kanban' ? 'kanban' : props.viewerMode === 'multiDimTable' ? 'multiDimTable' : 'table'}
          allowMultiDimLayout={supportsMultiDimLayout}
          columns={props.columns}
          groupByColumnId={props.groupByColumnId}
          viewConfig={viewConfig}
          setViewConfig={setViewConfig}
          onChangeLayoutMode={(mode) => {
            applyLayoutMode(mode)
          }}
          onChangeLayout={(layout) => {
            applyLayoutMode(layout)
          }}
          onSelectGeospatialView={props.onSelectGeospatialView}
          onClose={props.closeSettings}
        />
      ) : null}
    </WorkspaceHeader>
  )
}
