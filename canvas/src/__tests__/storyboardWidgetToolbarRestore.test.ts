import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { computeViewportSafeInlineCenterShiftPx } from '@/lib/ui/viewportToolbarPlacement'

export function testStoryboardWidgetToolbarRestoresTinyFloatingActionsWithRun() {
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorActionsToolbar.tsx')
  const overlayImplementationPaths = [
    resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorInner.tsx'),
    resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorView.tsx'),
    resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'useWidgetPlacementRuntime.ts'),
    resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'flowWidgetOverlayShared.ts'),
  ]
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetOverlaySurface.tsx')
  const overlaySurfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'storyboardWidgetOverlaySurfaceElements.tsx')
  const openMappingHelperPath = resolve(process.cwd(), 'src', 'features', 'storyboard-widget-manager', 'openWorkflowManagerMappingForNode.ts')
  const copyPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiCopy.ts')
  const metaPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiMeta.ts')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const overlayText = overlayImplementationPaths.map(path => readFileSync(path, 'utf8')).join('\n')
  const overlaySurfaceText = [overlaySurfacePath, overlaySurfaceElementsPath].map(path => readFileSync(path, 'utf8')).join('\n')
  const openMappingHelperText = readFileSync(openMappingHelperPath, 'utf8')
  const copyText = readFileSync(copyPath, 'utf8')
  const metaText = readFileSync(metaPath, 'utf8')

  const requiredToolbarSnippets = [
    'title={UI_LABELS.updateKvEntry}',
    'tooltipContent={UI_LABELS.updateKvEntry}',
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
    throw new Error('expected StoryboardWidget overlay widget to wire the Run action through the shared run handler')
  }
  if (!overlaySurfaceText.includes('void args.runWorkflowNode(actionNodeId)')) {
    throw new Error('expected StoryboardWidget Run action to reuse the existing workflow run callback through the resolved action identity')
  }
  if (!toolbarText.includes('GRAPH_FIELDS_ENTRY_SHORTCUT_NODE_LABEL')) {
    throw new Error('expected Open sidepane to reuse the shared Graph Fields node entry label instead of a local literal')
  }
  if (!toolbarText.includes("workflowManagerEntryLabel: GRAPH_FIELDS_ENTRY_SHORTCUT_NODE_LABEL")) {
    throw new Error('expected Open sidepane to deep-link into the Workflow Manager node entry target')
  }
  if (toolbarText.includes("emitFloatingPanelOpen({ tab: 'node', open: true })")) {
    throw new Error('expected Open sidepane to stop using the ambiguous floating-panel node route')
  }
  if (!overlaySurfaceText.includes('openWorkflowManagerMappingForNode({')) {
    throw new Error('expected Update KV entry to reuse the shared mapping-open helper instead of inlining a local route')
  }
  for (const snippet of [
    'const resolvedWidgetRegistryEntry = resolveWidgetRegistryEntry({',
    'const widgetIdentity = resolveWidgetIdentity({',
    "workflowManagerTab: 'mapping' as const",
    '...(searchQuery ? { searchQuery } : {}),',
  ]) {
    if (!openMappingHelperText.includes(snippet)) {
      throw new Error(`expected shared mapping-open helper snippet: ${snippet}`)
    }
  }
  if (!copyText.includes("flowWidgetRun: 'Run'")) {
    throw new Error('expected shared UI copy to expose a Run label for the widget tiny floating toolbar')
  }
  for (const snippet of [
    "flowWidgetOpenInSidepane: 'Open sidepane'",
    "flowWidgetConvertToLoop: 'Convert to loop'",
    "flowWidgetDuplicate: 'Duplicate'",
    "flowWidgetClearOutput: 'Reset'",
    "flowWidgetRemoveNode: 'Remove'",
  ]) {
    if (!copyText.includes(snippet)) {
      throw new Error(`expected shared widget toolbar copy snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    "updateKvEntry: 'Update KV entry'",
    "openInSidepane: 'Open sidepane'",
    "convertToLoopNode: 'Convert to loop'",
    "clearOutput: 'Reset'",
    "removeNode: 'Remove'",
  ]) {
    if (!metaText.includes(snippet)) {
      throw new Error(`expected shared widget toolbar meta label snippet: ${snippet}`)
    }
  }
}

export function testStoryboardWidgetToolbarViewportShiftKeepsActionsReachable() {
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
