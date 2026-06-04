import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  installWheelForwardingAndBrowserZoomGuards,
  shouldKeepWheelOnScrollableTarget,
} from 'grph-shared/dom/wheelGuards'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export function testRichMediaPanelEditorModeDisablesInteractiveContentForDragging() {
  const p = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })')) {
    throw new Error('expected RichMediaPanel to read canonical workspace overlay-open state for drag behavior')
  }
  if (!text.includes('const allowClickToOpenOverlay = canClickToOpen && !workspaceEditorOverlayOpen')) {
    throw new Error('expected RichMediaPanel to gate click-to-open overlay only while the workspace overlay is actually open')
  }
  if (!text.includes('pointerEvents: shouldHideSurfaceUntilReady ? \'none\' : (headerPassthrough ? \'none\' : (workspaceEditorOverlayOpen || canvasOverlayProxyEnabled ? \'auto\' : ((contentInteractive || canClickToOpen) ? \'auto\' : \'none\')))')) {
    throw new Error('expected RichMediaPanel pointer-events behavior to depend on workspace overlay-open and shared overlay proxy state, not editor mode alone')
  }
}

export async function testRichMediaPanelFlowEditorModifierWheelZoomKeepsInteractiveScroll() {
  const panelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const panelText = readFileSync(panelPath, 'utf8')
  if (!panelText.includes('const forwardModifierWheelZoomOnly = installWheelForwarding && flowEditorFrontmatterDocumentMode === true')) {
    throw new Error('expected RichMediaPanel to isolate explicit modifier-wheel zoom forwarding in Flow Editor frontmatter document mode')
  }
  if (!panelText.includes('shouldForwardWheel: forwardModifierWheelZoomOnly ? e => e.ctrlKey === true || e.metaKey === true : undefined')) {
    throw new Error('expected RichMediaPanel to forward only explicit ctrl/cmd wheel zoom while preserving normal panel scroll')
  }

  const wheelGuardsPath = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'wheelGuards.ts')
  const wheelGuardsText = readFileSync(wheelGuardsPath, 'utf8')
  if (!wheelGuardsText.includes('shouldForwardWheel?: (e: WheelEvent) => boolean')) {
    throw new Error('expected shared wheel guards to accept a wheel-forwarding predicate')
  }
  if (!wheelGuardsText.includes('if (forwardTo && forwardAllowed)')) {
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

export function testRichMediaPanelFlowEditorReusesSharedFloatingToolbarVariant() {
  const panelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const overlayEditorPanelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const overlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorView.tsx')
  const panelText = readFileSync(panelPath, 'utf8')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const overlayEditorPanelText = readFileSync(overlayEditorPanelPath, 'utf8')
  const overlayEditorText = readFileSync(overlayEditorPath, 'utf8')

  if (panelText.includes('NodeOverlayEditorActionsToolbar')) {
    throw new Error('expected RichMediaPanel to stop mounting its own widget-like floating toolbar and defer toolbar ownership upstream')
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
  if (!toolbarText.includes('richMediaTextModeToggle?: {')) {
    throw new Error('expected NodeOverlayEditorActionsToolbar to expose a shared rich-media text edit/view toggle contract')
  }
  if (!toolbarText.includes('openExternalAction?: {')) {
    throw new Error('expected NodeOverlayEditorActionsToolbar to expose a shared open-source action contract')
  }
  if (!toolbarText.includes("data-kg-rich-media-text-mode-toggle=\"1\"")) {
    throw new Error('expected the shared floating toolbar to expose a stable rich-media text toggle hook')
  }
  if (!toolbarText.includes("data-kg-rich-media-open-source=\"1\"")) {
    throw new Error('expected the shared floating toolbar to expose a stable rich-media open-source hook')
  }
}
