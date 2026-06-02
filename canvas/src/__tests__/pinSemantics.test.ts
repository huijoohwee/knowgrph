import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testPinnedDragSemanticsAcrossPanels = () => {
  const root = process.cwd()

  const mainToolbarPath = path.resolve(root, 'src', 'components', 'Toolbar.tsx')
  const widgetPanelPath = path.resolve(root, 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const headerActionsPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'HeaderActions.tsx')
  const pinTogglePath = path.resolve(root, 'src', 'lib', 'ui', 'pinToggle.ts')

  const toolbar = readUtf8(mainToolbarPath)
  if (!toolbar.includes('onHeaderDragStart={!effectiveMainPanelPinned ? handleMainPanelHeaderDragStart : undefined}')) {
    throw new Error('Expected pinned main panel to disable drag')
  }

  const widgetPanel = readUtf8(widgetPanelPath)
  const widgetChromePath = path.resolve(root, 'src', 'components', 'FlowEditor', 'FlowEditorPanelChrome.tsx')
  const widgetChrome = readUtf8(widgetChromePath)
  const widgetDragHookPath = path.resolve(root, 'src', 'components', 'FlowEditor', 'useNodeOverlayDragHandlers.ts')
  const widgetDragHook = readUtf8(widgetDragHookPath)
  if (!widgetPanel.includes('onHeaderPointerDown={onHeaderPointerDown}')) {
    throw new Error('Expected widget panel header to keep the shared drag handler wired')
  }
  if (!widgetChrome.includes("dragHandle ? 'cursor-move' : 'cursor-default'")) {
    throw new Error('Expected widget header drag affordance to use the shared drag-handle flag')
  }
  if (widgetDragHook.includes('if (pinnedInCanvas) return')) {
    throw new Error('Expected pinned widget world-position drag not to be disabled by stale pin state')
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
