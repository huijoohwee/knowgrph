import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { computeViewportSafeInlineCenterShiftPx } from '@/lib/ui/viewportToolbarPlacement'

export function testFlowEditorWidgetToolbarRestoresTinyFloatingActionsWithRun() {
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const overlayImplementationPaths = [
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx'),
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorView.tsx'),
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts'),
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'flowWidgetOverlayShared.ts'),
  ]
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const overlaySurfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx')
  const copyPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiCopy.ts')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const overlayText = overlayImplementationPaths.map(path => readFileSync(path, 'utf8')).join('\n')
  const overlaySurfaceText = [overlaySurfacePath, overlaySurfaceElementsPath].map(path => readFileSync(path, 'utf8')).join('\n')
  const copyText = readFileSync(copyPath, 'utf8')

  const requiredToolbarSnippets = [
    'Update KV entry',
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
  if (!overlayText.includes('absolute left-1/2 z-10 ${pointerPolicy.toolbarPointerEventsClassName}')) {
    throw new Error('expected widget tiny floating toolbar anchor to keep explicit stacking and pointer-event visibility')
  }
  if (!overlayText.includes('const [toolbarSideClamp, setToolbarSideClamp] = React.useState(false)')) {
    throw new Error('expected Rich Media widget toolbar to track side clamping state')
  }
  if (!overlayText.includes('const nextToolbarSideClamp = pos.left + scaled.width + WIDGET_ACTIONS_TOOLBAR_SIDE_CLEARANCE_PX > viewportW')) {
    throw new Error('expected Rich Media widget toolbar to clamp inside the widget when right-side placement would clip')
  }
  if (!overlayText.includes('isRichMediaPanelWidget\n              ? `absolute z-10 ${pointerPolicy.toolbarPointerEventsClassName}`')) {
    throw new Error('expected Rich Media widget toolbar anchor to branch into side-docked placement while preserving default center toolbar behavior for other widgets')
  }
  if (!overlayText.includes('computeViewportSafeInlineCenterShiftPx')
    || !overlayText.includes('toolbarInlineShiftPx')
    || !overlayText.includes('toolbarMaxWidthPx')) {
    throw new Error('expected widget tiny floating toolbar placement to use the shared viewport-safe inline shift contract')
  }
  if (!toolbarText.includes('App-toolbar--touch-scroll') || !toolbarText.includes('maxWidthPx')) {
    throw new Error('expected widget tiny floating toolbar to reuse shared touch-scroll behavior and viewport max-width')
  }
  if (!overlayText.includes('visible={toolbarVisible}')) {
    throw new Error('expected widget tiny floating toolbar visibility to be driven by local click-open state without duplicate selected-node gating')
  }
  if (!overlaySurfaceText.includes('onRun={() => {')) {
    throw new Error('expected FlowEditor overlay widget to wire the Run action through the shared run handler')
  }
  if (!overlaySurfaceText.includes('void args.runWorkflowNode(actionNodeId)')) {
    throw new Error('expected FlowEditor widget Run action to reuse the existing workflow run callback through the resolved action identity')
  }
  if (!overlaySurfaceText.includes("workflowManagerTab: 'mapping'")) {
    throw new Error('expected widget toolbar Update KV entry action to deep-link into the mapping CRUD tab')
  }
  if (!overlaySurfaceText.includes('const resolvedWidgetRegistryEntry = resolveWidgetRegistryEntry({')) {
    throw new Error('expected Update KV entry to resolve the exact active widget registry entry before opening the mapping tab')
  }
  if (!overlaySurfaceText.includes('String(resolvedWidgetRegistryEntry?.id || \'\').trim()')) {
    throw new Error('expected Update KV entry to search by exact registry entry id so multiple text widget variants open the correct CRUD rows')
  }
  if (!copyText.includes("flowWidgetRun: 'Run'")) {
    throw new Error('expected shared UI copy to expose a Run label for the widget tiny floating toolbar')
  }
}

export function testFlowEditorWidgetToolbarViewportShiftKeepsActionsReachable() {
  const centered = computeViewportSafeInlineCenterShiftPx({
    anchorCenterPx: 160,
    elementWidthPx: 240,
    viewportWidthPx: 320,
    marginPx: 8,
  })
  if (centered !== 0) {
    throw new Error(`expected centered toolbar to avoid unnecessary shift, got ${centered}`)
  }

  const left = computeViewportSafeInlineCenterShiftPx({
    anchorCenterPx: 24,
    elementWidthPx: 260,
    viewportWidthPx: 320,
    marginPx: 8,
  })
  if (!(left > 0) || Math.abs(24 + left - 138) > 0.001) {
    throw new Error(`expected left-edge toolbar to shift into the viewport, got ${left}`)
  }

  const right = computeViewportSafeInlineCenterShiftPx({
    anchorCenterPx: 300,
    elementWidthPx: 260,
    viewportWidthPx: 320,
    marginPx: 8,
  })
  if (!(right < 0) || Math.abs(300 + right - 182) > 0.001) {
    throw new Error(`expected right-edge toolbar to shift into the viewport, got ${right}`)
  }

  const oversized = computeViewportSafeInlineCenterShiftPx({
    anchorCenterPx: 24,
    elementWidthPx: 640,
    viewportWidthPx: 320,
    marginPx: 8,
  })
  if (Math.abs(24 + oversized - 160) > 0.001) {
    throw new Error(`expected oversized toolbar to center within the available viewport, got ${oversized}`)
  }
}
