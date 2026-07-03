import { readFileSync } from 'node:fs'

export function assertStoryboard2dMediaDropContract() {
  const storyboardCanvasSource = readFileSync(new URL('../components/StoryboardCanvas.tsx', import.meta.url), 'utf8')
  const storyboardWidgetSurfaceSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/runtime/StoryboardWidgetCanvasSurface.tsx', import.meta.url), 'utf8')
  const storyboardWidgetDropBridgeSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetDropBridge.ts', import.meta.url), 'utf8')
  const graphStoryboardOverlaySource = readFileSync(new URL('../components/StoryboardWidgetCanvas/StoryboardCardOverlayLayer2d.tsx', import.meta.url), 'utf8')
  const graphStoryboardMediaDropSlotSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/StoryboardCardMediaDropSlot2d.tsx', import.meta.url), 'utf8')
  const graphStoryboardMediaDropHookSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/useStoryboardCardMediaDrop2d.ts', import.meta.url), 'utf8')
  const mediaDragPayloadSource = readFileSync(new URL('../lib/ui/mediaDragPayload.ts', import.meta.url), 'utf8')
  const flowCanvasGraphStateSource = readFileSync(new URL('../components/FlowCanvas/useFlowCanvasGraphState.ts', import.meta.url), 'utf8')
  const flowCanvasMediaOverlaysSource = readFileSync(new URL('../components/FlowCanvas/FlowCanvasMediaOverlays.tsx', import.meta.url), 'utf8')
  const flowCanvasMediaOverlayWorldPointSource = readFileSync(new URL('../components/FlowCanvas/flowCanvasMediaOverlayWorldPoint.ts', import.meta.url), 'utf8')
  const flowCanvasZoomRequestSource = readFileSync(new URL('../components/FlowCanvas/applyZoomRequestNative.ts', import.meta.url), 'utf8')
  const mediaOverlayLayoutLoopSource = readFileSync(new URL('../lib/render/mediaOverlayLayoutLoop2d.ts', import.meta.url), 'utf8')
  const graphStoryboardCardOverlaySource = [graphStoryboardOverlaySource, graphStoryboardMediaDropSlotSource, graphStoryboardMediaDropHookSource].join('\n')

  for (const snippet of [
    'isMediaDropClaimedByNestedTarget',
    'if (isMediaDropClaimedByNestedTarget(clientX, clientY)) return false',
  ]) {
    if (!storyboardCanvasSource.includes(snippet) && !storyboardCanvasSource.includes('|| isMediaDropClaimedByNestedTarget(clientX, clientY)')) {
      throw new Error(`expected Storyboard canvas media release capture to skip nested media drop targets: ${snippet}`)
    }
    if (!storyboardWidgetSurfaceSource.includes(snippet)) {
      throw new Error(`expected Storyboard Widget canvas drop owner to skip nested media drop targets: ${snippet}`)
    }
    if (!storyboardWidgetDropBridgeSource.includes(snippet)) {
      throw new Error(`expected Storyboard Widget drop bridge to skip nested media drop targets: ${snippet}`)
    }
  }
  for (const snippet of [
    'document.querySelectorAll(`[${MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE}="1"]`)',
    '.some(element => isMediaDragPointInsideElement(element, clientX, clientY))',
  ]) {
    if (!mediaDragPayloadSource.includes(snippet)) {
      throw new Error(`expected nested media drop detection to reserve registered drop-consumer rectangles even when an overlay covers elementFromPoint: ${snippet}`)
    }
  }
  for (const snippet of [
    'if (hasMediaDragPayload(dt) && isMediaDropClaimedByNestedTarget(x, y)) return',
    'if (isMediaDropClaimedByNestedTarget(release.clientX, release.clientY)) return',
    'if (isMediaDropClaimedByNestedTarget(Number(detail.clientX), Number(detail.clientY))) return',
  ]) {
    if (!storyboardWidgetDropBridgeSource.includes(snippet)) {
      throw new Error(`expected Storyboard Widget drop bridge to leave registered nested media drop targets for their local owner before claiming the event: ${snippet}`)
    }
  }
  for (const snippet of [
    "document.querySelectorAll<HTMLElement>('[data-kg-storyboard-widget-surface-root]')",
    'if (activeSurface) return activeSurface.getBoundingClientRect()',
  ]) {
    if (!storyboardWidgetDropBridgeSource.includes(snippet)) {
      throw new Error(`expected bridge-only media drops to resolve against the active renderer surface before falling back to the window: ${snippet}`)
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
    || !graphStoryboardOverlaySource.includes('initialFitCommitKeyRef.current !== initialFitDocumentKey')
    || !graphStoryboardOverlaySource.includes('`${storyboardWidgetSurfaceId}::${String(markdownDocumentName || \'\').trim()}`')
  ) {
    throw new Error('expected Storyboard 2D fixed-card overlay to seed offscreen startup through the shared FlowCanvas zoom request path')
  }
  if (graphStoryboardOverlaySource.includes('initialFitCommitKeyRef.current !== zoomViewKey')) {
    throw new Error('expected Storyboard graph and selection mutations not to re-arm initial fit')
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
    "import { isStoryboardCanvas2dRenderer, resolveCanvas2dRendererId } from '@/lib/config.render'",
    'isStoryboardCanvas2dRenderer(resolveCanvas2dRendererId(state.canvas2dRenderer))',
  ]) {
    if (!flowCanvasZoomRequestSource.includes(snippet)) {
      throw new Error(`expected FlowCanvas zoom requests to reuse the shared Storyboard renderer predicate for Storyboard: ${snippet}`)
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
    "from '@/components/FlowCanvas/flowCanvasMediaOverlayWorldPoint'",
    'projectWithWorldTransformScale: storyboardSharedSurfaceRendererMode',
    'getNodeWorldTopLeftForId: storyboardSharedSurfaceRendererMode',
    '? id => mediaOverlayWorldPositionOverrideRef.current.get(id) || readNodeWorldTopLeft2d(mediaNodes.find(node => isCanonicalNodeIdEqual(node?.id, id)))',
    "getNodeWorldCenterForId: id => readNodeWorldCenterFromTopLeft2d(mediaNodes.find(node => isCanonicalNodeIdEqual(node?.id, id)))",
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
    'export function readNodeWorldTopLeft2d(',
    'export function readNodeWorldCenterFromTopLeft2d(',
    "return readNodeCenterWorld2d(node, { coords: 'topLeft' })",
  ]) {
    if (!flowCanvasMediaOverlayWorldPointSource.includes(snippet)) {
      throw new Error(`expected shared FlowCanvas media overlay world-point helpers to stay source-owned: ${snippet}`)
    }
  }
  if (storyboardWidgetSurfaceSource.includes('http://127.0.0.1:7777') || storyboardWidgetSurfaceSource.includes('storyboard-media-panel-loop') || storyboardWidgetSurfaceSource.includes('[DEBUG]')) {
    throw new Error('forbid hardcoded Storyboard surface debug endpoints and debug traces in the shared media drop owner')
  }
  if (flowCanvasMediaOverlaysSource.includes('http://127.0.0.1:7777') || flowCanvasMediaOverlaysSource.includes('[DEBUG] rich media overlay selected/opened on storyboard surface')) {
    throw new Error('forbid hardcoded Rich Media overlay debug endpoints in the shared Storyboard media surface')
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
  if (/<RichMediaPanel\b/.test(graphStoryboardCardOverlaySource)) {
    throw new Error('expected fixed Storyboard card media slots to render raw CardMediaPreview media, not RichMediaPanel chrome')
  }
}

export function testStoryboardCanvasMediaDropSkipsNestedDropTargets() {
  assertStoryboard2dMediaDropContract()
}
