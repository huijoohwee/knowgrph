import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardFixedCardOverlaySkipsNoopTransformWrites() {
  const text = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/StoryboardCardOverlayLayer2d.tsx'), 'utf8')
  for (const snippet of [
    "willChange: 'transform'",
    'lastAppliedBoxByCardIdRef',
    'const boxChanged = !prevBox',
    'Math.abs(prevBox.left - box.left) >= 0.25',
    'if (boxChanged) {',
    'lastAppliedBoxByCardIdRef.current.set',
    'lastAppliedBoxByCardIdRef.current.delete(key)',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected Storyboard fixed-card overlay to avoid redundant transform writes: ${snippet}`)
    }
  }
}

export function testStoryboardCardOverlayRestoresFlexInteractions() {
  const overlay = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/StoryboardCardOverlayLayer2d.tsx'), 'utf8')
  const helper = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/storyboardCardOverlayInteractions2d.ts'), 'utf8')
  const richMediaDrag = readFileSync(resolve(process.cwd(), 'src/components/RichMediaPanelOverlayDrag.ts'), 'utf8')
  const richMediaResize = readFileSync(resolve(process.cwd(), 'src/components/RichMediaPanelResizeHandle.tsx'), 'utf8')
  const richMediaSurface = readFileSync(resolve(process.cwd(), 'src/components/useRichMediaPanelSurfaceState.ts'), 'utf8')
  const surface = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx'), 'utf8')
  const listeners = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/interactions/listeners.ts'), 'utf8')
  const canvasViewMenu = readFileSync(resolve(process.cwd(), 'src/components/toolbar/canvasViewMenu.ts'), 'utf8')
  const canvasGridControls = readFileSync(resolve(process.cwd(), 'src/lib/canvas/canvasGridDisplayControls.ts'), 'utf8')
  for (const snippet of [
    'data-kg-overlay-pan-owner="canvas"',
    'dragHandle',
    'onHeaderPointerDown={event => onHeaderPointerDown(event, node)}',
    '<StoryboardCardResizeHandle',
    'useStoryboardCardOverlayWheelForwarding({ getWheelForwardTarget, rootRef })',
    'fixedLayoutEnabled ? buildFixedStoryboardCardPlacements2d',
    'dragWorldOverrideByCardIdRef.current.get(card.id) || readNodeCenter(node)',
    'getWheelForwardTarget={() => props.rootRef.current?.querySelector',
    'const overlayPanOwnerCanvas =',
    'overlayBodyViewportPan && flowEditorOverlayInteractionMode && !overlayPanOwnerCanvas',
  ]) {
    if (![overlay, surface, listeners].some(text => text.includes(snippet))) throw new Error(`expected Storyboard card flex interactions snippet: ${snippet}`)
  }
  for (const snippet of ['installRichMediaOverlayWheelForwarding', 'startRichMediaPanelHeaderDrag', 'beginRichMediaPanelResizeDrag', 'createRafValueScheduler', 'isStoryboardHeaderDragBlockedTarget', '[contenteditable="true"]', "'visual:width'", "'visual:height'"]) {
    if (!helper.includes(snippet)) throw new Error(`expected Storyboard card interaction helper snippet: ${snippet}`)
  }
  for (const snippet of ['installWheelForwardingAndBrowserZoomGuards', 'startPointerDrag']) {
    if (!richMediaDrag.includes(snippet)) throw new Error(`expected Rich Media interaction owner to keep low-level primitive: ${snippet}`)
    if (helper.includes(snippet)) throw new Error(`expected Storyboard helper to avoid low-level Rich Media primitive: ${snippet}`)
  }
  for (const snippet of ['beginRichMediaPanelResizeDrag', 'RichMediaPanelResizeHandle']) {
    if (!richMediaResize.includes(snippet) || !helper.includes(snippet)) throw new Error(`expected Storyboard resize to reuse Rich Media owner: ${snippet}`)
  }
  if (!richMediaSurface.includes('installRichMediaOverlayWheelForwarding(element, {')) {
    throw new Error('expected Flow Editor Rich Media panels to reuse shared Rich Media wheel forwarding owner')
  }
  for (const snippet of ['CANVAS_GRID_DISPLAY_CONTROL_ID', 'SNAP_GRID_DISPLAY_CONTROL_ID', 'readCanvasGridDisplayControlActive', 'readSnapGridDisplayControlActive']) {
    if (!canvasViewMenu.includes(snippet) || !canvasGridControls.includes(snippet)) throw new Error(`expected Canvas View Grid/Snap controls to stay shared: ${snippet}`)
  }
  if (overlay.includes('input,textarea,select,button,[role="button"]')) {
    throw new Error('expected Storyboard header drag guard to avoid blocking inline display editors by role')
  }
}
