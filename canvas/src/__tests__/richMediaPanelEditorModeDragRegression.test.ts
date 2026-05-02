import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
export function testRichMediaPanelEditorModeDisablesInteractiveContentForDragging() {
  const p = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })')) {
    throw new Error('expected RichMediaPanel to read canonical workspace overlay-open state for drag behavior')
  }
  if (!text.includes('const allowClickToOpenOverlay = canClickToOpen && !workspaceEditorOverlayOpen')) {
    throw new Error('expected RichMediaPanel to gate click-to-open overlay only while the workspace overlay is actually open')
  }
  if (!text.includes('pointerEvents: shouldHideSurfaceUntilReady ? \'none\' : (headerPassthrough ? \'none\' : (workspaceEditorOverlayOpen ? \'auto\' : ((contentInteractive || canClickToOpen) ? \'auto\' : \'none\')))')) {
    throw new Error('expected RichMediaPanel pointer-events behavior to depend on workspace overlay-open state, not editor mode alone')
  }
}

export function testRichMediaPanelFlowEditorModifierWheelZoomKeepsInteractiveScroll() {
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
}

export function testRichMediaPanelFlowEditorReusesSharedFloatingToolbarVariant() {
  const panelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const overlayEditorPanelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const overlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
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
  if (!overlayEditorPanelText.includes("import RichMediaPanel from '@/components/RichMediaPanel'")) {
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
