import React from 'react'
import { ArrowUpDown, Filter, Globe2, LayoutGrid, RotateCcw, SlidersHorizontal, Table as TableIcon } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import { WorkspaceDataViewSettingsPropertiesSection } from './WorkspaceDataViewSettingsPropertiesSection'
import { WorkspaceDataViewSettingsFilterSection } from './WorkspaceDataViewSettingsFilterSection'
import { WorkspaceDataViewSettingsSortSection } from './WorkspaceDataViewSettingsSortSection'
import { LayoutChoice } from './WorkspaceDataViewSettingsPrimitives'
import { buildSuggestedRoles } from './workspaceDataViewGraphRoles'
import { WORKSPACE_EDITOR_MODE_OPTIONS, type WorkspaceEditorMode } from '@/features/workspace-table/workspaceEditorMode'
import { getWorkspaceEditorModeLabel } from '@/features/workspace-table/workspaceEditorModePresentation'
import { MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME } from '@/features/panels/ui/mainPanelSettingsSelectClass'
import { MainPanelSettingsPanelShell } from '@/features/panels/ui/MainPanelSettingsPanelShell'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import ExpandCollapseAllButton from '@/features/panels/ui/ExpandCollapseAllButton'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { UI_RESPONSIVE_DATA_VIEW_HEADER_ACTIONS_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { uiToolbarRowScrollClassName } from '@/features/toolbar/ui/toolbarStyles'
import type { WorkspaceDataViewFloatingBinding, WorkspaceDataViewSettingsPanelKey } from './workspaceDataViewFloatingStore'

type WorkspaceDataViewSettingsPanelProps = Omit<WorkspaceDataViewFloatingBinding, 'registrationId'> & {
  title?: string
}

const VIEW_SECTION_HEADER_SPACING_CLASS_NAME = 'pt-[3px] pb-[3px]'

export function WorkspaceDataViewSettingsPanel(props: WorkspaceDataViewSettingsPanelProps) {
  const layoutModeOptions = React.useMemo(
    () => WORKSPACE_EDITOR_MODE_OPTIONS.filter(mode => props.allowMultiDimLayout || mode !== 'multiDimTable'),
    [props.allowMultiDimLayout],
  )

  const shownCount = React.useMemo(() => {
    return props.viewConfig.visibleColumnIds
      ? props.viewConfig.visibleColumnIds.length
      : props.columns.length
  }, [props.columns.length, props.viewConfig.visibleColumnIds])

  const groupableColumns = React.useMemo(() => {
    return props.columns.filter(c => c.kind === 'select' || c.kind === 'multi-select')
  }, [props.columns])

  const buildCollapsedState = React.useCallback(
    (expandedPanel?: WorkspaceDataViewSettingsPanelKey | null): Record<WorkspaceDataViewSettingsPanelKey, boolean> => ({
      layout: expandedPanel !== 'layout',
      properties: expandedPanel !== 'properties',
      filter: expandedPanel !== 'filter',
      sort: expandedPanel !== 'sort',
      group: expandedPanel !== 'group',
      reset: expandedPanel !== 'reset',
    }),
    [],
  )
  const [collapsedByPanel, setCollapsedByPanel] = React.useState<Record<WorkspaceDataViewSettingsPanelKey, boolean>>(
    () => buildCollapsedState(props.activePanel),
  )

  React.useEffect(() => {
    setCollapsedByPanel(buildCollapsedState(props.activePanel))
  }, [buildCollapsedState, props.activePanel])

  const setGraphEnabled = React.useCallback((next: boolean) => {
    if ((props.viewConfig.graphEnabled === true) === next) return
    const nextView = {
      ...props.viewConfig,
      graphEnabled: next,
      geospatialViewEnabled: next ? props.viewConfig.geospatialViewEnabled : false,
    }
    const hasAnyRole =
      props.viewConfig.graphRolesByColumnId
      && Object.keys(props.viewConfig.graphRolesByColumnId).length > 0
    if (next && !hasAnyRole) {
      nextView.graphRolesByColumnId = buildSuggestedRoles(props.columns)
    }
    props.onChangeLayoutMode?.(next ? 'multiDimTable' : 'table')
    props.setViewConfig(nextView)
  }, [props.columns, props.onChangeLayoutMode, props.setViewConfig, props.viewConfig])

  const title = props.title || MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel
  const sectionSummaries = React.useMemo(() => ([
    {
      key: 'layout' as const,
      title: 'Layout',
      value: getWorkspaceEditorModeLabel(props.viewerMode || 'table'),
      icon: <LayoutGrid className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: 'properties' as const,
      title: 'Properties',
      value: `${shownCount} shown`,
      icon: <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: 'filter' as const,
      title: MARKDOWN_DATA_VIEW_COPY.filterLabel,
      icon: <Filter className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: 'sort' as const,
      title: MARKDOWN_DATA_VIEW_COPY.sortLabel,
      icon: <ArrowUpDown className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: 'group' as const,
      title: 'Group',
      icon: <LayoutGrid className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: 'reset' as const,
      title: 'Reset',
      icon: <RotateCcw className="h-4 w-4" aria-hidden="true" />,
    },
  ]), [props.viewerMode, shownCount])
  const allCollapsed = React.useMemo(
    () => Object.values(collapsedByPanel).every(Boolean),
    [collapsedByPanel],
  )
  const collapseAll = React.useCallback(() => {
    setCollapsedByPanel(buildCollapsedState(null))
  }, [buildCollapsedState])
  const expandAll = React.useCallback(() => {
    setCollapsedByPanel({
      layout: false,
      properties: false,
      filter: false,
      sort: false,
      group: false,
      reset: false,
    })
  }, [])
  const togglePanel = React.useCallback((panel: WorkspaceDataViewSettingsPanelKey, next: boolean) => {
    setCollapsedByPanel(prev => {
      if (prev[panel] === next) return prev
      return { ...prev, [panel]: next }
    })
  }, [])
  const renderSectionTitle = React.useCallback((panel: WorkspaceDataViewSettingsPanelKey) => {
    const summary = sectionSummaries.find(item => item.key === panel)
    if (!summary) return null
    return (
      <span className="inline-flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
        <span className={['shrink-0', UI_THEME_TOKENS.icon.color].join(' ')}>
          {summary.icon}
        </span>
        <span className={['min-w-0', UI_TEXT_TRUNCATE].join(' ')}>
          {summary.title}
        </span>
        {summary.value ? (
          <span className={['shrink-0 text-[10px] uppercase tracking-wide', UI_THEME_TOKENS.text.tertiary].join(' ')}>
            {summary.value}
          </span>
        ) : null}
      </span>
    )
  }, [sectionSummaries])

  return (
    <MainPanelSettingsPanelShell
      ariaLabel={MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}
      titleNode={(
        <div className="flex min-w-0 max-w-full flex-col gap-1">
          <h3 className={['text-base font-semibold min-w-0', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>
            {title}
          </h3>
          <p className={['text-xs min-w-0', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.secondary].join(' ')}>
            {props.contextLabel}
          </p>
        </div>
      )}
      secondaryNode={(
        <ExpandCollapseAllButton
          allCollapsed={allCollapsed}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          titleExpand="Expand"
          titleCollapse="Collapse (Default)"
        />
      )}
      secondaryNodeClassName={`${UI_RESPONSIVE_DATA_VIEW_HEADER_ACTIONS_CLASSNAME} flex shrink-0 items-center justify-end gap-1 text-right`}
      uiPanelKeyValueTextSizeClass="text-xs"
      className="kg-data-view-settings-panel h-full rounded-none border-0"
      headerClassName={['px-3 py-3 border-b', UI_THEME_TOKENS.panel.divider].join(' ')}
      bodyClassName="p-0"
    >
      <main className="kg-data-view-settings-layout flex h-full min-h-0 flex-col">
        <section className="min-w-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="View settings panel">
          <CollapsibleSection
            title={renderSectionTitle('layout')}
            collapsed={collapsedByPanel.layout}
            onToggle={next => togglePanel('layout', next)}
            toolbarAligned
            stickyHeader={false}
            flushTop
            headerClassName={VIEW_SECTION_HEADER_SPACING_CLASS_NAME}
          >
            <section className="space-y-4" aria-label="Layout">
              <label className="block">
                <span className={['block text-xs mb-1', UI_THEME_TOKENS.text.secondary].join(' ')}>
                  View name
                </span>
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
                      icon={mode === 'kanban'
                        ? <LayoutGrid className="w-6 h-6" aria-hidden="true" />
                        : <TableIcon className="w-6 h-6" aria-hidden="true" />}
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
                <legend className={['px-1 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>
                  Multi-dimensional Table
                </legend>
                <div className={['text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>
                  Configure property mapping in Properties.
                </div>
                <label className="mt-3 flex min-w-0 max-w-full items-center gap-2" aria-label="Enable Multi-dimensional Table graph">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={props.viewConfig.graphEnabled === true}
                    onChange={e => setGraphEnabled(e.target.checked)}
                  />
                  <span className={['min-w-0 text-sm', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>
                    {MARKDOWN_DATA_VIEW_COPY.graphRenderingToggleLabel}
                  </span>
                </label>
              </fieldset>
            </section>
          </CollapsibleSection>

          <CollapsibleSection
            title={renderSectionTitle('properties')}
            collapsed={collapsedByPanel.properties}
            onToggle={next => togglePanel('properties', next)}
            toolbarAligned
            stickyHeader={false}
            headerClassName={VIEW_SECTION_HEADER_SPACING_CLASS_NAME}
          >
            <WorkspaceDataViewSettingsPropertiesSection
              canMutate={props.canMutate}
              columns={props.columns}
              view={props.viewConfig}
              onChangeView={props.setViewConfig}
              onAddColumn={props.onAddColumn}
              onDuplicateColumn={props.onDuplicateColumn}
              onDeleteColumn={props.onDeleteColumn}
              onRenameColumn={props.onRenameColumn}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={renderSectionTitle('filter')}
            collapsed={collapsedByPanel.filter}
            onToggle={next => togglePanel('filter', next)}
            toolbarAligned
            stickyHeader={false}
            headerClassName={VIEW_SECTION_HEADER_SPACING_CLASS_NAME}
          >
            <WorkspaceDataViewSettingsFilterSection
              columns={props.columns}
              view={props.viewConfig}
              onChangeView={props.setViewConfig}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={renderSectionTitle('sort')}
            collapsed={collapsedByPanel.sort}
            onToggle={next => togglePanel('sort', next)}
            toolbarAligned
            stickyHeader={false}
            headerClassName={VIEW_SECTION_HEADER_SPACING_CLASS_NAME}
          >
            <WorkspaceDataViewSettingsSortSection
              columns={props.columns}
              view={props.viewConfig}
              onChangeView={props.setViewConfig}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={renderSectionTitle('group')}
            collapsed={collapsedByPanel.group}
            onToggle={next => togglePanel('group', next)}
            toolbarAligned
            stickyHeader={false}
            headerClassName={VIEW_SECTION_HEADER_SPACING_CLASS_NAME}
          >
            <section aria-label="Group" className="space-y-2">
              <div className={['text-sm font-medium', UI_THEME_TOKENS.text.primary].join(' ')}>
                Group by
              </div>
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
              <div className={['text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>
                Grouping is available for Select / Multi-select properties.
              </div>
            </section>
          </CollapsibleSection>

          <CollapsibleSection
            title={renderSectionTitle('reset')}
            collapsed={collapsedByPanel.reset}
            onToggle={next => togglePanel('reset', next)}
            toolbarAligned
            stickyHeader={false}
            headerClassName={VIEW_SECTION_HEADER_SPACING_CLASS_NAME}
          >
            <section aria-label="Reset" className="space-y-3">
              <div className={['text-sm font-medium', UI_THEME_TOKENS.text.primary].join(' ')}>
                Reset view state
              </div>
              <div className={['text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>
                Clears local search, grouping, filters, sorting, and view state overrides for the active data view.
              </div>
              <button
                type="button"
                className={['App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg].join(' ')}
                onClick={() => props.onReset?.()}
              >
                Reset view state
              </button>
            </section>
          </CollapsibleSection>
        </section>
      </main>
    </MainPanelSettingsPanelShell>
  )
}
