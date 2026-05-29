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
  const explorerHeaderActionsText = readUtf8(path.resolve(root, 'src/features/markdown-workspace/MarkdownWorkspaceExplorerHeaderActions.tsx'))
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
  const markdownBubbleToolbarText = readUtf8(path.resolve(root, 'src/lib/markdown-core/ui/markdownBlockContainerCore.bubbleToolbarOverlay.tsx'))
  const settingsUiText = readUtf8(path.resolve(root, 'src/features/settings/ui.tsx'))
  const responsiveElementClassesText = readUtf8(path.resolve(root, 'src/lib/ui/responsiveElementClasses.ts'))
  const anchorOverlayText = readUtf8(path.resolve(root, 'src/lib/ui/overlay.tsx'))
  const anchoredPopoverText = readUtf8(path.resolve(root, 'src/components/ui/AnchoredPopover.tsx'))
  const overlayPlacementText = readUtf8(path.resolve(root, 'src/lib/ui/overlayPlacement.ts'))
  const importUrlPromptText = readUtf8(path.resolve(root, 'src/features/toolbar/ImportUrlPrompt.tsx'))
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
  if (!responsiveElementClassesText.includes('UI_RESPONSIVE_LAUNCH_MENU_ROW_CLASSNAME') || !responsiveElementClassesText.includes('kg-launch-menu-item') || !responsiveElementClassesText.includes('kg-touch-menu-row')) {
    throw new Error('expected Launch menu rows to reuse the shared mobile touch-row policy')
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
  if (
    !markdownBubbleToolbarText.includes('allowOverflowVisible') ||
    !markdownBubbleToolbarText.includes('uiToolbarRowScrollListClassName') ||
    !markdownBubbleToolbarText.includes('uiToolbarResponsiveRowScrollClassName') ||
    !markdownBubbleToolbarText.includes('uiToolbarTouchRowScrollClassName') ||
    !markdownBubbleToolbarText.includes("touchAction: 'pan-x manipulation'") ||
    markdownBubbleToolbarText.includes('flex flex-wrap items-center gap-1')
  ) {
    throw new Error('expected Viewer floating selection toolbar menus to reuse the shared list, row-scroll, touch-scroll, and visible-overflow mobile toolbar primitives')
  }
  if (!settingsUiText.includes('UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME') || !settingsUiText.includes('uiToolbarRowScrollClassName')) {
    throw new Error('expected Settings previews to use responsive inline rows and shared row scrolling')
  }
  if (!responsiveToolbarCssText.includes('.App-toolbar--touch-row-scroll') || responsiveToolbarCssText.includes('.App-toolbar--touch-wrap')) {
    throw new Error('expected toolbar mobile row-scroll behavior to stay centralized in shared CSS without stale wrap classes')
  }
  if (!responsiveToolbarCssText.includes('scroll-snap-type: x proximity') || !responsiveToolbarCssText.includes('scroll-snap-align: center')) {
    throw new Error('expected mobile canvas toolbar row scrolling to keep stable snap affordances')
  }
  if (!collapsibleToolbarText.includes('kg-collapsible-toolbar-overflow')) {
    throw new Error('expected collapsed workspace toolbar menus to reuse the shared viewport-clamped overflow shell')
  }
  if (!collapsibleToolbarText.includes('forceExpanded') || !markdownWorkspaceToolbarText.includes('forceExpanded={isTouchToolbarViewport}')) {
    throw new Error('expected Editor Workspace mobile controls to stay as a scrollable dock instead of collapsing behind overflow')
  }
  if (!markdownWorkspaceToolbarText.includes('kg-markdown-workspace-toolbar-row') || !responsiveToolbarCssText.includes('position: sticky') || !responsiveToolbarCssText.includes('var(--kg-mobile-bottom-dock-clearance')) {
    throw new Error('expected Editor Workspace mobile toolbar to use a thumb-reachable sticky bottom row above the shared mobile dock without theme changes')
  }
  if (!responsiveToolbarCssText.includes('.kg-markdown-workspace-toolbar-row') || !responsiveToolbarCssText.includes('background: var(--kg-panel-bg)') || !responsiveToolbarCssText.includes('border-top: 1px solid var(--kg-border)')) {
    throw new Error('expected Editor Workspace mobile toolbar dock to reuse existing panel theme tokens instead of overlaying editor content')
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
  if (!responsiveToolbarCssText.includes('.kg-markdown-workspace-explorer-resize') || responsiveToolbarCssText.includes('.kg-markdown-workspace-explorer-resize {\n      display: none;')) {
    throw new Error('expected Explorer/editor divider to remain visible when Editor Workspace stacks on narrow viewports')
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
  if (!anchorOverlayText.includes('allowOverflowVisible') || !anchorOverlayText.includes("overflow: allowOverflowVisible ? 'visible' : 'auto'")) {
    throw new Error('expected shared AnchorOverlay to support visible-overflow menus when floating selection toolbars expand outside the root panel')
  }
  if (!anchorOverlayText.includes('kg-anchor-overlay') || !detailsMenuText.includes('kg-details-menu-portal') || !responsiveToolbarCssText.includes('.kg-anchor-overlay')) {
    throw new Error('expected shared overlay portals to expose mobile viewport-owned classes')
  }
  if (!anchoredPopoverText.includes('clampOverlayTopLeftFullyInViewport') || anchoredPopoverText.includes("translateX('-100%')") || anchoredPopoverText.includes("translateX(-100%)")) {
    throw new Error('expected anchored popovers to clamp inside the viewport without transform fallback placement')
  }
  if (!anchoredPopoverText.includes('kg-anchored-popover') || !responsiveToolbarCssText.includes('.kg-anchored-popover')) {
    throw new Error('expected anchored popovers to reuse shared mobile overlay sizing')
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
  if (!anchorOverlayText.includes('var(--kg-overlay-max-height') || !detailsMenuText.includes('var(--kg-overlay-max-height')) {
    throw new Error('expected shared overlay portals to reuse the mobile bottom-dock-aware max-height token')
  }
  if (!responsiveToolbarCssText.includes('--kg-mobile-bottom-dock-clearance') || !responsiveToolbarCssText.includes('--kg-overlay-max-height')) {
    throw new Error('expected mobile overlay sizing to reserve shared bottom dock clearance without local menu patches')
  }
  if (!responsiveToolbarCssText.includes('max-height: var(--kg-overlay-max-height)') || !responsiveToolbarCssText.includes('max-block-size: var(--kg-overlay-max-height)')) {
    throw new Error('expected shared mobile menus to cap secondary panels with the overlay max-height token')
  }
  if (detailsMenuText.includes("translateX('-100%')") || detailsMenuText.includes("translateX(-100%)")) {
    throw new Error('expected shared details menus to avoid transform fallback placement that can escape mobile bounds')
  }
  if (!responsiveToolbarCssText.includes('.kg-explorer-search-input') || !explorerSearchControlText.includes('kg-explorer-search-input')) {
    throw new Error('expected Explorer search width to stay owned by shared responsive CSS')
  }
  if (explorerHeaderActionsText.includes('SelectionActionsMenu') || explorerHeaderActionsText.includes('MoreHorizontal') || explorerHeaderActionsText.includes('CollapsibleToolbar')) {
    throw new Error('expected Explorer header actions to avoid a three-dot overflow split')
  }
  if (!explorerHeaderActionsText.includes('uiToolbarRowScrollListClassName') || !explorerHeaderActionsText.includes('ariaLabel="Refresh"')) {
    throw new Error('expected Explorer header actions to keep Refresh and Search in the same scrollable action row')
  }
  if (
    explorerHeaderActionsText.includes('ariaLabel="New file"') ||
    explorerHeaderActionsText.includes('ariaLabel="Clear"') ||
    explorerHeaderActionsText.includes('ariaLabel="Delete') ||
    explorerHeaderActionsText.includes('Refresh from URL')
  ) {
    throw new Error('expected Explorer header to keep file mutations in the file context menu and consolidate URL refresh into Refresh')
  }
  if (!responsiveToolbarCssText.includes('.kg-workspace-pane-toggles') || !markdownWorkspaceToolbarText.includes('kg-workspace-pane-toggles') || !markdownWorkspaceToolbarText.includes('uiToolbarRowScrollInlineClassName')) {
    throw new Error('expected workspace pane toggles to keep a shared mobile row-scroll owner')
  }
  if (!responsiveToolbarCssText.includes('.kg-workspace-pane-toggles') || !responsiveToolbarCssText.includes('border: 0;') || !responsiveToolbarCssText.includes('background: transparent;') || !responsiveToolbarCssText.includes('padding: 0;')) {
    throw new Error('expected workspace pane toggles to stay unframed inside the shared toolbar panel')
  }
  if (markdownWorkspaceToolbarText.includes('kg-workspace-pane-toggles ${uiToolbarRowScrollInlineClassName} gap-2 rounded border')) {
    throw new Error('expected workspace pane toggles to avoid a nested bordered toolbar panel')
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
  const binPaneToggleIdx = markdownWorkspaceToolbarText.indexOf('Show binary model pane')
  const jsonPaneToggleIdx = markdownWorkspaceToolbarText.indexOf('Show JSON editor pane')
  const markdownPaneToggleIdx = markdownWorkspaceToolbarText.indexOf('Show Markdown editor pane')
  const viewerPaneToggleIdx = markdownWorkspaceToolbarText.indexOf('Show Viewer preview pane')
  const htmlPaneToggleIdx = markdownWorkspaceToolbarText.indexOf('Show HTML viewer pane')
  const canvasPaneToggleIdx = markdownWorkspaceToolbarText.indexOf('Show Canvas pane')
  if (!(
    explorerPaneToggleIdx >= 0 &&
    explorerPaneToggleIdx < binPaneToggleIdx &&
    binPaneToggleIdx < jsonPaneToggleIdx &&
    jsonPaneToggleIdx < markdownPaneToggleIdx &&
    markdownPaneToggleIdx < viewerPaneToggleIdx &&
    viewerPaneToggleIdx < htmlPaneToggleIdx &&
    htmlPaneToggleIdx < canvasPaneToggleIdx
  )) {
    throw new Error('expected pane toggles to keep Explorer, bin, JSON, Markdown, Viewer, HTML, Canvas order')
  }
  if (!responsiveToolbarCssText.includes('.kg-graph-table-menu-row') || !graphTableToolbarText.includes('kg-graph-table-menu-field')) {
    throw new Error('expected graph-table menu form rows to use shared mobile field constraints')
  }
  if (!responsiveToolbarCssText.includes('.kg-graph-table-kanban-lane') || !graphTableKanbanViewText.includes('kg-graph-table-kanban-lane')) {
    throw new Error('expected graph-table kanban lanes to use valid shared viewport sizing')
  }
  const graphTableDbText = readUtf8(path.resolve(root, 'src/lib/graph-table-db/graphTableDb.impl.ts'))
  const kanbanReorderText = readUtf8(path.resolve(root, 'src/features/markdown/ui/kanban/kanbanReorder.ts'))
  const kanbanShortcutCopyText = readUtf8(path.resolve(root, 'src/features/markdown/ui/kanban/kanbanShortcutCopy.ts'))
  const panelConfigText = readUtf8(path.resolve(root, 'src/features/panels/config.ts'))
  const kanbanDropPreviewText = readUtf8(path.resolve(root, 'src/features/markdown/ui/kanban/KanbanDropPreview.tsx'))
  const kanbanDragHookText = readUtf8(path.resolve(root, 'src/features/markdown/ui/kanban/useKanbanDragAndDrop.ts'))
  const kanbanDragVisualStateText = readUtf8(path.resolve(root, 'src/features/markdown/ui/kanban/kanbanDragVisualState.ts'))
  const kanbanDragIntentText = readUtf8(path.resolve(root, 'src/features/markdown/ui/kanban/kanbanDragIntent.ts'))
  const kanbanMoveOutcomesText = readUtf8(path.resolve(root, 'src/features/markdown/ui/kanban/kanbanMoveOutcomes.ts'))
  if (!graphTableKanbanViewText.includes('useKanbanDragAndDrop') || !graphTableKanbanViewText.includes('reorderKanbanRowIds') || !graphTableKanbanViewText.includes('orderedRowIds: nextOrderedRowIds') || !graphTableKanbanViewText.includes('handleKeyboardMove')) {
    throw new Error('expected graph-table kanban view to reuse the shared drag-and-drop contract and keyboard reorder lane order ids')
  }
  if (!kanbanShortcutCopyText.includes('KANBAN_SHORTCUT_HELP_LINES') || !panelConfigText.includes('...KANBAN_SHORTCUT_HELP_LINES') || graphTableKanbanViewText.includes('KanbanShortcutLegend') || graphTableKanbanViewText.includes('KanbanShortcutDetails')) {
    throw new Error('expected kanban shortcut guidance to live in shared Help shortcut copy instead of graph-table local hint surfaces')
  }
  if (!kanbanDropPreviewText.includes('export function KanbanCardDropPreview') || !graphTableKanbanViewText.includes('KanbanCardDropPreview') || !graphTableKanbanViewText.includes('KanbanLaneDropPreview')) {
    throw new Error('expected graph-table kanban view to reuse the shared pointer drop preview helper for cards and lane-end affordances')
  }
  if (!kanbanDragHookText.includes('KANBAN_EDGE_SCROLL_THRESHOLD_PX') || !kanbanDragHookText.includes('window.requestAnimationFrame(tick)') || !graphTableKanbanViewText.includes('getBoardScrollElement: () => boardScrollRef.current')) {
    throw new Error('expected graph-table kanban drag assistance to reuse the shared edge-aware auto-scroll owner instead of local scroll patches')
  }
  if (!kanbanDragHookText.includes('KANBAN_LANE_HOVER_DWELL_MS') || !kanbanDragHookText.includes('window.setTimeout(() =>') || !kanbanDragHookText.includes('resolveDropTarget')) {
    throw new Error('expected graph-table kanban lane target switching to reuse the shared hover dwell stabilization contract')
  }
  if (!kanbanDragHookText.includes('KANBAN_DIRECTIONAL_LANE_ENTRY_BIAS_PX') || !kanbanDragHookText.includes('KANBAN_CARD_TARGET_HYSTERESIS_PX') || !kanbanDragHookText.includes('lastAppliedTargetPointerRef')) {
    throw new Error('expected graph-table kanban lane entry and card target stickiness to reuse the shared bias and hysteresis contract')
  }
  if (!kanbanDragHookText.includes('registerFocusableRowElement') || !kanbanDragHookText.includes('requestFocusRow') || !kanbanDragHookText.includes('attemptFocusRow')) {
    throw new Error('expected graph-table kanban focus recovery to stay centralized in the shared drag owner')
  }
  if (!kanbanDragHookText.includes('const commitMove = React.useCallback') || !kanbanDragHookText.includes('const reportBlockedMove = React.useCallback') || !kanbanDragHookText.includes("commitMove(move) === 'committed' ? 'commit' : 'no-op'")) {
    throw new Error('expected graph-table kanban pointer and keyboard moves to share one upstream commit/no-op/boundary resolver')
  }
  if (!kanbanDragVisualStateText.includes('export const getKanbanCardDragVisualState') || !kanbanDragVisualStateText.includes('isCommitFlash') || !graphTableKanbanViewText.includes('getKanbanCardDragVisualState') || !graphTableKanbanViewText.includes('getKanbanLaneDragVisualState') || !graphTableKanbanViewText.includes('commitFlashGroupKey')) {
    throw new Error('expected graph-table kanban drag ghost, lane hover emphasis, and commit flash to reuse the shared visual state helper')
  }
  if (kanbanDragHookText.indexOf('const updateAutoScrollTargets = React.useCallback') > kanbanDragHookText.indexOf('const resolveDropTarget = React.useCallback')) {
    throw new Error('expected graph-table shared auto-scroll callback to be declared before the shared drop-target resolver to avoid TDZ runtime crashes')
  }
  if (!kanbanDragHookText.includes('const clearActiveDropTarget = React.useCallback') || !kanbanDragHookText.includes('if (dragOverRowIdRef.current == null) {') || !kanbanDragHookText.includes('clearActiveDropTarget()')) {
    throw new Error('expected graph-table lane-end drag previews to clear from the shared drag owner when the pointer leaves the lane target')
  }
  if (!kanbanDragHookText.includes('const [dragOutcomeSequence, setDragOutcomeSequence] = React.useState(0)') || !kanbanDragHookText.includes('setDragOutcomeSequence(value => value + 1)') || !graphTableKanbanViewText.includes('kanbanDrag.dragOutcomeSequence')) {
    throw new Error('expected graph-table repeated outcome announcements to be driven by the shared outcome sequence')
  }
  if (!kanbanDragHookText.includes('clearCommitFeedback()') || !kanbanDragHookText.includes("kind: 'no-op'")) {
    throw new Error('expected graph-table kanban no-op moves to clear stale success feedback in the shared drag owner')
  }
  if (!kanbanDragHookText.includes('setCommitFlashRowId(move.rowId)') || !graphTableKanbanViewText.includes('commitFlashRowId === row.id')) {
    throw new Error('expected graph-table kanban commit flash to follow the moved row from the shared drag owner')
  }
  if (!kanbanDragIntentText.includes('export const buildKanbanCardDropIntentLabel') || !graphTableKanbanViewText.includes('buildKanbanDragStatusText') || !graphTableKanbanViewText.includes('activeDragStatusText')) {
    throw new Error('expected graph-table kanban drag intent captions and status text to reuse the shared intent helper')
  }
  if (!graphTableKanbanViewText.includes('const liveRegionKey = [') || !graphTableKanbanViewText.includes('kanbanDrag.dragOutcomeSequence') || !graphTableKanbanViewText.includes('aria-live="polite">{statusPillText}</div>') || graphTableKanbanViewText.includes("setLiveMessage(statusPillText || '')")) {
    throw new Error('expected graph-table live-region announcements to stay aligned with the shared status pill without local live-message state churn')
  }
  if (!kanbanMoveOutcomesText.includes("kind: 'blocked' | 'cancelled' | 'no-op' | 'committed'") || !kanbanMoveOutcomesText.includes('export type KanbanBlockedMoveReason') || !kanbanMoveOutcomesText.includes('export const isKanbanMoveNoOp') || !graphTableKanbanViewText.includes('dragOutcomeMessage') || !graphTableKanbanViewText.includes('commitFlashRowId') || !graphTableKanbanViewText.includes('statusPillText')) {
    throw new Error('expected graph-table kanban success, cancel, no-op, and boundary outcomes to reuse the shared move outcome helper')
  }
  if (!graphTableKanbanViewText.includes('registerFocusableRowElement') || !graphTableKanbanViewText.includes('kanbanDrag.commitMove({') || !graphTableKanbanViewText.includes('kanbanDrag.reportBlockedMove({') || !graphTableKanbanViewText.includes("'start-of-lane'") || !graphTableKanbanViewText.includes("'start-of-board'") || !graphTableKanbanViewText.includes("'end-of-board'")) {
    throw new Error('expected graph-table kanban view to reuse the shared keyboard commit, boundary feedback, and focus recovery path')
  }
  if (!kanbanReorderText.includes('export const resolveKanbanGroupOrder') || !graphTableKanbanViewText.includes('resolveKanbanGroupOrder({')) {
    throw new Error('expected graph-table kanban lanes to reuse the shared lane ordering helper instead of local alphabetical sorting')
  }
  if (!graphTableDbText.includes('export const reorderGraphTableRows') || graphTableDbText.includes('await doc.incrementalPatch({ order: nextOrder, data: nextData, updatedAtMs: now })')) {
    throw new Error('expected graph-table db owner to persist manual row reorder upstream and preserve it during graph sync')
  }
  if (!responsiveToolbarCssText.includes('.kg-toast-card') || !toastHostText.includes('kg-toast-list')) {
    throw new Error('expected toast notifications to use valid shared mobile viewport sizing')
  }
  if ([explorerSearchControlText, explorerHeaderActionsText, graphTableKanbanViewText, toastHostText].some(text => text.includes('calc(100vw-'))) {
    throw new Error('expected mobile viewport calc classes to avoid invalid no-space calc syntax')
  }
  if (!cssText.includes('min-height: var(--kg-control-height, 36px);')) {
    throw new Error('expected collapsed toolbar and header height to follow the shared control height token')
  }
  if (!importUrlPromptText.includes('kg-import-url-prompt') || !importUrlPromptText.includes('kg-import-url-actions') || !importUrlPromptText.includes('kg-import-url-confirm')) {
    throw new Error('expected Import URL controls to expose shared responsive owner classes')
  }
  if (!responsiveToolbarCssText.includes('.kg-import-url-actions') || !responsiveToolbarCssText.includes('flex-direction: column') || !responsiveToolbarCssText.includes('.kg-import-url-confirm')) {
    throw new Error('expected Import URL controls to stack and keep touch-sized actions from shared mobile CSS')
  }
  if (!responsiveToolbarCssText.includes('[data-kg-floating-panel-root="true"]:not(.App-toolbar)') || !responsiveToolbarCssText.includes('--kg-floating-tool-menu-bottom-offset')) {
    throw new Error('expected floating tool menus to use a shared bottom-safe mobile panel placement')
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
