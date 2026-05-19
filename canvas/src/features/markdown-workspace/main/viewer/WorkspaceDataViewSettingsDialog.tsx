import React from 'react'
import { ArrowUpDown, Copy, Filter, Globe2, LayoutGrid, SlidersHorizontal, Table as TableIcon, Trash2 } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { WorkspaceDataViewConfig, WorkspaceDataViewLayout } from './workspaceDataViewConfig'
import { WorkspaceDataViewSettingsPropertiesSection } from './WorkspaceDataViewSettingsPropertiesSection'
import { WorkspaceDataViewSettingsFilterSection } from './WorkspaceDataViewSettingsFilterSection'
import { WorkspaceDataViewSettingsSortSection } from './WorkspaceDataViewSettingsSortSection'
import { LayoutChoice } from './WorkspaceDataViewSettingsPrimitives'
import { buildSuggestedRoles } from './workspaceDataViewGraphRoles'
import { WORKSPACE_EDITOR_MODE_OPTIONS, type WorkspaceEditorMode } from '@/features/workspace-table/workspaceEditorMode'
import { getWorkspaceEditorModeLabel } from '@/features/workspace-table/workspaceEditorModePresentation'
import { MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME } from '@/features/panels/ui/mainPanelSettingsSelectClass'
import { MainPanelSettingsPanelShell } from '@/features/panels/ui/MainPanelSettingsPanelShell'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { UI_RESPONSIVE_MENU_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import {
  uiToolbarResponsiveRowScrollClassName,
  uiToolbarRowScrollClassName,
} from '@/features/toolbar/ui/toolbarStyles'

type WorkspaceDataViewLayoutMode = WorkspaceEditorMode

export function WorkspaceDataViewSettingsDialog(props: {
  open: boolean
  activePanel?: 'layout' | 'properties' | 'filter' | 'sort' | 'group' | 'duplicate' | 'delete'
  canMutate: boolean
  viewerLayout: WorkspaceDataViewLayout
  viewerMode?: WorkspaceDataViewLayoutMode
  allowMultiDimLayout?: boolean
  columns: readonly MarkdownDataViewColumn[]
  groupByColumnId: string | null
  viewConfig: WorkspaceDataViewConfig
  setViewConfig: (next: WorkspaceDataViewConfig) => void
  onChangeLayout: (layout: WorkspaceDataViewLayout) => void
  onChangeLayoutMode?: (mode: WorkspaceDataViewLayoutMode) => void
  onSelectGeospatialView?: () => void
  onDuplicateColumn?: (columnId: string) => void
  onDeleteColumn?: (columnId: string) => void
  onRenameColumn?: (columnId: string, nextName: string) => void
  onClose: () => void
}) {
  const allowMultiDimLayout = props.allowMultiDimLayout ?? false
  const dialogRef = React.useRef<HTMLDialogElement | null>(null)
  const [activePanel, setActivePanel] = React.useState<'layout' | 'properties' | 'filter' | 'sort' | 'group' | 'duplicate' | 'delete'>('properties')
  const layoutModeOptions = React.useMemo(
    () => WORKSPACE_EDITOR_MODE_OPTIONS.filter(mode => allowMultiDimLayout || mode !== 'multiDimTable'),
    [allowMultiDimLayout],
  )

  React.useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (props.open) {
      if (!el.open) el.showModal()
      if (props.activePanel) setActivePanel(props.activePanel)
    } else {
      if (el.open) el.close()
      setActivePanel('properties')
    }
  }, [props.activePanel, props.open])

  const shownCount = React.useMemo(() => {
    return props.viewConfig.visibleColumnIds ? props.viewConfig.visibleColumnIds.length : props.columns.length
  }, [props.columns.length, props.viewConfig.visibleColumnIds])

  const groupableColumns = React.useMemo(() => {
    return props.columns.filter(c => c.kind === 'select' || c.kind === 'multi-select')
  }, [props.columns])
  const setGraphEnabled = (next: boolean) => {
    if ((props.viewConfig.graphEnabled === true) === next) return
    const nextView: WorkspaceDataViewConfig = { ...props.viewConfig, graphEnabled: next, geospatialViewEnabled: next ? props.viewConfig.geospatialViewEnabled : false }
    const hasAnyRole = props.viewConfig.graphRolesByColumnId && Object.keys(props.viewConfig.graphRolesByColumnId).length > 0
    if (next && !hasAnyRole) {
      nextView.graphRolesByColumnId = buildSuggestedRoles(props.columns)
    }
    props.setViewConfig(nextView)
  }

  return (
    <dialog
      ref={dialogRef}
      className={[
        'kg-data-view-settings-dialog rounded-lg p-0 border shadow-xl w-[720px] max-w-[92vw] h-[560px] max-h-[85vh] overflow-hidden',
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
      ].join(' ')}
      onMouseDown={e => {
        const el = dialogRef.current
        if (!el) return
        if (e.target === el) props.onClose()
      }}
      onCancel={e => {
        e.preventDefault()
        props.onClose()
      }}
      aria-label={MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}
    >
      <MainPanelSettingsPanelShell
        ariaLabel={MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}
        titleNode={(
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <h3 className={['text-base font-semibold min-w-0', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>{MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}</h3>
            <button
              type="button"
              className={['ml-auto inline-flex items-center justify-center w-8 h-8 rounded shrink-0', UI_THEME_TOKENS.button.hoverBg].join(' ')}
              aria-label="Close"
              onClick={() => props.onClose()}
            >
              <span className={UI_THEME_TOKENS.text.secondary}>✕</span>
            </button>
          </div>
        )}
        uiPanelKeyValueTextSizeClass="text-xs"
        className="h-full rounded-none border-0"
        headerClassName={['px-4 py-3 border-b', UI_THEME_TOKENS.panel.divider].join(' ')}
        bodyClassName="p-0"
      >
        <main className="kg-data-view-settings-layout flex h-full min-h-0">
          <nav
            className={[
              'kg-data-view-settings-nav w-[220px] shrink-0 border-r p-2 overflow-y-auto',
              uiToolbarResponsiveRowScrollClassName,
              UI_THEME_TOKENS.panel.divider,
            ].join(' ')}
            aria-label="View settings sections"
          >
            {([
              { key: 'layout' as const, label: 'Layout', icon: <LayoutGrid className="w-4 h-4" aria-hidden="true" /> },
              { key: 'properties' as const, label: 'Properties', icon: <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />, value: `${shownCount} shown` },
              { key: 'filter' as const, label: MARKDOWN_DATA_VIEW_COPY.filterLabel, icon: <Filter className="w-4 h-4" aria-hidden="true" /> },
              { key: 'sort' as const, label: MARKDOWN_DATA_VIEW_COPY.sortLabel, icon: <ArrowUpDown className="w-4 h-4" aria-hidden="true" /> },
              { key: 'group' as const, label: 'Group', icon: <LayoutGrid className="w-4 h-4" aria-hidden="true" /> },
              { key: 'duplicate' as const, label: 'Duplicate', icon: <Copy className="w-4 h-4" aria-hidden="true" /> },
              { key: 'delete' as const, label: 'Delete', icon: <Trash2 className="w-4 h-4" aria-hidden="true" /> },
            ] as const).map(item => {
              const active = activePanel === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  className={[
                    UI_RESPONSIVE_MENU_ROW_CLASSNAME,
                    'gap-2 px-2 py-2 rounded text-sm',
                    active
                      ? [UI_THEME_TOKENS.button.activeBg, UI_THEME_TOKENS.button.activeText].join(' ')
                      : [UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.primary].join(' '),
                  ].join(' ')}
                  onMouseEnter={() => setActivePanel(item.key)}
                  onFocus={() => setActivePanel(item.key)}
                >
                  <span className={['shrink-0', active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.icon.color].join(' ')}>{item.icon}</span>
                  <span className={['min-w-0', UI_TEXT_TRUNCATE].join(' ')}>{item.label}</span>
                  {'value' in item && item.value ? (
                    <span className={['ml-auto min-w-0 max-w-[45%] text-xs', UI_TEXT_TRUNCATE, active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.text.secondary].join(' ')}>{item.value}</span>
                  ) : null}
                </button>
              )
            })}
          </nav>

          <section className="kg-data-view-settings-panel min-w-0 flex-1 p-3 overflow-y-auto" aria-label="View settings panel">
          {activePanel === 'layout' ? (
            <section className="space-y-4" aria-label="Layout">
              <label className="block">
                <span className={['block text-xs mb-1', UI_THEME_TOKENS.text.secondary].join(' ')}>View name</span>
                <input
                  className={['w-full text-sm px-3 py-2 rounded border', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text].join(' ')}
                  value={props.viewConfig.name}
                  onChange={e => {
                    const nextName = e.target.value
                    if (nextName === props.viewConfig.name) return
                    props.setViewConfig({ ...props.viewConfig, name: nextName })
                  }}
                  placeholder="View name"
                />
              </label>

              <div>
                <div className={['flex items-center gap-2 text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>
                  <LayoutGrid className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                  <span>Layout</span>
                </div>
                <div className={`${uiToolbarRowScrollClassName} mt-2 gap-2`}>
                  {layoutModeOptions.map(mode => (
                    <LayoutChoice
                      key={mode}
                      active={(props.viewerMode || 'table') === mode}
                      label={getWorkspaceEditorModeLabel(mode)}
                      icon={mode === 'kanban' ? <LayoutGrid className="w-6 h-6" aria-hidden="true" /> : <TableIcon className="w-6 h-6" aria-hidden="true" />}
                      onClick={() => {
                        if ((props.viewerMode || 'table') === mode) return
                        if (props.onChangeLayoutMode) {
                          props.onChangeLayoutMode(mode)
                          return
                        }
                        props.onChangeLayout(mode === 'kanban' ? 'kanban' : 'table')
                      }}
                    />
                  ))}
                  <LayoutChoice
                    active={props.viewConfig.geospatialViewEnabled === true}
                    label={MARKDOWN_DATA_VIEW_COPY.geospatialViewLabel}
                    icon={<Globe2 className="w-6 h-6" aria-hidden="true" />}
                    onClick={() => {
                      props.onSelectGeospatialView?.()
                    }}
                  />
                </div>
              </div>

              <fieldset className={['rounded border p-3', UI_THEME_TOKENS.panel.border].join(' ')}>
                <legend className={['px-1 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>Multi-dimensional Table</legend>
                <div className={['text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>
                  Configure property mapping in Properties.
                </div>
                <label className="mt-3 flex min-w-0 max-w-full items-center gap-2" aria-label="Enable Multi-dimensional Table graph">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={props.viewConfig.graphEnabled === true}
                    onChange={e => setGraphEnabled(e.target.checked)}
                    disabled={!props.canMutate}
                  />
                  <span className={['min-w-0 text-sm', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>Enable table-to-graph rendering</span>
                </label>
              </fieldset>
            </section>
          ) : null}

          {activePanel === 'properties' ? (
            <WorkspaceDataViewSettingsPropertiesSection
              canMutate={props.canMutate}
              columns={props.columns}
              view={props.viewConfig}
              onChangeView={props.setViewConfig}
              onDuplicateColumn={props.onDuplicateColumn}
              onDeleteColumn={props.onDeleteColumn}
              onRenameColumn={props.onRenameColumn}
            />
          ) : null}

          {activePanel === 'filter' ? (
            <WorkspaceDataViewSettingsFilterSection columns={props.columns} view={props.viewConfig} onChangeView={props.setViewConfig} />
          ) : null}

          {activePanel === 'sort' ? (
            <WorkspaceDataViewSettingsSortSection columns={props.columns} view={props.viewConfig} onChangeView={props.setViewConfig} />
          ) : null}

          {activePanel === 'group' ? (
            <section aria-label="Group" className="space-y-2">
              <div className={['text-sm font-medium', UI_THEME_TOKENS.text.primary].join(' ')}>Group by</div>
              <select
                className={[MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME, 'w-full text-left'].join(' ')}
                value={props.viewConfig.groupByColumnId || ''}
                onChange={e => {
                  const nextGroupByColumnId = e.target.value || null
                  if ((props.viewConfig.groupByColumnId || null) === nextGroupByColumnId) return
                  props.setViewConfig({ ...props.viewConfig, groupByColumnId: nextGroupByColumnId })
                }}
              >
                <option value="">None</option>
                {groupableColumns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className={['text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>Grouping is available for Select / Multi-select properties.</div>
            </section>
          ) : null}

          {activePanel === 'duplicate' ? (
            <section aria-label="Duplicate" className="space-y-2">
              <div className={['text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>Duplicate view is not available yet.</div>
            </section>
          ) : null}

          {activePanel === 'delete' ? (
            <section aria-label="Delete" className="space-y-2">
              <div className={['text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>Delete view is not available yet.</div>
            </section>
          ) : null}
          </section>
        </main>
      </MainPanelSettingsPanelShell>
    </dialog>
  )
}
