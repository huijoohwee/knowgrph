import React from 'react'

import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { readStoryboardCardCenter2d, type StoryboardCardPlacement } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { shouldFreezeProjectionForFlowPortHandleDrag } from '@/components/StoryboardWidget/flowPortHandlePointerDrag'
import { emitStoryboardWidgetGeometryCommitted } from '@/lib/canvas/storyboard-widget-overlay-proxy'
import { applyVectorPaintedOverlayBox, projectVectorPaintedOverlayZoomBox, type VectorPaintedOverlayScaleProjectionBase } from '@/lib/canvas/vectorPaintedOverlayProjection'
import type { GraphNode } from '@/lib/graph/types'
import { computeStoryboardWidgetOverlayScreenBox, type StoryboardWidgetOverlayDragTransform } from '@/lib/storyboardWidget/overlayWorldDrag'
import { readFlowWidgetPinnedInCanvas, type FlowWidgetPinnedById } from '@/lib/storyboardWidget/flowWidgetPinnedState'
import { screenToWorld } from '@/lib/zoom/viewport'

type ProjectedCardBox = { left: number; top: number; scale: number }
type AppliedCardBox = ProjectedCardBox & { display: string }

export function useStoryboardCardOverlayProjection2d(args: {
  active: boolean
  cards: ReadonlyArray<StoryboardCardModel>
  dragWorldOverrideByCardIdRef: React.RefObject<Map<string, StoryboardCardPlacement>>
  effectiveFlowWidgetPinnedByNodeId: FlowWidgetPinnedById | null | undefined
  fixedCardReferencePlacements: ReadonlyMap<string, StoryboardCardPlacement>
  fixedLayoutEnabled: boolean
  getTransform: () => StoryboardWidgetOverlayDragTransform | null
  graphRevision: number
  nodeById: ReadonlyMap<string, GraphNode>
  overlayElsRef: React.RefObject<Map<string, HTMLElement>>
  readCardSize: (node: GraphNode) => { width: number; height: number }
  rootRef: React.RefObject<HTMLElement | null>
}) {
  const {
    active,
    cards,
    dragWorldOverrideByCardIdRef,
    effectiveFlowWidgetPinnedByNodeId,
    fixedCardReferencePlacements,
    fixedLayoutEnabled,
    getTransform,
    graphRevision,
    nodeById,
    overlayElsRef,
    readCardSize,
    rootRef,
  } = args
  const zoomLayoutBaseBoxByCardIdRef = React.useRef<Map<string, VectorPaintedOverlayScaleProjectionBase>>(new Map())
  const lastOverlayTransformRef = React.useRef<StoryboardWidgetOverlayDragTransform | null>(null)
  const lastPinnedByCardIdRef = React.useRef<Map<string, boolean>>(new Map())
  const lastAppliedBoxByCardIdRef = React.useRef<Map<string, AppliedCardBox>>(new Map())

  const clearCardProjection = React.useCallback((cardId: string) => {
    lastAppliedBoxByCardIdRef.current.delete(cardId)
    lastPinnedByCardIdRef.current.delete(cardId)
    zoomLayoutBaseBoxByCardIdRef.current.delete(cardId)
  }, [])

  React.useEffect(() => {
    if (!active || cards.length === 0) return
    let frame = 0
    let initialTimer = 0
    const update = () => {
      const currentTransform = getTransform()
      if (fixedLayoutEnabled && shouldFreezeProjectionForFlowPortHandleDrag()) {
        frame = window.requestAnimationFrame(update)
        return
      }
      const transformScale = currentTransform && Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1
      const paintScale = transformScale
      const previousTransform = lastOverlayTransformRef.current
      const devicePixelRatio = Number.isFinite(window.devicePixelRatio) ? Math.max(1, window.devicePixelRatio) : 1
      const viewportRect = rootRef.current?.getBoundingClientRect() || null
      const viewport = { width: Math.max(1, Math.floor(viewportRect?.width || 1)), height: Math.max(1, Math.floor(viewportRect?.height || 1)) }
      let rawCenterXSum = 0
      let rawCenterYSum = 0
      let rawCenterCount = 0
      const pending: Array<{ rawBox: ProjectedCardBox; card: StoryboardCardModel; el: HTMLElement; width: number; height: number }> = []
      const readProjectedBox = (cardId: string, rawBox: ProjectedCardBox, width: number, height: number, anchorX: number, anchorY: number) => {
        if (dragWorldOverrideByCardIdRef.current.has(cardId)) {
          zoomLayoutBaseBoxByCardIdRef.current.set(cardId, { left: rawBox.left, top: rawBox.top, scale: rawBox.scale, layoutScale: rawBox.scale })
          return rawBox
        }
        const previous = lastAppliedBoxByCardIdRef.current.get(cardId) || null
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
        lastPinnedByCardIdRef.current.set(card.id, cardPinned)
        const fixedPlacement = fixedLayoutEnabled && cardPinned ? referencePlacement : null
        const { width, height } = readCardSize(node)
        if (fixedLayoutEnabled && previousPinned === true && cardPinned === false && !dragWorldOverrideByCardIdRef.current.has(card.id)) {
          const liveBox = lastAppliedBoxByCardIdRef.current.get(card.id) || null
          const sx = liveBox ? liveBox.left + width * liveBox.scale / 2 : null
          const sy = liveBox ? liveBox.top + height * liveBox.scale / 2 : null
          if (sx != null && sy != null) {
            dragWorldOverrideByCardIdRef.current.set(card.id, screenToWorld({ transform: currentTransform, sx, sy }))
          } else if (referencePlacement) {
            dragWorldOverrideByCardIdRef.current.set(card.id, referencePlacement)
          }
        }
        const nodeCenter = dragWorldOverrideByCardIdRef.current.get(card.id)
          || (fixedLayoutEnabled ? readStoryboardCardCenter2d(node) || referencePlacement : referencePlacement || readStoryboardCardCenter2d(node))
          || null
        const x = fixedPlacement?.x ?? nodeCenter?.x ?? 0
        const y = fixedPlacement?.y ?? nodeCenter?.y ?? 0
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
        emitStoryboardWidgetGeometryCommitted()
      }
      lastOverlayTransformRef.current = currentTransform ? { k: currentTransform.k, x: currentTransform.x, y: currentTransform.y } : null
      frame = window.requestAnimationFrame(update)
    }
    initialTimer = window.setTimeout(() => {
      initialTimer = 0
      update()
    }, 0)
    return () => {
      if (initialTimer) window.clearTimeout(initialTimer)
      window.cancelAnimationFrame(frame)
    }
  }, [
    active,
    cards,
    dragWorldOverrideByCardIdRef,
    effectiveFlowWidgetPinnedByNodeId,
    fixedCardReferencePlacements,
    fixedLayoutEnabled,
    getTransform,
    graphRevision,
    nodeById,
    overlayElsRef,
    readCardSize,
    rootRef,
  ])

  return { clearCardProjection }
}
