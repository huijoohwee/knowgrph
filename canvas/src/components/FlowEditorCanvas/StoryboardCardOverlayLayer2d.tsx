import React from 'react'
import { buildFlowCanvasHeaderPinProps, type FlowCanvasHeaderPinProps } from '@/components/FlowCanvas/flowCanvasRichMediaPanelHeaderToolbar'
import { NodeOverlayEditorActionsToolbar } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { FlowEditorPanelChromeHeader } from '@/components/FlowEditor/FlowEditorPanelChrome'
import { getFlowEditorPanelChromeClassName } from '@/components/FlowEditor/flowEditorPanelChromeClassName'
import { FlowEditorOverlayPortHandles } from '@/components/FlowEditor/FlowEditorOverlayPortHandles'
import { StoryboardCardMediaDropSlot2d } from '@/components/FlowEditorCanvas/StoryboardCardMediaDropSlot2d'
import { buildFixedStoryboardCardPlacements2d, buildFixedStoryboardCardReferencePlacements2d, readStoryboardCardCenter2d, readStoryboardCardSize2d, type StoryboardCardPlacement } from '@/components/FlowEditorCanvas/storyboardCardPlacements2d'
import { isStoryboardHeaderDragBlockedTarget, StoryboardCardResizeHandle, useStoryboardCardOverlayInteractions2d, useStoryboardCardOverlayWheelForwarding } from '@/components/FlowEditorCanvas/storyboardCardOverlayInteractions2d'
import { isStoryboardFixedCardOwnedNode } from '@/components/FlowEditorCanvas/storyboardCardOwnership2d'
import { useStoryboardCardMediaDrop2d } from '@/components/FlowEditorCanvas/useStoryboardCardMediaDrop2d'
import { buildStoryboardToolbarActionBindings } from '@/components/StoryboardCanvas/storyboardToolbarActionBindings'
import { buildStoryboardBoardModel, type StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { buildStoryboardToolbarProps } from '@/components/StoryboardCanvas/storyboardToolbarProps'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { computeFlowEditorOverlayScreenBox, type FlowEditorOverlayDragTransform } from '@/lib/flowEditor/overlayWorldDrag'
import { resolveFlowWidgetStateGraphKey, resolveScopedFlowWidgetNodeMap } from '@/lib/flowEditor/widgetStateScope'
import { readCanvasBoardLayoutMode } from '@/lib/canvas/canvasBoardLayoutDisplayControls'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { buildGraphNodeCanonicalTextPatch, GRAPH_NODE_CARD_SUMMARY_PROPERTY_KEYS, GRAPH_NODE_CARD_TITLE_PROPERTY_KEYS } from '@/lib/cards/graphNodeCardFields'
import { GRAPH_KEYWORD_LANE_PROPERTY_KEYS } from '@/lib/graph/keywordTerms'
import { createUniqueId } from '@/lib/ids'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { RICH_MEDIA_PANEL_DEFAULT_CSS_VARS } from '@/lib/render/richMediaPanelDefaults'
import { readFlowWidgetPinnedInCanvas } from '@/lib/flowEditor/flowWidgetPinnedState'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'
import { cn } from '@/lib/utils'
const STORYBOARD_CARD_OVERLAY_Z_INDEX = 60

const isScreenBoxVisible = (box: { left: number; top: number; scale: number }, size: { width: number; height: number }, viewport: { width: number; height: number }): boolean => {
  const width = Math.max(1, size.width) * Math.max(0.001, box.scale)
  const height = Math.max(1, size.height) * Math.max(0.001, box.scale)
  return width > 0 && height > 0 && box.left + width > 0 && box.top + height > 0 && box.left < viewport.width && box.top < viewport.height
}

const buildCardRows = (card: StoryboardCardModel): string[] => {
  const primary = card.summary || card.output || card.action || card.prompt || ''
  const secondary = card.action && card.action !== primary ? card.action : card.prompt && card.prompt !== primary ? card.prompt : ''
  return [primary, secondary].filter(Boolean).slice(0, 2)
}

const ignoreStoryboardCardAction = () => void 0

function StoryboardCardOverlayItem(props: {
  card: StoryboardCardModel; node: GraphNode; pendingMedia: StoryboardCardModel['media']; flowEditorSurfaceId: string
  cardMoveEnabled: boolean
  register: (id: string, el: HTMLElement | null) => void; selected: boolean
  onDuplicate: (card: StoryboardCardModel) => void; onOpenInSidepane: (card: StoryboardCardModel) => void; onRemove: (card: StoryboardCardModel) => void; onSelect: (card: StoryboardCardModel) => void
  onCommitLane: (card: StoryboardCardModel, nextValue: string) => void; onCommitSummary: (card: StoryboardCardModel, nextValue: string) => void; onCommitTitle: (card: StoryboardCardModel, nextValue: string) => void; onCommitType: (card: StoryboardCardModel, nextValue: string) => void
  onDropMedia: (card: StoryboardCardModel, payload: MediaDragPayload) => void
  headerPinProps: FlowCanvasHeaderPinProps
  readCardSize: (node: GraphNode) => { width: number; height: number }
  onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>, node: GraphNode) => void
  onResizePointerDown: (event: React.PointerEvent<HTMLButtonElement>, node: GraphNode) => void
}) {
  const { card, cardMoveEnabled, flowEditorSurfaceId, headerPinProps, node, onCommitLane, onCommitSummary, onCommitTitle, onCommitType, onDropMedia, onDuplicate, onHeaderPointerDown, onOpenInSidepane, onRemove, onResizePointerDown, onSelect, pendingMedia, readCardSize, register, selected } = props
  const { width, height } = readCardSize(node)
  const rows = buildCardRows(card)
  const displayMedia = pendingMedia || card.media
  const toolbarProps = buildStoryboardToolbarProps({
    active: true,
    duplicateDisabled: headerPinProps.headerPinned === true,
    primaryReferenceUrl: card.href || card.references[0]?.url,
  })
  const toolbarActionBindings = buildStoryboardToolbarActionBindings({
    card, runCard: ignoreStoryboardCardAction, openCardInSidepane: onOpenInSidepane, duplicateCard: onDuplicate,
    clearCardOutput: ignoreStoryboardCardAction, showCardHelp: ignoreStoryboardCardAction, removeCard: onRemove,
    openCardWorkflowManagerMapping: ignoreStoryboardCardAction, convertCardToLoop: ignoreStoryboardCardAction,
  })
  return (
    <article
      ref={el => register(card.id, el)}
      aria-label={`Storyboard card ${card.title}`}
      className={cn(
        getFlowEditorPanelChromeClassName(),
        'pointer-events-auto absolute left-0 top-0 overflow-visible',
        selected ? 'ring-2 ring-blue-500/80' : '',
      )}
      data-kg-storyboard-fixed-card="1"
      data-kg-storyboard-fixed-card-id={card.id}
      data-kg-storyboard-fixed-card-lane={card.lane || 'Storyboard'}
      data-kg-storyboard-fixed-card-rich-media-chrome="1"
      data-kg-storyboard-fixed-card-pinned={headerPinProps.headerPinned === true ? '1' : '0'}
      data-kg-overlay-pan-owner="canvas"
      data-node-id={card.id}
      data-kg-flow-editor-surface={flowEditorSurfaceId}
      onClickCapture={event => {
        if (event.target instanceof Element && event.target.closest('[data-kg-port-handle="1"]')) return
        onSelect(card)
      }}
      onPointerDownCapture={event => {
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest('[data-kg-port-handle="1"],[data-kg-rich-media-resize-handle="1"]')) return
        if (target?.closest('[data-kg-rich-media-flow-editor-header="1"]') && !isStoryboardHeaderDragBlockedTarget(target)) {
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
        willChange: 'transform',
        ...RICH_MEDIA_PANEL_DEFAULT_CSS_VARS,
      }}
    >
      <NodeOverlayEditorActionsToolbar
        visible={selected}
        {...toolbarProps}
        {...toolbarActionBindings}
      />
      <FlowEditorOverlayPortHandles node={node} selected={selected} />
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]">
        <FlowEditorPanelChromeHeader
          active
          title={card.title}
          titleContent={<section className="flex min-w-0 items-center gap-2">
            <CardInlineTextEditor
              value={card.lane || 'Storyboard'}
              ariaLabel={`Storyboard lane for ${card.id}`}
              placeholder="Add lane"
              canEdit
              editActivation="click"
              onCommit={nextValue => onCommitLane(card, nextValue)}
              displayClassName="shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-normal text-[color:var(--kg-text-secondary)]"
              editorClassName="min-w-[4.5rem] rounded border bg-[color:var(--kg-input-bg)] px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--kg-text-primary)]"
            />
            <CardInlineTextEditor
              value={card.typeLabel}
              ariaLabel={`Storyboard type for ${card.id}`}
              placeholder="Add type"
              canEdit
              editActivation="click"
              onCommit={nextValue => onCommitType(card, nextValue)}
              displayClassName="shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-normal text-[color:var(--kg-text-secondary)]"
              editorClassName="min-w-[4.5rem] rounded border bg-[color:var(--kg-input-bg)] px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--kg-text-primary)]"
            />
            <CardInlineTextEditor
              value={card.title}
              ariaLabel={`Storyboard title for ${card.id}`}
              placeholder="Add title"
              canEdit
              editActivation="click"
              onCommit={nextValue => onCommitTitle(card, nextValue)}
              displayClassName="min-w-0 truncate text-[11px] font-semibold leading-4"
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
          className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_5.25rem] gap-2 p-[var(--kg-media-panel-padding,6px)]"
          aria-label={`${card.title} storyboard card body`}
          data-kg-rich-media-flow-editor-body="1"
          data-kg-widget-body="1"
        >
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-1">
            <CardInlineTextEditor
              value={rows[0] || card.slugline || ''}
              ariaLabel={`Summary for ${card.id}`}
              placeholder="Add summary"
              canEdit
              editActivation="click"
              multiline
              markdownPreview="auto"
              rows={2}
              onCommit={nextValue => onCommitSummary(card, nextValue)}
              displayClassName="m-0 line-clamp-2 text-[10px] leading-4 text-[color:var(--kg-text-secondary)]"
              editorClassName="min-h-[3rem] rounded border bg-[color:var(--kg-input-bg)] px-1.5 py-1 text-[10px] leading-4 text-[color:var(--kg-text-primary)]"
            />
            <p className="m-0 line-clamp-3 text-[9px] leading-3 text-[color:var(--kg-text-tertiary)]">
              {rows[1] || card.prompt || card.dialogue || card.style || ''}
            </p>
            <footer className="flex min-w-0 items-center gap-1 text-[8px] leading-3 text-[color:var(--kg-text-tertiary)]">
              {card.indexLabel ? <span className="shrink-0">{card.indexLabel}</span> : null}
              {card.typeLabel ? <span className="min-w-0 truncate">{card.typeLabel}</span> : null}
            </footer>
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
  flowEditorSurfaceId: string
  graphData: GraphData | null
  graphRevision: number
  getTransform: () => FlowEditorOverlayDragTransform | null
  getWheelForwardTarget?: () => Element | null
  schema: GraphSchema | null
  widgetRegistry: ReadonlyArray<WidgetRegistryEntry>
}) {
  const { active, flowEditorSurfaceId, getTransform, getWheelForwardTarget, graphData, graphRevision, schema, widgetRegistry } = props
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
    else { overlayElsRef.current.delete(key); lastAppliedBoxByCardIdRef.current.delete(key) }
  }, [])
  const stopCardHeaderControlEvent = React.useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])
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
    propertyKeys: readonly string[]
  }) => {
    const node = nodeById.get(card.id)
    const currentProperties = (node?.properties || {}) as Record<string, unknown>
    const nextProperties = buildGraphNodeCanonicalTextPatch({
      currentProperties,
      propertyKeys: args.propertyKeys,
      canonicalKey: args.canonicalKey,
      nextValue: args.nextValue,
    }) as Record<string, JSONValue>
    commitNodePatch(card, { properties: nextProperties }, args.historyLabel)
  }, [commitNodePatch, nodeById])
  const commitTitle = React.useCallback((card: StoryboardCardModel, nextValue: string) => {
    const label = String(nextValue || '').trim()
    commitNodePatch(card, {
      label,
      properties: buildGraphNodeCanonicalTextPatch({
        currentProperties: (nodeById.get(card.id)?.properties || {}) as Record<string, unknown>,
        propertyKeys: GRAPH_NODE_CARD_TITLE_PROPERTY_KEYS,
        canonicalKey: 'title',
        nextValue: label,
      }) as Record<string, JSONValue>,
    }, 'Storyboard title')
  }, [commitNodePatch, nodeById])
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
      propertyKeys: GRAPH_NODE_CARD_SUMMARY_PROPERTY_KEYS,
    })
  }, [commitNodeCanonicalProperty])
  const selectCard = React.useCallback((card: StoryboardCardModel) => {
    setActiveCardId(card.id)
    setSelectionSource('canvas')
    selectNode(card.id)
  }, [selectNode, setSelectionSource])
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
      const viewportRect = rootRef.current?.getBoundingClientRect() || null
      const viewport = {
        width: Math.max(1, Math.floor(viewportRect?.width || 1)),
        height: Math.max(1, Math.floor(viewportRect?.height || 1)),
      }
      let visibleCardCount = 0
      const pending: Array<{ card: StoryboardCardModel; el: HTMLElement; node: GraphNode; x: number; y: number; width: number; height: number }> = []
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
        const currentBox = computeFlowEditorOverlayScreenBox({
          transform: currentTransform,
          centerWorld: { x, y },
          width,
          height,
        })
        if (isScreenBoxVisible(currentBox, { width, height }, viewport)) visibleCardCount += 1
        pending.push({ card, el, node, x, y, width, height })
      }
      const initialFitDocumentKey = `${flowEditorSurfaceId}::${String(markdownDocumentName || '').trim()}`
      if (initialFitCommitKeyRef.current !== initialFitDocumentKey) {
        initialFitCommitKeyRef.current = initialFitDocumentKey
        if (visibleCardCount === 0) requestZoom('fit', { intent: 'fitToView' })
      }
      for (let i = 0; i < pending.length; i += 1) {
        const { el, x, y, width, height } = pending[i]!
        const box = computeFlowEditorOverlayScreenBox({
          transform: currentTransform,
          centerWorld: { x, y },
          width,
          height,
        })
        const display = box.scale <= 0.02 ? 'none' : ''
        const prevBox = lastAppliedBoxByCardIdRef.current.get(pending[i]!.card.id) || null
        const boxChanged = !prevBox
          || Math.abs(prevBox.left - box.left) >= 0.25
          || Math.abs(prevBox.top - box.top) >= 0.25
          || Math.abs(prevBox.scale - box.scale) >= 0.0005
          || prevBox.display !== display
        if (boxChanged) {
          el.style.transform = `translate3d(${box.left}px, ${box.top}px, 0) scale(${box.scale})`
          el.style.display = display
          lastAppliedBoxByCardIdRef.current.set(pending[i]!.card.id, { left: box.left, top: box.top, scale: box.scale, display })
        }
      }
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [active, cards, effectiveFlowWidgetPinnedByNodeId, fixedCardPlacements, fixedCardReferencePlacements, fixedLayoutEnabled, flowEditorSurfaceId, getTransform, graphRevision, markdownDocumentName, nodeById, readCardSize, requestZoom])

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
            cardMoveEnabled={!fixedLayoutEnabled || headerPinProps.headerPinned === false}
            flowEditorSurfaceId={flowEditorSurfaceId}
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
            onSelect={selectCard}
            register={register}
            selected={selected}
          />
        )
      })}
    </section>
  )
}
