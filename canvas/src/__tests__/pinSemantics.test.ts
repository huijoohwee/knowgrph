import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testPinnedDisablesDragAcrossPanels = () => {
  const root = process.cwd()

  const floatingPanelPath = path.resolve(root, 'src', 'features', 'toolbar', 'ToolbarToolMenu.tsx')
  const mainToolbarPath = path.resolve(root, 'src', 'components', 'Toolbar.tsx')
  const nodeQuickEditorPanelPath = path.resolve(root, 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const headerActionsPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'HeaderActions.tsx')
  const pinTogglePath = path.resolve(root, 'src', 'lib', 'ui', 'pinToggle.ts')

  const floatingPanel = readUtf8(floatingPanelPath)
  if (!floatingPanel.includes('if (floatingPanelPinned) return')) {
    throw new Error('Expected pinned floating panel to disable drag')
  }
  if (!floatingPanel.includes("${!floatingPanelPinned ? 'cursor-move' : ''}")) {
    throw new Error('Expected unpinned floating panel to show cursor-move')
  }

  const toolbar = readUtf8(mainToolbarPath)
  if (!toolbar.includes('onHeaderDragStart={!mainPanelPinned ? handleMainPanelHeaderDragStart : undefined}')) {
    throw new Error('Expected pinned main panel to disable drag')
  }

  const nodeQuickEditorPanel = readUtf8(nodeQuickEditorPanelPath)
  if (!nodeQuickEditorPanel.includes("pinned ? 'select-none' : 'cursor-move select-none'")) {
    throw new Error('Expected pinned node quick editor to disable drag and unpinned to enable drag')
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

