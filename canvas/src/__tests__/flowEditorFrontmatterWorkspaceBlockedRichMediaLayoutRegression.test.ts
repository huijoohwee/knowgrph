import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterWorkspaceBlockedRichMediaLayoutStaysLive() {
  const overlaysPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const panelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(overlaysPath, 'utf8')
  const panelText = readFileSync(panelPath, 'utf8')

  if (!text.includes('const stopPassiveLayoutWhileWorkspaceOverlayOpen =\n      workspaceOverlayOpenRef.current && !flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas media overlays to derive a frontmatter-aware passive layout exception while workspace mutation blocking is open')
  }
  if (!text.includes('if (stopPassiveLayoutWhileWorkspaceOverlayOpen) return')) {
    throw new Error('expected passive Rich Media layout scheduling to stay active for frontmatter document mode while workspace mutation blocking is open')
  }
  if (!text.includes('if (!active || mediaLayoutItems.length === 0 || stopPassiveLayoutWhileWorkspaceOverlayOpen)')) {
    throw new Error('expected Rich Media layout loop shutdown to exempt frontmatter document mode from workspace-open passive-layout parking')
  }
  const panelInvocationStart = text.indexOf('<RichMediaPanel')
  const panelInvocationEnd = panelInvocationStart >= 0 ? text.indexOf('/>', panelInvocationStart) : -1
  const panelInvocation = panelInvocationStart >= 0 && panelInvocationEnd > panelInvocationStart
    ? text.slice(panelInvocationStart, panelInvocationEnd)
    : ''
  if (!panelInvocation.includes('className={`absolute left-0 top-0')) {
    throw new Error('expected FlowCanvas rich media overlays to anchor at absolute top-left so passive layout transforms do not stack in normal document flow')
  }
  if (!panelInvocation.includes('flowEditorInteractionMode={flowEditorOverlayInteractionMode}')) {
    throw new Error('expected FlowCanvas rich media overlays to delegate Flow Editor absolute root positioning to the shared Rich Media Panel owner')
  }
  if (!panelText.includes("position: panelOwnsInlineSrcDocScroll ? 'relative' : (flowEditorInteractionMode ? 'absolute' : 'relative')")) {
    throw new Error('expected shared Rich Media Panel root positioning to switch to absolute in Flow Editor interaction mode so passive layout transforms map directly to overlay boxes')
  }
  if (!panelText.includes("const bodySurfaceStyle: React.CSSProperties = {\n    ...PANEL_FRAME_BODY_STYLE,\n    position: panelOwnsInlineSrcDocScroll ? 'relative' : (flowEditorInteractionMode ? 'absolute' : 'relative'),")) {
    throw new Error('expected shared Rich Media Panel merged body surface styles to preserve absolute positioning in Flow Editor interaction mode')
  }
  if (!text.includes("const mediaOverlayDragInteractionMode = canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'flowCanvas'")) {
    throw new Error('expected Rich Media overlay pan/drag interactions to be enabled from the renderer-level Flow Editor/Flow Canvas gate')
  }
  if (!text.includes('resolveFlowCanvasMediaOverlayInteractionPolicy')) {
    throw new Error('expected Rich Media overlay pan/drag interactions to reuse the shared renderer-level interaction policy')
  }
  if (!text.includes('const overlayInteractionEnabled = mediaOverlayInteractionPolicy.overlayPanActive')) {
    throw new Error('expected Rich Media panel pan proxy to remain active from the renderer-level interaction policy while workspace is open')
  }
  if (!text.includes('const headerDragInteractionActive = mediaOverlayInteractionPolicy.headerDragActive')) {
    throw new Error('expected Rich Media panel header drag to remain active from the renderer-level interaction policy while workspace is open')
  }
  if (text.includes('const overlayInteractionEnabled = mediaOverlayDragInteractionMode && !workspaceOverlayOpen')) {
    throw new Error('expected Rich Media panel pan proxy to avoid workspace-open pointer suppression')
  }
  if (text.includes('if (!mediaOverlayDragInteractionMode || workspaceOverlayOpenRef.current) return')) {
    throw new Error('expected Rich Media panel pan proxy to avoid workspace-open runtime suppression')
  }
  if (!text.includes('if (!mediaOverlayDragInteractionMode || workspaceMutationBlockedRef.current) return')) {
    throw new Error('expected Rich Media resize writes to stay blocked while workspace mutation blocking is active')
  }
  if (!text.includes("const richMediaInfiniteCanvasMode = canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'flowCanvas'")) {
    throw new Error('expected Flow Editor and Flow Canvas Rich Media panel layout to use the shared renderer-level infinite-canvas gate')
  }
  if (!text.includes("collision: richMediaInfiniteCanvasMode\n        ? { enabled: false }") || !text.includes("clampToViewport: richMediaInfiniteCanvasMode\n        ? null")) {
    throw new Error('expected Flow Rich Media panels to preserve infinite-canvas world placement instead of viewport collision/clamp relayout during pan/zoom')
  }
}
