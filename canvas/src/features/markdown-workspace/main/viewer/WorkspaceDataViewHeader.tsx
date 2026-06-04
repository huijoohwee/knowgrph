import React from 'react'
import { ArrowUpDown, Filter, Layers, LayoutGrid, MoreHorizontal, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import type { MarkdownWorkspaceDerivedViewerMode } from './MarkdownWorkspaceDerivedViewer'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { WorkspaceDataViewConfig } from './workspaceDataViewConfig'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import {
  UI_RESPONSIVE_ACTION_ROW_CLASSNAME,
  UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_ACTION_DEFAULT_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_SEARCH_FORM_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_SEARCH_INPUT_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import {
  uiToolbarRowScrollClassName,
  uiToolbarRowScrollInlineClassName,
  uiToolbarRowScrollJustifyEndClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import {
  FLOATING_MENU_BUTTON_CLASSNAME,
} from './floatingMenuStyles'
import { getWorkspaceEditorModeLabel } from '@/features/workspace-table/workspaceEditorModePresentation'
import type { WorkspaceDataViewSettingsPanelKey } from './workspaceDataViewFloatingStore'

type SortMode = 'none' | 'title_asc' | 'title_desc'
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
  openSettingsPanel?: (panel: WorkspaceDataViewSettingsPanelKey) => void
  tableSelector?: React.ReactNode
  state: WorkspaceDataViewHeaderState
  onChangeState: (next: WorkspaceDataViewHeaderState) => void
  onChangeViewerMode?: (mode: MarkdownWorkspaceDerivedViewerMode) => void
  onSelectGeospatialView?: () => void
  supportsMultiDimLayout?: boolean
  onNewRecord?: () => void
}) {
  const setState = props.onChangeState

  const [searchExpandedRaw, setSearchExpandedRaw] = React.useState(false)
  const searchExpanded = searchExpandedRaw || props.state.searchQuery.trim().length > 0
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  const icon12Class = [UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME, UI_THEME_TOKENS.icon.color].join(' ')
  const icon14Class = ['w-4 h-4 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')
  const squareIconButtonClassName = [UI_RESPONSIVE_ACTION_ROW_CLASSNAME, 'shrink-0', UI_THEME_TOKENS.button.square, 'rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')
  const viewModeLabel =
    props.viewConfig?.geospatialViewEnabled === true
      ? MARKDOWN_DATA_VIEW_COPY.geospatialViewLabel
      : props.viewerMode === 'read'
        ? 'Read'
        : props.viewerMode === 'geospatial'
          ? MARKDOWN_DATA_VIEW_COPY.geospatialViewLabel
          : getWorkspaceEditorModeLabel(props.viewerMode)
  const groupByLabel = React.useMemo(() => {
    const id = props.groupByColumnId
    if (!id) return 'Group'
    return props.columns.find(c => c.id === id)?.name || 'Group'
  }, [props.columns, props.groupByColumnId])

  const openSettingsPanel = (panel: WorkspaceDataViewSettingsPanelKey) => {
    if (props.openSettingsPanel) {
      props.openSettingsPanel(panel)
      return
    }
    props.openSettings()
  }

  return (
    <WorkspaceHeader ariaLabel="Data view header" border="border" className="relative z-20 kg-data-view-header">
      <section className={`kg-data-view-header-controls ${uiToolbarRowScrollClassName} gap-2 px-3 pt-2`} aria-label="Data view controls">
        <button
          type="button"
          className={squareIconButtonClassName}
          aria-label={`Layout: ${viewModeLabel}`}
          onClick={() => openSettingsPanel('layout')}
        >
          <LayoutGrid className={icon14Class} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={squareIconButtonClassName}
          aria-label={`Group by: ${groupByLabel}`}
          onClick={() => openSettingsPanel('group')}
        >
          <Layers className={icon14Class} aria-hidden="true" />
        </button>
        <section className={`kg-data-view-actions ${uiToolbarRowScrollJustifyEndClassName} ml-auto gap-2`} aria-label="Data view actions">
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
              className={[UI_RESPONSIVE_DATA_VIEW_SEARCH_FORM_CLASSNAME, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.bg].join(' ')}
              role="search"
              onSubmit={e => e.preventDefault()}
            >
              <Search className={icon12Class} aria-hidden="true" />
              <span className="sr-only">{MARKDOWN_DATA_VIEW_COPY.searchLabel}</span>
              <input
                ref={searchInputRef}
                className={[UI_RESPONSIVE_DATA_VIEW_SEARCH_INPUT_CLASSNAME, 'bg-transparent outline-none text-xs', UI_THEME_TOKENS.input.text].join(' ')}
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

          <button
            type="button"
            className={squareIconButtonClassName}
            aria-label="Add column"
            onClick={() => openSettingsPanel('properties')}
          >
            <Plus className={icon14Class} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={squareIconButtonClassName}
            aria-label="More"
            onClick={() => openSettingsPanel('properties')}
          >
            <MoreHorizontal className={icon14Class} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={squareIconButtonClassName}
            aria-label={MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}
            onClick={() => openSettingsPanel('properties')}
          >
            <SlidersHorizontal className={icon14Class} aria-hidden="true" />
          </button>

          {props.canMutate && props.onNewRecord ? (
            <button
              type="button"
              className={[UI_RESPONSIVE_ACTION_ROW_CLASSNAME, UI_RESPONSIVE_DATA_VIEW_ACTION_DEFAULT_CLASSNAME, 'rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
              onClick={() => props.onNewRecord?.()}
            >
              <Plus className={icon14Class} aria-hidden="true" />
              <span className={['text-xs font-medium', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>{MARKDOWN_DATA_VIEW_COPY.newRecordLabel}</span>
            </button>
          ) : null}
        </section>
      </section>

      <section className={`kg-data-view-header-options ${uiToolbarRowScrollClassName} gap-2 px-3 pb-2`} aria-label="Data view header options">
        {props.tableSelector ? (
          <aside className="kg-data-view-table-selector ml-2 min-w-0 max-w-full" aria-label="Data view table selector">
            <section className={`${uiToolbarRowScrollInlineClassName} gap-2`} role="group" aria-label="Table selector">
              {props.tableSelector}
            </section>
          </aside>
        ) : null}
      </section>
    </WorkspaceHeader>
  )
}
