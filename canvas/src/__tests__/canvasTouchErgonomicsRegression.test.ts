import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (filePath: string): string => fs.readFileSync(filePath, 'utf8')

export function testToolbarTouchErgonomicsStaySourceDriven() {
  const root = process.cwd()
  const canvasText = readUtf8(path.resolve(root, 'src/pages/Canvas.tsx'))
  const toolbarText = readUtf8(path.resolve(root, 'src/components/Toolbar.tsx'))
  const toolbarStylesText = readUtf8(path.resolve(root, 'src/features/toolbar/ui/toolbarStyles.ts'))
  const collapsibleToolbarText = readUtf8(path.resolve(root, 'src/components/ui/CollapsibleToolbar.tsx'))
  const detailsMenuText = readUtf8(path.resolve(root, 'src/components/ui/DetailsMenu.tsx'))
  const explorerSearchControlText = readUtf8(path.resolve(root, 'src/features/markdown-workspace/ExplorerSearchControl.tsx'))
  const selectionActionsMenuText = readUtf8(path.resolve(root, 'src/features/markdown-workspace/SelectionActionsMenu.tsx'))
  const markdownWorkspaceToolbarText = readUtf8(path.resolve(root, 'src/features/markdown-workspace/MarkdownWorkspaceToolbar.tsx'))
  const graphTableToolbarText = readUtf8(path.resolve(root, 'src/features/graph-table/ui/GraphTableToolbar.tsx'))
  const graphTableKanbanViewText = readUtf8(path.resolve(root, 'src/features/graph-table/ui/GraphTableKanbanView.tsx'))
  const toastHostText = readUtf8(path.resolve(root, 'src/components/ui/ToastHost.tsx'))
  const cssText = readUtf8(path.resolve(root, 'src/index.css'))
  const responsiveToolbarCssText = readUtf8(path.resolve(root, 'src/styles/responsive-toolbar.css'))

  if (!toolbarText.includes("touchAction: 'pan-x manipulation'")) {
    throw new Error('expected toolbar to allow horizontal touch scrolling without shrinking tap targets')
  }
  if (!toolbarText.includes("uiToolbarTouchRowScrollClassName")) {
    throw new Error('expected toolbar to opt into the shared touch row-scroll SSOT on narrow or coarse viewports')
  }
  if (!toolbarStylesText.includes('uiToolbarTouchRowScrollClassName') || !toolbarStylesText.includes('App-toolbar--touch-row-scroll')) {
    throw new Error('expected toolbarStyles to own the safe horizontal mobile scroll row class')
  }
  if (!toolbarStylesText.includes('uiToolbarResponsiveRowScrollClassName') || toolbarStylesText.includes('overflow-x-auto overflow-y-hidden')) {
    throw new Error('expected toolbarStyles to expose row-scroll identities without duplicating CSS scroll behavior')
  }
  if (!cssText.includes('.App-toolbar--touch-scroll')) {
    throw new Error('expected toolbar touch scrolling behavior to stay centralized in shared CSS')
  }
  if (!responsiveToolbarCssText.includes('.kg-row-scroll,') || !responsiveToolbarCssText.includes('.kg-responsive-row-scroll')) {
    throw new Error('expected responsive toolbar CSS to centralize same-row scrolling primitives')
  }
  if (!responsiveToolbarCssText.includes('.App-toolbar--touch-row-scroll') || responsiveToolbarCssText.includes('.App-toolbar--touch-wrap')) {
    throw new Error('expected toolbar mobile row-scroll behavior to stay centralized in shared CSS without stale wrap classes')
  }
  if (!collapsibleToolbarText.includes('kg-collapsible-toolbar-overflow')) {
    throw new Error('expected collapsed workspace toolbar menus to reuse the shared viewport-clamped overflow shell')
  }
  if (!canvasText.includes('kg-workspace-overlay-canvas-toolbar')) {
    throw new Error('expected editor-mode canvas toolbar to use a dedicated responsive dock class')
  }
  if (!responsiveToolbarCssText.includes('.kg-markdown-workspace-shell')) {
    throw new Error('expected Editor Workspace to use a shared mobile stacking rule')
  }
  if (!responsiveToolbarCssText.includes('flex-direction: column')) {
    throw new Error('expected Editor Workspace mobile layout to stack Explorer above editor content')
  }
  if (!responsiveToolbarCssText.includes('.kg-markdown-workspace-explorer')) {
    throw new Error('expected Markdown Explorer mobile sizing to stay centralized in shared CSS')
  }
  if (!responsiveToolbarCssText.includes('.MainPanelContainer')) {
    throw new Error('expected main panel mobile viewport bounds to stay centralized in shared CSS')
  }
  if (!responsiveToolbarCssText.includes('.kg-collapsible-toolbar-overflow')) {
    throw new Error('expected collapsed toolbar overflow bounds to stay centralized in shared CSS')
  }
  if (!responsiveToolbarCssText.includes('.kg-workspace-overlay-canvas-toolbar')) {
    throw new Error('expected editor-mode canvas toolbar mobile dock to stay centralized in shared CSS')
  }
  if (!detailsMenuText.includes('clampOverlayTopLeftFullyInViewport') || !detailsMenuText.includes('viewportHeight')) {
    throw new Error('expected shared details menus to clamp portal placement against full viewport bounds')
  }
  if (!detailsMenuText.includes('maxHeight') || !detailsMenuText.includes('overscrollBehavior')) {
    throw new Error('expected shared details menus to cap height and scroll inside the mobile viewport')
  }
  if (detailsMenuText.includes("translateX('-100%')") || detailsMenuText.includes("translateX(-100%)")) {
    throw new Error('expected shared details menus to avoid transform fallback placement that can escape mobile bounds')
  }
  if (!responsiveToolbarCssText.includes('.kg-explorer-search-input') || !explorerSearchControlText.includes('kg-explorer-search-input')) {
    throw new Error('expected Explorer search width to stay owned by shared responsive CSS')
  }
  if (!responsiveToolbarCssText.includes('.kg-selection-actions-menu') || !selectionActionsMenuText.includes('kg-selection-actions-menu')) {
    throw new Error('expected Explorer selection actions menu to use shared bounded menu sizing')
  }
  if (!selectionActionsMenuText.includes('UI_TEXT_TRUNCATE') || !selectionActionsMenuText.includes('kg-menu-row')) {
    throw new Error('expected Explorer selection actions labels to ellipsize without icon/text wrapping')
  }
  if (!responsiveToolbarCssText.includes('.kg-workspace-pane-toggles') || !markdownWorkspaceToolbarText.includes('kg-workspace-pane-toggles') || !markdownWorkspaceToolbarText.includes('uiToolbarRowScrollInlineClassName')) {
    throw new Error('expected workspace pane toggles to keep a shared mobile row-scroll owner')
  }
  if (!responsiveToolbarCssText.includes('.kg-graph-table-menu-row') || !graphTableToolbarText.includes('kg-graph-table-menu-field')) {
    throw new Error('expected graph-table menu form rows to use shared mobile field constraints')
  }
  if (!responsiveToolbarCssText.includes('.kg-graph-table-kanban-lane') || !graphTableKanbanViewText.includes('kg-graph-table-kanban-lane')) {
    throw new Error('expected graph-table kanban lanes to use valid shared viewport sizing')
  }
  if (!responsiveToolbarCssText.includes('.kg-toast-card') || !toastHostText.includes('kg-toast-list')) {
    throw new Error('expected toast notifications to use valid shared mobile viewport sizing')
  }
  if ([explorerSearchControlText, selectionActionsMenuText, graphTableKanbanViewText, toastHostText].some(text => text.includes('calc(100vw-'))) {
    throw new Error('expected mobile viewport calc classes to avoid invalid no-space calc syntax')
  }
  if (!cssText.includes('min-height: var(--kg-control-height, 36px);')) {
    throw new Error('expected collapsed toolbar and header height to follow the shared control height token')
  }
}

export function testCanvasTouchTargetsStayLargeAndViewportSuppressesBrowserGestures() {
  const root = process.cwd()
  const dropdownText = readUtf8(path.resolve(root, 'src/components/toolbar/ToolbarDropdownSelect.tsx'))
  const viewportText = readUtf8(path.resolve(root, 'src/components/CanvasViewport.tsx'))

  if (!dropdownText.includes('min-h-[var(--kg-touch-target)]')) {
    throw new Error('expected toolbar dropdown rows to keep touch-sized hit targets')
  }
  if (!viewportText.includes("touchAction: 'manipulation'")) {
    throw new Error('expected canvas viewport shell to disable double-tap browser zoom delays')
  }
  if (!viewportText.includes("overscrollBehavior: 'none'")) {
    throw new Error('expected canvas viewport shell to contain browser overscroll gestures')
  }
}
