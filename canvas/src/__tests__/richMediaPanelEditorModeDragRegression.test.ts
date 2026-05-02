import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { shouldShowRichMediaFloatingToolbar } from '@/lib/render/richMediaSsot'

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

  if (!panelText.includes("import { NodeOverlayEditorActionsToolbar } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'")) {
    throw new Error('expected RichMediaPanel to reuse the shared widget-like floating toolbar component')
  }
  if (!panelText.includes('shouldShowRichMediaFloatingToolbar({')) {
    throw new Error('expected RichMediaPanel to derive its shared floating-toolbar visibility through the rich-media SSOT helper')
  }
  if (!panelText.includes('<NodeOverlayEditorActionsToolbar')) {
    throw new Error('expected RichMediaPanel to mount the shared floating toolbar instead of duplicating header actions')
  }
  if (!panelText.includes('richMediaMediaSelector={showWidgetLikeToolbar ? {')) {
    throw new Error('expected RichMediaPanel to route media-mode selection through the shared floating toolbar')
  }
  if (!panelText.includes('richMediaViewToggle={showWidgetLikeToolbar ? props.richMediaViewToggle : undefined}')) {
    throw new Error('expected RichMediaPanel to route rich-media view toggles through the shared floating toolbar contract')
  }
  if (!panelText.includes('richMediaAspectToggle={showWidgetLikeToolbar ? props.richMediaAspectToggle : undefined}')) {
    throw new Error('expected RichMediaPanel to route aspect toggles through the shared floating toolbar contract')
  }
  if (!panelText.includes("richMediaTextModeToggle={showWidgetLikeToolbar && panelSelectedTab === 'text' ? {")) {
    throw new Error('expected RichMediaPanel to route text edit/view toggles through the shared floating toolbar')
  }
  if (!panelText.includes('openExternalAction={showWidgetLikeToolbar && safeOpenUrl ? {')) {
    throw new Error('expected RichMediaPanel to route open-source actions through the shared floating toolbar')
  }
  if (!panelText.includes('actionVisibility={{')) {
    throw new Error('expected RichMediaPanel to disable legacy generic widget actions when reusing the shared floating toolbar')
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
  if (!overlayEditorPanelText.includes('richMediaViewToggle={richMediaViewToggle}')) {
    throw new Error('expected NodeOverlayEditorPanel to pass view-toggle state into the shared RichMediaPanel toolbar')
  }
  if (!overlayEditorPanelText.includes('richMediaAspectToggle={richMediaAspectToggle}')) {
    throw new Error('expected NodeOverlayEditorPanel to pass aspect-toggle state into the shared RichMediaPanel toolbar')
  }
  if (overlayEditorPanelText.includes("richMediaPreview?.kind === 'image' && richMediaPreview.url ? (")) {
    throw new Error('expected NodeOverlayEditorPanel to remove the legacy bespoke image/video/iframe preview branches after consolidation')
  }
  if (overlayEditorText.includes('richMediaMediaSelector={isRichMediaPanelWidget ? {')) {
    throw new Error('expected NodeOverlayEditor to stop mounting legacy Rich Media media selectors on the outer generic widget toolbar')
  }
  if (overlayEditorText.includes('richMediaViewToggle={isRichMediaPanelWidget ? {')) {
    throw new Error('expected NodeOverlayEditor to stop mounting legacy Rich Media view toggles on the outer generic widget toolbar')
  }
  if (overlayEditorText.includes('richMediaAspectToggle={isRichMediaPanelWidget ? {')) {
    throw new Error('expected NodeOverlayEditor to stop mounting legacy Rich Media aspect toggles on the outer generic widget toolbar')
  }
  if (!overlayEditorPanelText.includes('richMediaMediaSelector={richMediaMediaSelector}')) {
    throw new Error('expected Flow Editor rich-media media selectors to flow through the shared RichMediaPanel shell')
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

export function testRichMediaFloatingToolbarShowsForCanonicalOpenUrlPreview() {
  const showForOpenUrlOnly = shouldShowRichMediaFloatingToolbar({
    hasPanelState: false,
    hasMultiKinds: false,
    selectedTab: 'image',
    safeOpenUrl: 'https://example.com/source',
  })
  if (showForOpenUrlOnly !== true) {
    throw new Error('expected canonical Rich Media previews with an open source URL to keep the widget-like floating toolbar')
  }

  const hideForEmptyNonPanel = shouldShowRichMediaFloatingToolbar({
    hasPanelState: false,
    hasMultiKinds: false,
    selectedTab: 'image',
    safeOpenUrl: '',
  })
  if (hideForEmptyNonPanel !== false) {
    throw new Error('expected empty non-panel Rich Media surfaces to avoid mounting a ghost floating toolbar')
  }
}
