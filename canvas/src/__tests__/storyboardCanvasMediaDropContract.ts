import { readFileSync } from 'node:fs'

export function assertStoryboard2dMediaDropContract() {
  const storyboardCanvasSource = readFileSync(new URL('../components/StoryboardCanvas.tsx', import.meta.url), 'utf8')
  const storyboardWidgetSurfaceSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/runtime/StoryboardWidgetCanvasSurface.tsx', import.meta.url), 'utf8')
  const storyboardWidgetRuntimeSource = readFileSync(new URL('../components/StoryboardWidgetCanvas.runtime.tsx', import.meta.url), 'utf8')
  const storyboardWidgetDropBridgeSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetDropBridge.ts', import.meta.url), 'utf8')
  const graphStoryboardOverlaySource = readFileSync(new URL('../components/StoryboardWidgetCanvas/StoryboardCardOverlayLayer2d.tsx', import.meta.url), 'utf8')
  const graphStoryboardMediaDropSlotSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/StoryboardCardMediaDropSlot2d.tsx', import.meta.url), 'utf8')
  const graphStoryboardMediaDropHookSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/useStoryboardCardMediaDrop2d.ts', import.meta.url), 'utf8')
  const graphStoryboardMediaDropGraphSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/storyboardCardMediaDropGraph.ts', import.meta.url), 'utf8')
  const sharedCardMediaDropZoneSource = readFileSync(new URL('../lib/cards/CardMediaDropZone.tsx', import.meta.url), 'utf8')
  const graphStoryboardOverlayEdgesSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetOverlayEdges.ts', import.meta.url), 'utf8')
  const graphStoryboardOverlayEdgeAnchorsSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/runtime/storyboardWidgetOverlayEdgeAnchors.ts', import.meta.url), 'utf8')
  const mediaDragPayloadSource = readFileSync(new URL('../lib/ui/mediaDragPayload.ts', import.meta.url), 'utf8')
  const flowCanvasGraphStateSource = readFileSync(new URL('../components/FlowCanvas/useFlowCanvasGraphState.ts', import.meta.url), 'utf8')
  const flowCanvasMediaOverlaysSource = readFileSync(new URL('../components/FlowCanvas/FlowCanvasMediaOverlays.tsx', import.meta.url), 'utf8')
  const flowCanvasMediaOverlayWorldPointSource = readFileSync(new URL('../components/FlowCanvas/flowCanvasMediaOverlayWorldPoint.ts', import.meta.url), 'utf8')
  const flowCanvasZoomRequestSource = readFileSync(new URL('../components/FlowCanvas/applyZoomRequestNative.ts', import.meta.url), 'utf8')
  const mediaOverlayLayoutLoopSource = readFileSync(new URL('../lib/render/mediaOverlayLayoutLoop2d.ts', import.meta.url), 'utf8')
  const graphStoryboardCardOverlaySource = [graphStoryboardOverlaySource, graphStoryboardMediaDropSlotSource, graphStoryboardMediaDropHookSource].join('\n')

  for (const snippet of [
    'isMediaDropClaimedByNestedTarget',
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
  if (!storyboardCanvasSource.includes('|| isMediaDropClaimedByNestedTarget(clientX, clientY)')) {
    throw new Error('expected Storyboard canvas media release capture to skip nested media drop targets before claiming canvas media drops')
  }
  if (!storyboardWidgetDropBridgeSource.includes("if (isMediaDropClaimedByNestedTarget(clientX, clientY)) return 'rejected'")) {
    throw new Error('expected Storyboard Widget drop bridge deferred media drops to reject registered nested media drop targets')
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
    'const viewportEl = resolveCanvasViewportMeasureElement(args.rootRef.current)',
    'if (viewportEl) return viewportEl.getBoundingClientRect()',
  ]) {
    if (!storyboardWidgetDropBridgeSource.includes(snippet)) {
      throw new Error(`expected Storyboard Widget drop bridge to prefer the canonical viewport measure element before fallback media-drop surfaces: ${snippet}`)
    }
  }
  for (const snippet of [
    "document.querySelectorAll<HTMLElement>('[data-kg-storyboard-widget-surface-root]')",
    'if (activeSurface) return activeSurface.getBoundingClientRect()',
  ]) {
    if (!storyboardWidgetDropBridgeSource.includes(snippet)) {
      throw new Error(`expected bridge-only media drops to retain renderer-surface fallback when the canonical viewport measure element is unavailable: ${snippet}`)
    }
  }
  for (const snippet of [
    "import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'",
    'disableAutoZoomModesForUserGesture(useGraphStore.getState())',
  ]) {
    if (!storyboardWidgetDropBridgeSource.includes(snippet)) {
      throw new Error(`expected Storyboard Widget drop bridge to neutralize auto-zoom selection before drop-created nodes mutate selection: ${snippet}`)
    }
  }
  if (!flowCanvasGraphStateSource.includes("...(canvas2dRenderer === 'storyboard' ? EMPTY_STRING_ARRAY : openWidgetNodeIdsSnapshot)")) {
    throw new Error('expected Storyboard Rich Media Panel overlays to stay visible when click-selection auto-opens the node')
  }
  for (const snippet of [
    'MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE',
    'MEDIA_POINTER_DRAG_DROP_EVENT',
    'readMediaDragPayload',
    'readMediaPointerDragPayload',
    'clearMediaPointerDragPayload',
    'mediaDropRef',
    "document.addEventListener('dragover', handleDocumentDragOver, true)",
    "document.addEventListener('drop', handleDocumentDrop, true)",
    "[MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE]: onDropMedia ? '1' : undefined",
    "'data-kg-card-media-drop-zone': '1'",
    'export function CardMediaDropZoneFrame',
  ]) {
    if (!sharedCardMediaDropZoneSource.includes(snippet)) {
      throw new Error(`expected shared card media drop-zone owner to retain snippet: ${snippet}`)
    }
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
    'onResolvedWorldTopLeftForId?: (id: string, point: { x: number; y: number }) => void',
    'args.onResolvedWorldTopLeftForId?.(id, worldTopLeft)',
    'applyPanelBox(p.el, { left: nextBox.left, top: nextBox.top, w: nextBox.w, h: nextBox.h, display: \'block\', scale: nextBox.scale })',
    'readSnapGridConfigFromSchema',
    'snapPanelTopLeftToGrid',
    'preserveWorldTopLeft: !!anchoredWorldBox || (!!projectedWorldBox && !!topLeftNow)',
    'const snappedPos = p.preserveWorldTopLeft ? pos : snapPanelTopLeftToGrid(pos)',
    'const collisionPreferred = preferred.filter(item => !item.preserveWorldTopLeft)',
    '.filter(item => item.preserveWorldTopLeft)',
    'const snappedWorldTopLeft = snapPointToGrid(worldTopLeft, snapGrid)',
    'const nextBox = { left: quantizePanelPos(snappedPos.left), top: quantizePanelPos(snappedPos.top), w: p.w, h: p.h, scale: Math.max(0.001, Number(p.scale) || 1) }',
  ]) {
    if (!mediaOverlayLayoutLoopSource.includes(snippet)) {
      throw new Error(`expected shared media overlay layout loop to support Storyboard card-matched world transform projection: ${snippet}`)
    }
  }
  for (const snippet of [
    "const storyboardSharedSurfaceRendererMode = canvas2dRenderer === 'storyboard'",
    'const storyboardRichMediaWorldTransformProjectionMode = storyboardWidgetSurfaceRendererMode || storyboardSharedSurfaceRendererMode',
    "from '@/components/FlowCanvas/flowCanvasMediaOverlayWorldPoint'",
    'projectWithWorldTransformScale: storyboardRichMediaWorldTransformProjectionMode',
    'onResolvedWorldTopLeftForId: storyboardRichMediaWorldTransformProjectionMode',
    'mediaOverlayWorldPositionOverrideRef.current.set(id, point)',
    'getNodeWorldTopLeftForId: storyboardRichMediaWorldTransformProjectionMode',
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
    'const displayMediaItems = React.useMemo',
    'mergeStoryboardMediaAlbumItems',
    'displayMediaItems={displayMediaItems}',
    'appendStoryboardMediaAlbumItem',
    'STORYBOARD_CARD_MEDIA_ALBUM_PROPERTY',
    'CardMediaAlbum',
    'displayMediaItems.length > 1',
    'buildStoryboardCardMediaTextareaAttachment',
    'projectedMediaAttachments={projectedMediaAttachments}',
    'buildStoryboardInlineMediaCommandContext',
    'markdownCommandContextText={storyboardCommandContextText}',
    'mediaCommandMode="external"',
    "value={textModel.primaryRaw || card.slugline || ''}",
    "displayValue={textModel.primaryDisplay || card.slugline || ''}",
    'buildInlineMediaCommandDragPayload',
    'const applyInlineMediaCommandToCard = React.useCallback',
    'onDropMedia(card, payload)',
    'onMediaCommandSelect={applyInlineMediaCommandToCard}',
    'const readLatestNode = React.useCallback',
    'const renderNode = nodeById.get(key) || null',
    'if (renderNode) return renderNode',
    'const latestGraphData = useGraphStore.getState().graphData',
    'openOnPointerDown',
    'data-kg-storyboard-card-text-column="1"',
    'onPointerDownCapture={requestSummaryEditFromTextColumn}',
    'event.preventDefault()',
    'editRequestKey={summaryEditRequestKey}',
    'select-none',
    "from '@/lib/cards/CardMediaDropZone'",
    '<CardMediaDropZoneFrame',
    "'data-kg-storyboard-card-media-drop': '1'",
    'data-kg-storyboard-card-media-chip="1"',
    'InlineMediaCommandThumbnail',
    'variant="inline"',
    'mediaThumbnailDataAttr',
    'onDropMedia',
    'setMarkdownDocument(markdownDocumentName, nextMarkdownText, { applyViewPreset: false })',
    'applyStoryboardCardMediaDropGraph',
    'setGraphDataPreservingLayout(nextGraph.graphData)',
  ]) {
    if (!graphStoryboardCardOverlaySource.includes(snippet)) {
      throw new Error(`expected Storyboard media drop owner to retain snippet: ${snippet}`)
    }
  }
  for (const forbiddenSnippet of [
    'buildInlineMediaCommandChipMarkdown',
    'buildStoryboardSummaryDisplayValue',
    'readStoryboardMediaChipMarkdown',
    'value={summaryDisplayValue}',
  ]) {
    if (graphStoryboardCardOverlaySource.includes(forbiddenSnippet)) {
      throw new Error(`expected Storyboard card summary to avoid generated inline media mutation: ${forbiddenSnippet}`)
    }
  }
  if (!graphStoryboardCardOverlaySource.includes('nextValue,\n      preserveFormatting: true,')) {
    throw new Error('expected Storyboard card summary writeback to preserve raw Viewer WYSIWYG text and spacing')
  }
  if (graphStoryboardCardOverlaySource.includes('nextValue: readStoryboardCardSummaryText(nextValue)')) {
    throw new Error('expected Storyboard card summary writeback not to strip inline media embeds through the read-only display helper')
  }

  const overlayDropMediaIndex = graphStoryboardMediaDropHookSource.indexOf('const dropCardMedia = React.useCallback')
  const overlayDropGraphPatchIndex = graphStoryboardMediaDropHookSource.indexOf('const nextProperties = buildNodeMediaProperties({', overlayDropMediaIndex)
  const overlayDropMarkdownMirrorIndex = graphStoryboardMediaDropHookSource.indexOf('const nextMarkdownText = updateStrybldrStoryboardMarkdownCardOverride({', overlayDropMediaIndex)
  const overlayDropGraphCommitIndex = graphStoryboardMediaDropHookSource.indexOf('setGraphDataPreservingLayout(nextGraph.graphData)', overlayDropMediaIndex)
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
  for (const snippet of [
    'findReusableMediaPanelNode',
    'CARD_MEDIA_DROP_EDGE_TARGET_PORT = \'mediaUrl\'',
    'CARD_MEDIA_DROP_PANEL_X_OFFSET = Math.round(RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width / 3)',
    'readCardMediaDropPanelPlacement',
    'isDropOwnedPanelNode',
    'countCardMediaPanelSources',
    'isCardMediaTargetEdge',
    'supersededSingleSourceEdgeIds',
    'isStoryboardCardMediaDropEdge',
    'isStoryboardCardMediaDropOverlayEdge',
    'buildRichMediaPanelDroppedMediaProperties',
    'finalizeEdgeAuthoring',
    '[STORYBOARD_CANVAS_RICH_MEDIA_PANEL_PROPERTY]: true',
    'fx: panelPlacement.x',
    '[FLOW_EDGE_SOURCE_PORT_KEY]: args.sourcePort',
    '[FLOW_EDGE_TARGET_PORT_KEY]: CARD_MEDIA_DROP_EDGE_TARGET_PORT',
    '[CARD_MEDIA_DROP_EDGE_KEY]: true',
  ]) {
    if (!graphStoryboardMediaDropGraphSource.includes(snippet)) {
      throw new Error(`expected Storyboard card media drops to create and reuse inbound Rich Media Panel edges: ${snippet}`)
    }
  }
  for (const staleReplacementSnippet of ['staleAutoEdgeIds', 'referencedPanelIds']) {
    if (graphStoryboardMediaDropGraphSource.includes(staleReplacementSnippet)) {
      throw new Error(`expected distinct Card @ media chips to retain their inbound Rich Media Panels and edges: ${staleReplacementSnippet}`)
    }
  }
  for (const snippet of [
    'commitGraphData?: (graphData: GraphData) => void',
    'if (commitGraphData) commitGraphData(nextGraph.graphData)',
  ]) {
    if (!graphStoryboardCardOverlaySource.includes(snippet)) {
      throw new Error(`expected Card @ media graph commits to update the Storyboard draft owner: ${snippet}`)
    }
  }
  for (const snippet of [
    'commitStoryboardCardMediaGraph',
    'draftGraphDataRef.current = nextDraft',
    'setDraftGraphData(nextDraft)',
    'setGraphDataPreservingLayout(nextDraft)',
  ]) {
    if (!storyboardWidgetRuntimeSource.includes(snippet)) {
      throw new Error(`expected Card @ media graph commits to preserve draft and store topology: ${snippet}`)
    }
  }
  if (storyboardWidgetSurfaceSource.includes('...storyboardCardOwnedMediaPanelNodeIds,\n    ...openRichMediaPanelNodeIds')) {
    throw new Error('expected inbound Card Rich Media Panels to remain visible in the Storyboard overlay renderer')
  }
  for (const snippet of [
    'isStoryboardCardMediaDropOverlayEdge(rawEdge, overlayNodeById.get(source) || null, target)',
    'readStoryboardOutputCardLeftSideAnchors({ sourceCardRect: tRect, outputCardRect: sRect })',
    'buildStoryboardOverlayEdgePathD({ outputCardLeftSide: !!semanticCardMediaOutputAnchors',
  ]) {
    if (!graphStoryboardOverlayEdgesSource.includes(snippet)) {
      throw new Error(`expected Storyboard overlay media edges to use semantic nearest-side anchors: ${snippet}`)
    }
  }
  for (const snippet of [
    'readNearestStoryboardOverlayAnchorSide',
    'readStoryboardOverlayRectSideAnchor',
    'readStoryboardOutputCardLeftSideAnchors',
    'buildStoryboardOutputCardLeftSidePath',
  ]) {
    if (!graphStoryboardOverlayEdgeAnchorsSource.includes(snippet)) {
      throw new Error(`expected Storyboard overlay edge anchor geometry to stay in the shared helper: ${snippet}`)
    }
  }
  if (/<RichMediaPanel\b/.test(graphStoryboardCardOverlaySource)) {
    throw new Error('expected fixed Storyboard card media slots to render raw CardMediaPreview media, not RichMediaPanel chrome')
  }
}

export function testStoryboardCanvasMediaDropSkipsNestedDropTargets() {
  assertStoryboard2dMediaDropContract()
}
