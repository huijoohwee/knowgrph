import { readFileSync } from 'node:fs'

export function testStoryboardCanvasKeepsNativeRendererContract() {
  const source = readFileSync(new URL('../components/StoryboardCanvas.tsx', import.meta.url), 'utf8')
  const infiniteZoomSource = readFileSync(new URL('../components/StoryboardCanvas/useStoryboardInfiniteZoom.ts', import.meta.url), 'utf8')
  const infiniteMetricsSource = readFileSync(new URL('../components/StoryboardCanvas/storyboardInfiniteZoomMetrics.ts', import.meta.url), 'utf8')
  const infiniteRequestSource = readFileSync(new URL('../components/StoryboardCanvas/storyboardInfiniteZoomRequest.ts', import.meta.url), 'utf8')
  const mediaSelectionSource = readFileSync(new URL('../components/StoryboardCanvas/storyboardMediaSelectionPanel.tsx', import.meta.url), 'utf8')
  const mediaLightboxSource = readFileSync(new URL('../lib/ui/MediaLightbox.tsx', import.meta.url), 'utf8')
  const mediaLightboxPromptParametersSource = readFileSync(new URL('../lib/ui/mediaLightboxPromptParameters.ts', import.meta.url), 'utf8')
  const mediaKindOverlaySource = readFileSync(new URL('../lib/ui/MediaKindOverlay.tsx', import.meta.url), 'utf8')
  for (const snippet of [
    'Visual Brief',
    'STORYBOARD_CARD_RATIO_CLASS_BY_MODE',
    "'9:16': 'aspect-[9/16] w-[min(22rem,calc(100vw-2rem))]'",
    'data-kg-storyboard-card-aspect={strybldrStoryboardCardAspectMode}',
    'data-kg-storyboard-board-layout={strybldrStoryboardBoardLayoutMode}',
    "const shouldUseFullHeightFixedLanes = strybldrStoryboardBoardLayoutMode === 'fixed' && !isWideStoryboardLayout",
    'shouldUseFullHeightFixedLanes ? `h-full ${UI_RESPONSIVE_KANBAN_LANE_CLASSNAME}` : `max-h-full ${storyboardLaneWidthClassName}`',
    "grid-cols-[minmax(0,1fr)_minmax(13rem,0.86fr)]",
    'StoryboardMediaSelectionPanel',
    "emitFloatingPanelOpen({ tab: 'media', open: true })",
    'StoryboardMentionPill',
    'CARD_MARKDOWN_PREVIEW_CHIP_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME',
    'resolveStoryboardActionTarget',
    "from '@/components/StoryboardCanvas/storyboardSelectAction'",
    'runStoryboardSelectAction({',
    'const selectStoryboardCardFromCanvas = () => runStoryboardSelectAction({',
    'onFocusCapture={() => {',
    'isCanonicalNodeIdEqual(selectedNodeId, resolvedCardNodeId)',
    'buildStoryboardBoardModel',
    'useKanbanDragAndDrop',
    'reorderKanbanRowIds',
    'data-kg-kanban-card-drag-region="1"',
    '...currentProperties',
    'aria-label={`Select storyboard card ${displayTitle}`}',
    "const toastId = 'storyboard:drag-status'",
    'upsertUiToast({',
    'dismissUiToast(toastId)',
    'const cardDragProps = storyboardDrag.createCardDragProps({ rowId: card.id, groupKey: lane.id })',
    'draggable={cardDragProps.draggable}',
    'onDragStart={cardDragProps.onDragStart}',
    'onDragEnd={cardDragProps.onDragEnd}',
    'const isStoryboardMoveNoOp = React.useCallback',
    'const currentSourceGroupKey = rowIdToLaneKey.get(move.rowId) || move.sourceGroupKey || \'\'',
    'const nextOrderedRowIds = reorderKanbanRowIds({',
    'isNoOpMove: isStoryboardMoveNoOp',
    'editActivation="click"',
    'NodeOverlayEditorActionsToolbar',
    'resolveStoryboardCardPrimaryReferenceUrl',
    'buildStoryboardGraphBackedNodeLookup',
    "from '@/components/StoryboardCanvas/storyboardDuplicateAction'",
    "from '@/components/StoryboardCanvas/storyboardHelpAction'",
    "from '@/components/StoryboardCanvas/storyboardOpenSidepaneAction'",
    "from '@/components/StoryboardCanvas/storyboardRunAction'",
    "from '@/components/StoryboardCanvas/storyboardClearOutputAction'",
    "from '@/components/StoryboardCanvas/storyboardConvertLoopAction'",
    "from '@/components/StoryboardCanvas/storyboardRemoveAction'",
    "from '@/components/StoryboardCanvas/storyboardSelectAction'",
    "from '@/components/StoryboardCanvas/storyboardUpdateKvEntryAction'",
    "from '@/components/StoryboardCanvas/storyboardDuplicateRouting'",
    'runCard: runStoryboardCard',
    'const generateStoryboardCardMediaFromPrompt = React.useCallback((card: StoryboardCardModel, prompt: string, parameters?: MediaLightboxPromptParameters) => {',
    'parameters?: MediaLightboxPromptParameters',
    'STORYBOARD_PROMPT_PROPERTY_KEYS',
    'updateStoryboardCardModel(card.id, nextModel)',
    'window.setTimeout(runWithCommittedPrompt, 0)',
    'const shouldUseSourceModelReadout = !!sourceModelLabel && !explicitStoryboardCardChatModel',
    'data-kg-storyboard-source-model-readout="true"',
    'const sourcePromptLabel = readStoryboardScalar(card.sourcePromptLabel)',
    'const usesNativeSourceFields = !!sourcePromptLabel || !!readStoryboardScalar(currentCardProperties.luminaNodeType)',
    'const canEditCanonicalText = canEditCard && !usesNativeSourceFields',
    'const shouldRenderSourcePromptReferenceControls = !usesNativeSourceFields && (card.references.length > 0 || !!card.href)',
    '].filter(row => row.value || canEditCanonicalText) as {',
    "{sourcePromptLabel || 'Visual Brief'}",
    '{shouldRenderSourcePromptReferenceControls ? (',
    '{card.href && !usesNativeSourceFields ? (',
    'runStoryboardWorkflowNode',
    'duplicateCard: duplicateStoryboardCard',
    'hasStrybldrStoryboardDuplicatePath',
    'const canUseStrybldrStoryboardDuplicatePathForCard = React.useCallback((card: StoryboardCardModel) => {',
    'return canUseStrybldrStoryboardDuplicatePath({',
    'runStoryboardDuplicateAction({',
    'canUseStrybldrDuplicatePath: canUseStrybldrStoryboardDuplicatePathForCard(card)',
    'commitStrybldrMutation: ({ nextMarkdownText, nextSelectedNodeId }) => commitStoryboardMarkdownMutation({',
    'commitMarkdownMutation: nextMarkdownText => commitStoryboardMarkdownMutation({',
    'const canDuplicateStoryboardCard = React.useCallback((card: StoryboardCardModel) => {',
    'getDocumentLocationFromMetadata(sourceNode?.metadata)',
    'duplicatedResult.handled',
    'selectNode: nextSelectedNodeId => selectNode(String(nextSelectedNodeId))',
    "const isMarkdownBackedCard = sourceId.startsWith('blk:md:')",
    "message: 'Duplicate is unavailable for markdown-backed storyboard cards until a durable document duplicate path is available.'",
    'duplicateDisabled: !canDuplicateStoryboardCard(card)',
    'clearCardOutput: clearStoryboardCardOutput',
    'runStoryboardClearOutputAction({',
    'showStoryboardCardHelp',
    'buildStoryboardHelpToast({',
    'openCardInSidepane: openStoryboardCardInSidepane',
    "from '@/components/StoryboardCanvas/storyboardToolbarActionBindings'",
    "from '@/components/StoryboardCanvas/storyboardToolbarProps'",
    "from '@/components/StoryboardCanvas/useStoryboardInfiniteZoom'",
    'const storyboardZoom = useStoryboardInfiniteZoom({',
    'const setStoryboardZoomViewportElement = storyboardZoom.setViewportElement',
    'const setBoardScrollElement = React.useCallback((element: HTMLElement | null) => {',
    'setStoryboardZoomViewportElement(element)',
    'data-kg-storyboard-infinite-canvas="1"',
    'data-kg-storyboard-zoom-scale={storyboardZoom.zoomScale}',
    'data-kg-storyboard-zoom-content="1"',
    'data-kg-storyboard-card-id={resolvedCardNodeId}',
    'data-kg-storyboard-card-scroll-root="1"',
    'data-kg-storyboard-card-sticky-header="1"',
    'data-kg-canvas-wheel-ignore="true"',
    'const toolbarProps = buildStoryboardToolbarProps({',
    'const toolbarActionBindings = buildStoryboardToolbarActionBindings({',
    '{...toolbarProps}',
    '{...toolbarActionBindings}',
    'runStoryboardOpenSidepaneAction({',
    'runStoryboardRunAction({',
    'removeCard: removeStoryboardCard',
    'runStoryboardRemoveAction({',
    'const openStoryboardCardWorkflowManagerMapping = React.useCallback((card: StoryboardCardModel) => {',
    'openCardWorkflowManagerMapping: openStoryboardCardWorkflowManagerMapping',
    'runStoryboardUpdateKvEntryAction({',
    'openMappingForNode: openWorkflowManagerMappingForNode',
    'registry: widgetRegistry',
    'graphMetaKind: storyboardRunBaseGraphKind',
    'convertCardToLoop: convertStoryboardCardToLoop',
    'runStoryboardConvertLoopAction({',
    'removeStrybldrStoryboardMarkdownElement',
    'commitStoryboardMarkdownMutation({',
    'runNode: runStoryboardWorkflowNode',
  ]) {
    if (!source.includes(snippet)) {
      throw new Error(`expected StoryboardCanvas to retain native storyboard contract snippet: ${snippet}`)
    }
  }
  if (source.includes('const statusPillText = activeDragStatusText || storyboardDrag.dragOutcomeMessage')) {
    throw new Error('expected StoryboardCanvas to route drag status through the shared toast host instead of a local top-left status pill')
  }
  if (source.includes('{...storyboardDrag.createCardDragProps({ rowId: card.id, groupKey: lane.id })}')) {
    throw new Error('expected StoryboardCanvas to avoid per-subsection drag-owner duplication and keep one shared drag owner on the card shell')
  }
  if (source.includes('if (hasStrybldrStoryboardDuplicatePath) return true')) {
    throw new Error('expected StoryboardCanvas duplicate routing to avoid document-wide Strybldr short-circuiting')
  }
  if (source.includes('const nextMarkdownId = hasStrybldrStoryboardDuplicatePath')) {
    throw new Error('expected StoryboardCanvas duplicate routing to choose the Strybldr append path per card')
  }
  if (source.includes('const nextMarkdownId = canUseStrybldrStoryboardDuplicatePathForCard(card)')) {
    throw new Error('expected StoryboardCanvas to centralize Strybldr duplicate markdown-id allocation in the shared action helper')
  }
  if (source.includes('chatModel: readStoryboardScalar(currentCardProperties.chatModel) || chatModel')) {
    throw new Error('expected StoryboardCanvas source-model cards to avoid prepending global chat model options')
  }
  if (source.includes('{card.href ? (\n                                      <a') || source.includes('{card.href ? (\n                                <section className="flex items-center justify-end">')) {
    throw new Error('expected StoryboardCanvas native-source cards to avoid generic Open brief/Open source actions')
  }
  if (source.includes('runStoryboardStrybldrDuplicateAction({') || source.includes('runStoryboardMarkdownDuplicateAction({')) {
    throw new Error('expected StoryboardCanvas to route both duplicate branches through one shared duplicate action helper')
  }
  if (source.includes('const converted = convertNodeToLoopInGraphData(graphData, resolvedCardNodeId)')) {
    throw new Error('expected StoryboardCanvas to centralize convert-to-loop graph mutation in the shared convert-loop action helper')
  }
  if (source.includes("updateStoryboardCanonicalProperty({\n      cardId: card.id,\n      propertyKeys: STORYBOARD_OUTPUT_PROPERTY_KEYS,")) {
    throw new Error('expected StoryboardCanvas to centralize clear-output choreography in the shared clear-output action helper')
  }
  if (source.includes("id: 'storyboard-widget-help'") && source.includes('const showStoryboardCardHelp = React.useCallback(() => {')) {
    throw new Error('expected StoryboardCanvas to centralize help toast payload construction in the shared help action helper')
  }
  if (source.includes("const selectStoryboardCardFromCanvas = () => {\n                      setSelectionSource('canvas')")) {
    throw new Error('expected StoryboardCanvas to centralize card-shell canvas selection choreography in the shared select action helper')
  }
  if (source.includes("const openStoryboardCardInSidepane = React.useCallback((card: StoryboardCardModel) => {\n    const { resolvedCardNodeId } = resolveStoryboardActionTarget(card.id)\n    setSelectionSource('canvas')")) {
    throw new Error('expected StoryboardCanvas to centralize open-sidepane selection choreography in the shared open-sidepane action helper')
  }
  if (source.includes("onOpenInSidepane={() => {\n                                openStoryboardCardInSidepane(card)\n                              }}")) {
    throw new Error('expected StoryboardCanvas to keep the open-sidepane toolbar binder as a thin direct callback')
  }
  if (source.includes('onRun={() => runStoryboardCard(card)}') || source.includes('onDuplicate={() => duplicateStoryboardCard(card)}') || source.includes('onClearOutput={() => clearStoryboardCardOutput(card)}') || source.includes('onRemove={() => removeStoryboardCard(card)}') || source.includes('onUpdateKvEntry={() => openStoryboardCardWorkflowManagerMapping(card)}') || source.includes('onConvertToLoopNode={() => convertStoryboardCardToLoop(card)}')) {
    throw new Error('expected StoryboardCanvas to centralize per-card toolbar action lambdas in the shared toolbar binding helper')
  }
  if (source.includes('ariaLabel="Storyboard card actions"') || source.includes('navClassName="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2"') || source.includes("navStyle={{ pointerEvents: 'auto' }}") || source.includes('iconSizeClass="h-3.5 w-3.5"') || source.includes('iconStrokeWidth={1.8}') || source.includes('convertToLoopDisabled={false}') || source.includes('enableHandlesDisabled') || source.includes("actionVisibility={{\n                                enableHandles: false,\n                              }}") || source.includes("openExternalAction={buildNodeOverlayOpenExternalAction({")) {
    throw new Error('expected StoryboardCanvas to centralize toolbar visual and presentation prop construction in the shared toolbar props helper')
  }
  if (source.includes('onEnableHandlesForAllInputs={() => { void 0 }}')) {
    throw new Error('expected StoryboardCanvas to avoid no-op enable-handles binders when the action is hidden')
  }
  if (source.includes("message: 'Run is available in Flow Editor for runnable graph-backed nodes.'") && source.includes('const runStoryboardCard = React.useCallback((card: StoryboardCardModel) => {')) {
    throw new Error('expected StoryboardCanvas to centralize storyboard run unavailable toast construction in the shared run action helper')
  }
  if (source.includes('void runStoryboardWorkflowNode(resolvedCardNodeId)')) {
    throw new Error('expected StoryboardCanvas to centralize storyboard run choreography in the shared run action helper')
  }
  if (source.includes("window.open(primaryReferenceUrl, '_blank', 'noopener,noreferrer')")) {
    throw new Error('expected StoryboardCanvas to centralize toolbar open-external choreography in the shared node-overlay external action helper')
  }
  if (source.includes("onUpdateKvEntry={() => {\n                                const { sourceNode } = resolveStoryboardActionTarget(card.id)\n                                runStoryboardUpdateKvEntryAction({")) {
    throw new Error('expected StoryboardCanvas to centralize update-KV-entry choreography in the shared update-KV-entry action helper')
  }
  if (source.includes('const nextMarkdownText = removeStrybldrStoryboardMarkdownElement({')) {
    throw new Error('expected StoryboardCanvas to centralize storyboard remove branch choreography in the shared remove action helper')
  }
  if (source.includes('const strybldrRunId = readStoryboardScalar(sourceProperties.strybldrRunId)')) {
    throw new Error('expected StoryboardCanvas to centralize duplicate-path Strybldr metadata checks in the shared helper')
  }
  if (source.includes('const duplicatedRange = duplicateMarkdownLineRange({')) {
    throw new Error('expected StoryboardCanvas to centralize markdown duplicate line-range work in the shared helper')
  }
  if (source.includes('const duplicatedNodeId = committedNodes.find(node => {')) {
    throw new Error('expected StoryboardCanvas to centralize markdown duplicate reselection in the shared helper')
  }
  if (!source.includes("STORYBOARD_BRANCH_ACTION_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4'") || !source.includes("STORYBOARD_SCORECARD_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2'")) {
    throw new Error('expected StoryboardCanvas storytree and scorecard grids to use mobile-first responsive owners')
  }
  if (source.includes('grid grid-cols-4 gap-1.5') || source.includes('grid grid-cols-2 gap-1.5 text-[11px]')) {
    throw new Error('expected StoryboardCanvas to avoid fixed mobile storytree and scorecard grid literals')
  }
  for (const snippet of [
    'export function StoryboardMediaSelectionPanel',
    'Reference Pack',
    'data-kg-storyboard-media-selection-panel="1"',
    'const dropTargetProps = {',
    "'data-kg-storyboard-media-slot': '1'",
    "'data-kg-storyboard-media-slot-index': slot.index",
    "'data-kg-storyboard-media-drop-active': dropActive ? '1' : undefined",
    '{...dropTargetProps}',
    'data-kg-storyboard-media-lightbox-trigger="1"',
    'data-kg-storyboard-media-missing="1"',
    'onError={() => setMediaError(true)}',
    'data-kg-storyboard-add-media="1"',
    "from '@/lib/cards/CardMediaPreview'",
    "from '@/lib/ui/MediaKindOverlay'",
    "from '@/lib/ui/MediaLightbox'",
    "from '@/lib/ui/mediaDragPayload'",
    "from '@/lib/ui/mediaLightboxPromptParameters'",
    "from '@/lib/ui/mediaKindOverlayIcon'",
    'MediaPromptActionOverlay',
    '<figure',
    '<figcaption',
    '<button',
    'CardMediaLoadingSkeleton',
    'CardMediaPreview',
    'MediaDownloadOverlay',
    'MediaInfoOverlay',
    'MediaOpenLinkOverlay',
    'resolveMediaKindOverlayIcon',
    'data-kg-storyboard-media-overlay-root="1"',
    'readStoryboardMediaLightboxDescription(props.card)',
    'descriptionLabel="Prompt"',
    'promptSubmitLabel="Regenerate media"',
    'promptParameters={promptParameters}',
    'onGenerateMediaPrompt',
    'onDropMedia?: (card: StoryboardCardModel, slot: StoryboardMediaSelectionSlot, payload: MediaDragPayload) => void',
    'onDropMedia={props.onDropMedia ? (slot, payload) => props.onDropMedia?.(props.card, slot, payload) : undefined}',
    'buildStoryboardMediaPromptParameters({ kind: lightboxKind, model: props.model })',
    'const isStoryboardRelatedTargetInside = (currentTarget: HTMLElement, relatedTarget: EventTarget | null): boolean => {',
    'const [lightboxSlotId, setLightboxSlotId] = React.useState<string | null>(null)',
    'const lightboxSlot = lightboxSlotId ? slots.find(slot => slot.id === lightboxSlotId) || null : null',
    'onPromptSubmit={props.onGenerateMediaPrompt ? (prompt, parameters) => props.onGenerateMediaPrompt?.(props.card, prompt, parameters) : undefined}',
    'label="Modify prompt"',
    'appearance="hover"',
    '<MediaDownloadOverlay href={reference.url} kind="image"',
  ]) {
    if (!mediaSelectionSource.includes(snippet)) {
      throw new Error(`expected Storyboard media selection panel to retain shared media slot snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    'export function MediaPromptActionOverlay',
    'data-kg-media-prompt-action-overlay="1"',
    'PencilLine',
    'Modify prompt',
  ]) {
    if (!mediaKindOverlaySource.includes(snippet)) {
      throw new Error(`expected shared media overlay utilities to retain prompt action snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    'descriptionLabel?: string',
    'MediaLightboxPromptParameter',
    'promptParameters?: readonly MediaLightboxPromptParameter[]',
    'onPromptSubmit?: (value: string, parameters?: MediaLightboxPromptParameters) => void | Promise<void>',
    "from '@/lib/ui/panelFormControls'",
    'data-kg-media-lightbox-media-panel="1"',
    'data-kg-media-lightbox-empty-output="1"',
    'data-kg-media-lightbox-prompt-panel="1"',
    'data-kg-media-lightbox-prompt="1"',
    'data-kg-media-lightbox-prompt-form="1"',
    'data-kg-media-lightbox-prompt-input="1"',
    "event.key === 'Enter' && !event.shiftKey",
    'data-kg-media-lightbox-prompt-submit="1"',
    'data-kg-media-lightbox-parameter-row="1"',
    'data-kg-media-lightbox-parameter={parameter.id}',
    'aria-label={promptSubmitLabel || \'Generate media\'}',
    'title={promptSubmitLabel || \'Generate media\'}',
    '<span className="sr-only">{promptSubmitLabel || \'Generate media\'}</span>',
    'className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"',
    "parameter.id === 'model' ? 'w-[13.25rem]' : 'w-[5.25rem]'",
    '<PanelTextarea',
    '<PanelSelect',
  ]) {
    if (!mediaLightboxSource.includes(snippet)) {
      throw new Error(`expected shared media lightbox to retain prompt/media panel snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    'buildMediaLightboxPromptParameters',
    'CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS',
    'MEDIA_VARIATION_COUNT_PARAMETER_OPTIONS',
    "id: 'model'",
    "id: 'aspectRatio'",
    "id: 'resolution'",
    "id: 'duration'",
    "id: 'count'",
  ]) {
    if (!mediaLightboxPromptParametersSource.includes(snippet)) {
      throw new Error(`expected shared media prompt parameters helper to retain snippet: ${snippet}`)
    }
  }
  if (!mediaSelectionSource.includes("from '@/lib/ui/mediaLightboxPromptParameters'")) {
    throw new Error('expected Storyboard media lightbox to reuse shared media prompt parameter helper')
  }
  const starterFallbackCopy = ['Media', 'unavailable'].join(' ')
  if (mediaSelectionSource.includes(starterFallbackCopy) || mediaSelectionSource.toLowerCase().includes(starterFallbackCopy.toLowerCase())) {
    throw new Error('expected Storyboard media slots to avoid starter-style hardcoded missing-media copy')
  }
  for (const snippet of [
    "import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'",
    'STORYBOARD_DROPPED_PRIMARY_MEDIA_CLEAR_KEYS',
    'STORYBOARD_DROPPED_REFERENCE_KEY_BY_KIND',
    'const handleDropStoryboardMedia = React.useCallback((card: StoryboardCardModel, slot: StoryboardMediaSelectionSlot, payload: MediaDragPayload) => {',
    'mediaUrl: cleanUrl',
    'mediaKind: payload.kind',
    'const referenceKey = STORYBOARD_DROPPED_REFERENCE_KEY_BY_KIND[payload.kind]',
    '[referenceKey]: uniqueReferences',
    'onDropMedia={handleDropStoryboardMedia}',
  ]) {
    if (!source.includes(snippet)) {
      throw new Error(`expected StoryboardCanvas to wire shared Media drag/drop into 2D Renderer card media: ${snippet}`)
    }
  }
  if (mediaSelectionSource.includes('buildStoryboardMediaLightboxMetadata') || mediaLightboxSource.includes('data-kg-media-lightbox-metadata') || mediaLightboxSource.includes('data-kg-media-lightbox-prompt-label="1"')) {
    throw new Error('expected media lightbox prompt panel to avoid redundant visible prompt headers and meaningless metadata footers')
  }
  if (source.includes('useStoryboardScrollZoom') || source.includes('data-kg-storyboard-zoom-shell="1"')) {
    throw new Error('expected StoryboardCanvas to use infinite-canvas zoom ownership instead of scroll-surface zoom wrappers')
  }
  if (!source.includes("'sticky top-0 z-10 border-b border-black/5 bg-white/95 px-3 py-2.5 backdrop-blur-sm cursor-grab active:cursor-grabbing select-none'")) {
    throw new Error('expected Storyboard card header to reuse the sticky header pattern inside the card scroll root')
  }
  for (const snippet of [
    "from '@/lib/canvas/infinite-canvas-engine'",
    "from '@/components/StoryboardCanvas/storyboardInfiniteZoomMetrics'",
    "from '@/components/StoryboardCanvas/storyboardInfiniteZoomRequest'",
    'const boardViewportRef = React.useRef<HTMLElement | null>(null)',
    'const [viewportElement, setViewportElementState] = React.useState<HTMLElement | null>(null)',
    'setViewportElementState(prev => (prev === element ? prev : element))',
    'createInfiniteCanvasViewportController({',
    'resolveStoryboardInfiniteZoomRequestTransform({',
    "zoomRequest: { type: 'fit', intent: 'fitToView', at: 0 }",
    'lastInitialFitKeyRef.current = fitKey',
    'cacheKeyBase: `storyboard:${metrics.signatureKey}`',
    'const requestState = useGraphStore.getState()',
    'commitZoomTransformToStore({',
    'interactionSnapshotRef.current',
    'transformRenderFrameRef',
    'requestAnimationFrame',
  ]) {
    if (!infiniteZoomSource.includes(snippet)) {
      throw new Error(`expected Storyboard infinite zoom hook to reuse shared zoom owner snippet: ${snippet}`)
    }
  }
  if (infiniteZoomSource.includes('scrollSurfaceZoom') || infiniteZoomSource.includes('computeScrollSurfaceZoomScaleFromRequest')) {
    throw new Error('expected Storyboard infinite zoom hook to avoid scroll-surface zoom helpers')
  }
  const hookStoreSelectorSource = infiniteZoomSource.slice(
    infiniteZoomSource.indexOf('useGraphStore('),
    infiniteZoomSource.indexOf('const effectiveSchema'),
  )
  for (const forbidden of ['selectedNodeId', 'selectedNodeIds', 'selectedEdgeId', 'selectedEdgeIds', 'selectedGroupId', 'selectedGroupIds']) {
    if (hookStoreSelectorSource.includes(forbidden)) {
      throw new Error(`expected Storyboard infinite zoom hook to avoid live selection subscription churn: ${forbidden}`)
    }
  }
  for (const snippet of [
    "from '@/lib/zoom/resolveZoomRequest2d'",
    'readZoomScaleExtent(args.schema)',
    'DEFAULT_TOOLBAR_ZOOM_CONFIG',
    'selectionState: StoryboardZoomSelectionState',
    'selectedNodeIds: readStringArray(args.selectionState.selectedNodeIds)',
    "cacheKeyBase: args.cacheKeyBase || 'storyboard'",
  ]) {
    if (!infiniteRequestSource.includes(snippet)) {
      throw new Error(`expected Storyboard zoom-request helper to retain lazy request resolution snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    'readStoryboardInfiniteMetrics',
    'buildStoryboardTransformCss',
    'buildStoryboardTransformKey',
    'signatureParts',
    'GRAPH_ELEMENT_FIT_ROLE_BOUNDS_ONLY',
    'GRAPH_ELEMENT_FIT_ROLE_PROPERTY',
    'signatureKey: hashStoryboardMetricSignature(signature)',
    'offsetParent',
    'readContentRect',
  ]) {
    if (!infiniteMetricsSource.includes(snippet)) {
      throw new Error(`expected Storyboard infinite zoom metrics helper to retain cached metric snippet: ${snippet}`)
    }
  }
  for (const forbidden of ['boords', 'peacock.boords.com', 'app.boords.com', 'dreamina.capcut.com', 'dreamina octo']) {
    if (source.toLowerCase().includes(forbidden)) {
      throw new Error(`expected StoryboardCanvas to avoid copied vendor reference: ${forbidden}`)
    }
  }
}
