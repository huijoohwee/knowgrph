import React from 'react'

import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { readStoryboardCardCenter2d, type StoryboardCardPlacement } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { shouldFreezeProjectionForFlowPortHandleDrag } from '@/components/StoryboardWidget/flowPortHandlePointerDrag'
import { emitStoryboardWidgetInteractionFrame } from '@/lib/canvas/storyboard-widget-overlay-proxy'
import { applyVectorPaintedOverlayBox, projectVectorPaintedOverlayZoomBox, type VectorPaintedOverlayScaleProjectionBase } from '@/lib/canvas/vectorPaintedOverlayProjection'
import type { GraphNode } from '@/lib/graph/types'
import { computeStoryboardWidgetOverlayScreenBox, type StoryboardWidgetOverlayDragTransform } from '@/lib/storyboardWidget/overlayWorldDrag'
import { readFlowWidgetPinnedInCanvas, type FlowWidgetPinnedById } from '@/lib/storyboardWidget/flowWidgetPinnedState'

type ProjectedCardBox = { left: number; top: number; scale: number }
type AppliedCardBox = ProjectedCardBox & { display: string }

const isScreenBoxVisible = (
  box: ProjectedCardBox,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): boolean => {
  const width = Math.max(1, size.width) * Math.max(0.001, box.scale)
  const height = Math.max(1, size.height) * Math.max(0.001, box.scale)
  return width > 0 && height > 0 && box.left + width > 0 && box.top + height > 0 && box.left < viewport.width && box.top < viewport.height
}

export function useStoryboardCardOverlayProjection2d(args: {
  active: boolean
  cards: ReadonlyArray<StoryboardCardModel>
  dragWorldOverrideByCardIdRef: React.RefObject<Map<string, StoryboardCardPlacement>>
  effectiveFlowWidgetPinnedByNodeId: FlowWidgetPinnedById | null | undefined
  fixedCardPlacements: ReadonlyMap<string, StoryboardCardPlacement>
  fixedCardReferencePlacements: ReadonlyMap<string, StoryboardCardPlacement>
  fixedLayoutEnabled: boolean
  getTransform: () => StoryboardWidgetOverlayDragTransform | null
  graphRevision: number
  markdownDocumentName: string | null
  nodeById: ReadonlyMap<string, GraphNode>
  overlayElsRef: React.RefObject<Map<string, HTMLElement>>
  readCardSize: (node: GraphNode) => { width: number; height: number }
  requestZoom: (action: 'fit', options: { intent: 'fitToView' }) => void
  rootRef: React.RefObject<HTMLElement | null>
  storyboardWidgetSurfaceId: string
}) {
  const {
    active,
    cards,
    dragWorldOverrideByCardIdRef,
    effectiveFlowWidgetPinnedByNodeId,
    fixedCardPlacements,
    fixedCardReferencePlacements,
    fixedLayoutEnabled,
    getTransform,
    graphRevision,
    markdownDocumentName,
    nodeById,
    overlayElsRef,
    readCardSize,
    requestZoom,
    rootRef,
    storyboardWidgetSurfaceId,
  } = args
  const zoomLayoutBaseBoxByCardIdRef = React.useRef<Map<string, VectorPaintedOverlayScaleProjectionBase>>(new Map())
  const lastOverlayTransformRef = React.useRef<StoryboardWidgetOverlayDragTransform | null>(null)
  const lastPinnedByCardIdRef = React.useRef<Map<string, boolean>>(new Map())
  const lastAppliedBoxByCardIdRef = React.useRef<Map<string, AppliedCardBox>>(new Map())
  const initialFitCommitKeyRef = React.useRef('')

  const clearCardProjection = React.useCallback((cardId: string) => {
    lastAppliedBoxByCardIdRef.current.delete(cardId)
    lastPinnedByCardIdRef.current.delete(cardId)
    zoomLayoutBaseBoxByCardIdRef.current.delete(cardId)
  }, [])

  React.useEffect(() => {
    if (!active || cards.length === 0) return
    let frame = 0
    const update = () => {
      const currentTransform = getTransform()
      if (fixedLayoutEnabled && shouldFreezeProjectionForFlowPortHandleDrag()) {
        frame = window.requestAnimationFrame(update)
        return
      }
      const transformScale = currentTransform && Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1
      const paintScale = fixedLayoutEnabled ? 1 : transformScale
      const previousTransform = lastOverlayTransformRef.current
      const devicePixelRatio = Number.isFinite(window.devicePixelRatio) ? Math.max(1, window.devicePixelRatio) : 1
      const viewportRect = rootRef.current?.getBoundingClientRect() || null
      const viewport = { width: Math.max(1, Math.floor(viewportRect?.width || 1)), height: Math.max(1, Math.floor(viewportRect?.height || 1)) }
      let visibleCardCount = 0
      let rawCenterXSum = 0
      let rawCenterYSum = 0
      let rawCenterCount = 0
      const pending: Array<{ rawBox: ProjectedCardBox; card: StoryboardCardModel; el: HTMLElement; width: number; height: number }> = []
      const readProjectedBox = (cardId: string, rawBox: ProjectedCardBox, width: number, height: number, anchorX: number, anchorY: number) => {
        const previous = lastAppliedBoxByCardIdRef.current.get(cardId) || null
        if (fixedLayoutEnabled && previous) {
          return { left: previous.left, top: previous.top, scale: previous.scale }
        }
        const projected = projectVectorPaintedOverlayZoomBox({
          previousBox: previous,
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
      for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index]!
        const node = nodeById.get(card.id)
        const element = overlayElsRef.current.get(card.id)
        if (!node || !element) continue
        const cardPinned = fixedLayoutEnabled ? readFlowWidgetPinnedInCanvas(effectiveFlowWidgetPinnedByNodeId, card.id) : true
        const referencePlacement = fixedCardReferencePlacements.get(card.id)
        const previousPinned = lastPinnedByCardIdRef.current.get(card.id)
        if (fixedLayoutEnabled && previousPinned === true && cardPinned === false && referencePlacement && !dragWorldOverrideByCardIdRef.current.has(card.id)) {
          dragWorldOverrideByCardIdRef.current.set(card.id, referencePlacement)
        }
        lastPinnedByCardIdRef.current.set(card.id, cardPinned)
        const fixedPlacement = fixedLayoutEnabled && cardPinned ? referencePlacement || fixedCardPlacements.get(card.id) : null
        const nodeCenter = dragWorldOverrideByCardIdRef.current.get(card.id)
          || (fixedLayoutEnabled ? readStoryboardCardCenter2d(node) || referencePlacement : referencePlacement || readStoryboardCardCenter2d(node))
          || null
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
        pending.push({ rawBox, card, el: element, width, height })
      }
      const projectionAnchorX = rawCenterCount > 0 ? rawCenterXSum / rawCenterCount : viewport.width / 2
      const projectionAnchorY = rawCenterCount > 0 ? rawCenterYSum / rawCenterCount : viewport.height / 2
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index]!
        const box = readProjectedBox(item.card.id, item.rawBox, item.width, item.height, projectionAnchorX, projectionAnchorY)
        if (isScreenBoxVisible(box, { width: item.width, height: item.height }, viewport)) visibleCardCount += 1
        const display = box.scale <= 0.02 ? 'none' : ''
        const previousBox = lastAppliedBoxByCardIdRef.current.get(item.card.id) || null
        const boxChanged = !previousBox
          || Math.abs(previousBox.left - box.left) >= 0.25
          || Math.abs(previousBox.top - box.top) >= 0.25
          || Math.abs(previousBox.scale - box.scale) >= 0.0005
          || previousBox.display !== display
        if (!boxChanged) continue
        applyVectorPaintedOverlayBox(item.el, { left: box.left, top: box.top, scale: box.scale, display })
        lastAppliedBoxByCardIdRef.current.set(item.card.id, { left: box.left, top: box.top, scale: box.scale, display })
        emitStoryboardWidgetInteractionFrame()
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
  }, [
    active,
    cards,
    dragWorldOverrideByCardIdRef,
    effectiveFlowWidgetPinnedByNodeId,
    fixedCardPlacements,
    fixedCardReferencePlacements,
    fixedLayoutEnabled,
    getTransform,
    graphRevision,
    markdownDocumentName,
    nodeById,
    overlayElsRef,
    readCardSize,
    requestZoom,
    rootRef,
    storyboardWidgetSurfaceId,
  ])

  return { clearCardProjection }
}
