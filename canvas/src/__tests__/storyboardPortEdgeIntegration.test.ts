import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'
import { appendFlowEditorAuthoredEdge, appendFlowEditorDraftNode, resolveFlowEditorEdgeAuthoringNodeId } from '@/components/FlowEditorCanvas/runtime/useFlowEditorGraphActions'
import { buildRichMediaPanelRegistryDraft } from '@/features/flow-editor-manager/richMediaPanelRegistryDraft'
import { buildStoryboardElementRegistryDraft } from '@/features/flow-editor-manager/storyboardElementRegistryDraft'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { computeRichMediaOverlayConnectedValuesByNodeId } from '@/lib/render/richMediaSsot'
import { resolveMediaPointerReleaseClientPoint } from '@/lib/ui/mediaDragPayload'
import {
  FLOW_RICH_MEDIA_PANEL_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_FORM_ID,
  FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
} from '@/lib/config.flow-editor'
import type { GraphData } from '@/lib/graph/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const buildTestImageDataUri = (semanticId: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><title>${semanticId}</title></svg>`)}`

export function testStoryboardRichMediaPortEdgeProjectsReferenceImageIntoCard() {
  const imageUrl = buildTestImageDataUri('media-source')
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'media-source',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        label: 'Reference media',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
          [FLOW_WIDGET_FORM_ID_KEY]: FLOW_RICH_MEDIA_PANEL_FORM_ID,
          imageUrl,
        },
      },
      {
        id: 'storyboard-target',
        type: FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
        label: 'Target card',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
          [FLOW_WIDGET_FORM_ID_KEY]: FLOW_STORYBOARD_ELEMENT_FORM_ID,
          lane: 'Storyboard',
        },
      },
    ],
    edges: [],
  }
  const authored = finalizeEdgeAuthoring({
    mode: 'create',
    data: graphData,
    schema: null,
    label: 'linksTo',
    selectedEdgeId: null,
    from: { nodeId: 'media-source', portKey: 'imageUrl' },
    to: { nodeId: 'storyboard-target', portKey: 'mediaUrl' },
  })
  if (authored.kind !== 'create') throw new Error(`expected a typed Rich Media to Storyboard edge, got ${authored.kind}`)

  const registry = [
    { ...buildRichMediaPanelRegistryDraft(), id: 'rich-media', updatedAt: '2026-06-27T00:00:00.000Z' },
    { ...buildStoryboardElementRegistryDraft(), id: 'storyboard', updatedAt: '2026-06-27T00:00:00.000Z' },
  ]
  const board = buildStoryboardBoardModel({
    graphData: { ...graphData, edges: [authored.edge] },
    graphRevision: 1,
    widgetRegistry: registry,
  })
  const targetCard = board.lanes.flatMap(lane => lane.cards).find(card => card.id === 'storyboard-target')
  if (targetCard?.media?.url !== imageUrl || (targetCard.media.kind !== 'image' && targetCard.media.kind !== 'svg')) {
    throw new Error(`expected connected reference image in target card, got ${JSON.stringify(targetCard?.media)}`)
  }
}

export function testStoryboardCardPortEdgeProjectsImageOutputIntoRichMediaPanel() {
  const imageUrl = buildTestImageDataUri('storyboard-source')
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'storyboard-source',
        type: FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
        label: 'Source card',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
          [FLOW_WIDGET_FORM_ID_KEY]: FLOW_STORYBOARD_ELEMENT_FORM_ID,
          lane: 'Storyboard',
          imageUrl,
        },
      },
      {
        id: 'media-target',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        label: 'Output media',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
          [FLOW_WIDGET_FORM_ID_KEY]: FLOW_RICH_MEDIA_PANEL_FORM_ID,
          imageUrl: '',
        },
      },
    ],
    edges: [],
  }
  const authored = finalizeEdgeAuthoring({
    mode: 'create',
    data: graphData,
    schema: null,
    label: 'linksTo',
    selectedEdgeId: null,
    from: { nodeId: 'storyboard-source', portKey: 'imageUrl' },
    to: { nodeId: 'media-target', portKey: 'imageUrl' },
  })
  if (authored.kind !== 'create') throw new Error(`expected typed Storyboard to Rich Media edge, got ${authored.kind}`)

  const registry = [
    { ...buildRichMediaPanelRegistryDraft(), id: 'rich-media', updatedAt: '2026-06-27T00:00:00.000Z' },
    { ...buildStoryboardElementRegistryDraft(), id: 'storyboard', updatedAt: '2026-06-27T00:00:00.000Z' },
  ]
  const connectedValues = computeRichMediaOverlayConnectedValuesByNodeId({
    graphData: { ...graphData, edges: [authored.edge] },
    graphRevision: 1,
    registry,
    includeMediaSpecNodes: true,
  })
  const imageValue = connectedValues.get('media-target')?.['properties.imageUrl']?.value
  if (imageValue !== imageUrl) {
    throw new Error(`expected Card image output in Rich Media Panel target, got ${JSON.stringify(imageValue)}`)
  }
}

export function testStoryboardPropsPanelEdgeRequestUsesSharedOverlayAuthoring() {
  const surface = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx'), 'utf8')
  const requestBridge = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/useStoryboardEdgeCreationRequest.ts'), 'utf8')
  const nativeEdgeEffect = readFileSync(resolve(process.cwd(), 'src/components/GraphCanvas/hooks/useEdgeCreationEffect.ts'), 'utf8')
  if (!surface.includes('useStoryboardEdgeCreationRequest({') || !requestBridge.includes('state.edgeCreationRequest') || !requestBridge.includes('beginEdge(sourceId, null)')) {
    throw new Error('expected Storyboard to consume Props Panel edge requests through shared Flow Editor authoring')
  }
  if (!nativeEdgeEffect.includes("edgeCreationRequest.type === 'create' && isStoryboardCanvas2dRenderer(state.canvas2dRenderer)")) {
    throw new Error('expected native GraphCanvas edge authoring to defer Storyboard requests to the overlay owner')
  }
}

export function testStoryboardPortDragResolvesWorkspaceQualifiedMediaNodeId() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'media-node', type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, label: 'Media', properties: {} }],
    edges: [],
  }
  const resolved = resolveFlowEditorEdgeAuthoringNodeId(graphData, 'workspace:document::media-node')
  if (resolved !== 'media-node') {
    throw new Error(`expected workspace-qualified overlay endpoint to resolve to media-node, got ${String(resolved)}`)
  }
}

export function testStoryboardPortEdgesReuseSharedOverlayEdgeSurface() {
  const proxy = readFileSync(resolve(process.cwd(), 'src/lib/canvas/flow-editor-overlay-proxy.ts'), 'utf8')
  const cards = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/StoryboardCardOverlayLayer2d.tsx'), 'utf8')
  const media = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/FlowCanvasMediaOverlays.tsx'), 'utf8')
  const runtime = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas.runtime.tsx'), 'utf8')
  const surface = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx'), 'utf8')
  if (!proxy.includes('SEMANTIC_FLOW_OVERLAY_ROOT_SELECTOR') || !proxy.includes('`[data-node-id][${FLOW_EDITOR_OVERLAY_SURFACE_ATTR}]`')) {
    throw new Error('expected semantic node overlays to reuse the shared Flow Editor edge surface contract')
  }
  if (!cards.includes('data-node-id={card.id}') || !cards.includes('data-kg-flow-editor-surface={flowEditorSurfaceId}')) {
    throw new Error('expected Storyboard cards to register with the shared overlay-edge surface')
  }
  if (!media.includes('data-node-id={node.id}') || !media.includes('data-kg-flow-editor-surface={flowEditorOverlaySurfaceId || undefined}')) {
    throw new Error('expected Rich Media panels to register with the shared overlay-edge surface')
  }
  if (!runtime.includes('overlayOnlyActive || hasOverlayEditors || storyboardCardsMode')) {
    throw new Error('expected Storyboard to activate the shared overlay-edge renderer')
  }
  if (!surface.includes('props.overlayOnlyActive || props.hasOverlayEditors || storyboardCardsActive')) {
    throw new Error('expected Storyboard to mount the shared overlay-edge SVG surface')
  }
}

export function testStoryboardCrossSurfaceEdgeUsesFlowEditorDraftAuthority() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'workspace:media::panel', type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, label: 'Media', properties: {} },
      { id: 'card', type: FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID, label: 'Card', properties: {} },
    ],
    edges: [],
  }
  const authored = finalizeEdgeAuthoring({
    mode: 'create',
    data: graphData,
    schema: null,
    label: 'linksTo',
    selectedEdgeId: null,
    from: { nodeId: 'workspace:media::panel', portKey: 'imageUrl' },
    to: { nodeId: 'card', portKey: 'mediaUrl' },
  })
  if (authored.kind !== 'create') throw new Error(`expected cross-surface edge creation, got ${authored.kind}`)
  const next = appendFlowEditorAuthoredEdge(graphData, authored.edge)
  if (next.edges.length !== 1 || next.edges[0]?.source !== 'workspace:media::panel' || next.edges[0]?.target !== 'card') {
    throw new Error(`expected Flow Editor draft to retain cross-surface endpoints, got ${JSON.stringify(next.edges)}`)
  }
}

export function testStoryboardPortEdgeKeepsPendingRichMediaPanelInDraft() {
  const baseGraphData: GraphData = {
    type: 'Graph',
    metadata: { graphDataRevision: 4 },
    nodes: [
      { id: 'card', type: FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID, label: 'Card', properties: {} },
    ],
    edges: [],
  }
  const pendingPanel = {
    id: 'pending-media-panel',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Dropped media',
    properties: { imageUrl: buildTestImageDataUri('pending-media') },
  }
  const draftWithPanel = appendFlowEditorDraftNode(baseGraphData, pendingPanel, { revisionFloor: 4 })
  const authored = finalizeEdgeAuthoring({
    mode: 'create',
    data: draftWithPanel,
    schema: null,
    label: 'linksTo',
    selectedEdgeId: null,
    from: { nodeId: 'pending-media-panel', portKey: 'imageUrl' },
    to: { nodeId: 'card', portKey: 'mediaUrl' },
  })
  if (authored.kind !== 'create') throw new Error(`expected pending Rich Media edge creation, got ${authored.kind}`)
  const nextDraft = appendFlowEditorAuthoredEdge(draftWithPanel, authored.edge, { revisionFloor: 5 })
  const nodeIds = new Set((nextDraft.nodes || []).map(node => String(node.id || '')))
  if (!nodeIds.has('pending-media-panel') || !nodeIds.has('card')) {
    throw new Error(`expected draft to retain pending Rich Media panel and target card, got ${JSON.stringify([...nodeIds])}`)
  }
  if ((nextDraft.edges || []).length !== 1) {
    throw new Error(`expected authored edge to remain in same draft graph, got ${JSON.stringify(nextDraft.edges)}`)
  }
  const revision = Number(((nextDraft.metadata || {}) as Record<string, unknown>).graphDataRevision || 0)
  if (!Number.isFinite(revision) || revision <= 5) {
    throw new Error(`expected authored Storyboard draft revision to outrun live/base reset, got ${revision}`)
  }
}

export function testStoryboardPortEdgeSelectsAuthoredEdgeAfterCreate() {
  const actions = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/useFlowEditorGraphActions.ts'), 'utf8')
  const createBranch = actions.slice(actions.indexOf("if (result.kind === 'create')"))
  if (!createBranch.includes("args.selectEdge(String(result.edge.id || ''))") || !createBranch.includes('args.selectNode(null)')) {
    throw new Error('expected Storyboard/Flow Editor port edge creation to select the authored edge so it remains visible after pending preview clears')
  }
  if (createBranch.indexOf("args.selectEdge(String(result.edge.id || ''))") > createBranch.indexOf("args.setToolMode('select')")) {
    throw new Error('expected authored edge selection before leaving addEdge mode')
  }
}

export function testStoryboardRichMediaOverlaySelectionMountsSharedPortHandles() {
  const mediaOverlays = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/FlowCanvasMediaOverlays.tsx'), 'utf8')
  const overlayHandles = readFileSync(resolve(process.cwd(), 'src/components/FlowEditor/FlowEditorOverlayPortHandles.tsx'), 'utf8')
  const nodeHandles = readFileSync(resolve(process.cwd(), 'src/components/FlowEditor/NodeOverlayEditorPortHandles.tsx'), 'utf8')
  const overlayEdges = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/useFlowEditorOverlayEdges.ts'), 'utf8')
  const runtime = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas.runtime.tsx'), 'utf8')
  const surface = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx'), 'utf8')
  if (!mediaOverlays.includes("selectionSource: 'canvas'") || !mediaOverlays.includes('selectedNodeIds: [id]')) {
    throw new Error('expected Rich Media overlay selection to update global selected node state for shared port handles')
  }
  if (!mediaOverlays.includes('onPointerDownCapture={() => { const id = String(node.id ||')) {
    throw new Error('expected Rich Media overlay pointer selection to feed the shared port-handle owner')
  }
  if (!overlayHandles.includes('resolveGraphNodeByCanonicalId(interaction?.graphData, nodeId)')) {
    throw new Error('expected shared overlay port handles to resolve workspace-qualified Rich Media node ids canonically')
  }
  if (!overlayHandles.includes('FLOW_PORT_HANDLE_FINALIZE_EVENT') || !overlayHandles.includes('value.finalizeEdge(targetNodeId, detail.targetPortKey)')) {
    throw new Error('expected shared overlay port handles to consume semantic drag-finalize events')
  }
  if (!overlayHandles.includes('FLOW_PORT_HANDLE_CANCEL_EVENT') || !overlayHandles.includes('value.cancelEdge()')) {
    throw new Error('expected missed Card/Rich Media source-handle drags to cancel add-edge mode through the shared overlay owner')
  }
  if (!overlayHandles.includes('readFlowPortHandleAtClientPoint') || !overlayHandles.includes('startFlowPortHandlePointerDrag({ event, sourceNodeId, sourcePortKey })')) {
    throw new Error('expected covered Rich Media source handles to reuse the shared pointer-drag utility instead of a Rich Media-only handler')
  }
  if (!runtime.includes('cancelPendingEdge={cancelPendingEdge}') || !surface.includes("event.key !== 'Escape' || props.toolMode !== 'addEdge'")) {
    throw new Error('expected Storyboard edge creation to support shared Escape cancel without a target handle')
  }
  if (!surface.includes('FLOW_PORT_HANDLE_SELECTOR') || !surface.includes('readFlowPortHandleAtClientPoint({ clientX: event.clientX, clientY: event.clientY })')) {
    throw new Error('expected shared add-edge cancel to preserve covered port handles while allowing blank-click abort')
  }
  const cursorEffectStart = overlayEdges.indexOf('const onMove = (e: MouseEvent | PointerEvent)')
  const cursorEffectEnd = overlayEdges.indexOf('}, [args.active, args.rootRef, scheduleOverlayEdgeUpdate])', Math.max(0, cursorEffectStart))
  const cursorEffect = cursorEffectStart >= 0 && cursorEffectEnd > cursorEffectStart
    ? overlayEdges.slice(cursorEffectStart, cursorEffectEnd)
    : ''
  if (!overlayEdges.includes('FLOW_PORT_HANDLE_PREVIEW_EVENT') || !overlayEdges.includes("toolMode: 'addEdge', sourceId: source.id, sourcePortKey: source.portKey")) {
    throw new Error('expected shared overlay edge preview to consume immediate port-handle preview events')
  }
  if (!overlayEdges.includes('document.addEventListener(FLOW_PORT_HANDLE_PREVIEW_EVENT, onPreview)') || !overlayEdges.includes('pendingEdgeCursorRef.current')) {
    throw new Error('expected shared overlay edge preview to track cursor movement through port-handle preview events')
  }
  if (cursorEffect.includes('if (!args.overlayOnlyModeEnabled) return')) {
    throw new Error('expected Storyboard port drag preview to avoid overlay-only gating')
  }
  if (!nodeHandles.includes('isCanonicalNodeIdEqual(args.pendingEdgeSourceId, nodeId)')) {
    throw new Error('expected shared overlay port handles to compare pending edge source ids canonically')
  }
  if (!nodeHandles.includes('const edgeDotHitOffsetPx = sizePx') || !nodeHandles.includes('railWidthPx + edgeDotHitOffsetPx') || !nodeHandles.includes('right: `-${edgeDotHitOffsetPx}px`')) {
    throw new Error('expected source-port visible dot to stay inside the shared draggable rail hit area')
  }
  const pointerDownBlockStart = nodeHandles.indexOf('onPointerDown={e => {')
  const pointerDownBlockEnd = nodeHandles.indexOf('onMouseDown={e => {', Math.max(0, pointerDownBlockStart))
  const pointerDownBlock = pointerDownBlockStart >= 0 && pointerDownBlockEnd > pointerDownBlockStart ? nodeHandles.slice(pointerDownBlockStart, pointerDownBlockEnd) : ''
  if (!pointerDownBlock || pointerDownBlock.indexOf('startFlowPortHandlePointerDrag({ event: e, sourceNodeId: nodeId') > pointerDownBlock.indexOf('handleClick(p.dir, parseFlowHandleKey(p.handleId as never))')) {
    throw new Error('expected direct source-handle drag to start the shared drag session before add-edge state mutation')
  }
}

export function testStoryboardRichMediaDropCentersPanelOnPointer() {
  const dropBridge = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/useFlowEditorWidgetDropBridge.ts'), 'utf8')
  const runtimeScene = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/useFlowEditorRuntimeScene.ts'), 'utf8')
  const mediaOverlay = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/FlowCanvasMediaOverlays.tsx'), 'utf8')
  if (!dropBridge.includes("from '@/lib/render/richMediaPanelDefaults'")) {
    throw new Error('expected Rich Media media-drop bridge to reuse shared panel size defaults')
  }
  if (!dropBridge.includes('RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width / 2') || !dropBridge.includes('RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.height / 2')) {
    throw new Error('expected dropped Rich Media Panels to center on the pointer instead of landing offset')
  }
  for (const snippet of ['fx: x', 'fy: y', 'vx: 0', 'vy: 0']) {
    if (!dropBridge.includes(snippet)) throw new Error(`expected dropped Rich Media Panels to remain pinned at the manual release position: ${snippet}`)
  }
  for (const snippet of [
    'const hasAuthoritativeGraphWorldAnchor = (rawId: string): boolean => {',
    'const hasXY = Number.isFinite(node.x) && Number.isFinite(node.y)',
    'const hasFixedXY = Number.isFinite(node.fx) && Number.isFinite(node.fy)',
    'if (forceSceneEmptyReseed) return !hasAuthoritativeGraphWorldAnchor(id)',
    'return !hasAuthoritativeGraphWorldAnchor(id)',
    '|| (initialCollectiveCenteringPass && !hasAuthoritativeWorldAnchor)',
    'const unanchoredPinnedOpenIds = pinnedOpenIds.filter(id => !hasAuthoritativeGraphWorldAnchor(id))',
  ]) {
    if (!runtimeScene.includes(snippet)) {
      throw new Error(`expected dropped Rich Media Panels with authored graph coordinates to stay out of collective reseed authority: ${snippet}`)
    }
  }
  for (const snippet of ['fx: next.x', 'fy: next.y', 'vx: 0', 'vy: 0']) {
    if (!mediaOverlay.includes(snippet)) throw new Error(`expected Rich Media Panel drag to update the shared pinned world position: ${snippet}`)
  }
}

export function testMediaPointerReleaseUsesActualCursorPoint() {
  const pointerRelease = resolveMediaPointerReleaseClientPoint({ eventType: 'pointerup', eventClientX: 720, eventClientY: 640, lastClientX: 1010, lastClientY: 220 })
  if (pointerRelease.clientX !== 720 || pointerRelease.clientY !== 640) {
    throw new Error('expected pointer release to use the actual cursor point instead of a stale FloatingPanel move point')
  }
  const nativeDragRelease = resolveMediaPointerReleaseClientPoint({ eventType: 'dragend', eventClientX: 0, eventClientY: 0, lastClientX: 720, lastClientY: 640 })
  if (nativeDragRelease.clientX !== 720 || nativeDragRelease.clientY !== 640) {
    throw new Error('expected native dragend to retain the last valid dragover point')
  }
}

export function testStoryboardPortHandleActivationForbidsTimingBasedDuplicateEdges() {
  const handles = readFileSync(resolve(process.cwd(), 'src/components/FlowEditor/NodeOverlayEditorPortHandles.tsx'), 'utf8')
  if (!handles.includes('const suppressNextPointerClickRef = React.useRef(false)')) {
    throw new Error('expected port handles to track pointer activation explicitly')
  }
  if (!handles.includes('e.detail !== 0 && suppressNextPointerClickRef.current')) {
    throw new Error('expected the native click following pointer activation to be consumed')
  }
  if (handles.includes('e.detail !== 0 && Date.now() - lastPointerActivationAtRef.current < 120')) {
    throw new Error('forbid timing-based duplicate-edge suppression')
  }
}
