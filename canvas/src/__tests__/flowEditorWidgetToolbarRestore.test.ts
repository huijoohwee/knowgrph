import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorWidgetToolbarRestoresTinyFloatingActionsWithRun() {
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const canvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const copyPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiCopy.ts')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const canvasText = readFileSync(canvasPath, 'utf8')
  const copyText = readFileSync(copyPath, 'utf8')

  const requiredToolbarSnippets = [
    'flowWidgetOpenInSidepane',
    'flowWidgetEnableHandles',
    'flowWidgetConvertToLoop',
    'flowWidgetDuplicate',
    'flowWidgetClearOutput',
    'flowWidgetHelp',
    'flowWidgetRemoveNode',
    'flowWidgetRun',
    '<Play className={iconSizeClass}',
    'onClick={onRun}',
  ]
  for (const snippet of requiredToolbarSnippets) {
    if (!toolbarText.includes(snippet)) {
      throw new Error(`expected restored widget toolbar snippet: ${snippet}`)
    }
  }
  if (!overlayText.includes('const [toolbarDock, setToolbarDock] = React.useState<\'above\' | \'below\'>(\'above\')')) {
    throw new Error('expected widget tiny floating toolbar to track adaptive above/below docking state')
  }
  if (!overlayText.includes('const nextToolbarDock = pos.top >= WIDGET_ACTIONS_TOOLBAR_CLEARANCE_PX ? \'above\' : \'below\'')) {
    throw new Error('expected widget tiny floating toolbar docking to derive from viewport-safe overlay position')
  }
  if (!overlayText.includes('absolute left-1/2 z-10 -translate-x-1/2 pointer-events-auto')) {
    throw new Error('expected widget tiny floating toolbar anchor to keep explicit stacking and pointer-event visibility')
  }
  if (!overlayText.includes('visible={toolbarVisible}')) {
    throw new Error('expected widget tiny floating toolbar visibility to be driven by local click-open state without duplicate selected-node gating')
  }
  if (!canvasText.includes('onRun={() => {')) {
    throw new Error('expected FlowEditor overlay widget to wire the Run action through the shared run handler')
  }
  if (!canvasText.includes('void runWorkflowNode(id)')) {
    throw new Error('expected FlowEditor widget Run action to reuse the existing workflow run callback')
  }
  if (!copyText.includes("flowWidgetRun: 'Run'")) {
    throw new Error('expected shared UI copy to expose a Run label for the widget tiny floating toolbar')
  }
}
