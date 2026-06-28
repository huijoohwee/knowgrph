import { readFileSync } from 'node:fs'

export function assertStoryboard2dMediaDropContract() {
  const flowEditorSurfaceSource = readFileSync(new URL('../components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx', import.meta.url), 'utf8')
  const flowEditorWidgetDropBridgeSource = readFileSync(new URL('../components/FlowEditorCanvas/runtime/useFlowEditorWidgetDropBridge.ts', import.meta.url), 'utf8')
  const graphStoryboardOverlaySource = readFileSync(new URL('../components/FlowEditorCanvas/StoryboardCardOverlayLayer2d.tsx', import.meta.url), 'utf8')
  const graphStoryboardMediaDropSlotSource = readFileSync(new URL('../components/FlowEditorCanvas/StoryboardCardMediaDropSlot2d.tsx', import.meta.url), 'utf8')
  const graphStoryboardMediaDropHookSource = readFileSync(new URL('../components/FlowEditorCanvas/useStoryboardCardMediaDrop2d.ts', import.meta.url), 'utf8')
  const flowCanvasGraphStateSource = readFileSync(new URL('../components/FlowCanvas/useFlowCanvasGraphState.ts', import.meta.url), 'utf8')
  const flowCanvasMediaOverlaysSource = readFileSync(new URL('../components/FlowCanvas/FlowCanvasMediaOverlays.tsx', import.meta.url), 'utf8')
  const flowCanvasZoomRequestSource = readFileSync(new URL('../components/FlowCanvas/applyZoomRequestNative.ts', import.meta.url), 'utf8')
  const mediaOverlayLayoutLoopSource = readFileSync(new URL('../lib/render/mediaOverlayLayoutLoop2d.ts', import.meta.url), 'utf8')
  const graphStoryboardCardOverlaySource = [graphStoryboardOverlaySource, graphStoryboardMediaDropSlotSource, graphStoryboardMediaDropHookSource].join('\n')

  for (const snippet of [
    'isMediaDropClaimedByNestedTarget',
    'if (isMediaDropClaimedByNestedTarget(clientX, clientY)) return false',
  ]) {
    if (!flowEditorSurfaceSource.includes(snippet)) {
      throw new Error(`expected Flow Editor canvas drop owner to skip nested media drop targets: ${snippet}`)
    }
    if (!flowEditorWidgetDropBridgeSource.includes(snippet)) {
      throw new Error(`expected Flow Editor widget drop bridge to skip nested media drop targets: ${snippet}`)
    }
  }
  if (!flowCanvasGraphStateSource.includes("...(canvas2dRenderer === 'storyboard' ? EMPTY_STRING_ARRAY : openWidgetNodeIdsSnapshot)")) {
    throw new Error('expected Storyboard Rich Media Panel overlays to stay visible when click-selection auto-opens the node')
  }
  for (const snippet of [
    'const authoritativeGraphNodeById = React.useMemo(() => {',
    "const node = canvas2dRenderer === 'storyboard'",
    '? authoritativeGraphNodeById.get(key)',
  ]) {
    if (!flowCanvasGraphStateSource.includes(snippet)) {
      throw new Error(`expected Storyboard Rich Media Panel retention to validate against the authoritative pre-projection graph: ${snippet}`)
    }
  }
  if (
    !graphStoryboardOverlaySource.includes("const requestZoom = useGraphStore(s => s.requestZoom)")
    || !graphStoryboardOverlaySource.includes("requestZoom('fit', { intent: 'fitToView' })")
    || !graphStoryboardOverlaySource.includes('initialFitCommitKeyRef')
    || !graphStoryboardOverlaySource.includes('initialFitCommitKeyRef.current !== zoomViewKey')
    || !flowEditorSurfaceSource.includes('zoomViewKeyRef={props.zoomViewKeyRef}')
  ) {
    throw new Error('expected Storyboard 2D fixed-card overlay to seed offscreen startup through the shared FlowCanvas zoom request path')
  }
  if (graphStoryboardOverlaySource.includes('`${zoomViewKey}:${graphRevision}')) {
    throw new Error('expected Storyboard graph mutations not to re-arm initial fit and move media drops away from the release point')
  }
  if (
    graphStoryboardOverlaySource.includes('commitZoomTransformToStore')
    || graphStoryboardOverlaySource.includes('const transform = fittedTransform || currentTransform')
    || graphStoryboardOverlaySource.includes('transform: fittedTransform')
    || graphStoryboardOverlaySource.includes('transform = fitTransform')
  ) {
    throw new Error('expected Storyboard 2D fixed-card overlay to render from the live FlowCanvas transform instead of overriding pan/zoom with a private fit transform')
  }
  for (const snippet of [
    "import { isFlowEditorSharedCanvas2dRenderer, resolveCanvas2dRendererId } from '@/lib/config.render'",
    'isFlowEditorSharedCanvas2dRenderer(resolveCanvas2dRendererId(state.canvas2dRenderer))',
  ]) {
    if (!flowCanvasZoomRequestSource.includes(snippet)) {
      throw new Error(`expected FlowCanvas zoom requests to reuse the shared Flow Editor renderer predicate for Storyboard: ${snippet}`)
    }
  }
  for (const snippet of [
    'projectWithWorldTransformScale?: boolean',
    'args.projectWithWorldTransformScale === true',
    'getNodeWorldTopLeftForId?: (id: string)',
    'topLeftNow.x + w / 2',
    'topLeftNow.y + h / 2',
    'left: t.applyX(center.x - w / 2)',
    'top: t.applyY(center.y - h / 2)',
    'applyPanelBox(p.el, { left: nextBox.left, top: nextBox.top, w: nextBox.w, h: nextBox.h, display: \'block\', scale: nextBox.scale })',
    'readSnapGridConfigFromSchema',
    'snapPanelTopLeftToGrid',
    'const snappedWorldTopLeft = snapPointToGrid(worldTopLeft, snapGrid)',
    'const nextBox = { left: quantizePanelPos(snappedPos.left), top: quantizePanelPos(snappedPos.top), w: p.w, h: p.h, scale: Math.max(0.001, Number(p.scale) || 1) }',
  ]) {
    if (!mediaOverlayLayoutLoopSource.includes(snippet)) {
      throw new Error(`expected shared media overlay layout loop to support Storyboard card-matched world transform projection: ${snippet}`)
    }
  }
  for (const snippet of [
    "const storyboardSharedSurfaceRendererMode = canvas2dRenderer === 'storyboard'",
    'projectWithWorldTransformScale: storyboardSharedSurfaceRendererMode',
    'getNodeWorldTopLeftForId: storyboardSharedSurfaceRendererMode',
    "? id => readNodeCenterWorld2d(runtimeRef.current?.scene?.nodeById.get(id), { coords: 'center' })",
    'if (storyboardSharedSurfaceRendererMode) return override',
    'w: RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width',
    'h: RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.height',
    'if (storyboardSharedSurfaceRendererMode) return stableSize',
  ]) {
    if (!flowCanvasMediaOverlaysSource.includes(snippet)) {
      throw new Error(`expected Storyboard Rich Media Panels to reuse card-sized world geometry during pan/drag/zoom/resize: ${snippet}`)
    }
  }
  for (const snippet of [
    'initializeMediaOverlayShell(el, mediaViewportMargins.left, mediaViewportMargins.top)',
    'style={{ zIndex: overlayZIndex }}',
  ]) {
    if (!flowCanvasMediaOverlaysSource.includes(snippet)) {
      throw new Error(`expected shared Rich Media Panel shells to preserve imperative projection across interaction rerenders: ${snippet}`)
    }
  }
  for (const snippet of ["if (element.dataset.kgOverlayHasPos === '1') return", "element.style.display = 'none'"]) {
    if (!mediaOverlayLayoutLoopSource.includes(snippet)) throw new Error(`expected shared media layout owner to initialize newly mounted overlay shells once: ${snippet}`)
  }
  if (flowCanvasMediaOverlaysSource.includes('style={{ transform: `translate(')) {
    throw new Error('expected React not to overwrite the shared Rich Media Panel projection transform during pan/drag/zoom rerenders')
  }
  for (const snippet of [
    'CardMediaPreview',
    'buildNodeMediaProperties',
    'updateStrybldrStoryboardMarkdownCardOverride',
    'writeActiveMarkdownDocumentTextIfPresent',
    'setGraphDataPreservingLayout',
    'pendingMediaByCardId',
    'setPendingMediaByCardId',
    'pendingMedia={pendingMediaByCardId[card.id] || null}',
    'const displayMedia = pendingMedia || card.media',
    'MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE',
    'MEDIA_POINTER_DRAG_DROP_EVENT',
    'readMediaDragPayload',
    'readMediaPointerDragPayload',
    'clearMediaPointerDragPayload',
    'mediaDropRef',
    "document.addEventListener('dragover', handleDocumentDragOver, true)",
    "document.addEventListener('drop', handleDocumentDrop, true)",
    'data-kg-storyboard-card-media-drop="1"',
    "[MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE]: '1'",
    'mediaThumbnailDataAttr',
    'onDropMedia',
    'setMarkdownDocument(markdownDocumentName, nextMarkdownText, { applyViewPreset: false })',
  ]) {
    if (!graphStoryboardCardOverlaySource.includes(snippet)) {
      throw new Error(`expected Storyboard media drop owner to retain snippet: ${snippet}`)
    }
  }

  const overlayDropMediaIndex = graphStoryboardMediaDropHookSource.indexOf('const dropCardMedia = React.useCallback')
  const overlayDropGraphPatchIndex = graphStoryboardMediaDropHookSource.indexOf('const nextProperties = buildNodeMediaProperties({', overlayDropMediaIndex)
  const overlayDropMarkdownMirrorIndex = graphStoryboardMediaDropHookSource.indexOf('const nextMarkdownText = updateStrybldrStoryboardMarkdownCardOverride({', overlayDropMediaIndex)
  const overlayDropGraphCommitIndex = graphStoryboardMediaDropHookSource.indexOf('setGraphDataPreservingLayout({', overlayDropMediaIndex)
  if (overlayDropMediaIndex < 0 || overlayDropGraphPatchIndex < overlayDropMediaIndex || overlayDropMarkdownMirrorIndex < overlayDropGraphPatchIndex || overlayDropGraphCommitIndex < overlayDropMarkdownMirrorIndex) {
    throw new Error('expected fixed Storyboard card media drops to build and commit visible graph media while mirroring Markdown secondarily')
  }
  const overlayDropMarkdownBranch = graphStoryboardMediaDropHookSource.slice(
    graphStoryboardMediaDropHookSource.indexOf('if (nextMarkdownText && markdownDocumentName && nextMarkdownText !== markdownDocumentText)', overlayDropMediaIndex),
    overlayDropGraphCommitIndex,
  )
  if (overlayDropMarkdownBranch.includes('return')) {
    throw new Error('expected fixed Storyboard card media drop Markdown mirroring not to short-circuit visible graph media commit')
  }
  const overlayPendingMediaIndex = graphStoryboardMediaDropHookSource.indexOf('setPendingMediaByCardId(current => ({', overlayDropMediaIndex)
  if (overlayPendingMediaIndex < overlayDropMediaIndex || overlayPendingMediaIndex > overlayDropGraphPatchIndex) {
    throw new Error('expected fixed Storyboard card media drops to publish an immediate pending media preview before graph/Markdown commit work')
  }
  if (graphStoryboardCardOverlaySource.includes('RichMediaPanel')) {
    throw new Error('expected fixed Storyboard card media slots to render raw CardMediaPreview media, not RichMediaPanel chrome')
  }
}
