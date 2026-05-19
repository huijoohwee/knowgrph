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
  const markdownWorkspaceLayoutText = readUtf8(path.resolve(root, 'src/features/markdown-workspace/main/layout/MarkdownWorkspaceLayout.tsx'))
  const markdownEditorPaneText = readUtf8(path.resolve(root, 'src/features/markdown-workspace/main/editor/MarkdownEditorPane.tsx'))
  const monacoTextEditorText = readUtf8(path.resolve(root, 'src/lib/monaco/MonacoTextEditor.impl.tsx'))
  const workspaceWidthDefaultsText = readUtf8(path.resolve(root, 'src/features/workspace-table/workspaceViewCanvasDefaults.ts'))
  const workspacePaneRuntimeText = readUtf8(path.resolve(root, 'src/features/canvas/useCanvasWorkspacePaneRuntime.ts'))
  const graphTableToolbarText = readUtf8(path.resolve(root, 'src/features/graph-table/ui/GraphTableToolbar.tsx'))
  const graphTableKanbanViewText = readUtf8(path.resolve(root, 'src/features/graph-table/ui/GraphTableKanbanView.tsx'))
  const toastHostText = readUtf8(path.resolve(root, 'src/components/ui/ToastHost.tsx'))
  const dataViewToolbarButtonText = readUtf8(path.resolve(root, 'src/lib/ui/dataViewToolbarButton.tsx'))
  const designFloatingPanelText = readUtf8(path.resolve(root, 'src/features/design/DesignFloatingPanelView.tsx'))
  const graphEditorToolRailText = readUtf8(path.resolve(root, 'src/features/graph-editor/GraphEditorToolRail.tsx'))
  const markdownInlineMenusText = readUtf8(path.resolve(root, 'src/lib/markdown-core/ui/markdownBlockContainerCore.inlineMenusOverlay.tsx'))
  const settingsUiText = readUtf8(path.resolve(root, 'src/features/settings/ui.tsx'))
  const responsiveElementClassesText = readUtf8(path.resolve(root, 'src/lib/ui/responsiveElementClasses.ts'))
  const anchorOverlayText = readUtf8(path.resolve(root, 'src/lib/ui/overlay.tsx'))
  const overlayPlacementText = readUtf8(path.resolve(root, 'src/lib/ui/overlayPlacement.ts'))
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
  if (cssText.includes('--kg-control-height: var(--kg-touch-target)')) {
    throw new Error('expected mobile touch policy not to mutate the shared control-height token used by toolbar icons')
  }
  if (cssText.includes('@media (pointer: coarse), (max-width: 768px) {\n    .App-toolbar__divider')) {
    throw new Error('expected mobile touch policy not to mutate toolbar divider sizing')
  }
  if (!cssText.includes('height: calc(var(--kg-control-height, 28px) - 12px);')) {
    throw new Error('expected toolbar divider sizing to stay globally tied to the stable control-height token')
  }
  if (!responsiveToolbarCssText.includes('.kg-row-scroll,') || !responsiveToolbarCssText.includes('.kg-responsive-row-scroll')) {
    throw new Error('expected responsive toolbar CSS to centralize same-row scrolling primitives')
  }
  if (!responsiveToolbarCssText.includes('.kg-responsive-element-row')) {
    throw new Error('expected responsive toolbar CSS to centralize clipped one-row element primitives')
  }
  if (!responsiveElementClassesText.includes('kg-touch-menu-row') || responsiveElementClassesText.includes('min-h-[var(--kg-touch-target)]')) {
    throw new Error('expected touch menu row height to be CSS-policy driven, not forced into every desktop dropdown row')
  }
  if (!responsiveToolbarCssText.includes('.kg-touch-menu-row') || !responsiveToolbarCssText.includes('min-height: var(--kg-control-height, 28px);') || !responsiveToolbarCssText.includes('min-height: var(--kg-touch-target, 44px);')) {
    throw new Error('expected touch menu rows to use compact desktop height and mobile touch height from shared CSS')
  }
  if (!dataViewToolbarButtonText.includes('UI_RESPONSIVE_ACTION_ROW_CLASSNAME') || !dataViewToolbarButtonText.includes('UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME')) {
    throw new Error('expected shared data-view toolbar buttons to reuse responsive action and inline rows')
  }
  if (!designFloatingPanelText.includes('uiToolbarRowScrollClassName') || designFloatingPanelText.includes('App-toolbar__btn flex items-center')) {
    throw new Error('expected design floating-panel controls and tabs to use toolbar-owned row scrolling')
  }
  if (!graphEditorToolRailText.includes('UI_RESPONSIVE_MENU_ROW_CLASSNAME') || !graphEditorToolRailText.includes('UI_TEXT_TRUNCATE')) {
    throw new Error('expected graph-editor rail buttons to reuse responsive menu rows and ellipsis')
  }
  if (!markdownInlineMenusText.includes('uiToolbarRowScrollClassName') || markdownInlineMenusText.includes('flex flex-wrap gap-1')) {
    throw new Error('expected inline markdown bubble menus to scroll on one toolbar-owned row')
  }
  if (!settingsUiText.includes('UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME') || !settingsUiText.includes('uiToolbarRowScrollClassName')) {
    throw new Error('expected Settings previews to use responsive inline rows and shared row scrolling')
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
  if (!responsiveToolbarCssText.includes('.kg-markdown-workspace-editor-panes') || !responsiveToolbarCssText.includes('.kg-monaco-textarea-fallback')) {
    throw new Error('expected Editor Workspace edit panes and textarea fallback to have shared mobile editability bounds')
  }
  if (!markdownWorkspaceLayoutText.includes('kg-markdown-workspace-editor-panes') || !markdownWorkspaceLayoutText.includes('kg-markdown-workspace-pane-divider')) {
    throw new Error('expected Editor Workspace panes and dividers to use responsive owner classes')
  }
  if (!markdownEditorPaneText.includes('kg-markdown-editor-pane') || !markdownEditorPaneText.includes('kg-monaco-textarea-fallback')) {
    throw new Error('expected Markdown editor pane to expose responsive Monaco and textarea classes')
  }
  if (!monacoTextEditorText.includes('kg-monaco-editor-root')) {
    throw new Error('expected Monaco editor root to expose a responsive editability class')
  }
  if (!canvasText.includes('WORKSPACE_EDITOR_CANVAS_GUTTER_CSS') || canvasText.includes('calc(100% - 3rem)')) {
    throw new Error('expected Canvas overlay bounds to reuse the shared workspace gutter token instead of a local mobile width literal')
  }
  if (!workspacePaneRuntimeText.includes('WORKSPACE_EDITOR_CANVAS_GUTTER_PX') || workspacePaneRuntimeText.includes('WORKSPACE_PREVIEW_RIGHT_GUTTER_PX')) {
    throw new Error('expected workspace pane runtime resizing bounds to reuse the shared canvas gutter token')
  }
  if (!workspaceWidthDefaultsText.includes('MIN_WORKSPACE_CANVAS_VISIBLE_STRIP_COMPACT_RATIO') || !workspaceWidthDefaultsText.includes('return args.maxPx')) {
    throw new Error('expected compact workspace width defaults to prefer editable mobile pane width from the shared owner')
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
  if (!responsiveToolbarCssText.includes('.kg-collapsible-toolbar-overflow-items .kg-row-scroll') || !responsiveToolbarCssText.includes('min-inline-size: 0')) {
    throw new Error('expected collapsed toolbar same-row scroll containers to stay bounded by the shared overflow shell')
  }
  if (!responsiveToolbarCssText.includes('.kg-workspace-overlay-canvas-toolbar')) {
    throw new Error('expected editor-mode canvas toolbar mobile dock to stay centralized in shared CSS')
  }
  if (!canvasText.includes('kg-canvas-toolbar-dock') || !responsiveToolbarCssText.includes('.kg-canvas-toolbar-dock')) {
    throw new Error('expected primary canvas toolbar to share the mobile thumb-reachable dock owner')
  }
  if (!detailsMenuText.includes('clampOverlayTopLeftFullyInViewport') || !detailsMenuText.includes('viewportHeight')) {
    throw new Error('expected shared details menus to clamp portal placement against full viewport bounds')
  }
  if (!anchorOverlayText.includes('useState<HTMLDivElement | null>(() => createPortalRoot())') || !anchorOverlayText.includes('resolveOverlayVerticalTop')) {
    throw new Error('expected shared dropdown overlays to render from the first open and use viewport-aware vertical placement')
  }
  if (!detailsMenuText.includes('resolveOverlayVerticalTop') || !detailsMenuText.includes('readOverlayElementSize')) {
    throw new Error('expected shared point-expand menus to reuse measured viewport-aware overlay placement')
  }
  if (!overlayPlacementText.includes('spaceBelow') || !overlayPlacementText.includes('spaceAbove') || !overlayPlacementText.includes('scrollHeight')) {
    throw new Error('expected overlay placement helper to measure real menu height and flip away from clipped viewport edges')
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
  if (!selectionActionsMenuText.includes('UI_TEXT_TRUNCATE') || !selectionActionsMenuText.includes('UI_RESPONSIVE_MENU_ROW_CLASSNAME')) {
    throw new Error('expected Explorer selection actions labels to ellipsize without icon/text wrapping')
  }
  if (!responsiveToolbarCssText.includes('.kg-workspace-pane-toggles') || !markdownWorkspaceToolbarText.includes('kg-workspace-pane-toggles') || !markdownWorkspaceToolbarText.includes('uiToolbarRowScrollInlineClassName')) {
    throw new Error('expected workspace pane toggles to keep a shared mobile row-scroll owner')
  }
  if (!responsiveToolbarCssText.includes('.kg-workspace-pane-toggle') || !responsiveToolbarCssText.includes('.kg-workspace-pane-toggle-input') || !responsiveToolbarCssText.includes('.kg-workspace-pane-toggle-label')) {
    throw new Error('expected workspace pane toggles to expose shared touch-sized label/input/text classes')
  }
  if (!responsiveToolbarCssText.includes('.kg-workspace-pane-toggle--viewer') || !markdownWorkspaceToolbarText.includes('kg-workspace-pane-toggle--viewer')) {
    throw new Error('expected Viewer pane toggle to expose a dedicated bounded mobile touch target class')
  }
  if (!responsiveToolbarCssText.includes('.kg-workspace-pane-toggles-item') || !markdownWorkspaceToolbarText.includes('kg-workspace-pane-toggles-item')) {
    throw new Error('expected workspace pane toggle row wrapper to stay bounded in collapsed toolbar overflow')
  }
  if (!markdownWorkspaceToolbarText.includes('Show Markdown editor pane') || !markdownWorkspaceToolbarText.includes('Show Viewer preview pane')) {
    throw new Error('expected Markdown and Viewer pane toggles to keep explicit edit/view accessibility labels')
  }
  if (!markdownWorkspaceToolbarText.includes('resolveViewerEditPaneVisibility')) {
    throw new Error('expected Viewer pane toggle to preserve an editable source pane when enabling preview')
  }
  const explorerPaneToggleIdx = markdownWorkspaceToolbarText.indexOf('Show Explorer pane')
  const markdownPaneToggleIdx = markdownWorkspaceToolbarText.indexOf('Show Markdown editor pane')
  const viewerPaneToggleIdx = markdownWorkspaceToolbarText.indexOf('Show Viewer preview pane')
  if (!(explorerPaneToggleIdx >= 0 && explorerPaneToggleIdx < markdownPaneToggleIdx && markdownPaneToggleIdx < viewerPaneToggleIdx)) {
    throw new Error('expected mobile pane toggles to keep Explorer, Markdown, and Viewer first for immediate edit/view reachability')
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

  if (!dropdownText.includes('UI_RESPONSIVE_TOUCH_MENU_ROW_CLASSNAME')) {
    throw new Error('expected toolbar dropdown rows to keep touch-sized hit targets')
  }
  if (!dropdownText.includes('kg-toolbar-dropdown-children') || !dropdownText.includes('aria-expanded')) {
    throw new Error('expected toolbar dropdown child groups to use shared click-expand-down rows')
  }
  if (dropdownText.includes('kg-toolbar-dropdown-submenu') || dropdownText.includes('left-full')) {
    throw new Error('expected toolbar dropdown groups to avoid stale side-flyout submenu placement')
  }
  if (!viewportText.includes("touchAction: 'manipulation'")) {
    throw new Error('expected canvas viewport shell to disable double-tap browser zoom delays')
  }
  if (!viewportText.includes("overscrollBehavior: 'none'")) {
    throw new Error('expected canvas viewport shell to contain browser overscroll gestures')
  }
}
