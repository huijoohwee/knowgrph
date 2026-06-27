import React from 'react'
import { NodeOverlayEditorActionsToolbar } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { buildStoryboardToolbarActionBindings } from '@/components/StoryboardCanvas/storyboardToolbarActionBindings'
import { buildStoryboardBoardModel, type StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { buildStoryboardToolbarProps } from '@/components/StoryboardCanvas/storyboardToolbarProps'
import { useGraphStore } from '@/hooks/useGraphStore'
import { computeFlowEditorOverlayScreenBox, type FlowEditorOverlayDragTransform } from '@/lib/flowEditor/overlayWorldDrag'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { readSnapGridConfigFromSchema, snapPointToGrid } from '@/lib/canvas/gridSnap'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { buildGraphNodeCanonicalTextPatch, GRAPH_NODE_CARD_SUMMARY_PROPERTY_KEYS, GRAPH_NODE_CARD_TITLE_PROPERTY_KEYS } from '@/lib/cards/graphNodeCardFields'
import { GRAPH_KEYWORD_LANE_PROPERTY_KEYS } from '@/lib/graph/keywordTerms'
import { createUniqueId } from '@/lib/ids'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { cn } from '@/lib/utils'

const STORYBOARD_CARD_OVERLAY_Z_INDEX = 60
const DEFAULT_CARD_WIDTH = 288
const DEFAULT_CARD_HEIGHT = 162
const DEFAULT_GRID_GAP = 64
const STORYBOARD_CARD_FIT_PADDING = 48

type StoryboardCardPlacement = {
  x: number
  y: number
}

const readFiniteNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

const readNodeCardSize = (node: GraphNode): { width: number; height: number } => {
  const props = (node.properties || {}) as Record<string, unknown>
  return {
    width: readFiniteNumber(props['visual:width']) || DEFAULT_CARD_WIDTH,
    height: readFiniteNumber(props['visual:height']) || DEFAULT_CARD_HEIGHT,
  }
}

const readNodeCenter = (node: GraphNode | undefined): StoryboardCardPlacement | null => {
  if (!node) return null
  const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : null
  const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : null
  return x == null || y == null ? null : { x, y }
}

const isScreenBoxVisible = (box: { left: number; top: number; scale: number }, size: { width: number; height: number }, viewport: { width: number; height: number }): boolean => {
  const width = Math.max(1, size.width) * Math.max(0.001, box.scale)
  const height = Math.max(1, size.height) * Math.max(0.001, box.scale)
  return width > 0 && height > 0 && box.left + width > 0 && box.top + height > 0 && box.left < viewport.width && box.top < viewport.height
}

const computeStoryboardCardFitTransform = (args: {
  cards: readonly StoryboardCardModel[]
  fixedCardPlacements: ReadonlyMap<string, StoryboardCardPlacement>
  nodeById: ReadonlyMap<string, GraphNode>
  viewport: { width: number; height: number }
}): FlowEditorOverlayDragTransform | null => {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (let i = 0; i < args.cards.length; i += 1) {
    const card = args.cards[i]!
    const node = args.nodeById.get(card.id)
    if (!node) continue
    const fixedPlacement = args.fixedCardPlacements.get(card.id)
    const nodeCenter = readNodeCenter(node)
    const x = fixedPlacement?.x ?? nodeCenter?.x ?? 0
    const y = fixedPlacement?.y ?? nodeCenter?.y ?? 0
    const { width, height } = readNodeCardSize(node)
    bounds.minX = Math.min(bounds.minX, x - width / 2)
    bounds.minY = Math.min(bounds.minY, y - height / 2)
    bounds.maxX = Math.max(bounds.maxX, x + width / 2)
    bounds.maxY = Math.max(bounds.maxY, y + height / 2)
  }
  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) return null
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX)
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY)
  const fitWidth = Math.max(1, args.viewport.width - STORYBOARD_CARD_FIT_PADDING * 2)
  const fitHeight = Math.max(1, args.viewport.height - STORYBOARD_CARD_FIT_PADDING * 2)
  const k = Math.min(1, Math.max(0.08, Math.min(fitWidth / boundsWidth, fitHeight / boundsHeight)))
  return {
    k,
    x: (args.viewport.width - boundsWidth * k) / 2 - bounds.minX * k,
    y: (args.viewport.height - boundsHeight * k) / 2 - bounds.minY * k,
  }
}

const ceilToStep = (value: number, step: number): number => {
  const v = Number.isFinite(value) ? Math.max(1, value) : 1
  const s = Number.isFinite(step) ? Math.max(1, step) : 1
  return Math.ceil(v / s) * s
}

export const buildFixedStoryboardCardPlacements2d = (args: {
  board: ReturnType<typeof buildStoryboardBoardModel>
  nodeById: Map<string, GraphNode>
  schema: GraphSchema | null | undefined
}): Map<string, StoryboardCardPlacement> => {
  const { board, nodeById, schema } = args
  const out = new Map<string, StoryboardCardPlacement>()
  const orderedCards = board.lanes.flatMap(lane => lane.cards).filter(card => nodeById.has(card.id))
  if (orderedCards.length === 0) return out

  const centers: StoryboardCardPlacement[] = []
  let maxCardWidth = DEFAULT_CARD_WIDTH
  let maxCardHeight = DEFAULT_CARD_HEIGHT
  for (let i = 0; i < orderedCards.length; i += 1) {
    const node = nodeById.get(orderedCards[i]!.id)
    if (!node) continue
    const center = readNodeCenter(node)
    if (center) centers.push(center)
    const size = readNodeCardSize(node)
    maxCardWidth = Math.max(maxCardWidth, size.width)
    maxCardHeight = Math.max(maxCardHeight, size.height)
  }

  const origin = centers.length > 0
    ? {
        x: centers.reduce((sum, p) => sum + p.x, 0) / centers.length,
        y: centers.reduce((sum, p) => sum + p.y, 0) / centers.length,
      }
    : { x: 0, y: 0 }
  const grid = readSnapGridConfigFromSchema(schema)
  const gapX = grid.enabled ? Math.max(grid.x * 2, DEFAULT_GRID_GAP) : DEFAULT_GRID_GAP
  const gapY = grid.enabled ? Math.max(grid.y * 2, DEFAULT_GRID_GAP) : DEFAULT_GRID_GAP
  const cellWidth = grid.enabled ? ceilToStep(maxCardWidth + gapX, grid.x) : maxCardWidth + gapX
  const cellHeight = grid.enabled ? ceilToStep(maxCardHeight + gapY, grid.y) : maxCardHeight + gapY
  const visibleLanes = board.lanes
    .map(lane => ({ ...lane, cards: lane.cards.filter(card => nodeById.has(card.id)) }))
    .filter(lane => lane.cards.length > 0)
  const columnCount = Math.max(1, visibleLanes.length)
  const rowCount = Math.max(1, visibleLanes.reduce((max, lane) => Math.max(max, lane.cards.length), 0))
  const centerLaneOffset = (columnCount - 1) / 2
  const centerRowOffset = (rowCount - 1) / 2

  for (let laneIndex = 0; laneIndex < visibleLanes.length; laneIndex += 1) {
    const lane = visibleLanes[laneIndex]!
    for (let rowIndex = 0; rowIndex < lane.cards.length; rowIndex += 1) {
      const card = lane.cards[rowIndex]!
      const node = nodeById.get(card.id)
      const size = node ? readNodeCardSize(node) : { width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT }
      const rawCenter = {
        x: origin.x + (laneIndex - centerLaneOffset) * cellWidth,
        y: origin.y + (rowIndex - centerRowOffset) * cellHeight,
      }
      if (!grid.enabled) {
        out.set(card.id, rawCenter)
        continue
      }
      const snappedTopLeft = snapPointToGrid({
        x: rawCenter.x - size.width / 2,
        y: rawCenter.y - size.height / 2,
      }, grid)
      out.set(card.id, {
        x: snappedTopLeft.x + size.width / 2,
        y: snappedTopLeft.y + size.height / 2,
      })
    }
  }
  return out
}

export const applyFixedStoryboardCardPlacementsToGraphData2d = (args: {
  graphData: GraphData | null
  graphRevision: number
  schema: GraphSchema | null | undefined
}): GraphData | null => {
  const { graphData, graphRevision, schema } = args
  const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes as GraphNode[]) : []
  if (!graphData || nodes.length === 0) return graphData
  const board = buildStoryboardBoardModel({ graphData, graphRevision })
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (id) nodeById.set(id, node)
  }
  const placements = buildFixedStoryboardCardPlacements2d({ board, nodeById, schema })
  if (placements.size === 0) return graphData
  let changed = false
  const nextNodes = nodes.map(node => {
    const id = String(node?.id || '').trim()
    const placement = id ? placements.get(id) : null
    if (!placement) return node
    changed = true
    return {
      ...node,
      x: placement.x,
      y: placement.y,
      fx: placement.x,
      fy: placement.y,
      vx: 0,
      vy: 0,
    } as GraphNode
  })
  if (!changed) return graphData
  return {
    ...graphData,
    nodes: nextNodes,
  }
}

const buildCardRows = (card: StoryboardCardModel): string[] => {
  const primary = card.summary || card.output || card.action || card.prompt || ''
  const secondary = card.action && card.action !== primary ? card.action : card.prompt && card.prompt !== primary ? card.prompt : ''
  return [primary, secondary].filter(Boolean).slice(0, 2)
}

const resolveStoryboardCardPrimaryReferenceUrl = (card: Pick<StoryboardCardModel, 'href' | 'references'>): string => {
  const directHref = String(card.href || '').trim()
  if (directHref) return directHref
  for (const reference of card.references) {
    const url = String(reference?.url || '').trim()
    if (url) return url
  }
  return ''
}

const ignoreStoryboardCardAction = () => void 0

function StoryboardCardOverlayItem(props: {
  card: StoryboardCardModel
  node: GraphNode
  register: (id: string, el: HTMLElement | null) => void
  onCommitLane: (card: StoryboardCardModel, nextValue: string) => void
  onCommitSummary: (card: StoryboardCardModel, nextValue: string) => void
  onCommitTitle: (card: StoryboardCardModel, nextValue: string) => void
  onCommitType: (card: StoryboardCardModel, nextValue: string) => void
  onDuplicate: (card: StoryboardCardModel) => void
  onOpenInSidepane: (card: StoryboardCardModel) => void
  onRemove: (card: StoryboardCardModel) => void
  onSelect: (card: StoryboardCardModel) => void
  selected: boolean
}) {
  const { card, node, onCommitLane, onCommitSummary, onCommitTitle, onCommitType, onDuplicate, onOpenInSidepane, onRemove, onSelect, register, selected } = props
  const { width, height } = readNodeCardSize(node)
  const rows = buildCardRows(card)
  const mediaUrl = card.media?.url || card.media?.thumbnailUrl || ''
  const mediaPoster = card.media?.thumbnailUrl || undefined
  const toolbarProps = buildStoryboardToolbarProps({
    active: true,
    duplicateDisabled: false,
    primaryReferenceUrl: resolveStoryboardCardPrimaryReferenceUrl(card),
  })
  const toolbarActionBindings = buildStoryboardToolbarActionBindings({
    card,
    runCard: ignoreStoryboardCardAction,
    openCardInSidepane: onOpenInSidepane,
    duplicateCard: onDuplicate,
    clearCardOutput: ignoreStoryboardCardAction,
    showCardHelp: ignoreStoryboardCardAction,
    removeCard: onRemove,
    openCardWorkflowManagerMapping: ignoreStoryboardCardAction,
    convertCardToLoop: ignoreStoryboardCardAction,
  })
  return (
    <article
      ref={el => register(card.id, el)}
      aria-label={`Storyboard card ${card.title}`}
      className="pointer-events-auto absolute left-0 top-0 overflow-visible rounded-md border bg-[color:var(--kg-panel-bg)] text-[color:var(--kg-text-primary)] shadow-sm"
      data-kg-storyboard-fixed-card="1"
      data-kg-storyboard-fixed-card-id={card.id}
      data-kg-storyboard-fixed-card-lane={card.lane || 'Storyboard'}
      onClickCapture={() => onSelect(card)}
      onPointerDownCapture={() => onSelect(card)}
      style={{
        width,
        height,
        borderColor: 'var(--kg-border)',
        transformOrigin: '0 0',
      }}
    >
      <NodeOverlayEditorActionsToolbar
        visible={selected}
        {...toolbarProps}
        navClassName="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2"
        actionVisibility={{
          ...toolbarProps.actionVisibility,
          clearOutput: false,
          convertToLoop: false,
          help: false,
          run: false,
          updateKvEntry: false,
        }}
        {...toolbarActionBindings}
      />
      <section className="h-full overflow-hidden rounded-md">
        <header className="flex h-7 min-w-0 items-center gap-2 border-b px-2" style={{ borderColor: 'var(--kg-border)' }}>
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
        </header>
        <section className="grid h-[calc(100%-1.75rem)] min-h-0 grid-cols-[minmax(0,1fr)_5.25rem] gap-2 p-2" aria-label={`${card.title} storyboard card body`}>
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
          <figure className={cn('m-0 flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded border bg-[color:var(--kg-input-bg)]')} style={{ borderColor: 'var(--kg-border)' }}>
            {mediaUrl ? (
              <CardMediaPreview
                kind={card.media?.kind || null}
                url={mediaUrl}
                srcDoc={card.media?.srcDoc || undefined}
                title={card.title}
                href={card.href || card.media?.sourceUrl || mediaUrl}
                fit="cover"
                interactive={false}
                mediaThumbnailDataAttr
                mediaSelectableSurfaceDataAttr
                videoMuted
                videoPoster={mediaPoster}
              />
            ) : (
              <span className="text-[18px] font-semibold text-[color:var(--kg-text-tertiary)]">+</span>
            )}
          </figure>
        </section>
      </section>
    </article>
  )
}

export function StoryboardCardOverlayLayer2d(props: {
  active: boolean
  graphData: GraphData | null
  graphRevision: number
  getTransform: () => FlowEditorOverlayDragTransform | null
  schema: GraphSchema | null
}) {
  const { active, getTransform, graphData, graphRevision, schema } = props
  const strybldrStoryboardBoardLayoutMode = useGraphStore(s => s.strybldrStoryboardBoardLayoutMode)
  const updateNode = useGraphStore(s => s.updateNode)
  const addNode = useGraphStore(s => s.addNode)
  const addHistory = useGraphStore(s => s.addHistory)
  const removeNode = useGraphStore(s => s.removeNode)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectedNodeId = useGraphStore(s => String(s.selectedNodeId || '').trim())
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const updateOpenWidgetNodeIds = useGraphStore(s => s.updateOpenWidgetNodeIds)
  const fixedLayoutEnabled = strybldrStoryboardBoardLayoutMode === 'fixed'
  const [activeCardId, setActiveCardId] = React.useState('')
  const rootRef = React.useRef<HTMLElement | null>(null)
  const overlayElsRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const board = React.useMemo(
    () => buildStoryboardBoardModel({ graphData, graphRevision }),
    [graphData, graphRevision],
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
    () => board.lanes.flatMap(lane => lane.cards).filter(card => nodeById.has(card.id)),
    [board.lanes, nodeById],
  )
  const fixedCardPlacements = React.useMemo(
    () => fixedLayoutEnabled ? buildFixedStoryboardCardPlacements2d({ board, nodeById, schema }) : new Map<string, StoryboardCardPlacement>(),
    [board, fixedLayoutEnabled, nodeById, schema],
  )
  const register = React.useCallback((id: string, el: HTMLElement | null) => {
    const key = String(id || '').trim()
    if (!key) return
    if (el) overlayElsRef.current.set(key, el)
    else overlayElsRef.current.delete(key)
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
      let visibleCount = 0
      const pending: Array<{ card: StoryboardCardModel; el: HTMLElement; node: GraphNode; x: number; y: number; width: number; height: number }> = []
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i]!
        const node = nodeById.get(card.id)
        const el = overlayElsRef.current.get(card.id)
        if (!node || !el) continue
        const fixedPlacement = fixedCardPlacements.get(card.id)
        const nodeCenter = readNodeCenter(node)
        const x = fixedPlacement?.x ?? nodeCenter?.x ?? 0
        const y = fixedPlacement?.y ?? nodeCenter?.y ?? 0
        const { width, height } = readNodeCardSize(node)
        const currentBox = computeFlowEditorOverlayScreenBox({
          transform: currentTransform,
          centerWorld: { x, y },
          width,
          height,
        })
        if (isScreenBoxVisible(currentBox, { width, height }, viewport)) visibleCount += 1
        pending.push({ card, el, node, x, y, width, height })
      }
      const fittedTransform = visibleCount === 0
        ? computeStoryboardCardFitTransform({ cards, fixedCardPlacements, nodeById, viewport })
        : null
      const transform = fittedTransform || currentTransform
      for (let i = 0; i < pending.length; i += 1) {
        const { el, x, y, width, height } = pending[i]!
        const box = computeFlowEditorOverlayScreenBox({
          transform,
          centerWorld: { x, y },
          width,
          height,
        })
        el.style.transform = `translate3d(${box.left}px, ${box.top}px, 0) scale(${box.scale})`
        el.style.display = box.scale <= 0.02 ? 'none' : ''
      }
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [active, cards, fixedCardPlacements, getTransform, nodeById])

  if (!active || cards.length === 0) return null
  return (
    <section
      ref={rootRef}
      aria-label="Storyboard card overlay"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-kg-storyboard-fixed-card-grid={fixedLayoutEnabled ? '1' : '0'}
      data-kg-storyboard-fixed-card-layout={fixedLayoutEnabled ? 'fixed' : 'flex'}
      data-kg-storyboard-fixed-card-overlay="1"
      style={{ zIndex: STORYBOARD_CARD_OVERLAY_Z_INDEX }}
    >
      {cards.map(card => {
        const node = nodeById.get(card.id)
        if (!node) return null
        const selected = activeCardId === card.id || selectedNodeId === card.id || (Array.isArray(selectedNodeIds) && selectedNodeIds.some(id => String(id || '').trim() === card.id))
        return (
          <StoryboardCardOverlayItem
            key={card.id}
            card={card}
            node={node}
            onCommitLane={commitLane}
            onCommitSummary={commitSummary}
            onCommitTitle={commitTitle}
            onCommitType={commitType}
            onDuplicate={duplicateCard}
            onOpenInSidepane={openCardInSidepane}
            onRemove={removeCard}
            onSelect={selectCard}
            register={register}
            selected={selected}
          />
        )
      })}
    </section>
  )
}
