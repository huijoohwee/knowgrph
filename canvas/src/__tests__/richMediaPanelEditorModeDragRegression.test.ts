import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  installWheelForwardingAndBrowserZoomGuards,
  shouldKeepWheelOnScrollableTarget,
} from 'grph-shared/dom/wheelGuards'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

function readRichMediaPanelSourceBundle(): string {
  const root = resolve(process.cwd(), 'src', 'components')
  const files = [
    'RichMediaPanel.tsx',
    'RichMediaPanel.types.ts',
    'RichMediaPanelSurface.tsx',
    'RichMediaPanelShell.tsx',
    'RichMediaPanelContentStack.tsx',
    'RichMediaPanelTextSurface.tsx',
    'RichMediaPanelIframeSurface.tsx',
    'RichMediaPanelDirectMediaSurface.tsx',
    'RichMediaPanelResizeHandle.tsx',
    'RichMediaPanelOpenOverlay.tsx',
    'useRichMediaPanelMediaState.ts',
    'useRichMediaPanelSurfaceState.ts',
  ]
  return files.map(file => readFileSync(resolve(root, file), 'utf8')).join('\n')
}

export function testRichMediaPanelEditorModeDisablesInteractiveContentForDragging() {
  const surfaceStatePath = resolve(process.cwd(), 'src', 'components', 'useRichMediaPanelSurfaceState.ts')
  const surfaceStateText = readFileSync(surfaceStatePath, 'utf8')
  if (!surfaceStateText.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({')) {
    throw new Error('expected RichMediaPanel to read canonical workspace overlay-open state for drag behavior')
  }
  if (!surfaceStateText.includes('const allowClickToOpenOverlay = canClickToOpen && !workspaceEditorOverlayOpen')) {
    throw new Error('expected RichMediaPanel to gate click-to-open overlay only while the workspace overlay is actually open')
  }
  if (
    !surfaceStateText.includes('pointerEvents: shouldHideSurfaceUntilReady')
    || !surfaceStateText.includes(': workspaceEditorOverlayOpen || canvasOverlayProxyEnabled')
    || !surfaceStateText.includes(": (contentInteractive || canClickToOpen ? 'auto' : 'none'),")
  ) {
    throw new Error('expected RichMediaPanel pointer-events behavior to depend on workspace overlay-open and shared overlay proxy state, not editor mode alone')
  }
}

export async function testRichMediaPanelFlowEditorModifierWheelZoomKeepsInteractiveScroll() {
  const surfaceStatePath = resolve(process.cwd(), 'src', 'components', 'useRichMediaPanelSurfaceState.ts')
  const surfaceStateText = readFileSync(surfaceStatePath, 'utf8')
  if (!surfaceStateText.includes('const forwardModifierWheelZoomOnly = installWheelForwarding && flowEditorFrontmatterDocumentMode === true')) {
    throw new Error('expected RichMediaPanel to isolate explicit modifier-wheel zoom forwarding in Flow Editor frontmatter document mode')
  }
  if (!surfaceStateText.includes('shouldForwardWheel: forwardModifierWheelZoomOnly ? event => event.ctrlKey === true || event.metaKey === true : undefined')) {
    throw new Error('expected RichMediaPanel to forward only explicit ctrl/cmd wheel zoom while preserving normal panel scroll')
  }

  const wheelGuardsPath = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'wheelGuards.ts')
  const wheelGuardsText = readFileSync(wheelGuardsPath, 'utf8')
  if (!wheelGuardsText.includes('shouldForwardWheel?: (e: WheelEvent) => boolean')) {
    throw new Error('expected shared wheel guards to accept a wheel-forwarding predicate')
  }
  if (!wheelGuardsText.includes('const tryForwardWheel = (e: WheelEvent): boolean => {')
    || !wheelGuardsText.includes('if (!forwardTo || !forwardAllowed) return false')) {
    throw new Error('expected shared wheel guards to gate forwarding through the shared predicate result')
  }
  if (!wheelGuardsText.includes('export function shouldKeepWheelOnScrollableTarget(') || !wheelGuardsText.includes('opts?: WheelScrollableTargetOptions')) {
    throw new Error('expected shared wheel guards to expose a reusable scrollable-target wheel predicate')
  }
  if (!wheelGuardsText.includes('if (shouldKeepWheelOnScrollableTarget(e, el)) return')) {
    throw new Error('expected shared wheel forwarding to preserve wheel events that start inside scrollable embedded media surfaces')
  }
  if (!wheelGuardsText.includes('export function consumeScrollablePanelWheelEvent')) {
    throw new Error('expected shared wheel guards to expose a reusable widget inner-panel wheel consumer')
  }

  const { dom, restore: restoreDom } = initJsdomHarness()
  const g = globalThis as typeof globalThis & {
    getComputedStyle?: typeof getComputedStyle
    WheelEvent?: typeof WheelEvent
  }
  const originalGetComputedStyle = g.getComputedStyle
  const originalWheelEvent = g.WheelEvent
  let cleanup: (() => void) | null = null
  try {
    g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window) as typeof getComputedStyle
    g.WheelEvent = dom.window.WheelEvent as unknown as typeof WheelEvent

    const doc = dom.window.document
    const root = doc.createElement('section')
    const scrollSurface = doc.createElement('section')
    const child = doc.createElement('p')
    const forwardedTarget = doc.createElement('section')
    const forwarded: WheelEvent[] = []
    const readForwardedCount = () => forwarded.length
    scrollSurface.style.overflowY = 'auto'
    scrollSurface.style.overflowX = 'hidden'
    Object.defineProperty(scrollSurface, 'scrollHeight', { configurable: true, value: 420 })
    Object.defineProperty(scrollSurface, 'clientHeight', { configurable: true, value: 120 })
    child.textContent = 'Scrollable rich media text'
    scrollSurface.appendChild(child)
    root.appendChild(scrollSurface)
    doc.body.appendChild(root)
    doc.body.appendChild(forwardedTarget)
    forwardedTarget.addEventListener('wheel', event => forwarded.push(event as WheelEvent))

    cleanup = installWheelForwardingAndBrowserZoomGuards(root, {
      forwardWheelTo: () => forwardedTarget,
      stopPropagationOnForward: true,
      stopPropagationOnPreventZoom: false,
      forwardedFlagKey: '__kgForwarded',
    })

    const scrollWheel = new dom.window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 48,
    }) as unknown as WheelEvent
    child.dispatchEvent(scrollWheel)

    if (!shouldKeepWheelOnScrollableTarget(scrollWheel, root)) {
      throw new Error('expected shared wheel guard to classify scrollable rich-media descendants as local scroll targets')
    }
    if (scrollWheel.defaultPrevented) {
      throw new Error('expected non-modifier wheel inside a scrollable media surface to remain available for native scrolling')
    }
    const forwardedBeforeZoom = readForwardedCount()
    if (forwardedBeforeZoom !== 0) {
      throw new Error(`expected scrollable media wheel to avoid canvas forwarding, forwarded=${forwardedBeforeZoom}`)
    }

    const zoomWheel = new dom.window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: 48,
    }) as unknown as WheelEvent
    child.dispatchEvent(zoomWheel)

    if (!shouldKeepWheelOnScrollableTarget(zoomWheel, root, { allowModifierZoom: false })) {
      throw new Error('expected shared wheel guard to let widget inner panel scrolling win over modifier-wheel canvas zoom when requested')
    }
    if (!zoomWheel.defaultPrevented) {
      throw new Error('expected modifier-wheel zoom to keep using the shared forwarding/browser zoom guard')
    }
    const forwardedAfterZoom = readForwardedCount()
    if (forwardedAfterZoom !== 1) {
      throw new Error(`expected only explicit modifier wheel to forward from the scrollable surface, forwarded=${forwardedAfterZoom}`)
    }

    cleanup?.()
    cleanup = installWheelForwardingAndBrowserZoomGuards(root, {
      forwardWheelTo: () => forwardedTarget,
      forwardWheelBeforeScrollableTarget: true,
      stopPropagationOnForward: true,
      stopPropagationOnPreventZoom: false,
      forwardedFlagKey: '__kgForwarded',
    })

    const forwardedBeforeD3PanelWheel = readForwardedCount()
    const d3PanelWheel = new dom.window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 48,
    }) as unknown as WheelEvent
    child.dispatchEvent(d3PanelWheel)

    const forwardedAfterD3PanelWheel = readForwardedCount()
    if (!d3PanelWheel.defaultPrevented) {
      throw new Error('expected D3 rich-media panel wheel to be captured for canvas forwarding before local scroll')
    }
    if (forwardedAfterD3PanelWheel !== forwardedBeforeD3PanelWheel + 1) {
      throw new Error(`expected D3 rich-media panel wheel to forward before scrollable-target guard, before=${forwardedBeforeD3PanelWheel} after=${forwardedAfterD3PanelWheel}`)
    }

  } finally {
    try {
      cleanup?.()
    } catch {
      void 0
    }
    g.getComputedStyle = originalGetComputedStyle
    g.WheelEvent = originalWheelEvent
    restoreDom()
  }
}

export function testD3RichMediaOverlayForwardsWheelBeforeScrollableBody() {
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx')
  const overlayText = readFileSync(overlayPath, 'utf8')
  if (!overlayText.includes('forwardWheelBeforeScrollableTarget={!allowEmbeddedMediaInteraction}')
    || !overlayText.includes('forwardPointerTo={() => svgRef.current}')
    || !overlayText.includes('shouldForwardPointerDown={() => !allowEmbeddedMediaInteraction}')) {
    throw new Error('expected D3 rich-media overlays to route non-interactive table/code body gestures through shared canvas pan/zoom owners')
  }
  if (overlayText.includes('onWheelCapture={stopEvent}')) {
    throw new Error('expected D3 rich-media overlays to let shared native wheel forwarding receive panel-origin wheel events')
  }

  const designOverlayPath = resolve(process.cwd(), 'src', 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx')
  const designOverlayText = readFileSync(designOverlayPath, 'utf8')
  if (!designOverlayText.includes('forwardWheelBeforeScrollableTarget={true}')
    || !designOverlayText.includes('shouldForwardPointerDown={() => true}')) {
    throw new Error('expected Markdown design rich-media panels to opt into canvas-first wheel and body-pan forwarding')
  }
  if (designOverlayText.includes("from 'grph-shared/dom/wheelGuards'")
    || designOverlayText.includes('installWheelForwardingAndBrowserZoomGuards')) {
    throw new Error('expected Markdown design overlay wrapper to avoid duplicate wheel forwarding; RichMediaPanel owns forwarding')
  }
  if (!designOverlayText.includes('collectiveFitToViewport: false,')
    || !designOverlayText.includes('clampToViewport: null,')) {
    throw new Error('expected Markdown design overlay to stay node-aligned by avoiding viewport fit/clamp')
  }
  if (designOverlayText.includes('isViewportClampEnabled')
    || designOverlayText.includes('viewportClampSuspended')
    || designOverlayText.includes('suspendViewportClamp')) {
    throw new Error('expected Markdown design overlay to avoid stale clamp-suspension paths')
  }
  if (designOverlayText.includes('onWheelCapture={props.stopEvent}')) {
    throw new Error('expected Markdown design overlay wrappers to let shared native wheel forwarding receive panel-origin wheel events')
  }

  const panelText = readFileSync(resolve(process.cwd(), 'src', 'components', 'useRichMediaPanelSurfaceState.ts'), 'utf8')
  if (!panelText.includes("from 'grph-shared/dom/overlayPointerGuards'")
    || !panelText.includes('readOverlayPointerTargetState')
    || !panelText.includes('shouldBlockOverlayPanTarget(pointerTarget, { scrollSurfaceCanForwardPointer })')) {
    throw new Error('expected RichMediaPanel to reuse shared overlay pointer target/button guards')
  }
  const overlayDragPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanelOverlayDrag.ts')
  const overlayDragText = readFileSync(overlayDragPath, 'utf8')
  if (!overlayDragText.includes("from 'grph-shared/dom/overlayPointerGuards'")
    || !overlayDragText.includes('readOverlayPointerTargetState')
    || !overlayDragText.includes('isOverlayPanStartButtonEvent(native)')
    || !overlayDragText.includes('shouldBlockOverlayPanTarget(pointerTarget, { scrollSurfaceCanForwardPointer })')) {
    throw new Error('expected RichMediaPanel overlay drag owner to reuse shared overlay pointer target/button guards')
  }

  const pointerGuardPath = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'overlayPointerGuards.ts')
  const pointerGuardText = readFileSync(pointerGuardPath, 'utf8')
  const overlayProxyPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts')
  const overlayProxyText = readFileSync(overlayProxyPath, 'utf8')
  if (!pointerGuardText.includes('export function readOverlayPointerTargetState')
    || !pointerGuardText.includes('export function shouldBlockOverlayPanTarget')
    || !pointerGuardText.includes('export function isOverlayPanStartButtonEvent')
    || !pointerGuardText.includes('selectableSurface: \'[data-kg-rich-media-selectable-surface="1"]\'')) {
    throw new Error('expected shared overlay pointer guard to own target classification, pan blocking, and button interpretation')
  }
  if (!overlayProxyText.includes("import { MEDIA_PREVIEW_SELECTABLE_SURFACE_ATTR, MEDIA_PREVIEW_SELECTABLE_SURFACE_VALUE } from '@/lib/cards/mediaPreviewSurfaceSelection'")
    || !overlayProxyText.includes('[${MEDIA_PREVIEW_SELECTABLE_SURFACE_ATTR}="${MEDIA_PREVIEW_SELECTABLE_SURFACE_VALUE}"]')
    || !overlayProxyText.includes('FLOW_EDITOR_OVERLAY_INTERACTIVE_SELECTOR')) {
    throw new Error('expected Flow Editor overlay proxy to classify shared media preview selectable surfaces as protected overlay interaction targets')
  }

  const overlayInteractionsPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const overlayInteractionsText = readFileSync(overlayInteractionsPath, 'utf8')
  const panTransformIndex = overlayInteractionsText.indexOf('zoom.transform as unknown as')
  const requestScheduleIndex = overlayInteractionsText.indexOf('requestOverlaySchedule?.()', panTransformIndex)
  if (panTransformIndex < 0 || requestScheduleIndex < 0) {
    throw new Error('expected 2D overlay pan moves to request the shared overlay layout schedule after viewport transforms')
  }
}

export function testRichMediaPanelFlowEditorReusesSharedFloatingToolbarVariant() {
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const overlayEditorPanelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const overlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorView.tsx')
  const toolbarHookPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayRichMediaToolbar.ts')
  const sharedToolbarPropsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'richMediaOverlayToolbarProps.ts')
  const flowCanvasOverlayPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const flowCanvasToolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasRichMediaOverlayToolbar.tsx')
  const graphCanvasToolbarPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx')
  const panelText = readRichMediaPanelSourceBundle()
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const overlayEditorPanelText = readFileSync(overlayEditorPanelPath, 'utf8')
  const overlayEditorText = readFileSync(overlayEditorPath, 'utf8')
  const toolbarHookText = readFileSync(toolbarHookPath, 'utf8')
  const sharedToolbarPropsText = readFileSync(sharedToolbarPropsPath, 'utf8')
  const flowCanvasOverlayText = readFileSync(flowCanvasOverlayPath, 'utf8')
  const flowCanvasToolbarText = readFileSync(flowCanvasToolbarPath, 'utf8')
  const graphCanvasToolbarText = readFileSync(graphCanvasToolbarPath, 'utf8')

  if (panelText.includes('NodeOverlayEditorActionsToolbar')) {
    throw new Error('expected RichMediaPanel to stop mounting its own widget-like floating toolbar and defer toolbar ownership upstream')
  }
  if (!sharedToolbarPropsText.includes("navClassName: args?.navClassName || 'absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2'")) {
    throw new Error('expected shared 2D Rich Media toolbar placement to clear the panel header')
  }
  if (panelText.includes('shouldShowRichMediaFloatingToolbar({')) {
    throw new Error('expected RichMediaPanel to stop deriving floating-toolbar visibility locally after upstream toolbar consolidation')
  }
  if (panelText.includes('data-kg-rich-media-floating-toolbar="1"')) {
    throw new Error('expected RichMediaPanel render surface to stop exposing a duplicate floating-toolbar shell marker')
  }
  if (panelText.includes('data-kg-panel-action="1"')) {
    throw new Error('expected RichMediaPanel to remove the legacy inline header action variant after consolidation')
  }
  if (!overlayEditorPanelText.includes("from '@/components/RichMediaPanel'")
    || !overlayEditorPanelText.includes('<RichMediaPanel')) {
    throw new Error('expected NodeOverlayEditorPanel to reuse the shared RichMediaPanel render shell instead of a bespoke preview surface')
  }
  if (overlayEditorPanelText.includes('showFloatingToolbar={false}')) {
    throw new Error('expected NodeOverlayEditorPanel to stop suppressing the shared RichMediaPanel floating toolbar after consolidation')
  }
  if (!overlayEditorPanelText.includes('panel={richMediaPanelState || undefined}')) {
    throw new Error('expected NodeOverlayEditorPanel to pass canonical rich-media panel state into the shared RichMediaPanel shell')
  }
  if (!overlayEditorPanelText.includes('widgetToolbarActive={false}')) {
    throw new Error('expected NodeOverlayEditorPanel to disable duplicate in-body RichMediaPanel toolbar ownership')
  }
  if (overlayEditorPanelText.includes("richMediaPreview?.kind === 'image' && richMediaPreview.url ? (")) {
    throw new Error('expected NodeOverlayEditorPanel to remove the legacy bespoke image/video/iframe preview branches after consolidation')
  }
  if (!overlayEditorText.includes('richMediaMediaSelector={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaMediaSelector : undefined}')) {
    throw new Error('expected NodeOverlayEditor to own the Rich Media media selector through the real outer widget floating toolbar')
  }
  if (!overlayEditorText.includes('richMediaViewToggle={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaViewToggle : undefined}')) {
    throw new Error('expected NodeOverlayEditor to own the Rich Media view toggle through the real outer widget floating toolbar')
  }
  if (!overlayEditorText.includes('richMediaAspectToggle={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaAspectToggle : undefined}')) {
    throw new Error('expected NodeOverlayEditor to own the Rich Media aspect toggle through the real outer widget floating toolbar')
  }
  if (!overlayEditorText.includes('richMediaTextModeToggle={isRichMediaPanelWidget ? richMediaPanelToolbarProps.richMediaTextModeToggle : undefined}')) {
    throw new Error('expected NodeOverlayEditor to own the Rich Media text edit/view toggle through the real outer widget floating toolbar')
  }
  if (!overlayEditorText.includes('openExternalAction={isRichMediaPanelWidget ? richMediaPanelToolbarProps.openExternalAction : undefined}')) {
    throw new Error('expected NodeOverlayEditor to own the Rich Media open-source action through the real outer widget floating toolbar')
  }
  for (const snippet of [
    "from '@/components/FlowCanvas/FlowCanvasRichMediaOverlayToolbar'",
    '<FlowCanvasRichMediaOverlayToolbar',
    'data-kg-rich-media-flow-editor-overlay-shell="1"',
    "const [activeRichMediaPanelId, setActiveRichMediaPanelId] = React.useState('')",
    'isCanonicalNodeIdEqual(selectedNodeId, node.id)',
    'isCanonicalNodeIdEqual(activeRichMediaPanelId, node.id)',
    'onPointerDownCapture={() => setActiveRichMediaPanelId(node.id)}',
    'visible={isSelected}',
  ]) {
    if (!flowCanvasOverlayText.includes(snippet)) {
      throw new Error(`expected Flow Editor Rich Media overlay owner to mount the shared floating toolbar shell: ${snippet}`)
    }
  }
  for (const snippet of [
    'buildSharedRichMediaOverlayControlProps',
    'richMediaMediaSelector',
    'richMediaAspectToggle',
    'richMediaTextModeToggle',
    'openExternalAction',
  ]) {
    if (!sharedToolbarPropsText.includes(snippet)) throw new Error(`expected shared Rich Media toolbar controls to retain ${snippet}`)
  }
  for (const snippet of ['buildSharedRichMediaOverlayControlProps({', '{...toolbarControlProps}']) {
    if (!graphCanvasToolbarText.includes(snippet)) throw new Error(`expected Storyboard Rich Media overlay to reuse shared toolbar controls: ${snippet}`)
  }
  for (const snippet of [
    "from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'",
    "from '@/components/FlowEditor/richMediaOverlayToolbarProps'",
    '<NodeOverlayEditorActionsToolbar',
    '{...buildSharedRichMediaOverlayToolbarProps()}',
    'onOpenInSidepane={openInSidepane}',
    'onDuplicate={duplicate}',
    'onRemove={remove}',
  ]) {
    if (!flowCanvasToolbarText.includes(snippet)) {
      throw new Error(`expected Flow Editor Rich Media overlay owner to reuse the shared floating toolbar variant: ${snippet}`)
    }
  }
  if (!toolbarHookText.includes("import { buildNodeOverlayOpenExternalAction } from '@/components/FlowEditor/nodeOverlayOpenExternalAction'")) {
    throw new Error('expected Rich Media toolbar wiring to import the shared node-overlay external action helper')
  }
  if (!toolbarHookText.includes('openExternalAction: buildNodeOverlayOpenExternalAction({')) {
    throw new Error('expected Rich Media toolbar wiring to build the open-source action through the shared helper')
  }
  if (toolbarHookText.includes("window.open(richMediaOpenUrl, '_blank', 'noopener,noreferrer')")) {
    throw new Error('expected Rich Media toolbar wiring to avoid inline window.open choreography')
  }
  if (!toolbarText.includes('richMediaTextModeToggle?: {')) {
    throw new Error('expected NodeOverlayEditorActionsToolbar to expose a shared rich-media text edit/view toggle contract')
  }
  if (!toolbarText.includes("import type { NodeOverlayOpenExternalAction } from '@/components/FlowEditor/nodeOverlayOpenExternalAction'")) {
    throw new Error('expected NodeOverlayEditorActionsToolbar to import the shared open-source action contract type')
  }
  if (!toolbarText.includes('openExternalAction?: NodeOverlayOpenExternalAction')) {
    throw new Error('expected NodeOverlayEditorActionsToolbar to expose the typed shared open-source action contract')
  }
  if (!toolbarText.includes("data-kg-rich-media-text-mode-toggle=\"1\"")) {
    throw new Error('expected the shared floating toolbar to expose a stable rich-media text toggle hook')
  }
  if (!toolbarText.includes("data-kg-rich-media-open-source=\"1\"")) {
    throw new Error('expected the shared floating toolbar to expose a stable rich-media open-source hook')
  }
}
