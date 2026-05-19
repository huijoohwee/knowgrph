import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testPanelHeaderUsesAriaTablist = () => {
  const root = process.cwd()
  const tabHeaderPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'TabHeader.tsx')
  const text = readUtf8(tabHeaderPath)
  if (!text.includes('role="tablist"') && !text.includes("role='tablist'")) {
    throw new Error('Expected TabHeader to render a tablist role')
  }
  if (!text.includes('role="tab"') && !text.includes("role='tab'")) {
    throw new Error('Expected TabHeader to render tab roles')
  }
}

export const testMainPanelContainerUsesKgPanelBg = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'MainPanelContainer.tsx')
  const text = readUtf8(filePath)
  if (text.includes('var(--panel-bg)')) throw new Error('Expected MainPanelContainer to avoid var(--panel-bg)')
  if (!text.includes('var(--kg-panel-bg)')) throw new Error('Expected MainPanelContainer to use var(--kg-panel-bg)')
}

export const testPanelShellUsesResponsiveRowScrolling = () => {
  const root = process.cwd()
  const tabHeaderPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'TabHeader.tsx')
  const headerActionsPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'HeaderActions.tsx')
  const floatingPanelPath = path.resolve(root, 'src', 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const iconButtonPath = path.resolve(root, 'src', 'components', 'IconButton.tsx')
  const responsiveCssPath = path.resolve(root, 'src', 'styles', 'responsive-toolbar.css')
  const toolbarStylesPath = path.resolve(root, 'src', 'features', 'toolbar', 'ui', 'toolbarStyles.ts')

  const tabHeader = readUtf8(tabHeaderPath)
  if (!tabHeader.includes('uiToolbarRowScrollClassName') || !tabHeader.includes('uiToolbarRowScrollJustifyEndClassName')) {
    throw new Error('Expected TabHeader shell to use the toolbar row-scroll SSOT')
  }
  if (!tabHeader.includes('basis-full w-full sm:basis-auto sm:w-72')) {
    throw new Error('Expected TabHeader search shell to expand full-width on narrow widths')
  }
  if (!tabHeader.includes('kg-panel-tabs-nav') || !tabHeader.includes('basis-full w-full')) {
    throw new Error('Expected TabHeader tab nav to preserve its bounded mobile lane before panel tools')
  }
  if (!tabHeader.includes('kg-panel-tablist') || !tabHeader.includes('uiToolbarRowScrollClassName')) {
    throw new Error('Expected TabHeader tabs to scroll from the shared toolbar row helper')
  }

  const headerActions = readUtf8(headerActionsPath)
  if (!headerActions.includes('uiToolbarRowScrollJustifyEndClassName')) {
    throw new Error('Expected HeaderActions to scroll from the shared toolbar row helper')
  }

  const floatingPanel = readUtf8(floatingPanelPath)
  if (!floatingPanel.includes('max-w-[calc(100vw-1rem)]')) {
    throw new Error('Expected FloatingPanel shell to cap width against viewport bounds')
  }
  if (!floatingPanel.includes('uiToolbarRowScrollJustifyBetweenClassName') || !floatingPanel.includes('uiToolbarRowScrollClassName')) {
    throw new Error('Expected FloatingPanel header shell to use toolbar row-scroll helpers')
  }

  const iconButton = readUtf8(iconButtonPath)
  if (!iconButton.includes('kg-icon-button') || !iconButton.includes('overflow-hidden')) {
    throw new Error('Expected IconButton to use the shared clipped icon-button surface')
  }
  if (!iconButton.includes('min-w-0 max-w-full') || !iconButton.includes('gap-1.5') || !iconButton.includes('flex-nowrap')) {
    throw new Error('Expected IconButton text/icon groups to keep mobile-safe dimensions')
  }

  const responsiveCss = readUtf8(responsiveCssPath)
  const toolbarStyles = readUtf8(toolbarStylesPath)
  if (!toolbarStyles.includes('uiToolbarRowScrollClassName') || !toolbarStyles.includes('uiToolbarTouchRowScrollClassName')) {
    throw new Error('Expected toolbarStyles to own shared row-scroll class constants')
  }
  if (!toolbarStyles.includes('uiToolbarResponsiveRowScrollClassName') || toolbarStyles.includes('overflow-x-auto overflow-y-hidden')) {
    throw new Error('Expected toolbarStyles row-scroll helpers to defer scroll behavior to shared CSS')
  }
  if (!responsiveCss.includes('.kg-row-scroll,') || !responsiveCss.includes('.kg-responsive-row-scroll')) {
    throw new Error('Expected responsive CSS to centralize always-on and mobile-only row scrolling')
  }
  if (!responsiveCss.includes('.kg-icon-button,') || !responsiveCss.includes('.App-toolbar__btn')) {
    throw new Error('Expected shared responsive CSS to own icon and toolbar button clipping')
  }
  if (!responsiveCss.includes('text-overflow: ellipsis') || !responsiveCss.includes('white-space: nowrap')) {
    throw new Error('Expected shared responsive CSS to prefer ellipsis over messy button overflow')
  }
}

export const testResponsiveWorkspaceAndTableSurfacesStayBounded = () => {
  const root = process.cwd()
  const responsiveCssPath = path.resolve(root, 'src', 'styles', 'responsive-toolbar.css')
  const workspaceHeaderPath = path.resolve(root, 'src', 'components', 'ui', 'WorkspaceHeader.tsx')
  const embeddedWorkspacePath = path.resolve(root, 'src', 'components', 'EmbeddedWorkspaceShell.tsx')
  const canvasPreviewDockPath = path.resolve(root, 'src', 'components', 'CanvasPreviewDock.tsx')
  const toolMenuStatePath = path.resolve(root, 'src', 'features', 'toolbar', 'useToolMenuState.ts')
  const graphTableHeaderPath = path.resolve(root, 'src', 'features', 'graph-table', 'ui', 'GraphTableWorkspaceHeader.tsx')
  const graphTableToolbarPath = path.resolve(root, 'src', 'features', 'graph-table', 'ui', 'GraphTableToolbar.tsx')
  const graphTableLeftPath = path.resolve(root, 'src', 'features', 'graph-table', 'ui', 'GraphTableWorkspaceLeft.tsx')
  const graphTableInspectorPath = path.resolve(root, 'src', 'features', 'graph-table', 'ui', 'GraphTableInspector.tsx')
  const markdownToolbarPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'MarkdownWorkspaceToolbar.tsx')
  const markdownExplorerPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'MarkdownWorkspaceExplorer.tsx')
  const workspaceTableModeControlPath = path.resolve(root, 'src', 'features', 'workspace-table', 'ui', 'WorkspaceTableModeControl.tsx')

  const responsiveCss = readUtf8(responsiveCssPath)
  if (!responsiveCss.includes('.kg-workspace-header-row') || !responsiveCss.includes('.kg-embedded-workspace-main')) {
    throw new Error('Expected shared responsive CSS to own workspace header and embedded workspace bounds')
  }
  if (!responsiveCss.includes('.kg-graph-table-grid-inspector-shell') || !responsiveCss.includes('.kg-graph-table-menu-form')) {
    throw new Error('Expected shared responsive CSS to own graph-table mobile stacking and menu bounds')
  }
  if (!responsiveCss.includes('flex-wrap: nowrap') || !responsiveCss.includes('.kg-icon-button > span')) {
    throw new Error('Expected shared responsive CSS to forbid icon/text wrapping inside toolbar buttons')
  }

  const workspaceHeader = readUtf8(workspaceHeaderPath)
  if (!workspaceHeader.includes('min-w-0 max-w-full shrink-0 overflow-hidden')) {
    throw new Error('Expected WorkspaceHeader to clip inside mobile viewports')
  }
  if (!workspaceHeader.includes('kg-workspace-header-row') || !workspaceHeader.includes('uiToolbarRowScrollJustifyBetweenClassName')) {
    throw new Error('Expected WorkspaceHeaderRow to use the shared row-scroll primitive')
  }

  const embeddedWorkspace = readUtf8(embeddedWorkspacePath)
  if (!embeddedWorkspace.includes('kg-embedded-workspace-shell') || !embeddedWorkspace.includes('kg-embedded-workspace-main')) {
    throw new Error('Expected EmbeddedWorkspaceShell to expose shared responsive shell classes')
  }
  if (!embeddedWorkspace.includes('kg-embedded-workspace-left') || !embeddedWorkspace.includes('sm:min-w-[280px]')) {
    throw new Error('Expected EmbeddedWorkspaceShell to release fixed minimum width on mobile')
  }

  const canvasPreviewDock = readUtf8(canvasPreviewDockPath)
  if (!canvasPreviewDock.includes('kg-canvas-preview-dock') || !canvasPreviewDock.includes('kg-canvas-preview-dock--collapsed')) {
    throw new Error('Expected CanvasPreviewDock to expose responsive dock state classes')
  }

  const toolMenuState = readUtf8(toolMenuStatePath)
  if (!toolMenuState.includes('clampOverlayTopLeftFullyInViewport') || !toolMenuState.includes('(pointer: coarse), (max-width: 768px)')) {
    throw new Error('Expected floating panel drag state to fully clamp mobile panels inside the viewport')
  }

  const graphTableHeader = readUtf8(graphTableHeaderPath)
  if (!graphTableHeader.includes('UI_TEXT_TRUNCATE') || !graphTableHeader.includes('kg-graph-table-header')) {
    throw new Error('Expected GraphTableWorkspaceHeader to use shared ellipsis and bounded header classes')
  }
  if (!graphTableHeader.includes('kg-graph-table-nav') || !graphTableHeader.includes('kg-graph-table-actions')) {
    throw new Error('Expected GraphTableWorkspaceHeader navigation and actions to stay viewport-bounded')
  }

  const graphTableToolbar = readUtf8(graphTableToolbarPath)
  if (!graphTableToolbar.includes('kg-graph-table-toolbar') || !graphTableToolbar.includes('kg-graph-table-menu-form')) {
    throw new Error('Expected GraphTableToolbar controls and menus to use shared responsive classes')
  }
  if (!graphTableToolbar.includes('UI_TEXT_TRUNCATE') || !graphTableToolbar.includes('flex-nowrap items-center')) {
    throw new Error('Expected GraphTableToolbar labels to ellipsize instead of pushing icons to new rows')
  }

  const graphTableLeft = readUtf8(graphTableLeftPath)
  if (!graphTableLeft.includes('kg-graph-table-grid-inspector-shell') || !graphTableLeft.includes('kg-graph-table-inspector-resize')) {
    throw new Error('Expected GraphTableWorkspaceLeft to expose responsive inspector stack classes')
  }

  const graphTableInspector = readUtf8(graphTableInspectorPath)
  if (!graphTableInspector.includes('kg-graph-table-inspector') || !graphTableInspector.includes('grid-cols-[minmax(0,120px)_minmax(0,1fr)]')) {
    throw new Error('Expected GraphTableInspector to avoid fixed overflow columns on mobile')
  }

  const markdownToolbar = readUtf8(markdownToolbarPath)
  if (!markdownToolbar.includes('kg-workspace-toolbar-controls') || !markdownToolbar.includes('uiToolbarRowScrollJustifyEndClassName')) {
    throw new Error('Expected MarkdownWorkspaceToolbar controls to scroll on one mobile row')
  }
  if (!markdownToolbar.includes('UI_TEXT_TRUNCATE')) {
    throw new Error('Expected MarkdownWorkspaceToolbar labels to use shared ellipsis')
  }

  const markdownExplorer = readUtf8(markdownExplorerPath)
  if (!markdownExplorer.includes('kg-toolbar') || !markdownExplorer.includes('uiToolbarRowScrollJustifyBetweenClassName')) {
    throw new Error('Expected MarkdownWorkspaceExplorer header to scroll without fixed mobile height')
  }

  const workspaceTableModeControl = readUtf8(workspaceTableModeControlPath)
  if (!workspaceTableModeControl.includes('UI_TEXT_TRUNCATE') || !workspaceTableModeControl.includes('uiToolbarRowScrollJustifyBetweenClassName')) {
    throw new Error('Expected WorkspaceTableModeControl rows to stay bounded with one-row scrolling')
  }
}

export const testResponsiveMenusAndDataViewSurfacesStayBounded = () => {
  const root = process.cwd()
  const responsiveCssPath = path.resolve(root, 'src', 'styles', 'responsive-toolbar.css')
  const overlayPath = path.resolve(root, 'src', 'lib', 'ui', 'overlay.tsx')
  const toolbarDropdownPath = path.resolve(root, 'src', 'components', 'toolbar', 'ToolbarDropdownSelect.tsx')
  const launchDropdownPath = path.resolve(root, 'src', 'lib', 'toolbar', 'LaunchDropdown.impl.tsx')
  const columnHeaderMenuPath = path.resolve(root, 'src', 'components', 'ui', 'ColumnHeaderMenu.tsx')
  const typeMenuPath = path.resolve(root, 'src', 'components', 'ui', 'TypeMenu.tsx')
  const dataViewHeaderPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'WorkspaceDataViewHeader.tsx')
  const dataViewDialogPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'WorkspaceDataViewSettingsDialog.tsx')
  const dataViewFilterPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'WorkspaceDataViewFilterMenu.tsx')
  const dataViewChipsPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownDataViewChips.tsx')
  const fileTreePath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'MarkdownFileTree.tsx')

  const responsiveCss = readUtf8(responsiveCssPath)
  if (!responsiveCss.includes('.kg-toolbar-dropdown-menu') || !responsiveCss.includes('.kg-column-header-menu')) {
    throw new Error('Expected shared responsive CSS to bound toolbar and column menus')
  }
  if (!responsiveCss.includes('.kg-data-view-settings-dialog') || !responsiveCss.includes('.kg-data-view-kanban-group')) {
    throw new Error('Expected shared responsive CSS to bound data-view dialogs and kanban groups')
  }
  if (!responsiveCss.includes('transform: none !important') || !responsiveCss.includes('.kg-menu-row svg')) {
    throw new Error('Expected mobile submenus and menu icons to avoid offscreen transforms and icon wrapping')
  }

  const overlay = readUtf8(overlayPath)
  if (!overlay.includes('clampOverlayTopLeftFullyInViewport') || !overlay.includes('maxWidth') || !overlay.includes('overscrollBehavior')) {
    throw new Error('Expected AnchorOverlay to clamp dropdowns inside the viewport')
  }

  const toolbarDropdown = readUtf8(toolbarDropdownPath)
  if (!toolbarDropdown.includes('kg-toolbar-dropdown-menu') || !toolbarDropdown.includes('kg-toolbar-dropdown-submenu')) {
    throw new Error('Expected toolbar dropdowns and submenus to use shared responsive menu classes')
  }

  const launchDropdown = readUtf8(launchDropdownPath)
  if (!launchDropdown.includes('kg-launch-menu-item w-full min-w-0 max-w-full flex flex-nowrap')) {
    throw new Error('Expected launch menu rows to keep icons and labels on one clipped row')
  }

  const columnHeaderMenu = readUtf8(columnHeaderMenuPath)
  if (!columnHeaderMenu.includes('kg-column-header-menu') || !columnHeaderMenu.includes('kg-column-header-submenu')) {
    throw new Error('Expected column header menus to use bounded menu and submenu primitives')
  }

  const typeMenu = readUtf8(typeMenuPath)
  if (!typeMenu.includes('kg-type-menu') || !typeMenu.includes('kg-menu-row')) {
    throw new Error('Expected type menus to reuse shared menu row clipping')
  }

  const dataViewHeader = readUtf8(dataViewHeaderPath)
  if (!dataViewHeader.includes('kg-data-view-header-controls') || !dataViewHeader.includes('kg-data-view-actions')) {
    throw new Error('Expected Data View header controls to stay inside viewport bounds')
  }

  const dataViewDialog = readUtf8(dataViewDialogPath)
  if (!dataViewDialog.includes('kg-data-view-settings-layout') || !dataViewDialog.includes('kg-data-view-settings-nav')) {
    throw new Error('Expected Data View settings dialog to stack navigation and content on mobile')
  }
  if (!dataViewDialog.includes('uiToolbarResponsiveRowScrollClassName')) {
    throw new Error('Expected Data View settings nav to use the toolbar-owned mobile row-scroll helper')
  }

  const dataViewFilter = readUtf8(dataViewFilterPath)
  if (!dataViewFilter.includes('kg-data-view-filter-menu') || !dataViewFilter.includes('UI_TEXT_TRUNCATE')) {
    throw new Error('Expected Data View filter menus to stay bounded and ellipsized')
  }

  const dataViewChips = readUtf8(dataViewChipsPath)
  if (!dataViewChips.includes('inline-flex min-w-0 max-w-full flex-nowrap') || !dataViewChips.includes('shrink-0')) {
    throw new Error('Expected Data View chips to prevent long tag and icon overflow')
  }

  const fileTree = readUtf8(fileTreePath)
  if (!fileTree.includes('clampOverlayTopLeftFullyInViewport') || !fileTree.includes('kg-data-view-floating-menu fixed')) {
    throw new Error('Expected workspace file context menus to clamp within mobile viewports')
  }
}

export const testKeyValueRowsKeepMobileGridConsistency = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'KeyTypeValueRow.tsx')
  const statusBadgePath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'StatusBadge.tsx')
  const text = readUtf8(filePath)
  const statusBadge = readUtf8(statusBadgePath)
  if (text.includes('grid-cols-1 sm:grid-cols-')) {
    throw new Error('Expected KeyTypeValueRow layouts to preserve KTV grid columns on narrow widths')
  }
  if (!text.includes('grid-cols-[minmax(0,0.92fr)_minmax(3.75rem,0.62fr)_minmax(0,1fr)]')) {
    throw new Error('Expected default Key/Type/Value rows to keep a mobile KTV grid')
  }
  if (!text.includes('grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]')) {
    throw new Error('Expected simple Key/Value rows to keep a mobile two-column grid')
  }
  if (!text.includes('flex min-w-0 items-center justify-center')) {
    throw new Error('Expected icon spacer cells to remain in the mobile grid instead of hiding')
  }
  if (!text.includes('justify-start sm:justify-end')) {
    throw new Error('Expected right-aligned value cells to relax to start alignment on narrow widths')
  }
  if (!text.includes('rowTextCellClassName') || !text.includes('overflow-hidden')) {
    throw new Error('Expected KeyTypeValueRow cells to clip instead of allowing messy mobile overflow')
  }
  if (!text.includes('rowLabelCellClassName') || !text.includes('text-ellipsis whitespace-nowrap')) {
    throw new Error('Expected KeyTypeValueRow labels to use ellipsis on narrow widths')
  }
  if (text.includes('break-words')) {
    throw new Error('Expected KeyTypeValueRow cells to avoid messy wrapped setting keys and values')
  }
  if (!statusBadge.includes('min-w-0 max-w-full') || !statusBadge.includes('sm:min-w-[120px]')) {
    throw new Error('Expected StatusBadge to release fixed minimum width on mobile')
  }
}

export const testSettingsRowsUseEllipsisForLongMobileText = () => {
  const root = process.cwd()
  const settingsEntryRowPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsEntryRow.tsx')
  const detailsTablePath = path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsEntryDetailsTable.tsx')
  const collapsibleSectionPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'CollapsibleSection.tsx')
  const settingsSectionsPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsSections.tsx')
  const sourceFileRowsPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'SourceFileManagementSettingsRows.tsx')
  const specialValueNodePath = path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsSpecialValueNode.tsx')
  const settingsUiPath = path.resolve(root, 'src', 'features', 'settings', 'ui.tsx')
  const indexCssPath = path.resolve(root, 'src', 'index.css')

  const settingsEntryRow = readUtf8(settingsEntryRowPath)
  if (!settingsEntryRow.includes('UI_TEXT_TRUNCATE')) {
    throw new Error('Expected SettingsEntryRow to use the shared ellipsis helper for long labels')
  }
  if (!settingsEntryRow.includes('className="w-full min-w-0 max-w-full overflow-hidden"')) {
    throw new Error('Expected SettingsEntryRow tooltips to constrain long labels before ellipsis')
  }
  if (!settingsEntryRow.includes('min-w-0 max-w-full flex-1 overflow-hidden')) {
    throw new Error('Expected SettingsEntryRow values to stay within their responsive cell')
  }

  const detailsTable = readUtf8(detailsTablePath)
  if (!detailsTable.includes('table-fixed') || !detailsTable.includes('title={modules}')) {
    throw new Error('Expected SettingsEntryDetailsTable to preserve details behind clipped cells')
  }
  if (!detailsTable.includes('UI_TEXT_TRUNCATE')) {
    throw new Error('Expected SettingsEntryDetailsTable to ellipsize long module/class/function details')
  }

  const indexCss = readUtf8(indexCssPath)
  if (!indexCss.includes('display: block;') || !indexCss.includes('max-inline-size: 100%')) {
    throw new Error('Expected shared truncate utility to create a bounded ellipsis box')
  }

  const collapsibleSection = readUtf8(collapsibleSectionPath)
  if (!collapsibleSection.includes('flex min-w-0 max-w-full items-center justify-between gap-1')) {
    throw new Error('Expected CollapsibleSection headers to stay within mobile panel bounds')
  }
  if (!collapsibleSection.includes('min-w-0 flex-1 overflow-hidden')) {
    throw new Error('Expected CollapsibleSection title area to release width to the action button')
  }

  const settingsSections = readUtf8(settingsSectionsPath)
  if (!settingsSections.includes('UI_TEXT_TRUNCATE') || !settingsSections.includes('inline-flex min-w-0 max-w-full items-center gap-1 overflow-hidden')) {
    throw new Error('Expected SettingsSections titles to ellipsize instead of overflowing on mobile')
  }

  const sourceFileRows = readUtf8(sourceFileRowsPath)
  if (!sourceFileRows.includes('SOURCE_FILE_ROW_DESCRIPTION_CLASS_NAME') || !sourceFileRows.includes('UI_TEXT_TRUNCATE')) {
    throw new Error('Expected Source File Management settings rows to reuse shared ellipsis classes')
  }
  if (!sourceFileRows.includes('SOURCE_FILE_ROW_VALUE_CLASS_NAME') || !sourceFileRows.includes('uiToolbarRowScrollClassName')) {
    throw new Error('Expected Source File Management value groups to stay inside the responsive value cell')
  }

  const specialValueNode = readUtf8(specialValueNodePath)
  if (!specialValueNode.includes('specialValueRowClassName') || !specialValueNode.includes('uiToolbarRowScrollClassName')) {
    throw new Error('Expected Settings special value rows to scroll within the KTV value cell')
  }
  if (specialValueNode.includes('flex items-center gap-2') || specialValueNode.includes('flex-1 min-w-0')) {
    throw new Error('Expected Settings special value rows to avoid stale fixed-width mobile layouts')
  }

  const settingsUi = readUtf8(settingsUiPath)
  if (!settingsUi.includes('overflow-hidden text-ellipsis whitespace-nowrap')) {
    throw new Error('Expected read-only settings values to ellipsize on mobile')
  }
  if (!settingsUi.includes('w-full min-w-0 max-w-full h-6')) {
    throw new Error('Expected settings inputs and selects to keep responsive width constraints')
  }
}

export const testToolbarRendererViewLazyLoadsWorkspaceTableModeControl = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'toolbar', 'ToolbarToolMenuRendererView.tsx')
  const text = readUtf8(filePath)
  if (text.includes("import { WorkspaceTableModeControl } from '@/features/workspace-table/ui/WorkspaceTableModeControl'")) {
    throw new Error('Expected ToolbarToolMenuRendererView to avoid a static WorkspaceTableModeControl import')
  }
  if (!text.includes('const WorkspaceTableModeControlLazy = React.lazy(async () => {')) {
    throw new Error('Expected ToolbarToolMenuRendererView to lazy-load WorkspaceTableModeControl')
  }
  if (!text.includes('<WorkspaceTableModeControlLazy />')) {
    throw new Error('Expected ToolbarToolMenuRendererView to render the lazy workspace control')
  }
}

export const testWorkspaceTableModeControlAvoidsToolbarSsotBridge = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'workspace-table', 'ui', 'WorkspaceTableModeControl.tsx')
  const text = readUtf8(filePath)
  if (text.includes("from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('Expected WorkspaceTableModeControl to avoid workspaceTableSsot imports that can pull toolbar chunks into SettingsView')
  }
  if (!text.includes("from '@/features/graph-table-db/graphTableDb'")) {
    throw new Error('Expected WorkspaceTableModeControl to warm GraphTableDb directly')
  }
}

export const testMainPanelLazyLoadsInactiveHeavyTabs = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'panels', 'MainPanel.tsx')
  const text = readUtf8(filePath)
  if (text.includes("import HelpView from '@/features/panels/views/HelpView'")) {
    throw new Error('Expected MainPanel to avoid a static HelpView import')
  }
  if (text.includes("import DashboardView from '@/features/panels/views/DashboardView'")) {
    throw new Error('Expected MainPanel to avoid a static DashboardView import')
  }
  if (text.includes("import WorkflowSection from '@/features/panels/views/WorkflowSection'")) {
    throw new Error('Expected MainPanel to avoid a static WorkflowSection import')
  }
  if (!text.includes("const HelpViewLazy = React.lazy(() => import('@/features/panels/views/HelpView'))")) {
    throw new Error('Expected MainPanel to lazy-load HelpView')
  }
  if (!text.includes("const DashboardViewLazy = React.lazy(() => import('@/features/panels/views/DashboardView'))")) {
    throw new Error('Expected MainPanel to lazy-load DashboardView')
  }
  if (text.includes("const WorkflowSectionLazy = React.lazy(() => import('@/features/panels/views/WorkflowSection'))")) {
    throw new Error('Expected MainPanel to avoid legacy WorkflowSection lazy loading after consolidation into FlowEditorManager')
  }
}

export const testMainPanelSettingsSurfacesSourceFileManagementContract = () => {
  const root = process.cwd()
  const settingsViewPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsView.tsx')
  const sourceFileRowsPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'SourceFileManagementSettingsRows.tsx')
  const collapseStatePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'useMarkdownExplorerSectionCollapseState.ts')
  const schemaPath = path.resolve(root, 'src', 'features', 'settings', 'settings-flow.schema.json')

  const settingsViewText = readUtf8(settingsViewPath)
  const sourceFileRowsText = readUtf8(sourceFileRowsPath)
  const collapseStateText = readUtf8(collapseStatePath)
  const schemaText = readUtf8(schemaPath)

  if (settingsViewText.includes('<SourceFileManagementSettingsPanel')) {
    throw new Error('Expected MainPanel Settings to remove the legacy standalone Source File Management panel')
  }
  if (!settingsViewText.includes('<SourceFileManagementSettingsRows')) {
    throw new Error('Expected MainPanel Settings to render Source File Management rows inside the Settings section')
  }
  if (!settingsViewText.includes('getAreaIntroItemCount={getSettingsAreaIntroItemCount}')) {
    throw new Error('Expected MainPanel Settings section counts to include Source File Management lead rows')
  }
  if (!sourceFileRowsText.includes('SOURCE_FILE_MANAGEMENT_SETTINGS_ROW_COUNT = 5')) {
    throw new Error('Expected Source File Management lead row count to stay owned by the rows module')
  }
  if (!sourceFileRowsText.includes("from '@/features/panels/ui/KeyTypeValueRow'")) {
    throw new Error('Expected Source File Management settings to reuse the MainPanel Key/Type/Value row primitive')
  }
  if (!sourceFileRowsText.includes('buildSettingsRowAnchorId')) {
    throw new Error('Expected Source File Management settings to reuse the shared settings row anchor helper')
  }
  if (sourceFileRowsText.includes('rounded-xl') || sourceFileRowsText.includes('grid grid-cols-2')) {
    throw new Error('Expected Source File Management settings to avoid the legacy standalone card/stat-grid layout')
  }
  if (!sourceFileRowsText.includes('Restore D1/docs defaults') || !sourceFileRowsText.includes('Open Source Files')) {
    throw new Error('Expected Source File Management settings rows to expose D1/docs restore and Source Files open actions')
  }
  if (!sourceFileRowsText.includes('scheduleApplyComposedGraphFromSourceFiles({ includeWorkspaceBacked: true })')) {
    throw new Error('Expected Source File Management settings rows to recompose D1/workspace-backed Source Files explicitly')
  }
  if (!sourceFileRowsText.includes('Import local files remains an explicit manual action')) {
    throw new Error('Expected Source File Management settings rows to document the manual-only local import boundary')
  }
  if (sourceFileRowsText.includes('importLocalFiles') || sourceFileRowsText.includes('openFilePicker')) {
    throw new Error('Expected Source File Management settings rows to avoid hidden Import local files actions')
  }
  if (!collapseStateText.includes('requestMarkdownExplorerSourceFilesOpen')) {
    throw new Error('Expected markdown explorer collapse state to expose a source-owned Source Files open request')
  }
  if (!schemaText.includes('"area": "Source File Management"')) {
    throw new Error('Expected settings schema to group Source Files controls under Source File Management')
  }
}

export const testWorkflowManagerReusesWorkspaceTableSsotForMultiDimView = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'flow-editor-manager', 'FlowEditorGraphTab.tsx')
  const text = readUtf8(filePath)
  if (!text.includes("from '@/features/workspace-table/workspaceTablePreferencesStore'")) {
    throw new Error('Expected Workflow Manager to read workspace table mode from workspaceTablePreferencesStore SSOT')
  }
  if (!text.includes('workspaceEditorMode === \'multiDimTable\'')) {
    throw new Error('Expected Workflow Manager to gate multi-dimensional table view by workspaceEditorMode SSOT')
  }
  if (!text.includes('<GraphTableWorkspace active />')) {
    throw new Error('Expected Workflow Manager to render GraphTableWorkspace for multi-dimensional table mode')
  }
  if (text.includes('Legacy graph-manager controls are suppressed for frontmatter workflow processing.')) {
    throw new Error('Expected Workflow Manager to remove dedicated workflow sections mode panel copy after Graph Fields consolidation')
  }
  if (text.includes('WorkflowManagerInspectorPanel')) {
    throw new Error('Expected Workflow Manager to avoid dedicated inspector panel and reuse Graph Fields pane model')
  }
}

export const testFloatingPanelRemovesDesignLayersViewAfterWorkflowManagerConsolidation = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const launcherPath = path.resolve(root, 'src', 'features', 'toolbar', 'ToolbarMenuLauncher.tsx')
  const typesPath = path.resolve(root, 'src', 'features', 'toolbar', 'ToolbarToolMenuTypes.ts')
  const text = readUtf8(filePath)
  const launcherText = readUtf8(launcherPath)
  const typesText = readUtf8(typesPath)
  if (text.includes("view: 'designLayers'")) {
    throw new Error('Expected FloatingPanel to remove designLayers view after Workflow Manager consolidation')
  }
  if (text.includes("floatingPanelView === 'designLayers'")) {
    throw new Error('Expected FloatingPanel to avoid rendering designLayers branch after consolidation')
  }
  if (text.includes("view: 'discovery'")) {
    throw new Error('Expected FloatingPanel to remove legacy discovery tab after Props Panel Discovery Widget consolidation')
  }
  if (text.includes("floatingPanelView === 'discovery'")) {
    throw new Error('Expected FloatingPanel to remove dedicated discovery branch after Props Panel Discovery Widget consolidation')
  }
  if (text.includes('normalizeRequestedFloatingPanelView')) {
    throw new Error('Expected FloatingPanel to remove legacy requested-view remapping after discovery consolidation')
  }
  if (launcherText.includes("'discovery'")) {
    throw new Error('Expected ToolbarMenuLauncher to remove legacy discovery requested-view support')
  }
  if (typesText.includes("'discovery'")) {
    throw new Error('Expected ToolbarToolMenuProps to remove legacy discovery requested-view type support')
  }
}

export const testWorkflowManagerConsolidatedEntriesReuseGraphFieldsRightPane = () => {
  const root = process.cwd()
  const flowEditorGraphTabPath = path.resolve(root, 'src', 'features', 'flow-editor-manager', 'FlowEditorGraphTab.tsx')
  const graphFieldsViewPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'GraphFieldsView.tsx')
  const graphTabText = readUtf8(flowEditorGraphTabPath)
  const graphFieldsText = readUtf8(graphFieldsViewPath)

  if (!graphTabText.includes('entryAliasLabels={WORKFLOW_ALIAS_LABELS}')) {
    throw new Error('Expected Workflow Manager to pass consolidated workflow alias labels into GraphFieldsView')
  }
  if (!graphTabText.includes('entryOpenRequest={entryOpenRequest}')) {
    throw new Error('Expected Workflow Manager to pass entry open requests into GraphFieldsView')
  }
  if (!graphFieldsText.includes('entryOpenRequest?:')) {
    throw new Error('Expected GraphFieldsView to accept consolidated entry open requests')
  }
  if (!graphFieldsText.includes('setSelectedFieldId(target.id)')) {
    throw new Error('Expected GraphFieldsView to open right-pane Field Settings by selecting a target field')
  }
  if (!graphFieldsText.includes('graphFields:entryOpen:')) {
    throw new Error('Expected GraphFieldsView consolidated entry-open path to provide visible toast confirmation')
  }
  if (!graphFieldsText.includes('scrollIntoView')) {
    throw new Error('Expected GraphFieldsView consolidated entry-open path to move focus toward right-pane Field Settings')
  }
}

export const testWorkflowManagerNonWorkflowListsReuseGraphFieldsRightPane = () => {
  const root = process.cwd()
  const flowEditorGraphTabPath = path.resolve(root, 'src', 'features', 'flow-editor-manager', 'FlowEditorGraphTab.tsx')
  const graphFieldsViewPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'GraphFieldsView.tsx')
  const graphTabText = readUtf8(flowEditorGraphTabPath)
  const graphFieldsText = readUtf8(graphFieldsViewPath)
  if (!graphTabText.includes('aria-label="Graph Fields and Field Settings"')) {
    throw new Error('Expected non-workflow Workflow Manager surface to include embedded Graph Fields right pane')
  }
  if (!graphTabText.includes('const GRAPH_FIELDS_ALIAS_LABELS = [')) {
    throw new Error('Expected non-workflow Workflow Manager to define Graph Fields alias labels')
  }
  if (!graphTabText.includes("'Node'") || !graphTabText.includes("'Edges'") || !graphTabText.includes("'Clusters'") || !graphTabText.includes("'Renderer'") || !graphTabText.includes("'Layer Mode'")) {
    throw new Error('Expected non-workflow alias list to cover Node/Edges/Clusters/Renderer/Layer Mode')
  }
  if (!graphTabText.includes('entryAliasLabels={GRAPH_FIELDS_ALIAS_LABELS}')) {
    throw new Error('Expected non-workflow Workflow Manager to pass alias labels into GraphFieldsView')
  }
  if (!graphFieldsText.includes('aria-label="Graph Fields entry aliases"')) {
    throw new Error('Expected GraphFieldsView to render alias buttons within Graph Fields surface')
  }
  if (!graphFieldsText.includes('onClick={() => onEntryAliasClick(label)}')) {
    throw new Error('Expected GraphFieldsView alias clicks to route through the shared right-pane open handler')
  }
}
