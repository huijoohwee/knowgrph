import React from 'react'
import { buildFlowCanvasHeaderPinProps, type FlowCanvasHeaderPinProps } from '@/components/FlowCanvas/flowCanvasRichMediaPanelHeaderToolbar'
import { WidgetEditorActionsToolbar } from '@/components/StoryboardWidget/WidgetEditorActionsToolbar'
import { StoryboardWidgetPanelChromeHeader } from '@/components/StoryboardWidget/StoryboardWidgetPanelChrome'
import { getStoryboardWidgetPanelChromeClassName } from '@/components/StoryboardWidget/storyboardWidgetPanelChromeClassName'
import { StoryboardWidgetOverlayPortHandles } from '@/components/StoryboardWidget/StoryboardWidgetOverlayPortHandles'
import { StoryboardCardMetaScrollRail } from '@/components/StoryboardWidgetCanvas/StoryboardCardMetaScrollRail'
import { StoryboardCardMediaDropSlot2d } from '@/components/StoryboardWidgetCanvas/StoryboardCardMediaDropSlot2d'
import { readStoryboardCardSummaryText } from '@/components/StoryboardWidgetCanvas/storyboardCardSummaryText'
import { buildFixedStoryboardCardPlacements2d, buildFixedStoryboardCardReferencePlacements2d, readStoryboardCardCenter2d, readStoryboardCardSize2d, type StoryboardCardPlacement } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { isStoryboardHeaderDragBlockedTarget, StoryboardCardResizeHandle, useStoryboardCardOverlayInteractions2d, useStoryboardCardOverlayWheelForwarding } from '@/components/StoryboardWidgetCanvas/storyboardCardOverlayInteractions2d'
import { isStoryboardFixedCardOwnedNode } from '@/components/StoryboardWidgetCanvas/storyboardCardOwnership2d'
import { useStoryboardCardMediaDrop2d } from '@/components/StoryboardWidgetCanvas/useStoryboardCardMediaDrop2d'
import { buildStoryboardToolbarActionBindings } from '@/components/StoryboardCanvas/storyboardToolbarActionBindings'
import { buildStoryboardCardMediaTextareaAttachment } from '@/components/StoryboardCanvas/storyboardCardMediaProjection'
import { buildStoryboardBoardModel, buildStoryboardInlineMediaCommandContext, type StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { buildStoryboardToolbarProps } from '@/components/StoryboardCanvas/storyboardToolbarProps'
import { useGraphStore } from '@/hooks/useGraphStore'
import { emitStoryboardWidgetInteractionFrame } from '@/lib/canvas/storyboard-widget-overlay-proxy'
import { applyVectorPaintedOverlayBox, projectVectorPaintedOverlayZoomBox, type VectorPaintedOverlayScaleProjectionBase } from '@/lib/canvas/vectorPaintedOverlayProjection'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { computeStoryboardWidgetOverlayScreenBox, type StoryboardWidgetOverlayDragTransform } from '@/lib/storyboardWidget/overlayWorldDrag'
import { resolveFlowWidgetStateGraphKey, resolveScopedFlowWidgetNodeMap } from '@/lib/storyboardWidget/widgetStateScope'
import { readCanvasBoardLayoutMode } from '@/lib/canvas/canvasBoardLayoutDisplayControls'
import { isFlowWidgetHeaderDragAllowedByPin } from '@/lib/storyboardWidget/flowWidgetPinMovement'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { buildGraphNodeCanonicalTextPatch, GRAPH_NODE_CARD_SUMMARY_PROPERTY_KEYS, GRAPH_NODE_CARD_TITLE_PROPERTY_KEYS } from '@/lib/cards/graphNodeCardFields'
import { buildInlineMediaCommandDragPayload } from '@/lib/command-menu/inlineMediaCommandDragPayload'
import type { InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { GRAPH_KEYWORD_LANE_PROPERTY_KEYS } from '@/lib/graph/keywordTerms'
import { createUniqueId } from '@/lib/ids'
import { UI_LABELS } from '@/lib/config'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { RICH_MEDIA_PANEL_DEFAULT_CSS_VARS } from '@/lib/render/richMediaPanelDefaults'
import { readFlowWidgetPinnedInCanvas } from '@/lib/storyboardWidget/flowWidgetPinnedState'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'
import { cn } from '@/lib/utils'
const STORYBOARD_CARD_OVERLAY_Z_INDEX = 60
const isScreenBoxVisible = (box: { left: number; top: number; scale: number }, size: { width: number; height: number }, viewport: { width: number; height: number }): boolean => {
  const width = Math.max(1, size.width) * Math.max(0.001, box.scale)
  const height = Math.max(1, size.height) * Math.max(0.001, box.scale)
  return width > 0 && height > 0 && box.left + width > 0 && box.top + height > 0 && box.left < viewport.width && box.top < viewport.height
}
type StoryboardCardTextModel = { primaryRaw: string; primaryDisplay: string; secondaryDisplay: string }
const buildCardTextModel = (card: StoryboardCardModel): StoryboardCardTextModel => {
  const primaryRaw = card.summary || card.output || card.action || card.prompt || ''
  const secondaryRaw = card.action && card.action !== primaryRaw ? card.action : card.prompt && card.prompt !== primaryRaw ? card.prompt : ''
  const primary = readStoryboardCardSummaryText(primaryRaw)
  const secondary = readStoryboardCardSummaryText(secondaryRaw)
  return {
    primaryRaw,
    primaryDisplay: primary,
    secondaryDisplay: secondary,
  }
}
const ignoreStoryboardCardAction = () => void 0
function StoryboardCardOverlayItem(props: {
  card: StoryboardCardModel; node: GraphNode; pendingMedia: StoryboardCardModel['media']; storyboardWidgetSurfaceId: string
  cardMoveEnabled: boolean
  register: (id: string, el: HTMLElement | null) => void; selected: boolean
  onDuplicate: (card: StoryboardCardModel) => void; onOpenInSidepane: (card: StoryboardCardModel) => void; onRemove: (card: StoryboardCardModel) => void; onRun: (card: StoryboardCardModel) => void; onSelect: (card: StoryboardCardModel) => void
  onCommitLane: (card: StoryboardCardModel, nextValue: string) => void; onCommitSummary: (card: StoryboardCardModel, nextValue: string) => void; onCommitTitle: (card: StoryboardCardModel, nextValue: string) => void; onCommitType: (card: StoryboardCardModel, nextValue: string) => void
  onDropMedia: (card: StoryboardCardModel, payload: MediaDragPayload) => void
  headerPinProps: FlowCanvasHeaderPinProps
  readCardSize: (node: GraphNode) => { width: number; height: number }
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>, node: GraphNode) => void
  onResizePointerDown: (event: React.PointerEvent<HTMLButtonElement>, node: GraphNode) => void
}) {
  const { card, cardMoveEnabled, storyboardWidgetSurfaceId, headerPinProps, node, onCommitLane, onCommitSummary, onCommitTitle, onCommitType, onDropMedia, onDuplicate, onHeaderPointerDown, onOpenInSidepane, onRemove, onResizePointerDown, onRun, onSelect, pendingMedia, readCardSize, register, selected } = props
  const { width, height } = readCardSize(node)
  const textModel = buildCardTextModel(card)
  const displayMedia = pendingMedia || card.media
  const projectedMediaAttachments = React.useMemo(() => {
    const attachment = buildStoryboardCardMediaTextareaAttachment(displayMedia, card.title || card.id)
    return attachment ? [attachment] : null
  }, [card.id, card.title, displayMedia])
  const [summaryEditRequestKey, setSummaryEditRequestKey] = React.useState(0)
  const storyboardCommandContextText = buildStoryboardInlineMediaCommandContext(
    displayMedia === card.media ? card : { ...card, media: displayMedia },
  )
  const applyInlineMediaCommandToCard = React.useCallback((candidate: InlineMediaCommandCandidate) => {
    const payload = buildInlineMediaCommandDragPayload(candidate)
    if (!payload) return
    onDropMedia(card, payload)
  }, [card, onDropMedia])
  const requestSummaryEditFromTextColumn = React.useCallback((event: React.SyntheticEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('button,input,textarea,select,a,[role="menu"],[role="menuitem"],[contenteditable="true"],[data-kg-card-inline-command-menu]')) return
    event.preventDefault()
    event.stopPropagation()
    setSummaryEditRequestKey(key => key + 1)
  }, [])
  const toolbarProps = buildStoryboardToolbarProps({
    active: true,
    duplicateDisabled: headerPinProps.headerPinned === true,
    primaryReferenceUrl: card.href || card.references[0]?.url,
  })
  const toolbarActionBindings = buildStoryboardToolbarActionBindings({
    card, runCard: onRun, openCardInSidepane: onOpenInSidepane, duplicateCard: onDuplicate,
    clearCardOutput: ignoreStoryboardCardAction, showCardHelp: ignoreStoryboardCardAction, removeCard: onRemove,
    openCardWorkflowManagerMapping: ignoreStoryboardCardAction, convertCardToLoop: ignoreStoryboardCardAction,
  })
  return (
    <article
      ref={el => register(card.id, el)}
      aria-label={`Storyboard card ${card.title}`}
      className={cn(
        getStoryboardWidgetPanelChromeClassName(),
        'pointer-events-auto absolute left-0 top-0 overflow-visible rounded-md shadow-md',
        selected ? 'ring-2 ring-blue-500/80' : '',
      )}
      data-kg-storyboard-card-pixel-snap="1"
      data-kg-storyboard-card-vector-zoom="1"
      data-kg-storyboard-fixed-card="1"
      data-kg-storyboard-fixed-card-id={card.id}
      data-kg-storyboard-fixed-card-lane={card.lane || 'Storyboard'}
      data-kg-storyboard-fixed-card-rich-media-chrome="1"
      data-kg-storyboard-fixed-card-pinned={headerPinProps.headerPinned === true ? '1' : '0'}
      data-kg-overlay-pan-owner="canvas"
      data-node-id={card.id}
      data-kg-storyboard-widget-surface={storyboardWidgetSurfaceId}
      onClickCapture={event => {
        if (event.target instanceof Element && event.target.closest('[data-kg-port-handle="1"]')) return
        onSelect(card)
      }}
      onPointerDownCapture={event => {
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest('[data-kg-port-handle="1"],[data-kg-rich-media-resize-handle="1"]')) return
        if (target?.closest('[data-kg-rich-media-storyboard-widget-header="1"]') && !isStoryboardHeaderDragBlockedTarget(target)) {
          onSelect(card)
          if (cardMoveEnabled) onHeaderPointerDown(event, node)
          return
        }
        onSelect(card)
      }}
      style={{
        width,
        height,
        transformOrigin: '0 0',
        ...RICH_MEDIA_PANEL_DEFAULT_CSS_VARS,
      }}
    >
      <WidgetEditorActionsToolbar
        visible={selected}
        ariaLabel={UI_LABELS.storyboardCard}
        {...toolbarProps}
        {...toolbarActionBindings}
      />
      <StoryboardWidgetOverlayPortHandles node={node} selected={selected} />
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]">
        <StoryboardWidgetPanelChromeHeader
          active
          title={card.title}
          actionsAriaLabel={UI_LABELS.storyboardCard}
          titleContent={<section className="flex min-w-0 items-center gap-1.5" data-kg-storyboard-card-title-row="1">
            <CardInlineTextEditor
              value={card.title}
              ariaLabel={`Storyboard title for ${card.id}`}
              placeholder="Add title"
              canEdit
              editActivation="click"
              onCommit={nextValue => onCommitTitle(card, nextValue)}
              displayClassName="min-w-0 flex-1 truncate text-[12px] font-semibold leading-4 text-[color:var(--kg-text-primary)]"
              editorClassName="min-w-[8rem] rounded border bg-[color:var(--kg-input-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[color:var(--kg-text-primary)]"
            />
          </section>}
          richMediaHeader
          dragHandle={cardMoveEnabled}
          onHeaderPointerDown={cardMoveEnabled ? event => onHeaderPointerDown(event, node) : undefined}
          showFieldToggle={false}
          showPinToggle={selected && typeof headerPinProps.onHeaderTogglePinned === 'function'}
          pinned={headerPinProps.headerPinned === true}
          onTogglePinned={headerPinProps.onHeaderTogglePinned}
          onPinnedPointerDown={headerPinProps.onHeaderPinnedPointerDown}
          showValidate={false}
          showMinimizeToggle={false}
        />
        <section
          className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(6.25rem,36%)] gap-2 p-[var(--kg-media-panel-padding,6px)]"
          aria-label={`${card.title} storyboard card body`}
          data-kg-rich-media-storyboard-widget-body="1"
          data-kg-widget-body="1"
          data-kg-storyboard-card-body-layout="brief-media"
        >
          <section
            className="flex min-h-0 flex-col gap-1.5 overflow-hidden rounded border bg-[color:var(--kg-panel-bg)]/70 p-1.5"
            data-kg-storyboard-card-text-column="1"
            onPointerDownCapture={requestSummaryEditFromTextColumn}
            onMouseDownCapture={requestSummaryEditFromTextColumn}
            style={{ borderColor: 'var(--kg-border)' }}
          >
            <StoryboardCardMetaScrollRail card={card} onCommitLane={onCommitLane} onCommitType={onCommitType} />
            <section className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable]" data-kg-canvas-pointer-ignore="true" data-kg-canvas-wheel-ignore="true" data-kg-media-scroll-surface="1" data-kg-storyboard-card-brief="1" data-kg-storyboard-card-summary-scroll="1" onWheelCapture={event => event.stopPropagation()}>
              <CardInlineTextEditor
                value={textModel.primaryRaw || card.slugline || ''}
                displayValue={textModel.primaryDisplay || card.slugline || ''}
                ariaLabel={`Summary for ${card.id}`}
                placeholder="Add summary"
                canEdit
                editActivation="click"
                editRequestKey={summaryEditRequestKey}
                multiline
                markdownPreview="auto"
                markdownCommandContextText={storyboardCommandContextText}
                mediaCommandMode="external"
                editorSurface="viewer"
                openOnPointerDown
                projectedMediaAttachments={projectedMediaAttachments}
                rows={2}
                showCommandLaunchers={false}
                onCommit={nextValue => onCommitSummary(card, nextValue)}
                onMediaCommandSelect={applyInlineMediaCommandToCard}
                displayClassName="m-0 h-full min-h-0 select-none overflow-auto whitespace-pre-wrap break-words text-[10px] font-medium leading-4 text-[color:var(--kg-text-secondary)] [scrollbar-gutter:stable]"
                editorClassName="h-full min-h-[3rem] overflow-auto text-[10px] font-medium leading-4 text-[color:var(--kg-text-primary)] [scrollbar-gutter:stable]"
              />
            </section>
            <p className="m-0 max-h-[2.625rem] overflow-auto overscroll-contain text-[9px] leading-[0.875rem] text-[color:var(--kg-text-tertiary)] [scrollbar-gutter:stable]">
              {textModel.secondaryDisplay || card.prompt || card.dialogue || card.style || ''}
            </p>
          </section>
          <StoryboardCardMediaDropSlot2d card={card} displayMedia={displayMedia} onDropMedia={onDropMedia} />
        </section>
      </section>
      {selected ? <StoryboardCardResizeHandle onPointerDown={event => onResizePointerDown(event, node)} /> : null}
    </article>
  )
}

export function StoryboardCardOverlayLayer2d(props: {
  active: boolean
  storyboardWidgetSurfaceId: string
  graphData: GraphData | null
  graphRevision: number
  getTransform: () => StoryboardWidgetOverlayDragTransform | null
  getWheelForwardTarget?: () => Element | null
  runWorkflowNode?: (nodeId: string) => Promise<void> | void
  schema: GraphSchema | null
  widgetRegistry: ReadonlyArray<WidgetRegistryEntry>
}) {
  const { active, storyboardWidgetSurfaceId, getTransform, getWheelForwardTarget, graphData, graphRevision, runWorkflowNode, schema, widgetRegistry } = props
  const strybldrStoryboardCardAspectMode = useGraphStore(s => s.strybldrStoryboardCardAspectMode)
  const strybldrStoryboardBoardLayoutMode = useGraphStore(s => s.strybldrStoryboardBoardLayoutMode)
  const updateNode = useGraphStore(s => s.updateNode)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName || null)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText || null)
  const addNode = useGraphStore(s => s.addNode)
  const addHistory = useGraphStore(s => s.addHistory)
  const removeNode = useGraphStore(s => s.removeNode)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectedNodeId = useGraphStore(s => String(s.selectedNodeId || '').trim())
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const flowWidgetPinnedByNodeId = useGraphStore(s => s.flowWidgetPinnedByNodeId)
  const flowWidgetPinnedByNodeIdByGraphMetaKey = useGraphStore(s => s.flowWidgetPinnedByNodeIdByGraphMetaKey)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const updateOpenWidgetNodeIds = useGraphStore(s => s.updateOpenWidgetNodeIds)
  const requestZoom = useGraphStore(s => s.requestZoom)
  const storyboardBoardLayoutMode = readCanvasBoardLayoutMode(strybldrStoryboardBoardLayoutMode)
  const fixedLayoutEnabled = storyboardBoardLayoutMode === 'fixed'
  const flowWidgetStateGraphKey = React.useMemo(() => resolveFlowWidgetStateGraphKey({ graphData }), [graphData])
  const effectiveFlowWidgetPinnedByNodeId = React.useMemo(() => resolveScopedFlowWidgetNodeMap({
    graphMetaKey: flowWidgetStateGraphKey,
    keyedByGraphMetaKey: flowWidgetPinnedByNodeIdByGraphMetaKey,
    globalByNodeId: flowWidgetPinnedByNodeId,
  }), [flowWidgetPinnedByNodeId, flowWidgetPinnedByNodeIdByGraphMetaKey, flowWidgetStateGraphKey])
  const [activeCardId, setActiveCardId] = React.useState('')
  const rootRef = React.useRef<HTMLElement | null>(null)
  const overlayElsRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const dragWorldOverrideByCardIdRef = React.useRef<Map<string, { x: number; y: number }>>(new Map())
  const zoomLayoutBaseBoxByCardIdRef = React.useRef<Map<string, VectorPaintedOverlayScaleProjectionBase>>(new Map())
  const lastOverlayTransformRef = React.useRef<StoryboardWidgetOverlayDragTransform | null>(null)
  const lastPinnedByCardIdRef = React.useRef<Map<string, boolean>>(new Map())
  const lastAppliedBoxByCardIdRef = React.useRef<Map<string, { left: number; top: number; scale: number; display: string }>>(new Map())
  const initialFitCommitKeyRef = React.useRef('')
  const board = React.useMemo(
    () => buildStoryboardBoardModel({ graphData, graphRevision, widgetRegistry }),
    [graphData, graphRevision, widgetRegistry],
  )
  const nodeById = React.useMemo(() => {
    const out = new Map<string, GraphNode>()
    const nodes = Array.isArray(graphData?.nodes) ? (graphData.nodes as GraphNode[]) : []
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const id = String(node?.id || '').trim()
      if (id) out.set(id, node)
    }
    return out
  }, [graphData])
  const cards = React.useMemo(
    () => board.lanes
      .flatMap(lane => lane.cards)
      .filter(card => isStoryboardFixedCardOwnedNode(nodeById.get(card.id))),
    [board.lanes, nodeById],
  )
  const { dropCardMedia, pendingMediaByCardId } = useStoryboardCardMediaDrop2d({
    cards,
    graphData,
    markdownDocumentName,
    markdownDocumentText,
    nodeById,
  })
  const readCardSize = React.useCallback(
    (node: GraphNode) => readStoryboardCardSize2d(node, strybldrStoryboardCardAspectMode),
    [strybldrStoryboardCardAspectMode],
  )
  const fixedCardPlacements = React.useMemo(
    () => fixedLayoutEnabled ? buildFixedStoryboardCardPlacements2d({ aspectRatioMode: strybldrStoryboardCardAspectMode, board, flowWidgetPinnedByNodeId: effectiveFlowWidgetPinnedByNodeId, nodeById, schema }) : new Map<string, StoryboardCardPlacement>(),
    [board, effectiveFlowWidgetPinnedByNodeId, fixedLayoutEnabled, nodeById, schema, strybldrStoryboardCardAspectMode],
  )
  const fixedCardReferencePlacements = React.useMemo(
    () => buildFixedStoryboardCardReferencePlacements2d({ aspectRatioMode: strybldrStoryboardCardAspectMode, board, nodeById, schema }),
    [board, nodeById, schema, strybldrStoryboardCardAspectMode],
  )
  const setDragVisualOverride = React.useCallback((id: string, point: { x: number; y: number } | null) => { const key = String(id || '').trim(); if (!key) return; if (point) dragWorldOverrideByCardIdRef.current.set(key, point); else dragWorldOverrideByCardIdRef.current.delete(key) }, [])
  const readCardCenter = React.useCallback((node: GraphNode): StoryboardCardPlacement | null => {
    const id = String(node.id || '').trim()
    if (!id) return readStoryboardCardCenter2d(node)
    return dragWorldOverrideByCardIdRef.current.get(id) || (fixedLayoutEnabled ? readStoryboardCardCenter2d(node) || fixedCardReferencePlacements.get(id) : fixedCardReferencePlacements.get(id) || readStoryboardCardCenter2d(node)) || null
  }, [fixedCardReferencePlacements, fixedLayoutEnabled])
  useStoryboardCardOverlayWheelForwarding({ getWheelForwardTarget, rootRef })
  const interactions = useStoryboardCardOverlayInteractions2d({
    addHistory,
    getTransform,
    readNodeCenter: readCardCenter,
    readNodeSize: readCardSize,
    schema,
    setDragVisualOverride,
    updateNode,
  })
  const register = React.useCallback((id: string, el: HTMLElement | null) => {
    const key = String(id || '').trim()
    if (!key) return
    if (el) overlayElsRef.current.set(key, el)
    else { overlayElsRef.current.delete(key); lastAppliedBoxByCardIdRef.current.delete(key); zoomLayoutBaseBoxByCardIdRef.current.delete(key) }
  }, [])
  const stopCardHeaderControlEvent = React.useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])
  const readLatestNode = React.useCallback((id: string): GraphNode | null => {
    const key = String(id || '').trim()
    if (!key) return null
    const renderNode = nodeById.get(key) || null
    if (renderNode) return renderNode
    const latestGraphData = useGraphStore.getState().graphData
    const latestNodes = Array.isArray(latestGraphData?.nodes) ? latestGraphData.nodes as GraphNode[] : []
    return latestNodes.find(item => String(item?.id || '').trim() === key) || null
  }, [nodeById])
  const commitNodePatch = React.useCallback((card: StoryboardCardModel, patch: Partial<GraphNode>, historyLabel: string) => {
    const id = String(card.id || '').trim()
    if (!id) return
    updateNode(id, patch)
    addHistory(historyLabel)
  }, [addHistory, updateNode])
  const commitNodeCanonicalProperty = React.useCallback((card: StoryboardCardModel, args: {
    canonicalKey: string
    historyLabel: string
    nextValue: string
    preserveFormatting?: boolean
    propertyKeys: readonly string[]
  }) => {
    const node = readLatestNode(card.id)
    const currentProperties = (node?.properties || {}) as Record<string, unknown>
    const nextProperties = buildGraphNodeCanonicalTextPatch({
      currentProperties,
      propertyKeys: args.propertyKeys,
      canonicalKey: args.canonicalKey,
      nextValue: args.nextValue,
      preserveFormatting: args.preserveFormatting,
    }) as Record<string, JSONValue>
    commitNodePatch(card, { properties: nextProperties }, args.historyLabel)
  }, [commitNodePatch, readLatestNode])
  const commitTitle = React.useCallback((card: StoryboardCardModel, nextValue: string) => {
    const label = String(nextValue || '').trim()
    const node = readLatestNode(card.id)
    commitNodePatch(card, {
      label,
      properties: buildGraphNodeCanonicalTextPatch({
        currentProperties: (node?.properties || {}) as Record<string, unknown>,
        propertyKeys: GRAPH_NODE_CARD_TITLE_PROPERTY_KEYS,
        canonicalKey: 'title',
        nextValue: label,
      }) as Record<string, JSONValue>,
    }, 'Storyboard title')
  }, [commitNodePatch, readLatestNode])
  const commitType = React.useCallback((card: StoryboardCardModel, nextValue: string) => {
    commitNodePatch(card, { type: String(nextValue || '').trim() }, 'Storyboard type')
  }, [commitNodePatch])
  const commitLane = React.useCallback((card: StoryboardCardModel, nextValue: string) => {
    commitNodeCanonicalProperty(card, {
      canonicalKey: 'lane',
      historyLabel: 'Storyboard lane',
      nextValue,
      propertyKeys: GRAPH_KEYWORD_LANE_PROPERTY_KEYS,
    })
  }, [commitNodeCanonicalProperty])
  const commitSummary = React.useCallback((card: StoryboardCardModel, nextValue: string) => {
    commitNodeCanonicalProperty(card, {
      canonicalKey: 'summary',
      historyLabel: 'Storyboard summary',
      nextValue,
      preserveFormatting: true,
      propertyKeys: GRAPH_NODE_CARD_SUMMARY_PROPERTY_KEYS,
    })
  }, [commitNodeCanonicalProperty])
  const selectCard = React.useCallback((card: StoryboardCardModel) => {
    setActiveCardId(card.id)
    setSelectionSource('canvas')
    selectNode(card.id)
  }, [selectNode, setSelectionSource])
  const runCard = React.useCallback((card: StoryboardCardModel) => {
    selectCard(card)
    void runWorkflowNode?.(card.id)
  }, [runWorkflowNode, selectCard])
  const openCardInSidepane = React.useCallback((card: StoryboardCardModel) => {
    selectCard(card)
    updateOpenWidgetNodeIds(prev => (prev.includes(card.id) ? prev : [...prev, card.id]))
  }, [selectCard, updateOpenWidgetNodeIds])
  const duplicateCard = React.useCallback((card: StoryboardCardModel) => {
    const node = nodeById.get(card.id)
    if (!node) return
    const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes as GraphNode[]) : []
    const usedIds = new Set(nodes.map(item => String(item?.id || '').trim()).filter(Boolean))
    const id = createUniqueId('n', usedIds)
    addNode({
      ...node,
      id,
      label: `${String(node.label || card.title || 'Storyboard card').trim()} Copy`,
      x: typeof node.x === 'number' && Number.isFinite(node.x) ? node.x + 32 : 32,
      y: typeof node.y === 'number' && Number.isFinite(node.y) ? node.y + 32 : 32,
      fx: undefined,
      fy: undefined,
      properties: {
        ...((node.properties || {}) as Record<string, JSONValue>),
        title: `${String(card.title || node.label || 'Storyboard card').trim()} Copy`,
      } as Record<string, JSONValue>,
    })
    addHistory('Storyboard duplicate')
  }, [addHistory, addNode, graphData, nodeById])
  const removeCard = React.useCallback((card: StoryboardCardModel) => {
    removeNode(card.id)
    addHistory('Storyboard remove')
  }, [addHistory, removeNode])

  React.useEffect(() => {
    if (!active || cards.length === 0) return
    let frame = 0
    const update = () => {
      const currentTransform = getTransform()
      const paintScale = currentTransform && Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1
      const previousTransform = lastOverlayTransformRef.current
      const devicePixelRatio = Number.isFinite(window.devicePixelRatio) ? Math.max(1, window.devicePixelRatio) : 1
      const viewportRect = rootRef.current?.getBoundingClientRect() || null
      const viewport = { width: Math.max(1, Math.floor(viewportRect?.width || 1)), height: Math.max(1, Math.floor(viewportRect?.height || 1)) }
      let visibleCardCount = 0
      let rawCenterXSum = 0, rawCenterYSum = 0, rawCenterCount = 0
      const pending: Array<{ rawBox: { left: number; top: number; scale: number }; card: StoryboardCardModel; el: HTMLElement; width: number; height: number }> = []
      const readProjectedBox = (cardId: string, rawBox: { left: number; top: number; scale: number }, width: number, height: number, anchorX: number, anchorY: number) => {
        const projected = projectVectorPaintedOverlayZoomBox({
          previousBox: lastAppliedBoxByCardIdRef.current.get(cardId) || null,
          baseBox: zoomLayoutBaseBoxByCardIdRef.current.get(cardId) || null,
          previousTransform,
          currentTransform,
          rawBox,
          anchorX,
          anchorY,
          width,
          height,
        })
        zoomLayoutBaseBoxByCardIdRef.current.set(cardId, projected.baseBox)
        return projected.box
      }
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i]!
        const node = nodeById.get(card.id)
        const el = overlayElsRef.current.get(card.id)
        if (!node || !el) continue
        const cardPinned = fixedLayoutEnabled ? readFlowWidgetPinnedInCanvas(effectiveFlowWidgetPinnedByNodeId, card.id) : true
        const referencePlacement = fixedCardReferencePlacements.get(card.id)
        const previousPinned = lastPinnedByCardIdRef.current.get(card.id)
        if (fixedLayoutEnabled && previousPinned === true && cardPinned === false && referencePlacement && !dragWorldOverrideByCardIdRef.current.has(card.id)) {
          dragWorldOverrideByCardIdRef.current.set(card.id, referencePlacement)
        }
        lastPinnedByCardIdRef.current.set(card.id, cardPinned)
        const fixedPlacement = fixedLayoutEnabled && cardPinned ? referencePlacement || fixedCardPlacements.get(card.id) : null
        const nodeCenter = dragWorldOverrideByCardIdRef.current.get(card.id) || (fixedLayoutEnabled ? readStoryboardCardCenter2d(node) || referencePlacement : referencePlacement || readStoryboardCardCenter2d(node)) || null
        const x = fixedPlacement?.x ?? nodeCenter?.x ?? 0
        const y = fixedPlacement?.y ?? nodeCenter?.y ?? 0
        const { width, height } = readCardSize(node)
        const rawBox = computeStoryboardWidgetOverlayScreenBox({
          transform: currentTransform,
          centerWorld: { x, y },
          devicePixelRatio,
          paintScale,
          snapToDevicePixels: true,
          width,
          height,
        })
        rawCenterXSum += rawBox.left + width * rawBox.scale / 2
        rawCenterYSum += rawBox.top + height * rawBox.scale / 2
        rawCenterCount += 1
        pending.push({ rawBox, card, el, width, height })
      }
      const projectionAnchorX = rawCenterCount > 0 ? rawCenterXSum / rawCenterCount : viewport.width / 2, projectionAnchorY = rawCenterCount > 0 ? rawCenterYSum / rawCenterCount : viewport.height / 2
      for (let i = 0; i < pending.length; i += 1) {
        const item = pending[i]!
        const box = readProjectedBox(item.card.id, item.rawBox, item.width, item.height, projectionAnchorX, projectionAnchorY)
        if (isScreenBoxVisible(box, { width: item.width, height: item.height }, viewport)) visibleCardCount += 1
        const { el } = item
        const display = box.scale <= 0.02 ? 'none' : ''
        const prevBox = lastAppliedBoxByCardIdRef.current.get(item.card.id) || null
        const boxChanged = !prevBox
          || Math.abs(prevBox.left - box.left) >= 0.25
          || Math.abs(prevBox.top - box.top) >= 0.25
          || Math.abs(prevBox.scale - box.scale) >= 0.0005
          || prevBox.display !== display
        if (boxChanged) {
          applyVectorPaintedOverlayBox(el, {
            left: box.left,
            top: box.top,
            scale: box.scale,
            display,
          })
          lastAppliedBoxByCardIdRef.current.set(item.card.id, { left: box.left, top: box.top, scale: box.scale, display })
          emitStoryboardWidgetInteractionFrame()
        }
      }
      const initialFitDocumentKey = `${storyboardWidgetSurfaceId}::${String(markdownDocumentName || '').trim()}`
      if (initialFitCommitKeyRef.current !== initialFitDocumentKey) {
        initialFitCommitKeyRef.current = initialFitDocumentKey
        if (visibleCardCount === 0) requestZoom('fit', { intent: 'fitToView' })
      }
      lastOverlayTransformRef.current = currentTransform ? { k: currentTransform.k, x: currentTransform.x, y: currentTransform.y } : null
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [active, cards, effectiveFlowWidgetPinnedByNodeId, fixedCardPlacements, fixedCardReferencePlacements, fixedLayoutEnabled, storyboardWidgetSurfaceId, getTransform, graphRevision, markdownDocumentName, nodeById, readCardSize, requestZoom])

  if (!active || cards.length === 0) return null
  return (
    <section
      ref={rootRef}
      aria-label="Storyboard card overlay"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-kg-storyboard-fixed-card-grid={fixedLayoutEnabled ? '1' : '0'}
      data-kg-storyboard-fixed-card-layout={storyboardBoardLayoutMode}
      data-kg-storyboard-fixed-card-overlay="1"
      style={{ zIndex: STORYBOARD_CARD_OVERLAY_Z_INDEX }}
    >
      {cards.map(card => {
        const node = nodeById.get(card.id)
        if (!node) return null
        const selected = activeCardId === card.id || selectedNodeId === card.id || (Array.isArray(selectedNodeIds) && selectedNodeIds.some(id => String(id || '').trim() === card.id))
        const headerPinProps = buildFlowCanvasHeaderPinProps({
          enabled: true,
          flowWidgetPinnedByNodeId: effectiveFlowWidgetPinnedByNodeId,
          flowWidgetStateGraphKey,
          nodeId: card.id,
          stopEvent: stopCardHeaderControlEvent,
        })
        return (
          <StoryboardCardOverlayItem
            key={card.id}
            card={card}
            cardMoveEnabled={isFlowWidgetHeaderDragAllowedByPin({
              fixedLayoutEnabled,
              pinnedInCanvas: headerPinProps.headerPinned === true,
            })}
            storyboardWidgetSurfaceId={storyboardWidgetSurfaceId}
            headerPinProps={headerPinProps}
            node={node}
            pendingMedia={pendingMediaByCardId[card.id] || null}
            readCardSize={readCardSize}
            onCommitLane={commitLane}
            onCommitSummary={commitSummary}
            onCommitTitle={commitTitle}
            onCommitType={commitType}
            onDuplicate={duplicateCard}
            onDropMedia={dropCardMedia}
            onHeaderPointerDown={interactions.beginHeaderDrag}
            onOpenInSidepane={openCardInSidepane}
            onRemove={removeCard}
            onResizePointerDown={interactions.beginResize}
            onRun={runCard}
            onSelect={selectCard}
            register={register}
            selected={selected}
          />
        )
      })}
    </section>
  )
}
