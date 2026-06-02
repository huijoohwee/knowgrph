import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readNodeOverlayEditorImplementationText(): string {
  return [
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx'),
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorView.tsx'),
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayRichMediaToolbar.ts'),
  ].map(path => readFileSync(path, 'utf8')).join('\n')
}

export function testFlowWidgetToolbarAutoShowsOnFirstSelectionTransition() {
  const text = readNodeOverlayEditorImplementationText()

  const requiredSnippets = [
    'const wasSelectedRef = React.useRef(false)',
    'const selected = !!id && isCanonicalNodeIdEqual(selectedNodeId, id)',
    'wasSelectedRef.current = selected',
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected NodeOverlayEditor to auto-show floating toolbar when widget selection transitions to active: ${snippet}`)
    }
  }
  if (!text.includes('if (selected && !wasSelectedRef.current) setToolbarVisible(true)')) {
    throw new Error('expected NodeOverlayEditor to auto-show floating toolbar when widget selection transitions to active')
  }
}

export function testFlowWidgetToolbarVisibleWhenViewLockOn() {
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const overlayText = readNodeOverlayEditorImplementationText()
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
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const panelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const overlayText = readNodeOverlayEditorImplementationText()
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const panelText = readFileSync(panelPath, 'utf8')

  if (overlayText.includes('richMediaViewToggle={isRichMediaPanelWidget ? {')) {
    throw new Error('expected NodeOverlayEditor to remove legacy Rich Media view-toggle wiring from the outer generic toolbar')
  }
  if (overlayText.includes('richMediaMediaSelector={isRichMediaPanelWidget ? {')) {
    throw new Error('expected NodeOverlayEditor to remove legacy Rich Media media-selector wiring from the outer generic toolbar')
  }
  if (!overlayText.includes('richMediaViewToggle={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaViewToggle : undefined}')) {
    throw new Error('expected NodeOverlayEditor to wire the Rich Media Panel view toggle through the real outer widget floating toolbar')
  }
  if (!overlayText.includes('richMediaMediaSelector={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaMediaSelector : undefined}')) {
    throw new Error('expected NodeOverlayEditor to wire the Rich Media Panel Media Selector through the real outer widget floating toolbar')
  }
  if (!overlayText.includes('richMediaAspectToggle={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaAspectToggle : undefined}')) {
    throw new Error('expected NodeOverlayEditor to wire the Rich Media Panel aspect toggle through the real outer widget floating toolbar')
  }
  if (!overlayText.includes('richMediaTextModeToggle={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaTextModeToggle : undefined}')) {
    throw new Error('expected NodeOverlayEditor to wire the Rich Media Panel text edit/view toggle through the real outer widget floating toolbar')
  }
  if (!overlayText.includes('openExternalAction={isRichMediaPanelWidget ? richMediaPanelToolbarProps.openExternalAction : undefined}')) {
    throw new Error('expected NodeOverlayEditor to wire the Rich Media Panel open-source action through the real outer widget floating toolbar')
  }
  if (!panelText.includes('widgetToolbarActive={false}')) {
    throw new Error('expected NodeOverlayEditorPanel to keep the RichMediaPanel body free of duplicate in-body widget toolbar ownership')
  }
  if (!overlayText.includes('selectedMode: richMediaSelectedMode')) {
    throw new Error('expected NodeOverlayEditor to pass the selected Rich Media mode into the shared RichMediaPanel shell')
  }
  if (!overlayText.includes('onSelect: handleSelectRichMediaMode')) {
    throw new Error('expected NodeOverlayEditor to update richMediaActiveTab through the shared RichMediaPanel selector callback')
  }
  if (!toolbarText.includes('richMediaViewToggle?.visible')) {
    throw new Error('expected NodeOverlayEditorActionsToolbar to render a Rich Media Panel view toggle')
  }
  if (!toolbarText.includes('richMediaMediaSelector?.visible')) {
    throw new Error('expected NodeOverlayEditorActionsToolbar to render a Rich Media Panel Media Selector')
  }
  if (!toolbarText.includes('RICH_MEDIA_PANEL_MEDIA_SELECTOR_LABEL')) {
    throw new Error('expected Rich Media floating toolbar selector to reuse the shared Media Selector label')
  }
  if (!toolbarText.includes('getRichMediaPanelMediaSelectorOptions')) {
    throw new Error('expected Rich Media floating toolbar selector to reuse shared media-mode option metadata')
  }
  if (!toolbarText.includes('Images')) {
    throw new Error('expected Rich Media floating toolbar selector to use the dedicated Media Selector icon button')
  }
  if (!toolbarText.includes("option.value === richMediaMediaSelector?.selectedMode")) {
    throw new Error('expected Rich Media floating toolbar selector to highlight the currently selected media mode')
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
}
