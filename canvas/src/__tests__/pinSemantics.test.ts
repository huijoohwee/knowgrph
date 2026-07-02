import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testPinnedDragSemanticsAcrossPanels = () => {
  const root = process.cwd()

  const mainToolbarPath = path.resolve(root, 'src', 'components', 'Toolbar.tsx')
  const widgetPanelPath = path.resolve(root, 'src', 'components', 'StoryboardWidget', 'WidgetEditorPanel.tsx')
  const headerActionsPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'HeaderActions.tsx')
  const pinTogglePath = path.resolve(root, 'src', 'lib', 'ui', 'pinToggle.ts')

  const toolbar = readUtf8(mainToolbarPath)
  if (!toolbar.includes('onHeaderDragStart={!effectiveMainPanelPinned ? handleMainPanelHeaderDragStart : undefined}')) {
    throw new Error('Expected pinned main panel to disable drag')
  }

  const widgetPanel = readUtf8(widgetPanelPath)
  const widgetOverlayInnerPath = path.resolve(root, 'src', 'components', 'StoryboardWidget', 'WidgetEditorInner.tsx')
  const widgetOverlayInner = readUtf8(widgetOverlayInnerPath)
  const widgetChromePath = path.resolve(root, 'src', 'components', 'StoryboardWidget', 'StoryboardWidgetPanelChrome.tsx')
  const widgetChrome = readUtf8(widgetChromePath)
  const widgetDragHookPath = path.resolve(root, 'src', 'components', 'StoryboardWidget', 'useWidgetDragHandlers.ts')
  const widgetDragHook = readUtf8(widgetDragHookPath)
  const storyboardWidgetCanvasSurfacePath = path.resolve(root, 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'StoryboardWidgetCanvasSurface.tsx')
  const storyboardWidgetCanvasSurface = readUtf8(storyboardWidgetCanvasSurfacePath)
  const flowCanvasListenersPath = path.resolve(root, 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const flowCanvasListeners = readUtf8(flowCanvasListenersPath)
  if (!widgetPanel.includes('dragHandle={headerDragEnabled}') || !widgetPanel.includes('onHeaderPointerDown={headerDragEnabled ? onHeaderPointerDown : undefined}')) {
    throw new Error('Expected widget panel header to keep the shared drag handler wired')
  }
  if (widgetPanel.includes('onHeaderPointerDownCapture=')) {
    throw new Error('Expected disabled widget header drag to fall through to shared collective pan instead of capture-consuming pointerdown')
  }
  if (!widgetChrome.includes("dragHandle ? 'cursor-move' : 'cursor-default'")) {
    throw new Error('Expected widget header drag affordance to use the shared drag-handle flag')
  }
  if (widgetChrome.includes('onHeaderPointerDownCapture')) {
    throw new Error('Expected Storyboard Widget panel chrome to avoid stale header capture hook')
  }
  if (widgetDragHook.includes('if (pinnedInCanvas) return')) {
    throw new Error('Expected pinned widget world-position drag not to be disabled by stale pin state')
  }
  for (const snippet of [
    'isFlowWidgetHeaderDragAllowedByPin',
    'readCanvasBoardLayoutMode(strybldrStoryboardBoardLayoutMode)',
    "String(storyboardWidgetSurfaceId || '').trim() === 'storyboard'",
    'headerDragEnabled: headerDragAllowedByPin',
    'headerDragEnabled={headerDragAllowedByPin}',
  ]) {
    if (!widgetOverlayInner.includes(snippet)) {
      throw new Error(`Expected widget overlay drag to reuse shared board-aware pin movement semantics: ${snippet}`)
    }
  }
  if (!widgetDragHook.includes('headerDragEnabled?: boolean') || !widgetDragHook.includes('if (!headerDragEnabled) return')) {
    throw new Error('Expected widget drag handler to accept the shared board-aware pin movement gate')
  }
  const widgetViewPath = path.resolve(root, 'src', 'components', 'StoryboardWidget', 'WidgetEditorView.tsx')
  const widgetView = readUtf8(widgetViewPath)
  if (!widgetView.includes("data-kg-widget-header-drag-enabled={headerDragEnabled ? '1' : '0'}")) {
    throw new Error('Expected widget view to expose the board-aware header drag state for Rich Media parity checks')
  }
  if (widgetView.includes('!headerDragEnabled && isHeaderTarget')) {
    throw new Error('Expected disabled widget header drag to use shared collective pan instead of local event consumption')
  }
  if (storyboardWidgetCanvasSurface.includes('isStoryboardWidgetOverlayHeaderDragDisabledTarget')) {
    throw new Error('Expected Storyboard Widget screen-authority pan to accept disabled local-drag headers for collective pinned movement')
  }
  if (flowCanvasListeners.includes('overlayDisabledHeaderDragTarget')) {
    throw new Error('Expected native FlowCanvas listeners to avoid blocking disabled local-drag headers from collective pinned movement')
  }

  const headerActions = readUtf8(headerActionsPath)
  if (!headerActions.includes('PinOff')) {
    throw new Error('Expected pin toggle to render PinOff when unpinned')
  }

  const pinToggle = readUtf8(pinTogglePath)
  if (!pinToggle.includes('UI_THEME_TOKENS.button.activeBg') || !pinToggle.includes('UI_THEME_TOKENS.icon.active')) {
    throw new Error('Expected pin toggle styling to use theme token SSOT')
  }
}
