import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWidgetToolbarAutoShowsOnFirstSelectionTransition() {
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(overlayPath, 'utf8')

  const requiredSnippets = [
    'const wasSelectedRef = React.useRef(false)',
    'const selected = !!id && selectedNodeId === id',
    'if (selected && !wasSelectedRef.current) {',
    'setToolbarVisible(true)',
    'wasSelectedRef.current = selected',
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected NodeOverlayEditor to auto-show floating toolbar when widget selection transitions to active: ${snippet}`)
    }
  }
}

export function testFlowWidgetToolbarVisibleWhenViewLockOn() {
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const toolbarText = readFileSync(toolbarPath, 'utf8')

  if (!overlayText.includes('onPointerDownCapture={(ev) => {')) {
    throw new Error('expected NodeOverlayEditor to keep pointer-down selection path for widget clicks')
  }
  if (overlayText.includes('if (!active) return')) {
    const aroundPointerDown = overlayText.includes('onPointerDownCapture={(ev) => {\n        if (!active) return')
    if (aroundPointerDown) {
      throw new Error('expected widget click in View Lock ON to still allow showing floating-toolbar')
    }
  }
  if (toolbarText.includes('if (!visible || !active) return null')) {
    throw new Error('expected floating-toolbar to remain visible in View Lock ON')
  }
  if (toolbarText.includes('const disabledByViewLock = !active')) {
    throw new Error('expected floating-toolbar actions to remain clickable in View Lock ON')
  }
}

export function testRichMediaPanelViewToggleLivesInFloatingToolbarOnly() {
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const panelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const formPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const richMediaSsotPath = resolve(process.cwd(), 'src', 'lib', 'render', 'richMediaSsot.ts')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const panelText = readFileSync(panelPath, 'utf8')
  const formText = readFileSync(formPath, 'utf8')
  const richMediaSsotText = readFileSync(richMediaSsotPath, 'utf8')

  if (!overlayText.includes('richMediaViewToggle={isRichMediaPanelWidget ? {')) {
    throw new Error('expected NodeOverlayEditor to wire Rich Media Panel view toggle through the floating toolbar')
  }
  if (!toolbarText.includes('richMediaViewToggle?.visible')) {
    throw new Error('expected NodeOverlayEditorActionsToolbar to render a Rich Media Panel view toggle')
  }
  if (!toolbarText.includes('SplitSquareVertical')) {
    throw new Error('expected floating toolbar Rich Media toggle to use the dedicated tiny split-view button')
  }
  if (!toolbarText.includes('getRichMediaPanelViewTitle(richMediaViewToggle.isKtvRows)')) {
    throw new Error('expected Rich Media floating toolbar toggle to reuse the shared Rich Media Panel title helper')
  }
  if (toolbarText.includes('UI_LABELS.panelView') || toolbarText.includes('UI_LABELS.ktvRows')) {
    throw new Error('expected Rich Media floating toolbar toggle to avoid generic Panel View/KTV Rows labels')
  }
  if (panelText.includes('flowWidgetRichMediaPanelView') || panelText.includes('flowWidgetRichMediaKtvRows')) {
    throw new Error('expected NodeOverlayEditorPanel header to avoid duplicating the Rich Media Panel view toggle')
  }
  if (!formText.includes('aria-label={getRichMediaPanelViewLabel(false)}')) {
    throw new Error('expected Rich Media Panel viewer section to reuse the shared canonical view label')
  }
  if (!richMediaSsotText.includes("RICH_MEDIA_PANEL_CONNECT_VIEW_LABEL = 'Rich Media Panel (Connect media to render)'")) {
    throw new Error('expected Rich Media SSOT to keep the canonical default viewer label')
  }
  if (!richMediaSsotText.includes('RICH_MEDIA_PANEL_KTV_VIEW_LABEL = FLOW_RICH_MEDIA_PANEL_NODE_LABEL')) {
    throw new Error('expected Rich Media SSOT to keep the canonical KTV-row panel label')
  }
}
