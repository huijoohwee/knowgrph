import React from 'react'

import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { readStoryboardCardCenter2d, type StoryboardCardPlacement } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { shouldFreezeProjectionForFlowPortHandleDrag } from '@/components/StoryboardWidget/flowPortHandlePointerDrag'
import { emitStoryboardWidgetGeometryCommitted } from '@/lib/canvas/storyboard-widget-overlay-proxy'
import { applyVectorPaintedOverlayBox, projectVectorPaintedOverlayZoomBox, type VectorPaintedOverlayScaleProjectionBase } from '@/lib/canvas/vectorPaintedOverlayProjection'
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
  const storyboardCardZoomBaselineKRef = React.useRef<number | null>(null)
  const lastOverlayTransformRef = React.useRef<StoryboardWidgetOverlayDragTransform | null>(null)
  const lastPinnedByCardIdRef = React.useRef<Map<string, boolean>>(new Map())
  const lastAppliedBoxByCardIdRef = React.useRef<Map<string, AppliedCardBox>>(new Map())
  const collectiveLayoutCacheRef = React.useRef<{
    key: string
    byId: Map<string, { left: number; top: number }>
  }>({ key: '', byId: new Map() })

  const clearCardProjection = React.useCallback((cardId: string) => {
    lastAppliedBoxByCardIdRef.current.delete(cardId)
    lastPinnedByCardIdRef.current.delete(cardId)
    zoomLayoutBaseBoxByCardIdRef.current.delete(cardId)
  }, [])

  React.useEffect(() => {
    if (!active) storyboardCardZoomBaselineKRef.current = null
  }, [active])

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
            return {
              id: `rich-media:${String(el.dataset.kgRichMediaOverlayId || el.dataset.kgWidget || el.dataset.nodeId || '').trim()}`,
              left: rect.left - (viewportRect?.left || 0),
              top: rect.top - (viewportRect?.top || 0),
              width: rect.width,
              height: rect.height,
            }
          })
          .filter(item => item.id !== 'rich-media:' && item.width > 0 && item.height > 0)
        const layoutInputKey = [
          `${viewport.width}x${viewport.height}`,
          ...layoutItems.map(item => `${item.id}:${Math.round(item.left)},${Math.round(item.top)},${Math.round(item.width)}x${Math.round(item.height)}`),
          ...richMediaObstacles.map(item => `${item.id}:${Math.round(item.left)},${Math.round(item.top)},${Math.round(item.width)}x${Math.round(item.height)}`),
        ].join('|')
        let relaxedById = collectiveLayoutCacheRef.current.key === layoutInputKey
          ? collectiveLayoutCacheRef.current.byId
          : null
        if (!relaxedById) {
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
          relaxedById = new Map(relaxed.map(item => [item.id, { left: item.left, top: item.top }]))
          collectiveLayoutCacheRef.current = { key: layoutInputKey, byId: relaxedById }
        }
        for (let i = 0; i < pending.length; i += 1) {
          const item = pending[i]!
          const next = relaxedById.get(item.card.id)
          if (!next) continue
          item.rawBox = { ...item.rawBox, left: next.left, top: next.top }
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
      const finalGapPx = 28
      const finalSurfaceId = String(pending[0]?.el.dataset.kgStoryboardWidgetSurface || '').trim()
      const finalRichMediaObstacles = fixedLayoutEnabled
        ? Array.from(document.querySelectorAll<HTMLElement>('[data-kg-rich-media-overlay="1"]'))
            .filter(el => !finalSurfaceId || String(el.dataset.kgStoryboardWidgetSurface || '').trim() === finalSurfaceId)
            .map(el => {
              const rect = el.getBoundingClientRect()
              return { left: rect.left - (viewportRect?.left || 0), top: rect.top - (viewportRect?.top || 0), width: rect.width, height: rect.height }
            })
            .filter(item => item.width > 0 && item.height > 0)
        : []
      const finalSettledCardBoxes: Array<{ left: number; top: number; width: number; height: number }> = []
      const finalRectsOverlap = (
        left: { left: number; top: number; width: number; height: number },
        right: { left: number; top: number; width: number; height: number },
      ) => left.left < right.left + right.width + finalGapPx
        && right.left < left.left + left.width + finalGapPx
        && left.top < right.top + right.height + finalGapPx
        && right.top < left.top + left.height + finalGapPx
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index]!
        let box = readProjectedBox(item.card.id, item.rawBox, item.width, item.height, projectionAnchorX, projectionAnchorY)
        if (fixedLayoutEnabled) {
          const previouslyApplied = lastAppliedBoxByCardIdRef.current.get(item.card.id) || null
          const currentDomRect = item.el.getBoundingClientRect()
          const projectionOffsetLeft = previouslyApplied
            ? currentDomRect.left - (viewportRect?.left || 0) - previouslyApplied.left
            : 0
          const projectionOffsetTop = previouslyApplied
            ? currentDomRect.top - (viewportRect?.top || 0) - previouslyApplied.top
            : 0
          const projectedRect = {
            left: box.left + projectionOffsetLeft,
            top: box.top + projectionOffsetTop,
            width: item.width * box.scale,
            height: item.height * box.scale,
          }
          const blockers = [...finalRichMediaObstacles, ...finalSettledCardBoxes]
          if (blockers.some(blocker => finalRectsOverlap(projectedRect, blocker))) {
            const xCandidates = new Set<number>([projectedRect.left])
            const yCandidates = new Set<number>([projectedRect.top])
            for (let blockerIndex = 0; blockerIndex < blockers.length; blockerIndex += 1) {
              const blocker = blockers[blockerIndex]!
              xCandidates.add(blocker.left - projectedRect.width - finalGapPx)
              xCandidates.add(blocker.left + blocker.width + finalGapPx)
              yCandidates.add(blocker.top - projectedRect.height - finalGapPx)
              yCandidates.add(blocker.top + blocker.height + finalGapPx)
            }
            const open = Array.from(xCandidates)
              .flatMap(left => Array.from(yCandidates).map(top => ({ left, top })))
              .filter(candidate => !blockers.some(blocker => finalRectsOverlap({ ...projectedRect, ...candidate }, blocker)))
              .sort((left, right) => {
                const leftScore = Math.abs(left.left - projectedRect.left) + Math.abs(left.top - projectedRect.top)
                const rightScore = Math.abs(right.left - projectedRect.left) + Math.abs(right.top - projectedRect.top)
                if (leftScore !== rightScore) return leftScore - rightScore
                if (left.top !== right.top) return left.top - right.top
                return left.left - right.left
              })[0]
            if (open) box = {
              ...box,
              left: open.left - projectionOffsetLeft,
              top: open.top - projectionOffsetTop,
            }
          }
          finalSettledCardBoxes.push({
            left: box.left + projectionOffsetLeft,
            top: box.top + projectionOffsetTop,
            width: item.width * box.scale,
            height: item.height * box.scale,
          })
        }
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
