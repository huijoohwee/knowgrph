import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  Check,
  ExternalLink,
  FileText,
  GitBranch,
  Heart,
  Hash,
  Image as ImageIcon,
  Link2,
  Lock,
  MessageSquare,
  PanelsTopLeft,
  Sparkles,
  Video,
  Volume2,
  Wand2,
} from 'lucide-react'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { DataViewStatusChip, DataViewTagChip } from '@/features/markdown/ui/MarkdownDataViewChips'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import {
  buildStoryboardBoardModel,
  STORYBOARD_ACTION_PROPERTY_KEYS,
  STORYBOARD_DIALOGUE_PROPERTY_KEYS,
  STORYBOARD_EMPTY_LANE,
  STORYBOARD_OUTPUT_PROPERTY_KEYS,
  STORYBOARD_PROMPT_PROPERTY_KEYS,
  STORYBOARD_SUMMARY_PROPERTY_KEYS,
  buildStoryboardInlineMediaCommandContext,
  type StoryboardCardModel,
  type StoryboardCardReference,
} from '@/components/StoryboardCanvas/storyboardModel'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { useKanbanDragAndDrop } from '@/features/markdown/ui/kanban/useKanbanDragAndDrop'
import { reorderKanbanRowIds, type KanbanDropPosition } from '@/features/markdown/ui/kanban/kanbanReorder'
import { isKanbanMoveNoOp, buildKanbanDropOutcomeText } from '@/features/markdown/ui/kanban/kanbanMoveOutcomes'
import { buildKanbanCardDropIntentLabel, buildKanbanDragStatusText, buildKanbanLaneDropIntentLabel } from '@/features/markdown/ui/kanban/kanbanDragIntent'
import { getKanbanCardDragVisualState, getKanbanLaneDragVisualState } from '@/features/markdown/ui/kanban/kanbanDragVisualState'
import { KanbanCardDropPreview, KanbanLaneDropPreview } from '@/features/markdown/ui/kanban/KanbanDropPreview'
import { isInteractiveEventTarget } from '@/features/markdown/ui/kanban/kanbanMenu'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { buildCardParagraphEntries } from '@/lib/cards/cardParagraphs'
import { buildGraphNodeCanonicalTextPatch } from '@/lib/cards/graphNodeCardFields'
import {
  UI_RESPONSIVE_CARD_MULTILINE_EDITOR_CLASSNAME,
  UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME,
  UI_RESPONSIVE_KANBAN_LANE_CLASSNAME,
  UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME,
  UI_RESPONSIVE_STORYBOARD_FILTER_ACTION_CLASSNAME,
  UI_RESPONSIVE_STORYBOARD_INDEX_BADGE_CLASSNAME,
  UI_RESPONSIVE_STORYBOARD_REFERENCE_LINK_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import {
  createStrytreeCandidateRunAction,
  createStrytreeContinuationDraftAction,
  publishStrytreeCandidateAction,
  toggleStrytreeLikeAction,
  unlockStrytreeNodeAction,
} from '@/features/strybldr/strytreeWorkflow'
import { updateStrybldrStoryboardMarkdownCardOverride } from '@/features/strybldr/strybldrStoryboard'
import { writeActiveMarkdownDocumentTextIfPresent } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'

type StoryboardDisplayMedia = { kind: 'image' | 'svg' | 'video' | 'audio' | 'iframe'; url: string; srcDoc?: string }

type StoryboardRenderedEdge = {
  id: string
  sourceId: string
  targetId: string
  label: string
  d: string
}

type StoryboardEdgeLayer = {
  width: number
  height: number
  edges: StoryboardRenderedEdge[]
}

const STORYBOARD_RENDERED_EDGE_LABELS = new Set(['parent_node_id', 'rootBranch', 'candidateOption', 'candidateScorecard', 'publishedCandidate'])
const EMPTY_STORYBOARD_WIDGET_REGISTRY: WidgetRegistryEntry[] = []
const STORYBOARD_BRANCH_ACTION_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4'
const STORYBOARD_SCORECARD_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2'
const STORYBOARD_CANONICAL_TEXT_FIELDS = { summary: { propertyKeys: STORYBOARD_SUMMARY_PROPERTY_KEYS, canonicalKey: 'summary' }, output: { propertyKeys: STORYBOARD_OUTPUT_PROPERTY_KEYS, canonicalKey: 'output' }, action: { propertyKeys: STORYBOARD_ACTION_PROPERTY_KEYS, canonicalKey: 'action' }, dialogue: { propertyKeys: STORYBOARD_DIALOGUE_PROPERTY_KEYS, canonicalKey: 'dialogue' } } as const

const STORYTREE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'hot', label: 'Hot' },
  { id: 'active', label: 'Active' },
  { id: 'protected', label: 'Protected' },
  { id: 'draft', label: 'Draft' },
  { id: 'dropped', label: 'Dropped' },
] as const

function readStoryboardNodeProperties(node: unknown): Record<string, unknown> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return {}
  const properties = (node as { properties?: unknown }).properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {}
  return properties as Record<string, unknown>
}

function readStoryboardScalar(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function readStoryboardBool(value: unknown): boolean {
  return value === true || String(value || '').trim().toLowerCase() === 'true'
}

function shouldRenderStoryboardEdge(edge: unknown, label: string): boolean {
  if (STORYBOARD_RENDERED_EDGE_LABELS.has(label)) return true
  const properties = edge && typeof edge === 'object' && !Array.isArray(edge)
    ? (edge as { properties?: unknown }).properties
    : null
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return false
  return readStoryboardBool((properties as Record<string, unknown>).strybldrWorkflowEdge)
}

function storytreeCardMatchesFilter(card: StoryboardCardModel, props: Record<string, unknown>, filter: string): boolean {
  if (card.lane !== 'Storytree' || filter === 'all') return true
  const status = readStoryboardScalar(props.strytreeStatus || props.branchStatus).toLowerCase()
  const accessState = readStoryboardScalar(props.accessState).toLowerCase()
  if (filter === 'protected') return readStoryboardBool(props.unlockRequired) || accessState.includes('unlock') || readStoryboardBool(props.isProtected)
  return status === filter || accessState === filter
}

function StorytreeEdgeConnector(props: {
  sourceId: string
  sourceTitle: string
  targetId: string
  targetTitle: string
  label: string
  depth: number
}) {
  const indentPx = Math.min(Math.max(0, props.depth), 5) * 22
  const displayLabel = props.label === 'rootBranch' ? 'root' : 'parent'
  const sourceTitle = readMarkdownSigilDisplayText(props.sourceTitle)
  const targetTitle = readMarkdownSigilDisplayText(props.targetTitle)
  return (
    <section
      className="relative mb-2 flex min-h-8 items-center"
      style={{ paddingLeft: `${indentPx}px` }}
      aria-label={`Storytree edge ${sourceTitle} to ${targetTitle}`}
      data-kg-storytree-edge={props.label}
      data-kg-storytree-edge-source={props.sourceId}
      data-kg-storytree-edge-target={props.targetId}
    >
      <section className="pointer-events-none absolute bottom-0 top-0 w-px bg-black/15" style={{ left: `${indentPx + 8}px` }} aria-hidden="true" />
      <section className="pointer-events-none absolute h-px w-7 bg-black/15" style={{ left: `${indentPx + 8}px`, top: '50%' }} aria-hidden="true" />
      <span className="ml-8 inline-flex max-w-full items-center gap-1 rounded-full border border-black/10 bg-black/[0.025] px-2 py-1 text-[10px] text-black/55">
        <span className="h-1.5 w-1.5 rounded-full bg-black/35" aria-hidden="true" />
        <span className="truncate">{sourceTitle}</span>
        <span aria-hidden="true">to</span>
        <span className="truncate">{targetTitle}</span>
        <span className="rounded bg-black/5 px-1">{displayLabel}</span>
      </span>
    </section>
  )
}

function resolveStoryboardDisplayMedia(card: StoryboardCardModel): StoryboardDisplayMedia | null {
  if (card.media) return card.media
  const firstReference = card.references.find(reference => reference.kind !== 'link')
  if (!firstReference || firstReference.kind === 'link') return null
  return {
    kind: firstReference.kind,
    url: firstReference.url,
  }
}

function StoryboardMediaPreview(props: {
  title: string
  href: string
  media: StoryboardDisplayMedia | null
}) {
  const { title, href, media } = props
  const interactive = media?.kind === 'video' || media?.kind === 'audio' || media?.kind === 'iframe'
  return (
    <CardMediaPreview
      kind={media?.kind || null}
      url={media?.url || ''}
      srcDoc={media?.srcDoc || undefined}
      title={title}
      href={href}
      interactive={interactive}
      fit="cover"
      videoControls={interactive}
      iframeScriptPolicy="allow"
      mediaClassName="h-full w-full"
    />
  )
}

function StoryboardDetailRow(props: {
  icon: React.ReactNode
  label: string
  value: string
  canEdit?: boolean
  placeholder?: string
  markdownCommandContextText?: string
  onCommit?: (nextValue: string) => void
}) {
  const displayValue = readMarkdownSigilDisplayText(props.value)
  if (!displayValue && !props.canEdit) return null
  return (
    <section className="flex items-start gap-2 rounded-lg border border-black/5 bg-black/[0.025] px-2.5 py-2">
      <span className={['mt-0.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')}>{props.icon}</span>
      <section className="min-w-0 flex-1">
        <p className={['m-0 text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
          {props.label}
        </p>
        <CardInlineTextEditor
          value={props.value}
          ariaLabel={props.label}
          placeholder={props.placeholder || `Add ${props.label.toLowerCase()}`}
          canEdit={props.canEdit}
          multiline
          markdownPreview="auto"
          markdownCommandContextText={props.markdownCommandContextText}
          rows={3}
          onCommit={props.onCommit}
          displayClassName={['m-0 mt-1 text-xs leading-5', UI_THEME_TOKENS.text.secondary].join(' ')}
          editorClassName={`mt-1 ${UI_RESPONSIVE_CARD_MULTILINE_EDITOR_CLASSNAME} px-0 py-0 text-xs leading-5`}
        />
      </section>
    </section>
  )
}

function StoryboardReferenceStrip(props: {
  cardId: string
  references: StoryboardCardReference[]
}) {
  if (props.references.length === 0) return null
  const visible = props.references.slice(0, 3)
  return (
    <section className="rounded-lg border border-black/5 bg-black/[0.025] px-2.5 py-2" aria-label="Reference pack">
      <section className="mb-2 flex items-center justify-between gap-2">
        <section className="flex items-center gap-2">
          <ImageIcon className={['h-3.5 w-3.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')} aria-hidden="true" />
          <span className={['text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
            Reference Pack
          </span>
        </section>
        <span className={['inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {props.references.length}
        </span>
      </section>
      <section className="flex gap-2 overflow-x-auto pb-1">
        {visible.map((reference, index) => {
          const key = `${props.cardId}:reference:${index}`
          if (reference.kind === 'image' || reference.kind === 'svg') {
            return (
              <a
                key={key}
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-white"
                title={reference.url}
                draggable={false}
                onDragStart={event => {
                  event.preventDefault()
                }}
              >
                <CardMediaPreview
                  kind={reference.kind}
                  url={reference.url}
                  title="Reference"
                  href={reference.url}
                  interactive={false}
                  fit="cover"
                  className="h-full w-full"
                  mediaClassName="h-full w-full"
                />
              </a>
            )
          }
          return (
            <a
              key={key}
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              className={[UI_RESPONSIVE_STORYBOARD_REFERENCE_LINK_CLASSNAME, 'rounded-lg border px-2 text-center text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}
              title={reference.url}
              draggable={false}
              onDragStart={event => {
                event.preventDefault()
              }}
            >
              {reference.kind === 'video' ? 'Video ref' : 'Open ref'}
            </a>
          )
        })}
      </section>
    </section>
  )
}

export default function StoryboardCanvas({
  active = true,
}: {
  active?: boolean
}) {
  const graphData = useActiveGraphRenderData(active)
  const { graphRevision, selectedNodeId, selectNode, updateNode, setGraphDataPreservingLayout, setMarkdownDocument, addHistory, upsertUiToast, dismissUiToast, markdownDocumentName, markdownDocumentText, documentWidgetRegistry, effectiveWidgetRegistry, baseWidgetRegistry } = useGraphStore(
    useShallow(s => ({
      graphRevision: s.graphDataRevision || 0,
      selectedNodeId: String(s.selectedNodeId || '').trim(),
      selectNode: s.selectNode,
      updateNode: s.updateNode,
      setGraphDataPreservingLayout: s.setGraphDataPreservingLayout,
      setMarkdownDocument: s.setMarkdownDocument,
      addHistory: s.addHistory,
      upsertUiToast: s.upsertUiToast,
      dismissUiToast: s.dismissUiToast,
      markdownDocumentName: s.markdownDocumentName || null,
      markdownDocumentText: s.markdownDocumentText || null,
      documentWidgetRegistry: Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : EMPTY_STORYBOARD_WIDGET_REGISTRY,
      effectiveWidgetRegistry: Array.isArray(s.effectiveWidgetRegistry) ? s.effectiveWidgetRegistry : EMPTY_STORYBOARD_WIDGET_REGISTRY,
      baseWidgetRegistry: Array.isArray(s.widgetRegistry) ? s.widgetRegistry : EMPTY_STORYBOARD_WIDGET_REGISTRY,
    })),
  )
  const boardScrollRef = React.useRef<HTMLElement>(null)
  const laneScrollElementsRef = React.useRef(new Map<string, HTMLOListElement>())
  const cardElementsRef = React.useRef(new Map<string, HTMLElement>())
  const [storyboardEdgeLayer, setStoryboardEdgeLayer] = React.useState<StoryboardEdgeLayer>({ width: 0, height: 0, edges: [] })
  const [storytreeFilter, setStorytreeFilter] = React.useState<string>('all')
  const widgetRegistry = React.useMemo(() => buildDataflowWidgetRegistry({ documentWidgetRegistry, effectiveWidgetRegistry, widgetRegistry: baseWidgetRegistry }), [baseWidgetRegistry, documentWidgetRegistry, effectiveWidgetRegistry])
  const board = React.useMemo(() => buildStoryboardBoardModel({ graphData, graphRevision, widgetRegistry }), [graphData, graphRevision, widgetRegistry])
  const rowIdToLaneKey = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const lane of board.lanes) {
      for (const card of lane.cards) map.set(card.id, lane.id)
    }
    return map
  }, [board.lanes])
  const laneToRowIds = React.useMemo(() => {
    const map = new Map<string, readonly string[]>()
    for (const lane of board.lanes) {
      map.set(lane.id, lane.cards.map(card => card.id))
    }
    return map
  }, [board.lanes])
  const orderedCardIds = React.useMemo(() => board.lanes.flatMap(lane => lane.cards.map(card => card.id)), [board.lanes])
  const rowIdToOrder = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const lane of board.lanes) {
      for (const card of lane.cards) map.set(card.id, card.order)
    }
    return map
  }, [board.lanes])
  const cardById = React.useMemo(() => {
    const map = new Map<string, StoryboardCardModel>()
    for (const lane of board.lanes) {
      for (const card of lane.cards) map.set(card.id, card)
    }
    return map
  }, [board.lanes])
  const storytreeIncomingEdgeByCardId = React.useMemo(() => {
    const out = new Map<string, { sourceId: string; sourceTitle: string; label: string }>()
    const edges = Array.isArray(graphData?.edges) ? graphData.edges : []
    for (const edge of edges) {
      const label = readStoryboardScalar(edge?.label)
      if (label !== 'parent_node_id' && label !== 'rootBranch') continue
      const sourceId = readStoryboardScalar(edge?.source)
      const targetId = readStoryboardScalar(edge?.target)
      const sourceCard = cardById.get(sourceId)
      const targetCard = cardById.get(targetId)
      if (!sourceCard || !targetCard || targetCard.lane !== 'Storytree') continue
      out.set(targetId, {
        sourceId,
        sourceTitle: sourceCard.title,
        label,
      })
    }
    return out
  }, [cardById, graphData?.edges])
  const currentPropertiesByCardId = React.useMemo(() => {
    const map = new Map<string, Record<string, unknown>>()
    const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
    for (const node of nodes) {
      const id = String(node?.id || '').trim()
      if (!id) continue
      map.set(id, readStoryboardNodeProperties(node))
    }
    return map
  }, [graphData])
  const visibleLanes = React.useMemo(() => {
    return board.lanes.map(lane => {
      if (lane.id !== 'Storytree') return lane
      return {
        ...lane,
        cards: lane.cards.filter(card => storytreeCardMatchesFilter(card, currentPropertiesByCardId.get(card.id) || {}, storytreeFilter)),
      }
    })
  }, [board.lanes, currentPropertiesByCardId, storytreeFilter])
  const visibleCardIds = React.useMemo(() => visibleLanes.flatMap(lane => lane.cards.map(card => card.id)), [visibleLanes])
  const visibleCardKey = visibleCardIds.join('\u0000')
  const registerCardElement = React.useCallback((cardId: string, element: HTMLElement | null) => {
    if (element) {
      cardElementsRef.current.set(cardId, element)
      return
    }
    cardElementsRef.current.delete(cardId)
  }, [])

  React.useLayoutEffect(() => {
    const root = boardScrollRef.current
    if (!root) {
      setStoryboardEdgeLayer({ width: 0, height: 0, edges: [] })
      return
    }
    const visible = new Set(visibleCardIds)
    const graphEdges = Array.isArray(graphData?.edges) ? graphData.edges : []
    let frame = 0
    const buildLayer = () => {
      const rootRect = root.getBoundingClientRect()
      const width = Math.max(root.scrollWidth, root.clientWidth)
      const height = Math.max(root.scrollHeight, root.clientHeight)
      const edges: StoryboardRenderedEdge[] = []
      for (const edge of graphEdges) {
        const label = readStoryboardScalar(edge?.label)
        if (!shouldRenderStoryboardEdge(edge, label)) continue
        const sourceId = readStoryboardScalar(edge?.source)
        const targetId = readStoryboardScalar(edge?.target)
        if (!sourceId || !targetId || !visible.has(sourceId) || !visible.has(targetId)) continue
        const sourceEl = cardElementsRef.current.get(sourceId)
        const targetEl = cardElementsRef.current.get(targetId)
        if (!sourceEl || !targetEl) continue
        const sourceRect = sourceEl.getBoundingClientRect()
        const targetRect = targetEl.getBoundingClientRect()
        const sourceCenterX = sourceRect.left - rootRect.left + root.scrollLeft + sourceRect.width / 2
        const sourceCenterY = sourceRect.top - rootRect.top + root.scrollTop + sourceRect.height / 2
        const targetCenterX = targetRect.left - rootRect.left + root.scrollLeft + targetRect.width / 2
        const targetCenterY = targetRect.top - rootRect.top + root.scrollTop + targetRect.height / 2
        const crossLane = Math.abs(targetCenterX - sourceCenterX) > sourceRect.width * 0.45
        const sx = crossLane && targetCenterX >= sourceCenterX
          ? sourceRect.right - rootRect.left + root.scrollLeft - 10
          : sourceCenterX
        const sy = crossLane ? sourceCenterY : sourceRect.bottom - rootRect.top + root.scrollTop - 8
        const tx = crossLane && targetCenterX >= sourceCenterX
          ? targetRect.left - rootRect.left + root.scrollLeft + 10
          : targetCenterX
        const ty = crossLane ? targetCenterY : targetRect.top - rootRect.top + root.scrollTop + 8
        const dx = Math.max(40, Math.abs(tx - sx) * 0.5)
        const dy = Math.max(28, Math.abs(ty - sy) * 0.5)
        const d = crossLane
          ? `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${(sx + dx).toFixed(1)} ${sy.toFixed(1)} ${(tx - dx).toFixed(1)} ${ty.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`
          : `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${sx.toFixed(1)} ${(sy + dy).toFixed(1)} ${tx.toFixed(1)} ${(ty - dy).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`
        edges.push({
          id: `${sourceId}:${label}:${targetId}`,
          sourceId,
          targetId,
          label,
          d,
        })
      }
      setStoryboardEdgeLayer({ width, height, edges })
    }
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(buildLayer)
    }
    schedule()
    root.addEventListener('scroll', schedule, { passive: true })
    const laneScrollElements = Array.from(laneScrollElementsRef.current.values())
    for (const element of laneScrollElements) element.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const Observer = typeof ResizeObserver !== 'undefined' ? ResizeObserver : null
    const observer = Observer ? new Observer(schedule) : null
    observer?.observe(root)
    for (const cardId of visibleCardIds) {
      const element = cardElementsRef.current.get(cardId)
      if (element) observer?.observe(element)
    }
    return () => {
      if (frame) cancelAnimationFrame(frame)
      root.removeEventListener('scroll', schedule)
      for (const element of laneScrollElements) element.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [graphData?.edges, visibleCardIds, visibleCardKey])
  const commitStrytreeWorkflowResult = React.useCallback((args: {
    result: ReturnType<typeof toggleStrytreeLikeAction>
    history: string
  }) => {
    const { result } = args
    if (result.changed) {
      setGraphDataPreservingLayout(result.graphData)
      addHistory(args.history)
      if (result.createdNodeId) selectNode(result.createdNodeId)
    }
    upsertUiToast({
      id: `storytree:${args.history.toLowerCase().replace(/\s+/g, '-')}`,
      kind: result.kind,
      message: result.message,
      dismissible: result.kind !== 'success',
      ttlMs: result.kind === 'success' ? 2600 : null,
    })
  }, [addHistory, selectNode, setGraphDataPreservingLayout, upsertUiToast])
  const toggleStorytreeLike = React.useCallback((cardId: string) => {
    if (!graphData) return
    commitStrytreeWorkflowResult({
      result: toggleStrytreeLikeAction(graphData, cardId),
      history: 'Storytree like',
    })
  }, [commitStrytreeWorkflowResult, graphData])
  const unlockStorytreeBranch = React.useCallback((cardId: string) => {
    if (!graphData) return
    commitStrytreeWorkflowResult({
      result: unlockStrytreeNodeAction(graphData, cardId),
      history: 'Storytree unlock',
    })
  }, [commitStrytreeWorkflowResult, graphData])
  const draftStorytreeContinuation = React.useCallback((cardId: string, prompt: string) => {
    if (!graphData) return
    commitStrytreeWorkflowResult({
      result: createStrytreeContinuationDraftAction(graphData, cardId, { prompt }),
      history: 'Storytree continuation',
    })
  }, [commitStrytreeWorkflowResult, graphData])
  const compareStorytreeCandidates = React.useCallback((cardId: string) => {
    if (!graphData) return
    commitStrytreeWorkflowResult({
      result: createStrytreeCandidateRunAction(graphData, cardId),
      history: 'ForkCompare candidates',
    })
  }, [commitStrytreeWorkflowResult, graphData])
  const publishForkCompareCandidate = React.useCallback((cardId: string) => {
    if (!graphData) return
    commitStrytreeWorkflowResult({
      result: publishStrytreeCandidateAction(graphData, cardId),
      history: 'ForkCompare publish',
    })
  }, [commitStrytreeWorkflowResult, graphData])
  const updateStoryboardCanonicalProperty = React.useCallback((args: {
    cardId: string
    propertyKeys: readonly string[]
    canonicalKey: string
    nextValue: string
  }) => {
    const nextMarkdownText = updateStrybldrStoryboardMarkdownCardOverride({
      text: markdownDocumentText || '',
      nodeId: args.cardId,
      patch: { [args.canonicalKey]: args.nextValue },
    })
    if (nextMarkdownText && markdownDocumentName && nextMarkdownText !== markdownDocumentText) {
      setMarkdownDocument(markdownDocumentName, nextMarkdownText, { applyViewPreset: false })
      writeActiveMarkdownDocumentTextIfPresent({
        state: useGraphStore.getState(),
        sourceFiles: useGraphStore.getState().sourceFiles || [],
        text: nextMarkdownText,
        label: `Storyboard ${args.canonicalKey}`,
      })
      addHistory(`Storyboard ${args.canonicalKey}`)
      return
    }
    const currentProperties = currentPropertiesByCardId.get(args.cardId) || {}
    const nextProperties = buildGraphNodeCanonicalTextPatch({
      currentProperties,
      propertyKeys: args.propertyKeys,
      canonicalKey: args.canonicalKey,
      nextValue: args.nextValue,
    })
    if (graphData?.nodes?.some(node => readStoryboardScalar(node?.id) === args.cardId)) {
      setGraphDataPreservingLayout({
        ...graphData,
        nodes: graphData.nodes.map(node => (
          readStoryboardScalar(node?.id) === args.cardId
            ? { ...node, properties: nextProperties as never }
            : node
        )),
      })
      addHistory(`Storyboard ${args.canonicalKey}`)
      return
    }
    updateNode(args.cardId, { properties: nextProperties as never })
  }, [addHistory, currentPropertiesByCardId, graphData, markdownDocumentName, markdownDocumentText, setGraphDataPreservingLayout, setMarkdownDocument, updateNode])
  const updateStoryboardTitle = React.useCallback((cardId: string, nextValue: string) => {
    const label = String(nextValue || '').trim()
    const nextMarkdownText = updateStrybldrStoryboardMarkdownCardOverride({
      text: markdownDocumentText || '',
      nodeId: cardId,
      patch: { title: label },
    })
    if (nextMarkdownText && markdownDocumentName && nextMarkdownText !== markdownDocumentText) {
      setMarkdownDocument(markdownDocumentName, nextMarkdownText, { applyViewPreset: false })
      writeActiveMarkdownDocumentTextIfPresent({
        state: useGraphStore.getState(),
        sourceFiles: useGraphStore.getState().sourceFiles || [],
        text: nextMarkdownText,
        label: 'Storyboard title',
      })
      addHistory('Storyboard title')
      return
    }
    if (graphData?.nodes?.some(node => readStoryboardScalar(node?.id) === cardId)) {
      setGraphDataPreservingLayout({
        ...graphData,
        nodes: graphData.nodes.map(node => (
          readStoryboardScalar(node?.id) === cardId
            ? { ...node, label }
            : node
        )),
      })
      addHistory('Storyboard title')
      return
    }
    updateNode(cardId, { label })
  }, [addHistory, graphData, markdownDocumentName, markdownDocumentText, setGraphDataPreservingLayout, setMarkdownDocument, updateNode])
  const isStoryboardMoveNoOp = React.useCallback((move: {
    rowId: string
    sourceGroupKey: string
    targetGroupKey: string
    targetRowId: string | null
    position: KanbanDropPosition
  }): boolean => {
    const currentSourceGroupKey = rowIdToLaneKey.get(move.rowId) || move.sourceGroupKey || ''
    if (!currentSourceGroupKey) return false
    const nextOrderedRowIds = reorderKanbanRowIds({
      orderedRowIds: orderedCardIds,
      availableRowIds: orderedCardIds,
      rowIdToGroupKey: rowIdToLaneKey,
      draggedRowId: move.rowId,
      targetGroupKey: move.targetGroupKey,
      targetRowId: move.targetRowId,
      position: move.position,
    })
    const sameLane = currentSourceGroupKey === move.targetGroupKey
    const sameOrder =
      nextOrderedRowIds.length === orderedCardIds.length
      && nextOrderedRowIds.every((rowId, index) => rowId === orderedCardIds[index])
    if (sameLane && sameOrder) return true
    return isKanbanMoveNoOp({
      groupToRowIds: laneToRowIds,
      draggedRowId: move.rowId,
      sourceGroupKey: currentSourceGroupKey,
      targetGroupKey: move.targetGroupKey,
      targetRowId: move.targetRowId,
      position: move.position,
    })
  }, [laneToRowIds, orderedCardIds, rowIdToLaneKey])
  const storyboardDrag = useKanbanDragAndDrop({
    enabled: active && typeof updateNode === 'function' && board.totalCards > 0,
    getBoardScrollElement: () => boardScrollRef.current,
    getLaneScrollElement: groupKey => laneScrollElementsRef.current.get(groupKey) || null,
    isNoOpMove: isStoryboardMoveNoOp,
    buildOutcomeMessage: ({ kind, move, sourceGroupKey, blockedReason }) => buildKanbanDropOutcomeText({
      kind,
      sourceLaneLabel: sourceGroupKey || move?.sourceGroupKey || null,
      targetLaneLabel: move?.targetGroupKey || null,
      targetCardLabel: move?.targetRowId ? cardById.get(move.targetRowId)?.title || move.targetRowId : null,
      blockedReason,
    }),
    onCommitMove: move => {
      const orderedRowIds = reorderKanbanRowIds({
        orderedRowIds: orderedCardIds,
        availableRowIds: orderedCardIds,
        rowIdToGroupKey: rowIdToLaneKey,
        draggedRowId: move.rowId,
        targetGroupKey: move.targetGroupKey,
        targetRowId: move.targetRowId,
        position: move.position,
      })
      for (let index = 0; index < orderedRowIds.length; index += 1) {
        const cardId = orderedRowIds[index]
        const card = cardById.get(cardId)
        if (!card) continue
        const nextOrder = index + 1
        const currentOrder = rowIdToOrder.get(cardId) ?? card.order
        const currentProperties = currentPropertiesByCardId.get(cardId) || {}
        const nextLaneValue =
          cardId === move.rowId
            ? (move.targetGroupKey === STORYBOARD_EMPTY_LANE ? '' : move.targetGroupKey)
            : card.lane === STORYBOARD_EMPTY_LANE
              ? ''
              : card.lane
        const currentLaneValue = String(currentProperties[card.lanePropertyKey] ?? currentProperties.lane ?? card.lane).trim()
        if (cardId !== move.rowId && currentOrder === nextOrder) continue
        if (cardId === move.rowId && currentOrder === nextOrder && currentLaneValue === nextLaneValue) continue
        updateNode(card.id, {
          properties: {
            ...currentProperties,
            lane: nextLaneValue,
            [card.lanePropertyKey]: nextLaneValue,
            order: nextOrder,
          } as never,
        })
      }
    },
  })
  const laneCount = board.lanes.length
  const mediaCount = board.lanes.reduce((sum, lane) => sum + lane.cards.filter(card => card.media !== null).length, 0)
  const referenceCount = board.lanes.reduce((sum, lane) => sum + lane.cards.reduce((laneSum, card) => laneSum + card.references.length, 0), 0)
  const activeDragStatusText = buildKanbanDragStatusText({
    sourceLaneLabel: storyboardDrag.dragSourceGroupKey,
    targetLaneLabel: storyboardDrag.dragOverGroupKey,
    targetCardLabel: storyboardDrag.dragOverRowId ? cardById.get(storyboardDrag.dragOverRowId)?.title || storyboardDrag.dragOverRowId : null,
    position: storyboardDrag.dragOverPosition as KanbanDropPosition,
    isDragging: storyboardDrag.draggingRowId !== null,
  })
  const dragToastMessage = activeDragStatusText || storyboardDrag.dragOutcomeMessage

  React.useEffect(() => {
    const toastId = 'storyboard:drag-status'
    const message = String(dragToastMessage || '').trim()
    if (!message) {
      dismissUiToast(toastId)
      return
    }
    upsertUiToast({
      id: toastId,
      kind: activeDragStatusText ? 'neutral' : storyboardDrag.commitFlashRowId ? 'success' : 'neutral',
      message,
      ttlMs: activeDragStatusText ? null : 2200,
      dismissible: !activeDragStatusText,
      log: false,
    })
  }, [activeDragStatusText, dismissUiToast, dragToastMessage, storyboardDrag.commitFlashRowId, upsertUiToast])

  return (
    <section className={['relative flex h-full w-full flex-col overflow-hidden', UI_THEME_TOKENS.panel.bg].join(' ')} aria-label="Storyboard canvas">
      <header className={['flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3', UI_THEME_TOKENS.panel.border].join(' ')}>
        <section className="min-w-0">
          <section className="flex items-center gap-2">
            <PanelsTopLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <h2 className={['m-0 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>Storyboard</h2>
            <span className={['inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
              {board.totalCards}
            </span>
          </section>
          <p className={['m-0 mt-1 text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>
            Native storyboard board derived from the active graph and shaped with the shared kanban system.
          </p>
        </section>
        <section className="flex flex-wrap items-center gap-2">
          <span className={['inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
            <Hash className="h-3 w-3" aria-hidden="true" />
            {laneCount} lanes
          </span>
          <span className={['inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
            <ImageIcon className="h-3 w-3" aria-hidden="true" />
            {mediaCount} media
          </span>
          <span className={['inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
            <Link2 className="h-3 w-3" aria-hidden="true" />
            {referenceCount} refs
          </span>
          <span className={['hidden text-[10px] sm:inline font-mono', UI_THEME_TOKENS.text.tertiary].join(' ')} title={board.semanticKey}>
            {board.semanticKey ? board.semanticKey.slice(0, 10) : 'empty'}
          </span>
        </section>
      </header>

      {board.totalCards > 0 ? (
        <section ref={boardScrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden p-4" aria-label="Storyboard lanes">
          {storyboardEdgeLayer.edges.length > 0 ? (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-20 overflow-visible"
              width={storyboardEdgeLayer.width}
              height={storyboardEdgeLayer.height}
              viewBox={`0 0 ${storyboardEdgeLayer.width} ${storyboardEdgeLayer.height}`}
              aria-hidden="true"
              data-kg-storyboard-canvas-edge-layer="1"
            >
              <defs>
                <marker id="kg-storyboard-edge-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="rgba(17, 24, 39, 0.32)" />
                </marker>
              </defs>
              {storyboardEdgeLayer.edges.map(edge => (
                <path
                  key={edge.id}
                  d={edge.d}
                  fill="none"
                  stroke={edge.label === 'candidateOption' || edge.label === 'candidateScorecard' ? 'rgba(20, 83, 45, 0.34)' : 'rgba(17, 24, 39, 0.28)'}
                  strokeWidth={edge.label === 'publishedCandidate' ? 2.5 : 1.75}
                  strokeDasharray={edge.label === 'candidateOption' || edge.label === 'candidateScorecard' ? '6 5' : undefined}
                  markerEnd="url(#kg-storyboard-edge-arrow)"
                  data-kg-storyboard-canvas-edge={edge.label}
                  data-kg-storyboard-canvas-edge-source={edge.sourceId}
                  data-kg-storyboard-canvas-edge-target={edge.targetId}
                />
              ))}
            </svg>
          ) : null}
          <section className="relative z-10 flex h-full min-w-fit items-start gap-4">
            {visibleLanes.map(lane => (
              (() => {
                const laneDropProps = storyboardDrag.createLaneDropProps(lane.id)
                return (
              <section
                key={lane.id}
                className={[
                  'flex h-full shrink-0 flex-col overflow-hidden rounded-2xl border shadow-sm',
                  UI_RESPONSIVE_KANBAN_LANE_CLASSNAME,
                  getKanbanLaneDragVisualState({
                    hasActiveDrag: storyboardDrag.draggingRowId !== null,
                    isDragOver: storyboardDrag.dragOverGroupKey === lane.id && storyboardDrag.dragSourceGroupKey !== lane.id,
                    isSourceLane: storyboardDrag.dragSourceGroupKey === lane.id,
                    isCommitFlash: storyboardDrag.commitFlashGroupKey === lane.id,
                  }).className,
                  UI_THEME_TOKENS.panel.border,
                  UI_THEME_TOKENS.kanban.groupBg,
                ].join(' ')}
                style={getKanbanLaneDragVisualState({
                  hasActiveDrag: storyboardDrag.draggingRowId !== null,
                  isDragOver: storyboardDrag.dragOverGroupKey === lane.id && storyboardDrag.dragSourceGroupKey !== lane.id,
                  isSourceLane: storyboardDrag.dragSourceGroupKey === lane.id,
                  isCommitFlash: storyboardDrag.commitFlashGroupKey === lane.id,
                }).style}
                aria-label={`Storyboard lane ${readMarkdownSigilDisplayText(lane.label)}`}
                {...laneDropProps}
              >
                <header className={['sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-3 backdrop-blur-sm', UI_THEME_TOKENS.panel.divider, UI_THEME_TOKENS.kanban.groupBg].join(' ')}>
                  <section className="min-w-0">
                    <h3 className={['m-0 text-sm font-medium truncate', UI_THEME_TOKENS.text.primary].join(' ')} title={readMarkdownSigilDisplayText(lane.label)}>
                      {renderMarkdownSigilInlineText(lane.label)}
                    </h3>
                    <p className={['m-0 mt-1 text-[11px]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                      {lane.cards.length} storyboard cards
                    </p>
                  </section>
                  <span className={['inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
                    {lane.cards.length}
                  </span>
                </header>
                {lane.id === 'Storytree' ? (
                  <section className={['flex gap-1 overflow-x-auto border-b px-3 py-2', UI_THEME_TOKENS.panel.divider].join(' ')} aria-label="Storytree filters">
                    {STORYTREE_FILTERS.map(filter => (
                      <button
                        key={filter.id}
                        type="button"
                        className={[
                          UI_RESPONSIVE_STORYBOARD_FILTER_ACTION_CLASSNAME,
                          'inline-flex shrink-0 items-center gap-1 rounded border text-[11px]',
                          filter.id === storytreeFilter ? 'border-black/30 bg-black/10 text-black' : [UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary].join(' '),
                        ].join(' ')}
                        aria-pressed={filter.id === storytreeFilter}
                        aria-label={`Storytree filter ${filter.label}`}
                        onClick={event => {
                          event.stopPropagation()
                          setStorytreeFilter(filter.id)
                        }}
                      >
                        <Hash className="h-3 w-3" aria-hidden="true" />
                        {filter.label}
                      </button>
                    ))}
                  </section>
                ) : null}

                <ol
                  ref={element => {
                    if (element) {
                      laneScrollElementsRef.current.set(lane.id, element)
                      return
                    }
                    laneScrollElementsRef.current.delete(lane.id)
                  }}
                  className="flex-1 space-y-3 overflow-y-auto p-3 list-none m-0"
                  aria-label={`${readMarkdownSigilDisplayText(lane.label)} cards`}
                  {...laneDropProps}
                >
                  {lane.cards.map((card, cardIndex) => {
                    const selected = selectedNodeId === card.id
                    const displayTitle = readMarkdownSigilDisplayText(card.title)
                    const displayIndex = card.indexLabel || String(cardIndex + 1)
                    const displayMedia = resolveStoryboardDisplayMedia(card)
                    const storyboardCommandContextText = buildStoryboardInlineMediaCommandContext(card)
                    const cardParagraphEntries = buildCardParagraphEntries([
                      { id: 'summary', label: 'Summary', value: card.summary },
                      { id: 'output', label: 'Output', value: card.output },
                      { id: 'action', label: 'Action', value: card.action },
                      { id: 'dialogue', label: 'Dialogue', value: card.dialogue },
                    ])
                    const summaryEntry = cardParagraphEntries.find(entry => entry.id === 'summary') || null
                    const outputEntry = cardParagraphEntries.find(entry => entry.id === 'output') || null
                    const canEditCard = typeof updateNode === 'function'
                    const commitCardProperty = (fieldId: keyof typeof STORYBOARD_CANONICAL_TEXT_FIELDS) => (nextValue: string) => {
                      const field = STORYBOARD_CANONICAL_TEXT_FIELDS[fieldId]
                      updateStoryboardCanonicalProperty({
                        cardId: card.id,
                        propertyKeys: field.propertyKeys,
                        canonicalKey: field.canonicalKey,
                        nextValue,
                      })
                    }
                    const detailRows = [
                      { fieldId: 'output', icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" />, label: 'Output', value: card.output || outputEntry?.value || '' },
                      { fieldId: 'action', icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" />, label: 'Action', value: card.action },
                      { fieldId: 'dialogue', icon: <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />, label: 'Dialogue', value: card.dialogue },
                    ] as const
                    const cardDragProps = storyboardDrag.createCardDragProps({ rowId: card.id, groupKey: lane.id })
                    const cardDragVisualState = getKanbanCardDragVisualState({
                      hasActiveDrag: storyboardDrag.draggingRowId !== null,
                      isDragging: storyboardDrag.draggingRowId === card.id,
                      isDropTarget: storyboardDrag.dragOverRowId === card.id,
                      isCommitFlash: storyboardDrag.commitFlashRowId === card.id,
                    })
                    const currentCardProperties = currentPropertiesByCardId.get(card.id) || {}
                    const isStorytreeBranch = card.lane === 'Storytree' && !!readStoryboardScalar(currentCardProperties.strytreeNodeId)
                    const isForkCompareCandidate = card.lane === 'ForkCompare' && !!readStoryboardScalar(currentCardProperties.strytreeCandidateId)
                    const storytreeDepth = Math.max(0, Number(currentCardProperties.depth || 0))
                    const storytreeIncomingEdge = isStorytreeBranch ? storytreeIncomingEdgeByCardId.get(card.id) || null : null
                    const likedByCurrentUser = readStoryboardBool(currentCardProperties.likedByCurrentUser)
                    const unlockRequired = readStoryboardBool(currentCardProperties.unlockRequired)
                    const canUnlock = currentCardProperties.canUnlock !== false && readStoryboardScalar(currentCardProperties.accessState) !== 'unlock-needs-credits'
                    const accessState = readStoryboardScalar(currentCardProperties.accessState) || 'open'
                    const unlockPriceCredits = Number(currentCardProperties.unlockPriceCredits || 0)
                    const storytreeStatus = readStoryboardScalar(currentCardProperties.strytreeStatus || currentCardProperties.branchStatus)
                    const candidateStatus = readStoryboardScalar(currentCardProperties.candidateStatus || currentCardProperties.status)
                    const candidateProvider = readStoryboardScalar(currentCardProperties.provider) || 'local-harness'
                    const candidateModeration = readStoryboardScalar(currentCardProperties.moderationStatus) || 'pending'
                    const candidateFallback = readStoryboardScalar(currentCardProperties.fallbackStatus) || 'none'
                    const candidateContinuity = Number(currentCardProperties.continuityScore || 0)
                    const candidateCreditCost = Number(currentCardProperties.creditCost || 0)
                    const candidateElapsedMs = Number(currentCardProperties.elapsedMs || 0)
                    const candidatePublishEligible = readStoryboardBool(currentCardProperties.publishEligible)
                    return (
                      <li
                        key={card.id}
                        className="relative list-none"
                        style={isStorytreeBranch ? { paddingLeft: `${Math.min(storytreeDepth, 5) * 14}px` } : undefined}
                      >
                        {storytreeIncomingEdge ? (
                          <StorytreeEdgeConnector
                            sourceId={storytreeIncomingEdge.sourceId}
                            sourceTitle={storytreeIncomingEdge.sourceTitle}
                            targetId={card.id}
                            targetTitle={card.title}
                            label={storytreeIncomingEdge.label}
                            depth={storytreeDepth}
                          />
                        ) : null}
                        <article
                          className={[
                            'group overflow-hidden rounded-2xl border bg-white shadow-sm transition-transform duration-150 select-none',
                            UI_THEME_TOKENS.kanban.cardHoverBg,
                            selected ? 'border-black/30 ring-1 ring-black/10' : UI_THEME_TOKENS.panel.border,
                            isStorytreeBranch ? 'border-l-4 border-l-black/20' : '',
                            isForkCompareCandidate ? 'border-l-4 border-l-emerald-700/35' : '',
                            cardDragVisualState.className,
                            'hover:-translate-y-[1px]',
                          ].join(' ')}
                          style={cardDragVisualState.style}
                          ref={element => {
                            storyboardDrag.registerFocusableRowElement({
                              rowId: card.id,
                              element,
                            })
                            registerCardElement(card.id, element)
                          }}
                          tabIndex={0}
                          role="button"
                          aria-pressed={selected}
                          aria-grabbed={cardDragProps.draggable ? storyboardDrag.draggingRowId === card.id : undefined}
                          aria-label={`Select storyboard card ${displayTitle}`}
                          {...storyboardDrag.createCardDropProps({ rowId: card.id, groupKey: lane.id })}
                          draggable={cardDragProps.draggable}
                          onDragStart={cardDragProps.onDragStart}
                          onDragEnd={cardDragProps.onDragEnd}
                          onClick={event => {
                            if (isInteractiveEventTarget(event.target)) return
                            selectNode(card.id)
                          }}
                          onKeyDown={event => {
                            if (isInteractiveEventTarget(event.target)) return
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              selectNode(card.id)
                            }
                          }}
                        >
                          {storyboardDrag.dragOverRowId === card.id ? (
                            <KanbanCardDropPreview
                              position={storyboardDrag.dragOverPosition as KanbanDropPosition}
                              label={buildKanbanCardDropIntentLabel({
                                position: storyboardDrag.dragOverPosition as KanbanDropPosition,
                                targetCardLabel: card.title,
                                targetLaneLabel: lane.label,
                              })}
                            />
                          ) : null}
                          <section className="block w-full cursor-pointer text-left">
                            <section
                              data-kg-kanban-card-drag-region="1"
                              className="border-b border-black/5 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none"
                            >
                              <section className="flex items-start justify-between gap-3">
                                <section className="min-w-0 flex-1">
                                  <section className="mb-2 flex items-center gap-2">
                                    <span className={`${UI_RESPONSIVE_STORYBOARD_INDEX_BADGE_CLASSNAME} inline-flex items-center justify-center rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-[10px] font-semibold text-black/70`}>
                                      {displayIndex}
                                    </span>
                                    <DataViewTagChip value={card.typeLabel} />
                                    <DataViewStatusChip value={card.lane} checked={selected} hideIcon />
                                  </section>
                                  <CardInlineTextEditor
                                    value={card.title}
                                    ariaLabel={`Storyboard title for ${card.id}`}
                                    placeholder="Add title"
                                    canEdit={canEditCard}
                                    onCommit={nextValue => {
                                      updateStoryboardTitle(card.id, nextValue)
                                    }}
                                    displayClassName={['m-0 truncate text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}
                                    editorClassName={`${UI_RESPONSIVE_CARD_TITLE_EDITOR_CLASSNAME} px-0 py-0 text-sm font-semibold leading-5`}
                                  />
                                  {card.slugline ? (
                                    <p className={['m-0 mt-1 text-[11px] uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                      {renderMarkdownSigilInlineText(card.slugline)}
                                    </p>
                                  ) : null}
                                </section>
                                {displayMedia?.kind === 'video' ? (
                                  <Video className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                                ) : displayMedia?.kind === 'audio' ? (
                                  <Volume2 className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                                ) : displayMedia ? (
                                  <ImageIcon className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                                ) : null}
                              </section>
                            </section>

                            <section
                              data-kg-kanban-card-drag-region="1"
                              className={['aspect-[16/9] overflow-hidden border-b border-black/5 cursor-grab active:cursor-grabbing select-none', selected ? 'bg-black/10' : 'bg-black/5'].join(' ')}
                            >
                              <StoryboardMediaPreview title={displayTitle} href={card.href} media={displayMedia} />
                            </section>

                            <section
                              data-kg-kanban-card-drag-region="1"
                              className="space-y-3 px-3 py-3 cursor-grab active:cursor-grabbing select-none"
                            >
                              {summaryEntry || canEditCard ? (
                                <section>
                                  <p className={['m-0 text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                    {summaryEntry?.label || 'Summary'}
                                  </p>
                                  <CardInlineTextEditor
                                    value={summaryEntry?.value || ''}
                                    ariaLabel={`Summary for ${card.id}`}
                                    placeholder="Add summary"
                                    canEdit={canEditCard}
                                    multiline
                                    markdownPreview="auto"
                                    markdownCommandContextText={storyboardCommandContextText}
                                    rows={3}
                                    onCommit={commitCardProperty('summary')}
                                    displayClassName={['m-0 mt-1 text-xs leading-5', UI_THEME_TOKENS.text.secondary].join(' ')}
                                    editorClassName={`mt-1 ${UI_RESPONSIVE_CARD_MULTILINE_EDITOR_CLASSNAME} px-0 py-0 text-xs leading-5`}
                                  />
                                </section>
                              ) : null}

                              {detailRows.map(row => (
                                <StoryboardDetailRow
                                  key={row.fieldId}
                                  icon={row.icon}
                                  label={row.label}
                                  value={row.value}
                                  canEdit={canEditCard}
                                  onCommit={commitCardProperty(row.fieldId)}
                                  markdownCommandContextText={storyboardCommandContextText}
                                />
                              ))}

                              {isStorytreeBranch ? (
                                <section className="rounded-xl border border-black/5 bg-black/[0.025] p-2.5" aria-label="Storytree workflow">
                                  <section className="mb-2 flex flex-wrap items-center gap-1">
                                    <DataViewTagChip value={storytreeStatus || 'storytree'} />
                                    <DataViewTagChip value={accessState} />
                                    {Number.isFinite(unlockPriceCredits) && unlockPriceCredits > 0 ? <DataViewTagChip value={`${unlockPriceCredits} credits`} /> : null}
                                  </section>
                                  <section className={STORYBOARD_BRANCH_ACTION_GRID_CLASS_NAME}>
                                    <button
                                      type="button"
                                      className={[UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME, 'inline-flex items-center justify-center gap-1 rounded border text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary].join(' ')}
                                      aria-label={`${likedByCurrentUser ? 'Unlike' : 'Like'} storytree branch ${displayTitle}`}
                                      onClick={event => {
                                        event.stopPropagation()
                                        toggleStorytreeLike(card.id)
                                      }}
                                    >
                                      <Heart className="h-3.5 w-3.5" aria-hidden="true" fill={likedByCurrentUser ? 'currentColor' : 'none'} />
                                      {likedByCurrentUser ? 'Liked' : 'Like'}
                                    </button>
                                    <button
                                      type="button"
                                      className={[UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME, 'inline-flex items-center justify-center gap-1 rounded border text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary].join(' ')}
                                      aria-label={`Compare storytree candidates from ${displayTitle}`}
                                      disabled={storytreeStatus === 'dropped'}
                                      onClick={event => {
                                        event.stopPropagation()
                                        compareStorytreeCandidates(card.id)
                                      }}
                                    >
                                      <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                                      Compare
                                    </button>
                                    <button
                                      type="button"
                                      className={[UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME, 'inline-flex items-center justify-center gap-1 rounded border text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary].join(' ')}
                                      aria-label={`Unlock storytree branch ${displayTitle}`}
                                      disabled={!unlockRequired || !canUnlock}
                                      onClick={event => {
                                        event.stopPropagation()
                                        unlockStorytreeBranch(card.id)
                                      }}
                                    >
                                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                      {unlockRequired ? 'Unlock' : 'Open'}
                                    </button>
                                    <button
                                      type="button"
                                      className={[UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME, 'inline-flex items-center justify-center gap-1 rounded border text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary].join(' ')}
                                      aria-label={`Draft storytree continuation from ${displayTitle}`}
                                      disabled={storytreeStatus === 'dropped'}
                                      onClick={event => {
                                        event.stopPropagation()
                                        draftStorytreeContinuation(card.id, card.prompt)
                                      }}
                                    >
                                      <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      Draft
                                    </button>
                                  </section>
                                </section>
                              ) : null}

                              {isForkCompareCandidate ? (
                                <section className="rounded-xl border border-emerald-900/10 bg-emerald-50/40 p-2.5" aria-label="ForkCompare scorecard">
                                  <section className="mb-2 flex flex-wrap items-center gap-1">
                                    <DataViewTagChip value={candidateStatus || 'candidate'} />
                                    <DataViewTagChip value={candidateModeration} />
                                    <DataViewTagChip value={`${Math.round(Math.max(0, Math.min(1, candidateContinuity)) * 100)}% continuity`} />
                                  </section>
                                  <section className={STORYBOARD_SCORECARD_GRID_CLASS_NAME}>
                                    <span className={['rounded border px-2 py-1', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}>
                                      {candidateCreditCost} credits
                                    </span>
                                    <span className={['rounded border px-2 py-1', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}>
                                      {Math.max(0, Math.round(candidateElapsedMs / 1000))}s
                                    </span>
                                    <span className={['rounded border px-2 py-1', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}>
                                      {candidateProvider}
                                    </span>
                                    <span className={['rounded border px-2 py-1', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}>
                                      {candidateFallback}
                                    </span>
                                  </section>
                                  <button
                                    type="button"
                                    className={[
                                      UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME,
                                      'mt-2 inline-flex w-full items-center justify-center gap-1 rounded border text-[11px]',
                                      candidatePublishEligible ? 'border-emerald-900/20 bg-emerald-700/10 text-emerald-950 hover:bg-emerald-700/15' : [UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.tertiary].join(' '),
                                    ].join(' ')}
                                    aria-label={`Publish ForkCompare candidate ${displayTitle}`}
                                    disabled={!candidatePublishEligible}
                                    onClick={event => {
                                      event.stopPropagation()
                                      publishForkCompareCandidate(card.id)
                                    }}
                                  >
                                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                    Publish selected
                                  </button>
                                </section>
                              ) : null}

                              {card.prompt || card.style || card.references.length > 0 ? (
                                <section className="rounded-xl border border-black/5 bg-black/[0.025] p-2.5" aria-label="Visual brief">
                                  <section className="flex items-center justify-between gap-2">
                                    <section className="flex items-center gap-2">
                                      <Sparkles className={['h-3.5 w-3.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')} aria-hidden="true" />
                                      <span className={['text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                        Visual Brief
                                      </span>
                                    </section>
                                    {card.style ? <DataViewTagChip value={card.style} /> : null}
                                  </section>
                                  {card.prompt ? (
                                    <CardInlineTextEditor
                                      value={card.prompt}
                                      ariaLabel={`Visual brief for ${card.id}`}
                                      placeholder="Add visual brief"
                                      canEdit={typeof updateNode === 'function'}
                                      multiline
                                      markdownPreview="auto"
                                      markdownCommandContextText={storyboardCommandContextText}
                                      rows={3}
                                      onCommit={nextValue => {
                                        updateStoryboardCanonicalProperty({
                                          cardId: card.id,
                                          propertyKeys: STORYBOARD_PROMPT_PROPERTY_KEYS,
                                          canonicalKey: 'prompt',
                                          nextValue,
                                        })
                                      }}
                                      displayClassName={['m-0 mt-2 text-xs leading-5', UI_THEME_TOKENS.text.secondary].join(' ')}
                                      editorClassName={`mt-2 ${UI_RESPONSIVE_CARD_MULTILINE_EDITOR_CLASSNAME} px-0 py-0 text-xs leading-5`}
                                    />
                                  ) : null}
                                  <section className="mt-2 flex items-center gap-2">
                                    {card.references.length > 0 ? (
                                      <span className={['inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
                                        <ImageIcon className="h-3 w-3" aria-hidden="true" />
                                        {card.references.length} refs
                                      </span>
                                    ) : null}
                                    {card.href ? (
                                      <a
                                        href={card.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={['inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}
                                        draggable={false}
                                        onClick={event => {
                                          event.stopPropagation()
                                        }}
                                        onDragStart={event => {
                                          event.preventDefault()
                                        }}
                                        title={card.href}
                                      >
                                        <Wand2 className="h-3 w-3" aria-hidden="true" />
                                        Open brief
                                      </a>
                                    ) : null}
                                  </section>
                                </section>
                              ) : null}

                              <StoryboardReferenceStrip cardId={card.id} references={card.references} />

                              {card.tags.length > 0 ? (
                                <section className="flex flex-wrap gap-1">
                                  {card.tags.slice(0, 4).map(tag => (
                                    <DataViewTagChip key={`${card.id}:tag:${tag}`} value={tag} />
                                  ))}
                                </section>
                              ) : null}

                              {card.meta.length > 0 ? (
                                <section className={['flex flex-wrap gap-1 text-[11px]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                  {card.meta.map(item => (
                                    <span key={`${card.id}:meta:${item}`} className={['rounded px-2 py-1', UI_THEME_TOKENS.badge.chip].join(' ')}>
                                      {item}
                                    </span>
                                  ))}
                                </section>
                              ) : null}

                              {card.href ? (
                                <section className="flex items-center justify-end">
                                  <a
                                    href={card.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={['inline-flex max-w-full items-center gap-1 text-xs underline underline-offset-2', UI_THEME_TOKENS.text.secondary].join(' ')}
                                    draggable={false}
                                    onClick={event => {
                                      event.stopPropagation()
                                    }}
                                    onDragStart={event => {
                                      event.preventDefault()
                                    }}
                                    title={card.href}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span className="truncate">Open source</span>
                                  </a>
                                </section>
                              ) : null}
                            </section>
                          </section>
                        </article>
                      </li>
                    )
                  })}
                  {storyboardDrag.draggingRowId !== null && storyboardDrag.dragOverGroupKey === lane.id && storyboardDrag.dragOverRowId == null ? (
                    <li className="list-none">
                      <KanbanLaneDropPreview label={buildKanbanLaneDropIntentLabel({ targetLaneLabel: lane.label })} compact />
                    </li>
                  ) : null}
                </ol>
              </section>
                )
              })()
            ))}
          </section>
        </section>
      ) : (
        <section className="flex flex-1 items-center justify-center p-6" aria-label="Storyboard empty state">
          <section className="max-w-md text-center">
            <PanelsTopLeft className="mx-auto h-8 w-8" aria-hidden="true" />
            <h3 className={['mb-2 mt-3 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>No storyboard cards yet</h3>
            <p className={['m-0 text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>
              Add scene-like nodes, stage fields, summaries, script beats, prompts, or media references to project the active graph into storyboard lanes.
            </p>
          </section>
        </section>
      )}
    </section>
  )
}
