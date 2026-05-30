import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ExternalLink,
  FileText,
  Hash,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  PanelsTopLeft,
  Sparkles,
  Video,
  Wand2,
} from 'lucide-react'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { DataViewStatusChip, DataViewTagChip } from '@/features/markdown/ui/MarkdownDataViewChips'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import {
  buildStoryboardBoardModel,
  STORYBOARD_ACTION_PROPERTY_KEYS,
  STORYBOARD_DIALOGUE_PROPERTY_KEYS,
  STORYBOARD_EMPTY_LANE,
  STORYBOARD_PROMPT_PROPERTY_KEYS,
  STORYBOARD_SUMMARY_PROPERTY_KEYS,
  type StoryboardCardModel,
  type StoryboardCardReference,
} from '@/components/StoryboardCanvas/storyboardModel'
import { useKanbanDragAndDrop } from '@/features/markdown/ui/kanban/useKanbanDragAndDrop'
import { reorderKanbanRowIds, type KanbanDropPosition } from '@/features/markdown/ui/kanban/kanbanReorder'
import { isKanbanMoveNoOp, buildKanbanDropOutcomeText } from '@/features/markdown/ui/kanban/kanbanMoveOutcomes'
import { buildKanbanCardDropIntentLabel, buildKanbanDragStatusText, buildKanbanLaneDropIntentLabel } from '@/features/markdown/ui/kanban/kanbanDragIntent'
import { getKanbanCardDragVisualState, getKanbanLaneDragVisualState } from '@/features/markdown/ui/kanban/kanbanDragVisualState'
import { KanbanCardDropPreview, KanbanLaneDropPreview } from '@/features/markdown/ui/kanban/KanbanDropPreview'
import { isInteractiveEventTarget } from '@/features/markdown/ui/kanban/kanbanMenu'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { buildCardParagraphEntries } from '@/lib/cards/cardParagraphs'
import { buildGraphNodeCanonicalTextPatch } from '@/lib/cards/graphNodeCardFields'
import { resolveIframeEmbed } from 'grph-shared/rich-media/iframe'

type StoryboardDisplayMedia = {
  kind: 'image' | 'svg' | 'video' | 'iframe'
  url: string
}

function readStoryboardNodeProperties(node: unknown): Record<string, unknown> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return {}
  const properties = (node as { properties?: unknown }).properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {}
  return properties as Record<string, unknown>
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
  if (media?.kind === 'image' || media?.kind === 'svg') {
    return (
      <img
        src={media.url}
        alt={title}
        className="pointer-events-none h-full w-full select-none object-cover"
        loading="lazy"
        draggable={false}
      />
    )
  }
  if (media?.kind === 'video') {
    return (
      <video
        src={media.url}
        className="pointer-events-none h-full w-full select-none object-cover"
        muted
        playsInline
        preload="metadata"
        draggable={false}
      />
    )
  }
  if (media?.kind === 'iframe') {
    const embed = resolveIframeEmbed({ url: media.url, scriptPolicy: 'allow' })
    return (
      <iframe
        src={embed.iframeSrc}
        title={title}
        className="pointer-events-none h-full w-full select-none border-0"
        allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox={embed.sandbox}
        referrerPolicy={embed.direct ? 'strict-origin-when-cross-origin' : 'no-referrer'}
        loading="lazy"
        data-kg-storyboard-media-iframe="1"
      />
    )
  }
  return (
    <div className={['flex h-full w-full items-center justify-center gap-2 text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>
      {href ? <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span className="truncate">{href ? 'Open reference' : 'No preview'}</span>
    </div>
  )
}

function StoryboardDetailRow(props: {
  icon: React.ReactNode
  label: string
  value: string
  canEdit?: boolean
  placeholder?: string
  onCommit?: (nextValue: string) => void
}) {
  const displayValue = readMarkdownSigilDisplayText(props.value)
  if (!displayValue && !props.canEdit) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-black/5 bg-black/[0.025] px-2.5 py-2">
      <span className={['mt-0.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')}>{props.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={['m-0 text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
          {props.label}
        </p>
        <CardInlineTextEditor
          value={props.value}
          ariaLabel={props.label}
          placeholder={props.placeholder || `Add ${props.label.toLowerCase()}`}
          canEdit={props.canEdit}
          multiline
          rows={3}
          onCommit={props.onCommit}
          displayClassName={['m-0 mt-1 text-xs leading-5', UI_THEME_TOKENS.text.secondary].join(' ')}
          editorClassName="mt-1 min-h-[4.5rem] px-0 py-0 text-xs leading-5"
        />
      </div>
    </div>
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
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ImageIcon className={['h-3.5 w-3.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')} aria-hidden="true" />
          <span className={['text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
            Reference Pack
          </span>
        </div>
        <span className={['inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {props.references.length}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
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
                <img src={reference.url} alt="Reference" className="h-full w-full object-cover" loading="lazy" draggable={false} />
              </a>
            )
          }
          return (
            <a
              key={key}
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              className={['inline-flex h-14 min-w-14 max-w-[8rem] shrink-0 items-center justify-center rounded-lg border px-2 text-center text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}
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
      </div>
    </section>
  )
}

export default function StoryboardCanvas({
  active = true,
}: {
  active?: boolean
}) {
  const graphData = useActiveGraphRenderData(active)
  const { graphRevision, selectedNodeId, selectNode, updateNode, upsertUiToast, dismissUiToast } = useGraphStore(
    useShallow(s => ({
      graphRevision: s.graphDataRevision || 0,
      selectedNodeId: String(s.selectedNodeId || '').trim(),
      selectNode: s.selectNode,
      updateNode: s.updateNode,
      upsertUiToast: s.upsertUiToast,
      dismissUiToast: s.dismissUiToast,
    })),
  )
  const boardScrollRef = React.useRef<HTMLElement>(null)
  const laneScrollElementsRef = React.useRef(new Map<string, HTMLOListElement>())
  const board = React.useMemo(() => {
    return buildStoryboardBoardModel({
      graphData,
      graphRevision,
    })
  }, [graphData, graphRevision])
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
  const updateStoryboardCanonicalProperty = React.useCallback((args: {
    cardId: string
    aliasKeys: readonly string[]
    canonicalKey: string
    nextValue: string
  }) => {
    const currentProperties = currentPropertiesByCardId.get(args.cardId) || {}
    updateNode(args.cardId, {
      properties: buildGraphNodeCanonicalTextPatch({
        currentProperties,
        aliasKeys: args.aliasKeys,
        canonicalKey: args.canonicalKey,
        nextValue: args.nextValue,
      }) as never,
    })
  }, [currentPropertiesByCardId, updateNode])
  const updateStoryboardTitle = React.useCallback((cardId: string, nextValue: string) => {
    updateNode(cardId, {
      label: String(nextValue || '').trim(),
    })
  }, [updateNode])
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
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PanelsTopLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <h2 className={['m-0 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>Storyboard</h2>
            <span className={['inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
              {board.totalCards}
            </span>
          </div>
          <p className={['m-0 mt-1 text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>
            Native storyboard board derived from the active graph and shaped with the shared kanban system.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </header>

      {board.totalCards > 0 ? (
        <section ref={boardScrollRef} className="flex-1 overflow-x-auto overflow-y-hidden p-4" aria-label="Storyboard lanes">
          <div className="flex h-full min-w-fit items-start gap-4">
            {board.lanes.map(lane => (
              (() => {
                const laneDropProps = storyboardDrag.createLaneDropProps(lane.id)
                return (
              <section
                key={lane.id}
                className={[
                  'flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border shadow-sm',
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
                  <div className="min-w-0">
                    <h3 className={['m-0 text-sm font-medium truncate', UI_THEME_TOKENS.text.primary].join(' ')} title={readMarkdownSigilDisplayText(lane.label)}>
                      {renderMarkdownSigilInlineText(lane.label)}
                    </h3>
                    <p className={['m-0 mt-1 text-[11px]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                      {lane.cards.length} storyboard cards
                    </p>
                  </div>
                  <span className={['inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
                    {lane.cards.length}
                  </span>
                </header>

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
                    const cardParagraphEntries = buildCardParagraphEntries([
                      { id: 'summary', label: 'Summary', value: card.summary },
                      { id: 'action', label: 'Action', value: card.action },
                      { id: 'dialogue', label: 'Dialogue', value: card.dialogue },
                    ])
                    const summaryEntry = cardParagraphEntries.find(entry => entry.id === 'summary') || null
                    const cardDragProps = storyboardDrag.createCardDragProps({ rowId: card.id, groupKey: lane.id })
                    const cardDragVisualState = getKanbanCardDragVisualState({
                      hasActiveDrag: storyboardDrag.draggingRowId !== null,
                      isDragging: storyboardDrag.draggingRowId === card.id,
                      isDropTarget: storyboardDrag.dragOverRowId === card.id,
                      isCommitFlash: storyboardDrag.commitFlashRowId === card.id,
                    })
                    return (
                      <li key={card.id} className="list-none">
                        <article
                          className={[
                            'group overflow-hidden rounded-2xl border bg-white shadow-sm transition-transform duration-150 select-none',
                            UI_THEME_TOKENS.kanban.cardHoverBg,
                            selected ? 'border-black/30 ring-1 ring-black/10' : UI_THEME_TOKENS.panel.border,
                            cardDragVisualState.className,
                            'hover:-translate-y-[1px]',
                          ].join(' ')}
                          style={cardDragVisualState.style}
                          ref={element => {
                            storyboardDrag.registerFocusableRowElement({
                              rowId: card.id,
                              element,
                            })
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
                          <div className="block w-full cursor-pointer text-left">
                            <div
                              data-kg-kanban-card-drag-region="1"
                              className="border-b border-black/5 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex items-center gap-2">
                                    <span className="inline-flex min-w-[2rem] items-center justify-center rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-[10px] font-semibold text-black/70">
                                      {displayIndex}
                                    </span>
                                    <DataViewTagChip value={card.typeLabel} />
                                    <DataViewStatusChip value={card.lane} checked={selected} hideIcon />
                                  </div>
                                  <CardInlineTextEditor
                                    value={card.title}
                                    ariaLabel={`Storyboard title for ${card.id}`}
                                    placeholder="Add title"
                                    canEdit={typeof updateNode === 'function'}
                                    onCommit={nextValue => {
                                      updateStoryboardTitle(card.id, nextValue)
                                    }}
                                    displayClassName={['m-0 truncate text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}
                                    editorClassName="min-h-[1.5rem] px-0 py-0 text-sm font-semibold leading-5"
                                  />
                                  {card.slugline ? (
                                    <p className={['m-0 mt-1 text-[11px] uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                      {renderMarkdownSigilInlineText(card.slugline)}
                                    </p>
                                  ) : null}
                                </div>
                                {displayMedia?.kind === 'video' ? (
                                  <Video className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                                ) : displayMedia ? (
                                  <ImageIcon className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                                ) : null}
                              </div>
                            </div>

                            <div
                              data-kg-kanban-card-drag-region="1"
                              className={['aspect-[16/9] overflow-hidden border-b border-black/5 cursor-grab active:cursor-grabbing select-none', selected ? 'bg-black/10' : 'bg-black/5'].join(' ')}
                            >
                              <StoryboardMediaPreview title={displayTitle} href={card.href} media={displayMedia} />
                            </div>

                            <div
                              data-kg-kanban-card-drag-region="1"
                              className="space-y-3 px-3 py-3 cursor-grab active:cursor-grabbing select-none"
                            >
                              {summaryEntry || typeof updateNode === 'function' ? (
                                <div>
                                  <p className={['m-0 text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                    {summaryEntry?.label || 'Summary'}
                                  </p>
                                  <CardInlineTextEditor
                                    value={summaryEntry?.value || ''}
                                    ariaLabel={`Summary for ${card.id}`}
                                    placeholder="Add summary"
                                    canEdit={typeof updateNode === 'function'}
                                    multiline
                                    rows={3}
                                    onCommit={nextValue => {
                                      updateStoryboardCanonicalProperty({
                                        cardId: card.id,
                                        aliasKeys: STORYBOARD_SUMMARY_PROPERTY_KEYS,
                                        canonicalKey: 'summary',
                                        nextValue,
                                      })
                                    }}
                                    displayClassName={['m-0 mt-1 text-xs leading-5', UI_THEME_TOKENS.text.secondary].join(' ')}
                                    editorClassName="mt-1 min-h-[4.5rem] px-0 py-0 text-xs leading-5"
                                  />
                                </div>
                              ) : null}

                              <StoryboardDetailRow
                                icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
                                label="Action"
                                value={card.action}
                                canEdit={typeof updateNode === 'function'}
                                onCommit={nextValue => {
                                  updateStoryboardCanonicalProperty({
                                    cardId: card.id,
                                    aliasKeys: STORYBOARD_ACTION_PROPERTY_KEYS,
                                    canonicalKey: 'action',
                                    nextValue,
                                  })
                                }}
                              />
                              <StoryboardDetailRow
                                icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />}
                                label="Dialogue"
                                value={card.dialogue}
                                canEdit={typeof updateNode === 'function'}
                                onCommit={nextValue => {
                                  updateStoryboardCanonicalProperty({
                                    cardId: card.id,
                                    aliasKeys: STORYBOARD_DIALOGUE_PROPERTY_KEYS,
                                    canonicalKey: 'dialogue',
                                    nextValue,
                                  })
                                }}
                              />

                              {card.prompt || card.style || card.references.length > 0 ? (
                                <section className="rounded-xl border border-black/5 bg-black/[0.025] p-2.5" aria-label="Visual brief">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className={['h-3.5 w-3.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')} aria-hidden="true" />
                                      <span className={['text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                        Visual Brief
                                      </span>
                                    </div>
                                    {card.style ? <DataViewTagChip value={card.style} /> : null}
                                  </div>
                                  {card.prompt ? (
                                    <CardInlineTextEditor
                                      value={card.prompt}
                                      ariaLabel={`Visual brief for ${card.id}`}
                                      placeholder="Add visual brief"
                                      canEdit={typeof updateNode === 'function'}
                                      multiline
                                      rows={3}
                                      onCommit={nextValue => {
                                        updateStoryboardCanonicalProperty({
                                          cardId: card.id,
                                          aliasKeys: STORYBOARD_PROMPT_PROPERTY_KEYS,
                                          canonicalKey: 'prompt',
                                          nextValue,
                                        })
                                      }}
                                      displayClassName={['m-0 mt-2 text-xs leading-5', UI_THEME_TOKENS.text.secondary].join(' ')}
                                      editorClassName="mt-2 min-h-[4.5rem] px-0 py-0 text-xs leading-5"
                                    />
                                  ) : null}
                                  <div className="mt-2 flex items-center gap-2">
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
                                  </div>
                                </section>
                              ) : null}

                              <StoryboardReferenceStrip cardId={card.id} references={card.references} />

                              {card.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {card.tags.slice(0, 4).map(tag => (
                                    <DataViewTagChip key={`${card.id}:tag:${tag}`} value={tag} />
                                  ))}
                                </div>
                              ) : null}

                              {card.meta.length > 0 ? (
                                <div className={['flex flex-wrap gap-1 text-[11px]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                  {card.meta.map(item => (
                                    <span key={`${card.id}:meta:${item}`} className={['rounded px-2 py-1', UI_THEME_TOKENS.badge.chip].join(' ')}>
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              ) : null}

                              {card.href ? (
                                <div className="flex items-center justify-end">
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
                                </div>
                              ) : null}
                            </div>
                          </div>
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
          </div>
        </section>
      ) : (
        <section className="flex flex-1 items-center justify-center p-6" aria-label="Storyboard empty state">
          <div className="max-w-md text-center">
            <PanelsTopLeft className="mx-auto h-8 w-8" aria-hidden="true" />
            <h3 className={['mb-2 mt-3 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>No storyboard cards yet</h3>
            <p className={['m-0 text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>
              Add scene-like nodes, stage fields, summaries, script beats, prompts, or media references to project the active graph into storyboard lanes.
            </p>
          </div>
        </section>
      )}
    </section>
  )
}
