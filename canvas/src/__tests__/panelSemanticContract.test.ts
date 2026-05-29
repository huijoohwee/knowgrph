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
  if (!iconButton.includes('kg-icon-button') || !iconButton.includes('UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME')) {
    throw new Error('Expected IconButton to use the shared clipped icon-button surface')
  }
  if (!iconButton.includes('UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME') || !iconButton.includes('UI_RESPONSIVE_ICON_TEXT_ROW_CLASSNAME')) {
    throw new Error('Expected IconButton text/icon groups to use the shared responsive element-row primitive')
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
  if (!responsiveCss.includes('.kg-responsive-element-row') || !responsiveCss.includes('.kg-icon-button,') || !responsiveCss.includes('.App-toolbar__btn')) {
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
  if (!graphTableToolbar.includes('UI_TEXT_TRUNCATE') || !graphTableToolbar.includes('UI_RESPONSIVE_ELEMENT_ROW_CLASSNAME')) {
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
  const launchDropdownExportPath = path.resolve(root, 'src', 'lib', 'toolbar', 'LaunchDropdownExportMenu.tsx')
  const columnHeaderMenuPath = path.resolve(root, 'src', 'components', 'ui', 'ColumnHeaderMenu.tsx')
  const typeMenuPath = path.resolve(root, 'src', 'components', 'ui', 'TypeMenu.tsx')
  const dataViewHeaderPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'WorkspaceDataViewHeader.tsx')
  const dataViewPanelPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'WorkspaceDataViewSettingsPanel.tsx')
  const dataViewPropertiesPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'WorkspaceDataViewSettingsPropertiesSection.tsx')
  const dataViewFilterPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'WorkspaceDataViewFilterMenu.tsx')
  const dataViewChipsPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownDataViewChips.tsx')
  const dataViewAddColumnPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownDataViewAddColumnMenu.tsx')
  const dataViewTablePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownDataViewTableView.tsx')
  const kanbanCardPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'KanbanCard.tsx')
  const fileTreePath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'MarkdownFileTree.tsx')
  const floatingMenuStylesPath = path.resolve(root, 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'floatingMenuStyles.ts')

  const responsiveCss = readUtf8(responsiveCssPath)
  if (!responsiveCss.includes('.kg-toolbar-dropdown-menu') || !responsiveCss.includes('.kg-column-header-menu')) {
    throw new Error('Expected shared responsive CSS to bound toolbar and column menus')
  }
  if (!responsiveCss.includes('.kg-data-view-settings-panel') || !responsiveCss.includes('.kg-data-view-kanban-group')) {
    throw new Error('Expected shared responsive CSS to bound data-view panels and kanban groups')
  }
  if (!responsiveCss.includes('.kg-click-expand-menu-children') || !responsiveCss.includes('.kg-menu-row svg')) {
    throw new Error('Expected nested menu children and menu icons to avoid offscreen transforms and icon wrapping')
  }
  const overlay = readUtf8(overlayPath)
  if (!overlay.includes('clampOverlayTopLeftFullyInViewport') || !overlay.includes('maxWidth') || !overlay.includes('overscrollBehavior')) {
    throw new Error('Expected AnchorOverlay to clamp dropdowns inside the viewport')
  }
  const toolbarDropdown = readUtf8(toolbarDropdownPath)
  if (!toolbarDropdown.includes('kg-toolbar-dropdown-menu') || !toolbarDropdown.includes('kg-toolbar-dropdown-children') || !toolbarDropdown.includes('aria-expanded') || !toolbarDropdown.includes('UI_RESPONSIVE_TOUCH_MENU_ROW_CLASSNAME')) {
    throw new Error('Expected toolbar dropdown groups to use shared click-expand responsive menu classes')
  }
  const launchDropdown = readUtf8(launchDropdownPath)
  const launchDropdownExport = readUtf8(launchDropdownExportPath)
  if (!launchDropdown.includes('UI_RESPONSIVE_LAUNCH_MENU_ROW_CLASSNAME') || !launchDropdown.includes('importUrlControlsId') || !launchDropdown.includes('kg-click-expand-menu-children') || !launchDropdownExport.includes('kg-click-expand-menu-children') || launchDropdownExport.includes('left-full') || launchDropdown.includes('runImportUrl(draft)')) {
    throw new Error('Expected launch menu rows to keep bounded click-expand rows without parent-click import execution')
  }
  const columnHeaderMenu = readUtf8(columnHeaderMenuPath)
  if (!columnHeaderMenu.includes('kg-column-header-menu') || !columnHeaderMenu.includes('kg-click-expand-menu-children') || columnHeaderMenu.includes('onMouseEnter') || columnHeaderMenu.includes('left-full')) {
    throw new Error('Expected column header menus to use bounded click-expand child primitives')
  }
  const typeMenu = readUtf8(typeMenuPath)
  if (!typeMenu.includes('kg-type-menu') || !typeMenu.includes('UI_RESPONSIVE_MENU_ROW_CLASSNAME')) {
    throw new Error('Expected type menus to reuse shared menu row clipping')
  }
  const dataViewHeader = readUtf8(dataViewHeaderPath)
  if (!dataViewHeader.includes('kg-data-view-header-controls') || !dataViewHeader.includes('UI_RESPONSIVE_ACTION_ROW_CLASSNAME')) {
    throw new Error('Expected Data View header controls to stay inside viewport bounds')
  }
  if (!dataViewHeader.includes("openSettingsPanel('layout')")) {
    throw new Error('Expected Data View layout control to open the shared FloatingPanel View layout section')
  }
  if (!dataViewHeader.includes("openSettingsPanel('group')") || !dataViewHeader.includes("openSettingsPanel('properties')")) {
    throw new Error('Expected Data View group, settings, and more controls to route into the shared FloatingPanel View sections')
  }
  if (!dataViewHeader.includes('aria-label="Add column"') || dataViewHeader.includes('MarkdownDataViewAddColumnMenu')) {
    throw new Error('Expected Data View add-column trigger to route through the shared FloatingPanel View instead of a local menu')
  }
  if (dataViewHeader.includes('layoutDetailsRef') || dataViewHeader.includes('FLOATING_MENU_LEFT_W220_CLASSNAME')) {
    throw new Error('Expected Data View header to remove the legacy local layout dropdown after View-panel consolidation')
  }
  if (dataViewHeader.includes('FLOATING_MENU_RIGHT_W220_CLASSNAME') || dataViewHeader.includes('<details className="relative z-30">')) {
    throw new Error('Expected Data View header to remove the legacy local More dropdown after View-panel consolidation')
  }
  const dataViewPanel = readUtf8(dataViewPanelPath)
  const dataViewProperties = readUtf8(dataViewPropertiesPath)
  if (!dataViewPanel.includes('kg-data-view-settings-layout flex h-full min-h-0 flex-col') || !dataViewPanel.includes('secondaryNode={(') || !dataViewPanel.includes('secondaryNodeClassName="flex max-w-[45%] shrink-0 items-center justify-end gap-1 text-right"')) {
    throw new Error('Expected Data View settings panel to consolidate shared header actions into the shell header using the shared right-edge action lane')
  }
  if (!dataViewPanel.includes('<ExpandCollapseAllButton') || !dataViewPanel.includes('titleCollapse="Collapse (Default)"') || !dataViewPanel.includes('<CollapsibleSection') || dataViewPanel.includes('kg-data-view-settings-nav') || dataViewPanel.includes('<ToolbarDropdownSelect') || dataViewPanel.includes('uiToolbarResponsiveRowScrollClassName') || dataViewPanel.includes('onMouseEnter={() => setActivePanel(') || dataViewPanel.includes('w-[220px]') || dataViewPanel.includes('border-r')) {
    throw new Error('Expected Data View settings panel to consolidate collapse/expand into the header and remove legacy chooser / side rail wrappers')
  }
  if (!dataViewPanel.includes('overflow-y-auto px-3 pb-3') || !dataViewPanel.includes('flushTop')) {
    throw new Error('Expected Data View settings panel to remove the spacer between the header border and the first collapsible section')
  }
  if (!dataViewPanel.includes("key: 'reset'") || dataViewPanel.includes("key: 'duplicate'") || dataViewPanel.includes("key: 'delete'")) {
    throw new Error('Expected Data View settings panel to expose reset and remove legacy placeholder duplicate/delete sections')
  }
  if (!dataViewPanel.includes('onAddColumn={props.onAddColumn}') || !dataViewProperties.includes('aria-label="Add column"') || !dataViewProperties.includes('MarkdownDataViewAddColumnMenu')) {
    throw new Error('Expected Data View Properties section to own add-column creation after header consolidation')
  }
  const dataViewFilter = readUtf8(dataViewFilterPath)
  if (!dataViewFilter.includes('kg-data-view-filter-menu') || !dataViewFilter.includes('UI_TEXT_TRUNCATE')) {
    throw new Error('Expected Data View filter menus to stay bounded and ellipsized')
  }
  const dataViewChips = readUtf8(dataViewChipsPath)
  if (!dataViewChips.includes('UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME') || !dataViewChips.includes('shrink-0')) {
    throw new Error('Expected Data View chips to prevent long tag and icon overflow')
  }
  const dataViewAddColumn = readUtf8(dataViewAddColumnPath)
  if (!dataViewAddColumn.includes('UI_RESPONSIVE_MENU_ROW_CLASSNAME') || !dataViewAddColumn.includes('UI_RESPONSIVE_ACTION_ROW_CLASSNAME')) {
    throw new Error('Expected Data View add-column menu to reuse responsive menu and action rows')
  }
  const dataViewTable = readUtf8(dataViewTablePath)
  if (!dataViewTable.includes('uiToolbarRowScrollClassName') || dataViewTable.includes('flex flex-wrap gap-1')) {
    throw new Error('Expected Data View table chip rows to use toolbar-owned same-row scrolling')
  }
  const kanbanViewPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownDataViewKanbanView.tsx')
  const kanbanShortcutCopyPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'kanbanShortcutCopy.ts')
  const kanbanGroupPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'KanbanGroup.tsx')
  const kanbanDropPreviewPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'KanbanDropPreview.tsx')
  const kanbanDragHookPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'useKanbanDragAndDrop.ts')
  const kanbanDragVisualStatePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'kanbanDragVisualState.ts')
  const kanbanDragIntentPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'kanbanDragIntent.ts')
  const kanbanMoveOutcomesPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'kanbanMoveOutcomes.ts')
  const kanbanCard = readUtf8(kanbanCardPath)
  const kanbanShortcutCopy = readUtf8(kanbanShortcutCopyPath)
  const panelConfig = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'config.ts'))
  const kanbanGroup = readUtf8(kanbanGroupPath)
  const kanbanDropPreview = readUtf8(kanbanDropPreviewPath)
  const kanbanDragHook = readUtf8(kanbanDragHookPath)
  const kanbanDragVisualState = readUtf8(kanbanDragVisualStatePath)
  const kanbanDragIntent = readUtf8(kanbanDragIntentPath)
  const kanbanMoveOutcomes = readUtf8(kanbanMoveOutcomesPath)
  if (!kanbanCard.includes('kg-click-expand-menu-children') || kanbanCard.includes('-translate-x-full')) {
    throw new Error('Expected kanban card child menus to expand inline without offscreen side placement')
  }
  if (!kanbanCard.includes('uiToolbarRowScrollClassName') || kanbanCard.includes('flex flex-wrap gap-1 list-none')) {
    throw new Error('Expected Kanban tag rows to use toolbar-owned same-row scrolling')
  }
  if (
    !kanbanCard.includes('data-kg-kanban-card-drag-region="1"') ||
    !kanbanCard.includes("const sharedDragRegionClassName = props.cardDragProps?.draggable ? 'cursor-grab active:cursor-grabbing' : ''") ||
    !kanbanCard.includes('const sharedDragRegionProps = props.cardDragProps?.draggable') ||
    !kanbanCard.includes('{...sharedDragRegionProps}')
  ) {
    throw new Error('Expected Kanban cards to expose shared non-handle drag regions instead of a visible grip handle or full-card drag shell')
  }
  if (!kanbanCard.includes('props.canMutate && (e.altKey || e.metaKey)') || !kanbanCard.includes('props.onKeyboardMove?.({ rowId: props.row.id, direction })')) {
    throw new Error('Expected Kanban cards to expose shared keyboard move controls for accessible reorder')
  }
  if (kanbanCard.includes('KANBAN_DRAG_HANDLE_LABEL') || kanbanCard.includes('KanbanShortcutDetails') || kanbanCard.includes('aria-describedby={props.canMutate && props.onKeyboardMove ? shortcutHintId : undefined}')) {
    throw new Error('Expected Kanban cards to keep shortcut copy out of the local card surface and avoid reintroducing a visible drag handle')
  }
  if (!kanbanCard.includes('KanbanCardDropPreview') || kanbanCard.includes('absolute inset-x-2 top-0 h-[2px] z-10')) {
    throw new Error('Expected Kanban cards to reuse the shared drop preview helper instead of inline-only drop lines')
  }
  if (!kanbanCard.includes('onFocusableRowElement?:') || !kanbanCard.includes('props.onFocusableRowElement?.({')) {
    throw new Error('Expected Kanban cards to expose shared focusable-row registration instead of local-only focus recovery')
  }
  if (!kanbanCard.includes('getKanbanCardDragVisualState') || !kanbanGroup.includes('getKanbanLaneDragVisualState') || !kanbanCard.includes('isCommitFlash') || !kanbanGroup.includes('commitFlashRowId')) {
    throw new Error('Expected Kanban cards and lanes to reuse shared drag ghost/emphasis and commit flash visuals instead of local styling branches')
  }
  if (!kanbanCard.includes('buildKanbanCardDropIntentLabel') || !kanbanGroup.includes('laneDropPreviewLabel')) {
    throw new Error('Expected Kanban cards and lanes to reuse shared drag-intent captions instead of static drop labels')
  }
  const kanbanView = readUtf8(kanbanViewPath)
  const kanbanReorderPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'kanbanReorder.ts')
  const dataViewModelPath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'markdownDataViewModel.ts')
  const kanbanReorder = readUtf8(kanbanReorderPath)
  const dataViewModel = readUtf8(dataViewModelPath)
  if (!kanbanShortcutCopy.includes('KANBAN_SHORTCUT_HELP_LINES') || !panelConfig.includes('...KANBAN_SHORTCUT_HELP_LINES')) {
    throw new Error('Expected Kanban shortcut copy to be owned by a shared helper and surfaced from MainPanel Help shortcuts')
  }
  if (!kanbanDropPreview.includes('export function KanbanCardDropPreview') || !kanbanDropPreview.includes('export function KanbanLaneDropPreview')) {
    throw new Error('Expected Kanban drop previews to be owned by a shared helper')
  }
  if (!kanbanDragVisualState.includes('export const getKanbanCardDragVisualState') || !kanbanDragVisualState.includes('export const getKanbanLaneDragVisualState') || !kanbanDragVisualState.includes('isCommitFlash')) {
    throw new Error('Expected Kanban drag ghost, lane emphasis, and commit flash visuals to be owned by a shared helper')
  }
  if (!kanbanDragIntent.includes('export const buildKanbanCardDropIntentLabel') || !kanbanDragIntent.includes('export const buildKanbanDragStatusText')) {
    throw new Error('Expected Kanban drag intent messaging to be owned by a shared helper')
  }
  if (!kanbanMoveOutcomes.includes("kind: 'blocked' | 'cancelled' | 'no-op' | 'committed'") || !kanbanMoveOutcomes.includes('export type KanbanBlockedMoveReason') || !kanbanMoveOutcomes.includes('export const isKanbanMoveNoOp') || !kanbanMoveOutcomes.includes('export const buildKanbanDropOutcomeText')) {
    throw new Error('Expected Kanban move outcome suppression and success/cancel/boundary messaging to be owned by a shared helper')
  }
  if (!kanbanDragHook.includes('getBoardScrollElement?: () => HTMLElement | null') || !kanbanDragHook.includes('getLaneScrollElement?: (groupKey: string) => HTMLElement | null') || !kanbanDragHook.includes('window.requestAnimationFrame(tick)')) {
    throw new Error('Expected Kanban drag owner to manage shared board and lane auto-scroll via a requestAnimationFrame loop')
  }
  if (!kanbanDragHook.includes('KANBAN_LANE_HOVER_DWELL_MS') || !kanbanDragHook.includes('window.setTimeout(() =>') || !kanbanDragHook.includes('resolveDropTarget')) {
    throw new Error('Expected Kanban drag owner to stabilize cross-lane hover with a shared dwell contract instead of immediate target thrash')
  }
  if (!kanbanDragHook.includes('KANBAN_DIRECTIONAL_LANE_ENTRY_BIAS_PX') || !kanbanDragHook.includes('KANBAN_CARD_TARGET_HYSTERESIS_PX') || !kanbanDragHook.includes('lastAppliedTargetPointerRef')) {
    throw new Error('Expected Kanban drag owner to apply shared directional lane-entry bias and card-target hysteresis instead of raw pointer switching')
  }
  if (kanbanDragHook.indexOf('const updateAutoScrollTargets = React.useCallback') > kanbanDragHook.indexOf('const resolveDropTarget = React.useCallback')) {
    throw new Error('Expected Markdown kanban shared auto-scroll callback to be declared before the shared drop-target resolver to avoid TDZ runtime crashes')
  }
  if (!kanbanDragHook.includes('const clearActiveDropTarget = React.useCallback') || !kanbanDragHook.includes('if (dragOverRowIdRef.current == null) {') || !kanbanDragHook.includes('clearActiveDropTarget()')) {
    throw new Error('Expected Markdown kanban lane-end drag previews to clear from the shared drag owner when the pointer leaves the lane target')
  }
  if (!kanbanDragHook.includes('registerFocusableRowElement') || !kanbanDragHook.includes('requestFocusRow') || !kanbanDragHook.includes('attemptFocusRow')) {
    throw new Error('Expected Kanban drag owner to centralize post-move focus recovery instead of per-surface focus patches')
  }
  if (!kanbanDragHook.includes('const commitMove = React.useCallback') || !kanbanDragHook.includes('const reportBlockedMove = React.useCallback') || !kanbanDragHook.includes("commitMove(move) === 'committed' ? 'commit' : 'no-op'")) {
    throw new Error('Expected Kanban drag owner to centralize shared commit/no-op/boundary resolution for pointer and keyboard moves')
  }
  if (!kanbanDragHook.includes('const [dragOutcomeSequence, setDragOutcomeSequence] = React.useState(0)') || !kanbanDragHook.includes('setDragOutcomeSequence(value => value + 1)') || !kanbanView.includes('kanbanDrag.dragOutcomeSequence')) {
    throw new Error('Expected Markdown kanban repeated outcome announcements to be driven by a shared outcome sequence instead of local live-region retries')
  }
  if (!kanbanDragHook.includes('clearCommitFeedback()') || !kanbanDragHook.includes("kind: 'no-op'")) {
    throw new Error('Expected Markdown kanban no-op moves to clear stale success feedback in the shared drag owner before announcing no change')
  }
  if (!kanbanDragHook.includes('const draggingRowIdRef = React.useRef<string | null>(null)') || !kanbanDragHook.includes('const dragSourceGroupKeyRef = React.useRef<string | null>(null)') || !kanbanDragHook.includes('const resolveDraggedRowId = React.useCallback') || !kanbanDragHook.includes('const resolveDraggedGroupKey = React.useCallback')) {
    throw new Error('Expected Kanban drag owner to retain active drag identity in shared refs when browser dragover/drop dataTransfer payloads are unavailable')
  }
  if (!kanbanDragHook.includes('setCommitFlashRowId(move.rowId)') || !kanbanView.includes('commitFlashRowId={kanbanDrag.commitFlashRowId}') || !kanbanGroup.includes('props.commitFlashRowId === row.id')) {
    throw new Error('Expected Markdown kanban commit flash to follow the moved row through the shared drag owner and card registration path')
  }
  if (!kanbanView.includes('useKanbanDragAndDrop') || !kanbanView.includes('reorderKanbanRowIds') || !kanbanView.includes('onReorderRows({') || !kanbanView.includes('handleKeyboardMove')) {
    throw new Error('Expected Markdown kanban view to reuse the shared drag-and-drop hook and keyboard reorder through the root data-view reorder contract')
  }
  if (kanbanView.includes('KanbanShortcutLegend') || kanbanView.includes('KanbanShortcutDetails')) {
    throw new Error('Expected Kanban shortcut guidance to move out of local kanban surfaces and into MainPanel Help shortcuts')
  }
  if (!kanbanView.includes('buildKanbanDragStatusText') || !kanbanView.includes('activeDragStatusText')) {
    throw new Error('Expected Markdown kanban view to expose visible shared drag-intent status before drop')
  }
  if (!kanbanView.includes('const liveRegionKey = [') || !kanbanView.includes('kanbanDrag.dragOutcomeSequence') || !kanbanView.includes('aria-live="polite">{statusPillText}</div>') || kanbanView.includes("setLiveMessage(statusPillText || '')")) {
    throw new Error('Expected Markdown kanban live-region announcements to stay aligned with the shared status pill without local live-message state churn')
  }
  if (!kanbanView.includes('isKanbanMoveNoOp') || !kanbanView.includes('dragOutcomeMessage') || !kanbanView.includes('commitFlashGroupKey') || !kanbanView.includes('statusPillText')) {
    throw new Error('Expected Markdown kanban view to reuse shared success/no-op/cancel messaging and commit flash feedback')
  }
  if (!kanbanView.includes('registerFocusableRowElement') || !kanbanView.includes('kanbanDrag.commitMove({') || !kanbanView.includes('kanbanDrag.reportBlockedMove({') || !kanbanView.includes("'start-of-lane'") || !kanbanView.includes("'start-of-board'") || !kanbanView.includes("'end-of-board'") || !kanbanGroup.includes('onFocusableRowElement={props.onFocusableRowElement}')) {
    throw new Error('Expected Markdown kanban keyboard reorder, boundary feedback, and focus recovery to stay rooted in the shared drag owner and card registration path')
  }
  if (!kanbanReorder.includes('export const resolveKanbanGroupOrder') || !kanbanView.includes('resolveKanbanGroupOrder')) {
    throw new Error('Expected Markdown kanban lane ordering to reuse the shared configured-option order helper')
  }
  if (!kanbanGroup.includes('KanbanLaneDropPreview') || !kanbanView.includes('showLaneDropPreview=')) {
    throw new Error('Expected Markdown kanban lanes to expose a shared end-of-lane drop affordance during pointer drag')
  }
  if (!kanbanGroup.includes('max-h-[min(65vh,720px)] overflow-y-auto') || !kanbanView.includes('getBoardScrollElement: () => boardScrollRef.current')) {
    throw new Error('Expected Markdown kanban lanes and board to expose explicit scroll owners for shared edge-aware drag assistance')
  }
  if (!dataViewModel.includes('export const reorderMarkdownDataViewRows') || !dataViewModel.includes('columns: recomputeColumnsForRows')) {
    throw new Error('Expected Markdown data-view model to own persisted row reorder and enum option recomputation upstream')
  }
  const fileTree = readUtf8(fileTreePath)
  if (!fileTree.includes('clampOverlayTopLeftFullyInViewport') || !fileTree.includes('kg-data-view-floating-menu fixed') || !fileTree.includes('UI_RESPONSIVE_MENU_ROW_CLASSNAME')) {
    throw new Error('Expected workspace file context menus to clamp within mobile viewports')
  }
  const floatingMenuStyles = readUtf8(floatingMenuStylesPath)
  if (!floatingMenuStyles.includes('uiToolbarRowScrollClassName') || !floatingMenuStyles.includes('UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME')) {
    throw new Error('Expected floating toolbars to reuse row-scroll and responsive inline elements')
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
  if (!settingsEntryRow.includes('RightAlignedValueCell') || !settingsEntryRow.includes('valueNode={<RightAlignedValueCell>')) {
    throw new Error('Expected SettingsEntryRow values to reuse the shared responsive value cell')
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
  if (!sourceFileRowsText.includes('scheduleApplyComposedGraphFromSourceFiles()')) {
    throw new Error('Expected Source File Management settings rows to reuse the canonical passive Source Files recomposition scheduler')
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
  if (!text.includes("view: 'view'")) {
    throw new Error('Expected FloatingPanel to expose a dedicated View tab beside Props Panel')
  }
  if (!text.includes("floatingPanelView === 'view' && <WorkspaceDataViewFloatingPanelView />")) {
    throw new Error('Expected FloatingPanel to render the dedicated View settings surface')
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
  if (!launcherText.includes("tab === 'view'")) {
    throw new Error('Expected ToolbarMenuLauncher to route shared View requests into the FloatingPanel')
  }
  if (typesText.includes("'discovery'")) {
    throw new Error('Expected ToolbarToolMenuProps to remove legacy discovery requested-view type support')
  }
  if (!typesText.includes("'view'")) {
    throw new Error('Expected ToolbarToolMenuProps to include the dedicated View floating panel type')
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
