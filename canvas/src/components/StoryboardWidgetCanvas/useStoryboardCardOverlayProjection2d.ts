import React from 'react'

import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { readStoryboardCardCenter2d, type StoryboardCardPlacement } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { shouldFreezeProjectionForFlowPortHandleDrag } from '@/components/StoryboardWidget/flowPortHandlePointerDrag'
import { emitStoryboardWidgetGeometryCommitted } from '@/lib/canvas/storyboard-widget-overlay-proxy'
import { applyVectorPaintedOverlayBox, projectVectorPaintedOverlayZoomBox, readVectorPaintedOverlayScale, type VectorPaintedOverlayScaleProjectionBase } from '@/lib/canvas/vectorPaintedOverlayProjection'
import { computeCollectiveFollowScaleFromBaseline } from '@/lib/canvas/overlayWidgetZoom'
import type { GraphNode } from '@/lib/graph/types'
import { computeStoryboardWidgetOverlayScreenBox, type StoryboardWidgetOverlayDragTransform } from '@/lib/storyboardWidget/overlayWorldDrag'
import { readFlowWidgetPinnedInCanvas, type FlowWidgetPinnedById } from '@/lib/storyboardWidget/flowWidgetPinnedState'
import { screenToWorld } from '@/lib/zoom/viewport'
import { defaultSchema } from '@/lib/graph/schema'
import { relaxOverlayPanelsWithCollision } from '@/lib/ui/relaxOverlayPanelsWithCollision'
import { computeOverlayMaxAnchorShiftPx } from '@/lib/ui/overlayAnchorShift'
import { COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9 } from '@/lib/ui/overlayScaleLimits'

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
  registerInteractionFrameProjectionScheduler?: (scheduler: null | (() => void)) => void
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
    registerInteractionFrameProjectionScheduler,
    rootRef,
  } = args
  const zoomLayoutBaseBoxByCardIdRef = React.useRef<Map<string, VectorPaintedOverlayScaleProjectionBase>>(new Map())
  const storyboardCardZoomBaselineKRef = React.useRef<number | null>(null)
  const lastOverlayTransformRef = React.useRef<StoryboardWidgetOverlayDragTransform | null>(null)
  const lastPinnedByCardIdRef = React.useRef<Map<string, boolean>>(new Map())
  const lastAppliedBoxByCardIdRef = React.useRef<Map<string, AppliedCardBox>>(new Map())
  const settledWorldByCardIdRef = React.useRef<{
    key: string
    worldById: Map<string, StoryboardCardPlacement>
  }>({ key: '', worldById: new Map() })

  const clearCardProjection = React.useCallback((cardId: string) => {
    lastAppliedBoxByCardIdRef.current.delete(cardId)
    lastPinnedByCardIdRef.current.delete(cardId)
    zoomLayoutBaseBoxByCardIdRef.current.delete(cardId)
    settledWorldByCardIdRef.current.worldById.delete(cardId)
  }, [])

  React.useEffect(() => {
    if (!active) storyboardCardZoomBaselineKRef.current = null
  }, [active])

  React.useEffect(() => {
    settledWorldByCardIdRef.current = { key: '', worldById: new Map() }
  }, [cards, fixedCardReferencePlacements, graphRevision])

  React.useEffect(() => {
    if (!active || cards.length === 0) return
    let frame = 0
    let initialTimer = 0
    const applyProjection = () => {
      const currentTransform = getTransform()
      if (fixedLayoutEnabled && shouldFreezeProjectionForFlowPortHandleDrag()) {
        return
      }
      const transformScale = currentTransform && Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1
      if (
        storyboardCardZoomBaselineKRef.current == null
        || !Number.isFinite(storyboardCardZoomBaselineKRef.current)
        || storyboardCardZoomBaselineKRef.current <= 0
      ) {
        storyboardCardZoomBaselineKRef.current = transformScale
      }
      const previousTransform = lastOverlayTransformRef.current
      const devicePixelRatio = Number.isFinite(window.devicePixelRatio) ? Math.max(1, window.devicePixelRatio) : 1
      const viewportRect = rootRef.current?.getBoundingClientRect() || null
      const viewport = { width: Math.max(1, Math.floor(viewportRect?.width || 1)), height: Math.max(1, Math.floor(viewportRect?.height || 1)) }
      let rawCenterXSum = 0
      let rawCenterYSum = 0
      let rawCenterCount = 0
      const pending: Array<{ rawBox: ProjectedCardBox; card: StoryboardCardModel; el: HTMLElement; width: number; height: number }> = []
      const readProjectedBox = (cardId: string, rawBox: ProjectedCardBox, width: number, height: number, anchorX: number, anchorY: number) => {
        if (fixedLayoutEnabled) return rawBox
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
        const dragPlacement = dragWorldOverrideByCardIdRef.current.get(card.id) || null
        const settledPlacement = fixedLayoutEnabled ? settledWorldByCardIdRef.current.worldById.get(card.id) || null : null
        const previousPinned = lastPinnedByCardIdRef.current.get(card.id)
        lastPinnedByCardIdRef.current.set(card.id, cardPinned)
        const fixedPlacement = fixedLayoutEnabled && cardPinned ? referencePlacement : null
        const { width, height } = readCardSize(node)
        const paintScale = fixedLayoutEnabled
          ? computeCollectiveFollowScaleFromBaseline({
              zoomK: transformScale,
              baselineZoomK: storyboardCardZoomBaselineKRef.current,
              viewportW: viewport.width,
              viewportH: viewport.height,
              count: cards.length,
              baseWidth: width,
              baseHeight: height,
              hardMinScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.richMedia.min,
              hardMaxScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.richMedia.max,
              fitToViewport: false,
            })
          : transformScale
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
        const nodeCenter = fixedLayoutEnabled ? readStoryboardCardCenter2d(node) || referencePlacement : referencePlacement || readStoryboardCardCenter2d(node)
        const projectedCenter = dragPlacement || settledPlacement || fixedPlacement || nodeCenter || null
        const x = projectedCenter?.x ?? 0
        const y = projectedCenter?.y ?? 0
        const rawBox = computeStoryboardWidgetOverlayScreenBox({
          transform: currentTransform,
          centerWorld: { x, y },
          devicePixelRatio,
          paintScale,
          snapToDevicePixels: true,
          width,
          height,
        })
        pending.push({ rawBox, card, el: element, width, height })
      }
      if (fixedLayoutEnabled && pending.length > 0) {
        const gapPx = 28
        let layoutItems = pending.map(item => ({
          id: item.card.id,
          left: item.rawBox.left,
          top: item.rawBox.top,
          width: item.width * item.rawBox.scale,
          height: item.height * item.rawBox.scale,
          movable: true,
        }))
        const surfaceId = String(pending[0]?.el.dataset.kgStoryboardWidgetSurface || '').trim()
        const richMediaObstacles = Array.from(document.querySelectorAll<HTMLElement>('[data-kg-rich-media-overlay="1"]'))
          .filter(el => !surfaceId || String(el.dataset.kgStoryboardWidgetSurface || '').trim() === surfaceId)
          .map(el => {
            const rect = el.getBoundingClientRect()
            const scale = readVectorPaintedOverlayScale(el)
            return {
              id: `rich-media:${String(el.dataset.kgRichMediaOverlayId || el.dataset.kgWidget || el.dataset.nodeId || '').trim()}`,
              left: rect.left - (viewportRect?.left || 0),
              top: rect.top - (viewportRect?.top || 0),
              width: rect.width,
              height: rect.height,
              baseWidth: rect.width / scale,
              baseHeight: rect.height / scale,
            }
          })
          .filter(item => item.id !== 'rich-media:' && item.width > 0 && item.height > 0)
        const layoutInputKey = [
          `${viewport.width}x${viewport.height}`,
          ...pending.map(item => `${item.card.id}:${Math.round(item.width)}x${Math.round(item.height)}`),
          ...richMediaObstacles.map(item => `${item.id}:${Math.round(item.baseWidth)}x${Math.round(item.baseHeight)}`),
        ].join('|')
        const cachedWorldById = settledWorldByCardIdRef.current.key === layoutInputKey
          ? settledWorldByCardIdRef.current.worldById
          : null
        if (cachedWorldById) {
          for (let index = 0; index < pending.length; index += 1) {
            const item = pending[index]!
            if (dragWorldOverrideByCardIdRef.current.has(item.card.id)) continue
            const centerWorld = cachedWorldById.get(item.card.id)
            if (!centerWorld) continue
            item.rawBox = computeStoryboardWidgetOverlayScreenBox({
              transform: currentTransform,
              centerWorld,
              devicePixelRatio,
              paintScale: item.rawBox.scale,
              snapToDevicePixels: true,
              width: item.width,
              height: item.height,
            })
          }
        } else {
          const overlaps = (
            left: { left: number; top: number; width: number; height: number },
            right: { left: number; top: number; width: number; height: number },
          ) => left.left < right.left + right.width + gapPx
            && right.left < left.left + left.width + gapPx
            && left.top < right.top + right.height + gapPx
            && right.top < left.top + left.height + gapPx
          const hasUnresolvedOverlap = (items: typeof layoutItems) => {
            if (items.some(item => richMediaObstacles.some(obstacle => overlaps(item, obstacle)))) return true
            for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
              for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
                if (overlaps(items[leftIndex]!, items[rightIndex]!)) return true
              }
            }
            return false
          }
          let relaxed = layoutItems
          for (let pass = 0; pass < 4 && hasUnresolvedOverlap(relaxed); pass += 1) {
            const passPositions = relaxOverlayPanelsWithCollision({
              schema: defaultSchema,
              items: relaxed,
              obstacles: richMediaObstacles,
              gapPx,
              strength: 0.88,
              iterations: 16,
              steps: 18,
              anchorStrength: 0.04,
              maxAnchorShiftPx: computeOverlayMaxAnchorShiftPx(viewport.width, viewport.height),
              maxSpeedPxPerStep: 180,
            })
            const passById = new Map(passPositions.map(item => [item.id, item]))
            relaxed = relaxed.map(item => ({ ...item, ...(passById.get(item.id) || {}) }))
          }
          const exactlySettled: typeof layoutItems = []
          for (let itemIndex = 0; itemIndex < relaxed.length; itemIndex += 1) {
            const item = relaxed[itemIndex]!
            const blockers = [...richMediaObstacles, ...exactlySettled]
            if (!blockers.some(blocker => overlaps(item, blocker))) {
              exactlySettled.push(item)
              continue
            }
            const xCandidates = new Set<number>([item.left])
            const yCandidates = new Set<number>([item.top])
            for (let blockerIndex = 0; blockerIndex < blockers.length; blockerIndex += 1) {
              const blocker = blockers[blockerIndex]!
              xCandidates.add(blocker.left - item.width - gapPx)
              xCandidates.add(blocker.left + blocker.width + gapPx)
              yCandidates.add(blocker.top - item.height - gapPx)
              yCandidates.add(blocker.top + blocker.height + gapPx)
            }
            const candidates = Array.from(xCandidates).flatMap(left => Array.from(yCandidates).map(top => ({ left, top })))
              .sort((left, right) => {
                const leftScore = Math.abs(left.left - item.left) + Math.abs(left.top - item.top)
                const rightScore = Math.abs(right.left - item.left) + Math.abs(right.top - item.top)
                if (leftScore !== rightScore) return leftScore - rightScore
                if (left.top !== right.top) return left.top - right.top
                return left.left - right.left
              })
            const open = candidates.find(candidate => !blockers.some(blocker => overlaps({ ...item, ...candidate }, blocker)))
            exactlySettled.push(open ? { ...item, ...open } : item)
          }
          relaxed = exactlySettled
          const relaxedById = new Map(relaxed.map(item => [item.id, { left: item.left, top: item.top }]))
          const worldById = new Map<string, StoryboardCardPlacement>()
          for (let index = 0; index < pending.length; index += 1) {
            const item = pending[index]!
            const next = relaxedById.get(item.card.id)
            if (!next) continue
            item.rawBox = { ...item.rawBox, left: next.left, top: next.top }
            const centerWorld = screenToWorld({
              transform: currentTransform,
              sx: next.left + (item.width * item.rawBox.scale) / 2,
              sy: next.top + (item.height * item.rawBox.scale) / 2,
            })
            if (Number.isFinite(centerWorld.x) && Number.isFinite(centerWorld.y)) {
              worldById.set(item.card.id, centerWorld)
            }
          }
          settledWorldByCardIdRef.current = { key: layoutInputKey, worldById }
        }
      }
      for (let i = 0; i < pending.length; i += 1) {
        const item = pending[i]!
        rawCenterXSum += item.rawBox.left + item.width * item.rawBox.scale / 2
        rawCenterYSum += item.rawBox.top + item.height * item.rawBox.scale / 2
        rawCenterCount += 1
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
    }
    const tick = () => {
      applyProjection()
      frame = window.requestAnimationFrame(tick)
    }
    registerInteractionFrameProjectionScheduler?.(applyProjection)
    initialTimer = window.setTimeout(() => {
      initialTimer = 0
      tick()
    }, 0)
    return () => {
      registerInteractionFrameProjectionScheduler?.(null)
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
    registerInteractionFrameProjectionScheduler,
    rootRef,
  ])

  return { clearCardProjection }
}
